/**
 * Gửi đoạn text giọng nói của Mẹ đến OpenAI-Compatible LLM API (hoặc AI Rule Engine dự phòng) để phân tích ngữ nghĩa
 */
export async function extractItemsWithLLM(text, existingItems, config = {}) {
  if (!text) return [];

  const {
    apiKey = '',
    baseUrl = 'https://api.openai.com/v1',
    model = 'gpt-4o-mini'
  } = typeof config === 'string' ? { apiKey: config } : config;

  // Nếu người dùng có cung cấp API Key
  if (apiKey) {
    try {
      const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
      const endpoint = cleanBaseUrl.endsWith('/chat/completions') 
        ? cleanBaseUrl 
        : `${cleanBaseUrl}/chat/completions`;

      const promptText = `Bạn là trợ lý cho cửa hàng bán rau, hàng khô, hoa quả Việt Nam. 
Hãy phân tích đoạn văn giọng nói sau: "${text}"
Trích xuất danh sách các mặt hàng và giá tiền tương ứng.
Yêu cầu giữ nguyên tên rau củ quả gốc nếu không trùng trong từ điển (ví dụ: "Lạc lè" giữ đúng là "Lạc lè", "Đậu bắp" giữ đúng là "Đậu bắp", "Đậu đũa" giữ đúng là "Đậu đũa").
Yêu cầu trả về đúng định dạng JSON Array chứa các object:
[
  {
    "name": "Tên mặt hàng đầy đủ tiếng Việt chuẩn có dấu (ví dụ: Đậu bắp, Lạc lè, Rau muống, Su hào, Giá đỗ, Tỏi ta, Xoài cát)",
    "price": số tiền (tính theo nghìn/k, ví dụ 10 nghìn -> 10, 8 nghìn -> 8, 35 nghìn -> 35),
    "category": "rau" hoặc "kho" hoặc "qua",
    "unit": "mớ" hoặc "kg" hoặc "nải"
  }
]
Chỉ trả về JSON thuần túy, không kèm Markdown hay lời giải thích.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Bạn là trợ lý trích xuất dữ liệu JSON chính xác.' },
            { role: 'user', content: promptText }
          ],
          temperature: 0.1
        })
      });

      const data = await response.json();
      const rawJsonText = data.choices?.[0]?.message?.content || data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJson = rawJsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedArray = JSON.parse(cleanJson);

      return parsedArray.map(item => {
        const normName = removeAccents(item.name);
        const matched = existingItems.find(ex => removeAccents(ex.name) === normName);
        return {
          matchedItem: matched,
          matchedName: item.name,
          newPrice: item.price,
          category: item.category || 'rau',
          unit: item.unit || 'kg'
        };
      });
    } catch (e) {
      console.warn('Lỗi kết nối OpenAI Compatible LLM, chuyển sang bộ phân tích tự động thông minh...', e);
    }
  }

  // Fallback AI Engine siêu thông minh
  return fallbackAIParser(text, existingItems);
}

function removeAccents(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

function fallbackAIParser(text, existingItems) {
  const rawWords = text.trim().split(/[\s,.]+/);
  const results = [];

  // Từ điển AI phong phú bao gồm các loại nông sản đặc thù (Lạc lè, Đậu bắp, Đậu đũa,...)
  const DICTIONARY = [
    { keys: ['lac le', 'quang le'], name: 'Lạc lè', cat: 'rau', unit: 'kg' },
    { keys: ['dau bap', 'bap'], name: 'Đậu bắp', cat: 'rau', unit: 'kg' },
    { keys: ['dau dua', 'do dua'], name: 'Đậu đũa', cat: 'rau', unit: 'kg' },
    { keys: ['muong', 'muon', 'rau muong'], name: 'Rau muống', cat: 'rau', unit: 'mớ' },
    { keys: ['toi', 'mong toi', 'rau mong toi'], name: 'Rau mồng tơi', cat: 'rau', unit: 'mớ' },
    { keys: ['su hao', 'suhao', 'hao'], name: 'Su hào', cat: 'rau', unit: 'củ' },
    { keys: ['bap cai', 'cai', 'cai bap'], name: 'Bắp cải', cat: 'rau', unit: 'kg' },
    { keys: ['do', 'do cove', 'do que', 'dau que'], name: 'Đỗ cove', cat: 'rau', unit: 'kg' },
    { keys: ['gia', 'gia do'], name: 'Giá đỗ', cat: 'rau', unit: 'kg' },
    { keys: ['ca chua', 'chua'], name: 'Cà chua', cat: 'rau', unit: 'kg' },
    { keys: ['ca rot'], name: 'Cà rốt', cat: 'rau', unit: 'kg' },
    { keys: ['bi do'], name: 'Bí đỏ', cat: 'rau', unit: 'kg' },
    { keys: ['bi xanh'], name: 'Bí xanh', cat: 'rau', unit: 'kg' },
    { keys: ['toi ta', 'cu toi'], name: 'Tỏi ta', cat: 'kho', unit: 'kg' },
    { keys: ['hanh kho', 'cu hanh', 'hanh'], name: 'Hành khô', cat: 'kho', unit: 'kg' },
    { keys: ['gung'], name: 'Gừng tươi', cat: 'kho', unit: 'kg' },
    { keys: ['nam', 'nam huong'], name: 'Nấm hương khô', cat: 'kho', unit: 'kg' },
    { keys: ['xoai', 'xoai cat'], name: 'Xoài cát', cat: 'qua', unit: 'kg' },
    { keys: ['tao'], name: 'Táo Mỹ', cat: 'qua', unit: 'kg' },
    { keys: ['cam'], name: 'Cam sành', cat: 'qua', unit: 'kg' },
    { keys: ['chuoi'], name: 'Chuối tiêu', cat: 'qua', unit: 'nải' }
  ];

  let currentTextBuf = [];

  for (let i = 0; i < rawWords.length; i++) {
    const word = rawWords[i];
    const num = parseInt(word, 10);

    if (!isNaN(num) && num > 0 && num < 2000) {
      const phrase = currentTextBuf.join(' ').trim();
      if (phrase) {
        const normPhrase = removeAccents(phrase);
        
        // 1. Khớp từ điển chính xác nhất (ví dụ "lac le" match "Lạc lè" thay vì match nhầm "Lạc")
        const dictMatch = DICTIONARY.find(d => d.keys.some(k => k === normPhrase || normPhrase === k));

        // 2. Khớp chính xác với thẻ đã có trong ứng dụng
        const matchedItem = existingItems.find(ex => removeAccents(ex.name) === normPhrase);

        let finalName = matchedItem ? matchedItem.name : (dictMatch ? dictMatch.name : capitalizeVietnamese(phrase));
        let finalCat = matchedItem ? matchedItem.category : (dictMatch ? dictMatch.cat : 'rau');
        let finalUnit = matchedItem ? matchedItem.unit : (dictMatch ? dictMatch.unit : 'kg');

        results.push({
          matchedItem: matchedItem || null,
          matchedName: finalName,
          newPrice: num,
          category: finalCat,
          unit: finalUnit
        });
      }
      currentTextBuf = [];
    } else {
      currentTextBuf.push(word);
    }
  }

  return results;
}

function capitalizeVietnamese(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
