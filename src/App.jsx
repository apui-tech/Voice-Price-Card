import React, { useState, useEffect } from 'react';
import { 
  Mic, MicOff, Search, Plus, RefreshCw, Volume2, Sparkles, 
  Tag, Filter, CheckCircle2, Edit3, Trash2, X, AlertCircle, Key, Cpu, Clock, Undo2, Database, LogOut
} from 'lucide-react';
import { INITIAL_ITEMS, CATEGORY_MAP } from './data';
import { parseVoiceSearch, removeAccents, getStandardVietnameseName } from './voiceParser';
import { extractItemsWithLLM } from './llmService';
import { getSupabaseClient, getSupabaseConfig, resetSupabaseClient } from './supabase';
import LoginScreen from './LoginScreen';
import { 
  fetchAppConfig, parseLlmConfig, saveLlmConfig, setAdminPin, verifyPin, 
  isPinConfigured, saveSession, isSessionValid, clearSession 
} from './configService';

export default function App() {
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'unauthenticated' | 'authenticated' | 'setup'
  const [appConfig, setAppConfig] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');

  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('voice_price_items');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map(item => ({
        ...item,
        name: getStandardVietnameseName(item.name, null)
      }));
    }
    return INITIAL_ITEMS;
  });

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState('update'); // 'update' (Mẹ nhập) | 'search' (Bố/bạn đọc tra cứu)
  const [transcript, setTranscript] = useState('');
  const [speechStatus, setSpeechStatus] = useState('');
  const [lastUpdatedLog, setLastUpdatedLog] = useState([]);
  const [highlightedItemId, setHighlightedItemId] = useState(null);
  
  // OpenAI Compatible LLM Config
  const [llmConfig, setLlmConfig] = useState(() => {
    const saved = localStorage.getItem('openai_llm_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration: nếu có model (string cũ) nhưng chưa có models (array mới)
        if (parsed.model && !parsed.models) {
          parsed.models = parsed.model.split(',').map(m => m.trim()).filter(Boolean);
        }
        if (!parsed.models) parsed.models = ['llama-3.3-70b-versatile'];
        return parsed;
      } catch (e) {}
    }
    return {
      apiKey: localStorage.getItem('gemini_api_key') || '',
      baseUrl: 'https://api.groq.com/openai/v1',
      models: ['llama-3.3-70b-versatile', 'llama3-8b-8192']
    };
  });

  // State ô nhập model mới trong UI
  const [modelInput, setModelInput] = useState('');

  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Edit / Add Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [newItemModalOpen, setNewItemModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', price: '', category: 'rau', unit: 'kg', image: '' });

  // Supabase Database Config State
  const [supabaseConfig, setSupabaseConfig] = useState(getSupabaseConfig);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState(false);

  // Khởi tạo xác thực và cấu hình từ Supabase
  useEffect(() => {
    const initAuth = async () => {
      try {
        const config = await fetchAppConfig();
        setAppConfig(config);

        if (!config || !isPinConfigured(config)) {
          setAuthState('setup');
        } else if (isSessionValid()) {
          setAuthState('authenticated');
          const dbLlmConfig = parseLlmConfig(config);
          if (dbLlmConfig) {
            setLlmConfig(dbLlmConfig);
          }
        } else {
          setAuthState('unauthenticated');
        }
      } catch (e) {
        console.error('Lỗi khởi tạo Auth:', e);
        setAuthState('setup');
      }
    };

    initAuth();
  }, [supabaseConfig]);

  const handleLogin = async (pin) => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const valid = await verifyPin(pin, appConfig);
      if (valid) {
        saveSession();
        setAuthState('authenticated');
        // Đồng bộ LLM config từ Supabase
        const dbLlmConfig = parseLlmConfig(appConfig);
        if (dbLlmConfig) {
          setLlmConfig(dbLlmConfig);
        }
      } else {
        setLoginError('Mã PIN không chính xác. Vui lòng nhập lại!');
      }
    } catch (e) {
      setLoginError('Lỗi kết nối cơ sở dữ liệu. Vui lòng kiểm tra cấu hình Supabase!');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSetup = async (pin) => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const success = await setAdminPin(pin);
      if (success) {
        saveSession();
        // Fetch lại config mới
        const config = await fetchAppConfig();
        setAppConfig(config);
        setAuthState('authenticated');
      } else {
        setLoginError('Không thể lưu mã PIN mới. Vui lòng kiểm tra phân quyền Supabase!');
      }
    } catch (e) {
      setLoginError('Lỗi kết nối khi thiết lập PIN: ' + e.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSaveLlmConfigToDb = async () => {
    const success = await saveLlmConfig(llmConfig);
    if (success) {
      alert('Đã đồng bộ cấu hình LLM lên Cloud thành công!');
      const config = await fetchAppConfig();
      setAppConfig(config);
    } else {
      alert('Lỗi lưu cấu hình LLM lên Cloud. Vui lòng thử lại!');
    }
  };

  // Load items from Supabase or localStorage (chỉ chạy khi đã xác thực)
  useEffect(() => {
    if (authState !== 'authenticated') return;

    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsDbConnected(false);
      return;
    }

    // Load initial items from Supabase DB
    const fetchFromSupabase = async () => {
      try {
        const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          setIsDbConnected(true);
          const formatted = data.map(i => ({
            id: i.id,
            name: i.name,
            price: i.price,
            category: i.category || 'rau',
            unit: i.unit || 'kg',
            image: i.image,
            updatedAt: i.updated_at || i.created_at,
            keywords: i.keywords || [removeAccents(i.name)]
          }));
          setItems(formatted);
        }
      } catch (err) {
        console.warn('Không thể kết nối Supabase, chuyển sang xài Local Storage...', err);
        setIsDbConnected(false);
      }
    };

    fetchFromSupabase();

    // Supabase Realtime Subscription (Đồng bộ tức thì giữa Mẹ & Bố)
    const subscription = supabase
      .channel('public:items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        fetchFromSupabase();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [supabaseConfig, authState]);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('voice_price_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('openai_llm_config', JSON.stringify(llmConfig));
  }, [llmConfig]);

  const handleSaveSupabaseConfig = (url, key) => {
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_anon_key', key);
    resetSupabaseClient();
    setSupabaseConfig({ url, anonKey: key });
    setShowSupabaseModal(false);
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Trình duyệt không hỗ trợ Web Speech API. Hãy mở ứng dụng bằng Google Chrome trên điện thoại!');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechStatus(voiceMode === 'update' ? 'Đang lắng nghe mẹ đọc giá...' : 'Đang lắng nghe từ khóa tìm kiếm...');
      setTranscript('');
      if (voiceMode === 'search') {
        setSearchMatchedIds([]); // Reset kết quả tra cứu của lần trước
      }
    };

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);

      if (voiceMode === 'search') {
        const matches = parseVoiceSearch(currentTranscript, items);
        if (matches && matches.length > 0) {
          const ids = matches.map(m => m.id);
          setSearchMatchedIds(ids);
          const namesStr = matches.map(m => m.name).join(', ');
          setSpeechStatus(`Đã tìm thấy ${matches.length} sản phẩm: ${namesStr}`);
        } else {
          setSearchMatchedIds([]); // Không tìm thấy -> Xóa kết quả cũ ngay lập tức
          setSpeechStatus(`Không tìm thấy mặt hàng: "${currentTranscript.trim()}"`);
        }
      }
    };

    recognition.onerror = (event) => {
      console.error(event.error);
      setIsListening(false);
      setSpeechStatus('Có lỗi xảy ra khi thu âm: ' + event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    window._activeRecognition = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (window._activeRecognition) {
      window._activeRecognition.stop();
      setIsListening(false);
      
      if (voiceMode === 'update' && transcript) {
        processVoiceUpdateText(transcript);
      }
    }
  };

  const processVoiceUpdateText = async (text) => {
    if (!llmConfig.apiKey) {
      setSpeechStatus('❌ Chưa có API Key. Nhấn 🔑 để nhập API Key!');
      return;
    }

    setIsAiProcessing(true);
    const modelNames = (llmConfig.models || []).join(' → ');
    setSpeechStatus(`🤖 AI LLM (${modelNames || 'OpenAI'}) đang phân tích...`);

    const res = await extractItemsWithLLM(text, items, llmConfig);
    setIsAiProcessing(false);

    if (res.error) {
      setSpeechStatus(`❌ Lỗi LLM: ${res.error}`);
      return;
    }

    const updates = Array.isArray(res) ? res : (res.items || []);
    const aiModel = res.model || (llmConfig.models || [])[0] || 'OpenAI';

    if (updates.length === 0) {
      setSpeechStatus('Mẹ hãy đọc rõ tên mặt hàng và giá. Ví dụ: "muống 10, su hào 5"');
      return;
    }

    const newLogs = [];
    const supabase = getSupabaseClient();
    const newItemsToInsert = [];

    // Duyệt danh sách update để chuẩn bị log và dữ liệu trước khi set state
    let updatedList = [...items];

    for (const up of updates) {
      const existing = updatedList.find(ex => removeAccents(ex.name) === removeAccents(up.matchedName) || (up.matchedItem && ex.id === up.matchedItem.id));

      if (existing) {
        updatedList = updatedList.map(item => {
          if (item.id === existing.id) {
            return { ...item, price: up.newPrice, updatedAt: new Date().toISOString() };
          }
          return item;
        });
        newLogs.push(`Đã cập nhật ${existing.name}: ${existing.price}k ➔ ${up.newPrice}k`);

        if (supabase) {
          const { error } = await supabase.from('items')
            .update({ price: up.newPrice, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (error) {
            console.error('Lỗi cập nhật Supabase cho sản phẩm ' + existing.name + ':', error);
          }
        }
      } else {
        let defaultImg = '/placeholder.svg';

        const newItem = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
          name: up.matchedName,
          price: up.newPrice,
          category: up.category || 'rau',
          unit: up.unit || 'kg',
          image: defaultImg,
          updatedAt: new Date().toISOString(),
          keywords: [removeAccents(up.matchedName)]
        };
        updatedList.unshift(newItem);
        newLogs.push(`Đã thêm mới ${newItem.name}: ${up.newPrice}k`);
        newItemsToInsert.push(newItem);
      }
    }

    setItems(updatedList);

    // Đẩy dữ liệu mới tạo lên Supabase DB
    if (supabase && newItemsToInsert.length > 0) {
      const records = newItemsToInsert.map(newItem => ({
        id: newItem.id,
        name: newItem.name,
        price: newItem.price,
        category: newItem.category,
        unit: newItem.unit,
        image: newItem.image,
        updated_at: newItem.updatedAt,
        keywords: newItem.keywords
      }));
      await supabase.from('items').insert(records);
    }

    setLastUpdatedLog(newLogs);
    setSpeechStatus(`🤖 [${aiModel}] Trích xuất thành công ${updates.length} thẻ giá!`);
  };

  const [searchMatchedIds, setSearchMatchedIds] = useState([]);

  const filteredItems = items.filter(item => {
    const normSearch = removeAccents(searchQuery);

    // Nếu người dùng đang GÕ tìm kiếm trong ô gõ chữ
    if (normSearch) {
      return removeAccents(item.name).includes(normSearch) ||
             (item.keywords && item.keywords.some(k => removeAccents(k).includes(normSearch)));
    }

    // Nếu đang ở chế độ Bố / Bạn đọc tra cứu bằng giọng nói (và không gõ ô tìm kiếm)
    if (voiceMode === 'search') {
      if (searchMatchedIds.length === 0) return false; // Chưa đọc tra cứu -> Không hiện danh sách
      return searchMatchedIds.includes(item.id); // Hiển thị TẤT CẢ sản phẩm trùng khớp
    }

    // Chế độ Mẹ nhập giá
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    return matchesCategory;
  });

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) return;
    const supabase = getSupabaseClient();

    if (editingItem) {
      const updatedData = {
        name: formData.name,
        price: Number(formData.price),
        category: formData.category,
        unit: formData.unit,
        image: '/placeholder.svg',
      };

      setItems(items.map(i => i.id === editingItem.id ? { ...i, ...updatedData } : i));
      if (supabase) {
        await supabase.from('items').update({
          name: updatedData.name,
          price: updatedData.price,
          category: updatedData.category,
          unit: updatedData.unit,
          image: updatedData.image,
          updated_at: new Date().toISOString()
        }).eq('id', editingItem.id);
      }
      setEditingItem(null);
    } else {
      const newItem = {
        id: Date.now().toString(),
        name: formData.name,
        price: Number(formData.price),
        category: formData.category,
        unit: formData.unit,
        image: formData.image || '/placeholder.svg',
        updatedAt: new Date().toISOString(),
        keywords: [removeAccents(formData.name)]
      };
      setItems([newItem, ...items]);
      if (supabase) {
        await supabase.from('items').insert({
          id: newItem.id,
          name: newItem.name,
          price: newItem.price,
          category: newItem.category,
          unit: newItem.unit,
          image: newItem.image,
          updated_at: newItem.updatedAt,
          keywords: newItem.keywords
        });
      }
      setNewItemModalOpen(false);
    }
    setFormData({ name: '', price: '', category: 'rau', unit: 'kg', image: '' });
  };

  // State hỗ trợ Hoàn tác sản phẩm vừa xóa
  const [lastDeletedItem, setLastDeletedItem] = useState(null);

  const handleDeleteItem = async (id) => {
    const itemToDelete = items.find(i => i.id === id);
    if (itemToDelete) {
      setLastDeletedItem(itemToDelete);
      setItems(items.filter(i => i.id !== id));
      setSpeechStatus(`Đã xóa ${itemToDelete.name}`);

      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('items').delete().eq('id', id);
      }
    }
  };

  const handleUndoDelete = async () => {
    if (lastDeletedItem) {
      setItems(prev => [lastDeletedItem, ...prev]);
      setSpeechStatus(`Đã hoàn tác sản phẩm ${lastDeletedItem.name}`);

      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('items').insert({
          id: lastDeletedItem.id,
          name: lastDeletedItem.name,
          price: lastDeletedItem.price,
          category: lastDeletedItem.category,
          unit: lastDeletedItem.unit,
          image: lastDeletedItem.image,
          updated_at: lastDeletedItem.updatedAt,
          keywords: lastDeletedItem.keywords
        });
      }
      setLastDeletedItem(null);
    }
  };

  const handleClearAll = async () => {
    if (items.length === 0) return;
    if (confirm('Bạn có chắc chắn muốn XÓA TẤT CẢ các thẻ giá hiện tại không?')) {
      setItems([]);
      setSpeechStatus('Đã xóa sạch tất cả sản phẩm!');

      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from('items').delete().neq('id', '');
      }
    }
  };

  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-800 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-full border-4 border-white border-t-transparent animate-spin mb-4"></div>
        <p className="text-sm font-semibold">Đang tải cấu hình ứng dụng...</p>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <LoginScreen onLogin={handleLogin} isLoading={loginLoading} error={loginError} isSetup={false} />;
  }

  if (authState === 'setup') {
    return <LoginScreen onSetup={handleSetup} isLoading={loginLoading} error={loginError} isSetup={true} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-emerald-600 text-white shadow-md px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-2xl backdrop-blur-md">
              🧺
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight flex items-center gap-1.5">
                Sổ Giá Giọng Nói
              </h1>
              <p className="text-xs text-emerald-100">Đọc giá thông minh • Trích xuất bằng AI</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1.5">
            {/* Nút Khôi phục sản phẩm vừa xóa (Undo) */}
            {lastDeletedItem && (
              <button
                onClick={handleUndoDelete}
                className="p-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1 shadow-sm animate-bounce"
                title={`Khôi phục ${lastDeletedItem.name}`}
              >
                <Undo2 className="w-4 h-4" />
                <span className="hidden sm:inline">Khôi phục</span>
              </button>
            )}

            {/* Nút Xóa tất cả */}
            {items.length > 0 && (
              <button 
                onClick={handleClearAll} 
                title="Xóa tất cả sản phẩm"
                className="p-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-rose-100 transition active:scale-95 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setShowSupabaseModal(!showSupabaseModal)}
              className={`p-2 rounded-lg transition ${isDbConnected ? 'bg-emerald-500 text-white font-bold ring-2 ring-emerald-300' : 'bg-emerald-700 text-emerald-100 hover:bg-emerald-800'}`}
              title="Cấu hình Cloud Supabase Database"
            >
              <Database className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className={`p-2 rounded-lg transition ${llmConfig.apiKey ? 'bg-amber-500 text-white' : 'bg-emerald-700 text-emerald-100 hover:bg-emerald-800'}`}
              title="Cấu hình OpenAI Compatible LLM"
            >
              <Key className="w-4 h-4" />
            </button>

            {/* Nút Đăng xuất */}
            <button
              onClick={() => {
                clearSession();
                setAuthState('unauthenticated');
              }}
              className="p-2 rounded-lg bg-emerald-700 hover:bg-rose-700 text-emerald-100 hover:text-white transition active:scale-95 flex items-center justify-center"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Supabase Database Config Modal */}
        {showSupabaseModal && (
          <div className="max-w-md mx-auto mt-3 p-3.5 bg-slate-900 rounded-2xl text-xs space-y-2.5 border border-slate-700 animate-fadeIn text-white shadow-lg">
            <div className="flex items-center justify-between font-bold border-b border-slate-700 pb-2">
              <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
                <Database className="w-4 h-4" /> Cấu Hình Supabase DB (Đồng bộ Realtime)
              </span>
              <button onClick={() => setShowSupabaseModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300 leading-relaxed text-[11px]">
              Dán URL & Anon Key từ dự án Supabase miễn phí của bạn để đồng bộ giá tức thì 24/7 giữa máy Mẹ & Bố.
            </p>

            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">Project URL:</label>
                <input
                  type="text"
                  placeholder="https://xyz.supabase.co"
                  value={supabaseConfig.url}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, url: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl text-slate-800 text-xs outline-none bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-300 font-semibold mb-0.5">Anon Public Key:</label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiI..."
                  value={supabaseConfig.anonKey}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, anonKey: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl text-slate-800 text-xs outline-none bg-white font-mono"
                />
              </div>

              <button
                onClick={() => handleSaveSupabaseConfig(supabaseConfig.url, supabaseConfig.anonKey)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-xl transition"
              >
                Lưu Kết Nối Supabase DB
              </button>
            </div>
          </div>
        )}

        {/* OpenAI Compatible Config Banner */}
        {showApiKeyInput && (
          <div className="max-w-md mx-auto mt-3 p-3.5 bg-emerald-800 rounded-2xl text-xs space-y-2.5 border border-emerald-500/50 animate-fadeIn text-white shadow-lg">
            <div className="flex items-center justify-between font-bold border-b border-emerald-700 pb-2">
              <span className="flex items-center gap-1.5 text-amber-300 text-sm">
                <Cpu className="w-4 h-4" /> Kết Nối OpenAI-Compatible LLM
              </span>
              <button onClick={() => setShowApiKeyInput(false)} className="text-emerald-200 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-emerald-100 leading-relaxed text-[11px]">
              Tương thích với OpenAI, Gemini OpenAI Endpoint, DeepSeek, Groq hoặc Ollama local.
            </p>

            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-[10px] text-emerald-200 font-semibold mb-0.5">Base URL (Endpoint):</label>
                <input
                  type="text"
                  placeholder="https://api.openai.com/v1"
                  value={llmConfig.baseUrl}
                  onChange={(e) => setLlmConfig({ ...llmConfig, baseUrl: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl text-slate-800 text-xs outline-none bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-emerald-200 font-semibold mb-0.5">API Key:</label>
                <input
                  type="password"
                  placeholder="sk-... hoặc API Key của bạn"
                  value={llmConfig.apiKey}
                  onChange={(e) => setLlmConfig({ ...llmConfig, apiKey: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl text-slate-800 text-xs outline-none bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-emerald-200 font-semibold mb-1">Model Ưu Tiên (tự động chuyển nếu hết quota):</label>
                {/* Hiển thị tags model hiện tại */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(llmConfig.models || []).map((m, idx) => (
                    <span
                      key={idx}
                      className="flex items-center gap-1 bg-emerald-700/70 border border-emerald-500/60 text-emerald-100 px-2 py-0.5 rounded-lg text-[11px] font-mono"
                    >
                      <span className="text-emerald-300 font-bold text-[10px]">{idx + 1}.</span>
                      {m}
                      <button
                        type="button"
                        onClick={() => setLlmConfig(prev => ({ ...prev, models: prev.models.filter((_, i) => i !== idx) }))}
                        className="ml-0.5 text-emerald-300 hover:text-rose-300 transition"
                        title="Xóa model này"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {(llmConfig.models || []).length === 0 && (
                    <span className="text-emerald-400 text-[11px] italic">Chưa có model nào</span>
                  )}
                </div>
                {/* Ô nhập thêm model mới */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Ví dụ: llama-3.3-70b-versatile"
                    value={modelInput}
                    onChange={e => setModelInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',') && modelInput.trim()) {
                        e.preventDefault();
                        const newModel = modelInput.trim().replace(/,$/, '');
                        if (newModel && !(llmConfig.models || []).includes(newModel)) {
                          setLlmConfig(prev => ({ ...prev, models: [...(prev.models || []), newModel] }));
                        }
                        setModelInput('');
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-xl text-slate-800 text-xs outline-none bg-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newModel = modelInput.trim();
                      if (newModel && !(llmConfig.models || []).includes(newModel)) {
                        setLlmConfig(prev => ({ ...prev, models: [...(prev.models || []), newModel] }));
                      }
                      setModelInput('');
                    }}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-xs transition"
                  >
                    + Thêm
                  </button>
                </div>
                <p className="text-[10px] text-emerald-300/70 mt-1">
                  Nhấn Enter hoặc nút + Thêm. App sẽ tự động chuyển sang model kế tiếp khi model trước bị rate-limit.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveLlmConfigToDb}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 font-bold text-white rounded-xl transition text-xs mt-3 shadow-md"
              >
                Lưu cấu hình LLM lên Cloud ☁️
              </button>

              <div className="border-t border-emerald-700/50 pt-3 mt-3">
                <label className="block text-[10px] text-emerald-200 font-semibold mb-1">Đổi mã PIN mới:</label>
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Nhập PIN mới..."
                    value={newPinInput}
                    onChange={e => setNewPinInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl text-slate-800 text-xs outline-none bg-white font-mono text-center tracking-[0.2em]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newPinInput.trim()) return;
                      const success = await setAdminPin(newPinInput.trim());
                      if (success) {
                        alert('Đổi mã PIN mới thành công!');
                        setNewPinInput('');
                        const config = await fetchAppConfig();
                        setAppConfig(config);
                      } else {
                        alert('Lỗi thiết lập mã PIN!');
                      }
                    }}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl text-xs transition"
                  >
                    Đổi PIN
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        
        {/* Mode Switcher Tabs */}
        <div className="bg-slate-200/80 p-1 rounded-2xl flex text-xs font-semibold">
          <button
            onClick={() => { setVoiceMode('update'); setSpeechStatus(''); setSearchMatchedIds([]); }}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 ${
              voiceMode === 'update' ? 'bg-white shadow-sm text-emerald-700 font-bold' : 'text-slate-600'
            }`}
          >
            <Mic className="w-4 h-4 text-emerald-600" />
            <span>Mẹ Đọc Nhập Giá</span>
          </button>
          <button
            onClick={() => { setVoiceMode('search'); setSpeechStatus(''); setSearchMatchedIds([]); }}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 ${
              voiceMode === 'search' ? 'bg-white shadow-sm text-blue-700 font-bold' : 'text-slate-600'
            }`}
          >
            <Volume2 className="w-4 h-4 text-blue-600" />
            <span>Bố / Bạn Đọc Tra Cứu</span>
          </button>
        </div>

        {/* Big Voice Controller Box */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500"></div>

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            {voiceMode === 'update' ? '🗣️ Mẹ nhấn mic & đọc tự do tên + giá' : '🎙️ Đọc tên rau/hàng để xem giá'}
          </p>

          <button
            onClick={isListening ? stopListening : startListening}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
              isListening 
                ? 'mic-recording text-white shadow-red-200 scale-105' 
                : voiceMode === 'update' 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-200 hover:scale-105'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-200 hover:scale-105'
            }`}
          >
            {isListening ? (
              <MicOff className="w-8 h-8 animate-pulse" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>

          <p className="text-sm font-medium mt-3 text-slate-700">
            {isListening ? 'Đang thu âm... (Nhấn để dừng)' : 'Nhấn vào Micro để bắt đầu nói'}
          </p>

          {/* Prompt Instructions */}
          <div className="mt-2 bg-slate-50 px-3 py-2 rounded-xl text-xs text-slate-600 border border-slate-100 w-full">
            {voiceMode === 'update' ? (
              <span>Ví dụ Mẹ đọc tự nhiên: <strong className="text-emerald-700">"Hôm nay su hào 5, rau muống 10, tỏi ta 45"</strong></span>
            ) : (
              <span>Ví dụ đọc: <strong className="text-blue-700">"Su hào bao nhiêu", "Rau muống"</strong></span>
            )}
          </div>

          {/* Transcript display */}
          {transcript && (
            <div className="mt-3 p-3 bg-emerald-50 text-emerald-900 rounded-xl text-sm italic w-full border border-emerald-100">
              "{transcript}"
            </div>
          )}

          {/* Status logs */}
          {speechStatus && (
            <div className="mt-2 text-xs font-semibold text-slate-600 flex items-center justify-center space-x-1">
              {isAiProcessing && <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />}
              <span>{speechStatus}</span>
            </div>
          )}

          {/* Toast thông báo hoàn tác khi vừa xóa sản phẩm */}
          {lastDeletedItem && (
            <div className="mt-3 w-full bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between text-xs animate-fadeIn">
              <span className="text-amber-800">
                Đã xóa <strong>{lastDeletedItem.name}</strong>
              </span>
              <button
                onClick={handleUndoDelete}
                className="font-bold text-amber-700 hover:text-amber-900 bg-amber-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
              >
                <Undo2 className="w-3.5 h-3.5" /> Hoàn tác
              </button>
            </div>
          )}

          {/* Log list after updates */}
          {lastUpdatedLog.length > 0 && voiceMode === 'update' && (
            <div className="mt-3 w-full bg-emerald-50/60 p-2.5 rounded-xl text-left border border-emerald-100">
              <p className="text-xs font-bold text-emerald-800 mb-1 flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> AI vừa trích xuất:
              </p>
              <ul className="text-xs space-y-1 text-emerald-700">
                {lastUpdatedLog.map((log, idx) => (
                  <li key={idx}>• {log}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Search Bar & Add Button */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Gõ tìm nhanh (vd: tơi, su hào, tỏi)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setFormData({ name: '', price: '', category: 'rau', unit: 'kg', image: '' });
              setNewItemModalOpen(true);
            }}
            className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-sm transition active:scale-95 flex items-center justify-center"
            title="Thêm thẻ thủ công"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeCategory === 'all' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Tất cả ({items.length})
          </button>
          {Object.entries(CATEGORY_MAP).map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center space-x-1 ${
                activeCategory === key 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Price Cards Grid */}
        <div className={voiceMode === 'search' && !searchQuery && filteredItems.length === 1 ? 'flex justify-center pt-1' : 'grid grid-cols-2 gap-3 pt-1'}>
          {filteredItems.map(item => {
            const isHighlighted = highlightedItemId === item.id;
            const cat = CATEGORY_MAP[item.category] || CATEGORY_MAP.rau;
            const displayName = item.name;

            return (
              <div
                key={item.id}
                className={`price-card bg-white rounded-2xl p-3 border shadow-sm flex flex-col justify-between relative overflow-hidden ${
                  voiceMode === 'search' && !searchQuery ? 'w-full max-w-xs ring-4 ring-blue-500 border-blue-500 bg-blue-50/20 shadow-lg scale-105' : ''
                } ${
                  isHighlighted 
                    ? 'ring-4 ring-blue-500 border-blue-500 bg-blue-50/30' 
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                {/* Image Placeholder showing Product Name */}
                <div className="relative w-full h-28 rounded-xl overflow-hidden mb-2 bg-gradient-to-br from-emerald-500 to-teal-700 flex flex-col items-center justify-center p-3 text-center text-white shadow-inner">
                  <div className="text-3xl mb-1 drop-shadow-sm">{cat.icon}</div>
                  <h4 className="font-extrabold text-lg leading-tight drop-shadow-md text-white line-clamp-2 px-1">
                    {displayName}
                  </h4>
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-black/20 backdrop-blur-md text-emerald-100">
                    {cat.label}
                  </span>

                  {/* Actions overlay */}
                  <div className="absolute top-1.5 right-1.5 flex space-x-1">
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setFormData({
                          name: displayName,
                          price: item.price.toString(),
                          category: item.category,
                          unit: item.unit,
                          image: item.image
                        });
                      }}
                      className="p-1 rounded-lg bg-white/90 hover:bg-white text-slate-700 shadow-sm transition"
                      title="Sửa"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1 rounded-lg bg-white/90 hover:bg-rose-50 text-rose-600 shadow-sm transition"
                      title="Xóa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div>
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline">
                      <span className="text-2xl font-black text-emerald-600">{item.price}k</span>
                      <span className="text-xs text-slate-500 font-bold ml-1">/{item.unit}</span>
                    </div>
                  </div>
                  
                  {/* Ngày cập nhật giá */}
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center text-[10px] text-slate-400 font-medium">
                    <Clock className="w-3 h-3 mr-1 text-slate-400" />
                    <span>
                      {item.updatedAt ? (
                        (() => {
                          const d = new Date(item.updatedAt);
                          const now = new Date();
                          const isToday = d.toDateString() === now.toDateString();
                          const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                          return isToday 
                            ? `Hôm nay ${timeStr}`
                            : `${d.getDate()}/${d.getMonth() + 1} (${timeStr})`;
                        })()
                      ) : 'Mới cập nhật'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-blue-500" />
            <p className="text-sm font-medium text-slate-700">
              {voiceMode === 'search' 
                ? 'Nhấn micro và đọc tên mặt hàng để xem giá' 
                : 'Không tìm thấy mặt hàng nào phù hợp'}
            </p>
            <p className="text-xs mt-1">
              {voiceMode === 'search'
                ? 'Ví dụ: "Su hào bao nhiêu", "Rau muống"...'
                : 'Thử đọc bằng giọng nói hoặc bấm nút (+) để thêm thẻ mới'}
            </p>
          </div>
        )}

      </main>

      {/* Add / Edit Modal */}
      {(newItemModalOpen || editingItem) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-bold text-base text-slate-800">
                {editingItem ? 'Chỉnh Sửa Thẻ Giá' : 'Thêm Thẻ Giá Mới'}
              </h2>
              <button 
                onClick={() => { setNewItemModalOpen(false); setEditingItem(null); }}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tên sản phẩm *</label>
                <input
                  type="text"
                  required
                  placeholder="Vd: Su hào, Rau muống..."
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Giá (k/ngàn) *</label>
                  <input
                    type="number"
                    required
                    placeholder="Vd: 10"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Đơn vị</label>
                  <input
                    type="text"
                    placeholder="kg / mớ / nải"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Danh mục</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  <option value="rau">🥦 Rau Tươi</option>
                  <option value="kho">🧅 Hàng Khô</option>
                  <option value="qua">🍎 Hoa Quả</option>
                </select>
              </div>



              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => { setNewItemModalOpen(false); setEditingItem(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                >
                  Lưu Thẻ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
