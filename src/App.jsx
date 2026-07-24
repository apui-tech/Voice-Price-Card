import React, { useState, useEffect } from 'react';
import { 
  Mic, MicOff, Search, Plus, RefreshCw, Volume2, Sparkles, 
  Tag, Filter, CheckCircle2, Edit3, Trash2, X, AlertCircle, Key, Cpu, Clock
} from 'lucide-react';
import { INITIAL_ITEMS, CATEGORY_MAP } from './data';
import { parseVoiceSearch, removeAccents, getStandardVietnameseName } from './voiceParser';
import { extractItemsWithLLM } from './llmService';

export default function App() {
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
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      apiKey: localStorage.getItem('gemini_api_key') || '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini'
    };
  });

  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Edit / Add Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [newItemModalOpen, setNewItemModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', price: '', category: 'rau', unit: 'kg', image: '' });

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('voice_price_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('openai_llm_config', JSON.stringify(llmConfig));
  }, [llmConfig]);

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
    };

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);

      if (voiceMode === 'search') {
        const matched = parseVoiceSearch(currentTranscript, items);
        if (matched) {
          setHighlightedItemId(matched.id);
          const matchedDisplayName = getStandardVietnameseName(matched.name, matched);
          setSpeechStatus(`Đã tìm thấy: ${matchedDisplayName} - ${matched.price}k/${matched.unit}`);
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
    setIsAiProcessing(true);
    setSpeechStatus(llmConfig.apiKey ? '🤖 LLM AI đang phân tích tên & giá...' : '⚡ AI Engine đang phân tích...');

    const updates = await extractItemsWithLLM(text, items, llmConfig);
    setIsAiProcessing(false);

    if (updates.length === 0) {
      setSpeechStatus('Không tìm thấy tên & giá hợp lệ. Mẹ hãy đọc lại theo mẫu: "muống 10, su hào 5"');
      return;
    }

    const newLogs = [];
    setItems(prevItems => {
      let updatedList = [...prevItems];

      updates.forEach(up => {
        if (up.matchedItem) {
          updatedList = updatedList.map(item => {
            if (item.id === up.matchedItem.id) {
              newLogs.push(`Đã cập nhật ${item.name}: ${item.price}k ➔ ${up.newPrice}k`);
              return { ...item, price: up.newPrice, updatedAt: new Date().toISOString() };
            }
            return item;
          });
        } else {
          let defaultImg = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80';
          if (up.category === 'qua') {
            defaultImg = 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=400&q=80';
          } else if (up.category === 'kho') {
            defaultImg = 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=400&q=80';
          }

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
        }
      });

      return updatedList;
    });

    setLastUpdatedLog(newLogs);
    setSpeechStatus(`✨ AI trích xuất thành công ${updates.length} thẻ giá!`);
  };

  const filteredItems = items.filter(item => {
    const normSearch = removeAccents(searchQuery);

    // Nếu người dùng đang GÕ tìm kiếm trong ô gõ chữ
    if (normSearch) {
      return removeAccents(item.name).includes(normSearch) ||
             (item.keywords && item.keywords.some(k => removeAccents(k).includes(normSearch)));
    }

    // Nếu đang ở chế độ Bố / Bạn đọc tra cứu bằng giọng nói (và không gõ ô tìm kiếm)
    if (voiceMode === 'search') {
      if (!highlightedItemId) return false; // Chưa đọc tra cứu -> Không hiện danh sách
      return item.id === highlightedItemId; // Chỉ hiển thị đúng sản phẩm tìm được
    }

    // Chế độ Mẹ nhập giá
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    return matchesCategory;
  });

  const handleSaveItem = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) return;

    if (editingItem) {
      setItems(items.map(i => i.id === editingItem.id ? {
        ...i,
        name: formData.name,
        price: Number(formData.price),
        category: formData.category,
        unit: formData.unit,
        image: formData.image || i.image
      } : i));
      setEditingItem(null);
    } else {
      const newItem = {
        id: Date.now().toString(),
        name: formData.name,
        price: Number(formData.price),
        category: formData.category,
        unit: formData.unit,
        image: formData.image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80',
        updatedAt: new Date().toISOString(),
        keywords: [removeAccents(formData.name)]
      };
      setItems([newItem, ...items]);
      setNewItemModalOpen(false);
    }
    setFormData({ name: '', price: '', category: 'rau', unit: 'kg', image: '' });
  };

  const handleDeleteItem = (id) => {
    if (confirm('Bạn có chắc chắn muốn xóa mặt hàng này?')) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const resetDefaultData = () => {
    if (confirm('Khôi phục danh sách rau & hàng khô mặc định?')) {
      setItems(INITIAL_ITEMS);
      localStorage.removeItem('voice_price_items');
    }
  };

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
                <span className="bg-emerald-800/80 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-0.5">
                  <Sparkles className="w-3 h-3 text-amber-300" /> AI LLM
                </span>
              </h1>
              <p className="text-xs text-emerald-100">Đọc giá thông minh • Trích xuất bằng AI</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className={`p-2 rounded-lg transition ${llmConfig.apiKey ? 'bg-amber-500 text-white' : 'bg-emerald-700 text-emerald-100 hover:bg-emerald-800'}`}
              title="Cấu hình OpenAI Compatible LLM"
            >
              <Key className="w-4 h-4" />
            </button>
            <button 
              onClick={resetDefaultData} 
              title="Khôi phục mặc định"
              className="p-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-emerald-100 transition active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

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
              Tương thích với OpenAI, Gemini OpenAI Endpoint, DeepSeek, Groq hoặc Ollama local. Để trống nếu muốn dùng **AI Engine nội bộ miễn phí**.
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
                <label className="block text-[10px] text-emerald-200 font-semibold mb-0.5">Model Name:</label>
                <input
                  type="text"
                  placeholder="gpt-4o-mini, deepseek-chat, gemini-2.5-flash..."
                  value={llmConfig.model}
                  onChange={(e) => setLlmConfig({ ...llmConfig, model: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl text-slate-800 text-xs outline-none bg-white font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        
        {/* Mode Switcher Tabs */}
        <div className="bg-slate-200/80 p-1 rounded-2xl flex text-xs font-semibold">
          <button
            onClick={() => { setVoiceMode('update'); setSpeechStatus(''); setHighlightedItemId(null); }}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center space-x-1.5 ${
              voiceMode === 'update' ? 'bg-white shadow-sm text-emerald-700 font-bold' : 'text-slate-600'
            }`}
          >
            <Mic className="w-4 h-4 text-emerald-600" />
            <span>Mẹ Đọc Nhập Giá</span>
          </button>
          <button
            onClick={() => { setVoiceMode('search'); setSpeechStatus(''); setHighlightedItemId(null); }}
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
                {/* Image & Category Badge */}
                <div className="relative w-full h-28 rounded-xl overflow-hidden mb-2 bg-slate-100">
                  <img
                    src={item.image}
                    alt={displayName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/90 backdrop-blur-md shadow-sm text-slate-700">
                    {cat.icon} {cat.label}
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
                  <h3 className="font-bold text-base text-slate-800 line-clamp-1">{displayName}</h3>
                  <div className="mt-1 flex items-baseline justify-between">
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

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Link Ảnh (Không bắt buộc)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.image}
                  onChange={e => setFormData({ ...formData, image: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                />
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
