// Helper to remove accents for fuzzy matching
export function removeAccents(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

// Bảng từ điển phong phú hơn cho các loại nông sản Việt Nam
const DICTIONARY_MAP = {
  // Rau củ
  'muon': 'Rau muống',
  'muong': 'Rau muống',
  'rau muong': 'Rau muống',
  'toi': 'Rau mồng tơi',
  'mong toi': 'Rau mồng tơi',
  'rau mong toi': 'Rau mồng tơi',
  'su hao': 'Su hào',
  'suhao': 'Su hào',
  'bap cai': 'Bắp cải',
  'cai': 'Bắp cải',
  'cai bắp': 'Bắp cải',
  'do': 'Đỗ cove',
  'do cove': 'Đỗ cove',
  'do que': 'Đỗ cove',
  'dau que': 'Đỗ cove',
  'gia': 'Giá đỗ',
  'gia do': 'Giá đỗ',
  'ca chua': 'Cà chua',
  'chua': 'Cà chua',
  'ca rot': 'Cà rốt',
  'bi do': 'Bí đỏ',
  'bi xanh': 'Bí xanh',
  'khoai tay': 'Khoai tây',
  'khoai lang': 'Khoai lang',
  'rau thom': 'Rau thơm',
  'hanh la': 'Hành lá',
  'rau rai': 'Rau rải / Rau răm',
  'sa': 'Sả tươi',
  'ot': 'Ớt chỉ thiên',
  'chanh': 'Chanh tươi',

  // Hàng khô
  'toi ta': 'Tỏi ta',
  'cu toi': 'Tỏi ta',
  'hanh kho': 'Hành khô',
  'cu hanh': 'Hành khô',
  'hanh': 'Hành khô',
  'gung': 'Gừng tươi',
  'nam': 'Nấm hương khô',
  'nam huong': 'Nấm hương khô',
  'moc nhi': 'Mộc nhĩ',

  // Hoa quả
  'xoai': 'Xoài cát',
  'xoai cat': 'Xoài cát',
  'tao': 'Táo Mỹ',
  'cam': 'Cam sành',
  'chuoi': 'Chuối tiêu',
  'dua': 'Dưa hấu',
  'dua hau': 'Dưa hấu',
  'oi': 'Ổi ruột hồng',
  'thanh long': 'Thanh long',
  'nhan': 'Nhãn lồng',
  'vai': 'Vải thiều'
};

/**
 * Thuật toán khôi phục dấu tiếng Việt thông minh (Vietnamese Diacritics Restorer)
 */
export function restoreVietnameseAccents(str) {
  if (!str) return '';
  const norm = removeAccents(str);
  
  if (DICTIONARY_MAP[norm]) {
    return DICTIONARY_MAP[norm];
  }

  // Tự động khôi phục dấu tiếng Việt theo quy tắc từ đơn giản
  const words = str.trim().split(/\s+/);
  const restoredWords = words.map(w => {
    const nw = removeAccents(w);
    if (DICTIONARY_MAP[nw]) return DICTIONARY_MAP[nw];

    switch (nw) {
      case 'su': return 'Su';
      case 'hao': return 'hào';
      case 'rau': return 'Rau';
      case 'cu': return 'Củ';
      case 'qua': return 'Quả';
      case 'ot': return 'Ớt';
      case 'bi': return 'Bí';
      case 'khoai': return 'Khoai';
      case 'dau': return 'Đậu';
      case 'nam': return 'Nấm';
      case 'do': return 'Đỗ';
      default:
        return w.charAt(0).toUpperCase() + w.slice(1);
    }
  });

  return restoredWords.join(' ');
}

export function getStandardVietnameseName(query, matchedItem) {
  if (matchedItem) return matchedItem.name;
  return restoreVietnameseAccents(query);
}

/**
 * Match spoken item query to existing items in database
 */
export function matchItem(query, items) {
  const normQuery = removeAccents(query);
  if (!normQuery) return null;

  // 1. Kiểm tra từ điển từ rút gọn
  if (DICTIONARY_MAP[normQuery]) {
    const targetNormName = removeAccents(DICTIONARY_MAP[normQuery]);
    const found = items.find(item => removeAccents(item.name) === targetNormName);
    if (found) return found;
  }

  // 2. Tương thích khớp tuyệt đối hoặc từ khóa
  let matched = items.find(item => 
    removeAccents(item.name) === normQuery || 
    (item.keywords && item.keywords.some(k => removeAccents(k) === normQuery))
  );

  if (matched) return matched;

  // 3. Khớp theo ranh giới từ (Word Boundary / Whole Word Inclusion)
  matched = items.find(item => {
    const normName = removeAccents(item.name);
    // Ví dụ: query là "cai" sẽ khớp "bap cai" nhưng không khớp "cai rot" (nếu có)
    const nameWords = normName.split(/\s+/);
    const queryWords = normQuery.split(/\s+/);

    return queryWords.every(qw => nameWords.includes(qw)) || nameWords.every(nw => queryWords.includes(nw));
  });

  if (matched) return matched;

  // 4. Tương thích khớp một phần (substring)
  matched = items.find(item => {
    const normName = removeAccents(item.name);
    return normName.includes(normQuery) || normQuery.includes(normName);
  });

  return matched || null;
}

/**
 * Parse a full spoken phrase like:
 * "muong 10 toi 8 su hao 5"
 */
export function parseVoiceUpdate(text, originalRawText = '', existingItems) {
  const rawTextToUse = originalRawText || text;
  if (!text) return [];

  // Tách câu dựa trên số (giá tiền)
  const cleanText = removeAccents(text);
  const words = cleanText.split(/[\s,.]+/);
  const rawWords = rawTextToUse.split(/[\s,.]+/);
  
  const updates = [];
  let currentWords = [];
  let currentRawWords = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const rawWord = rawWords[i] || word;
    const num = parseInt(word, 10);
    
    // Nếu gặp 1 con số (giá tiền k)
    if (!isNaN(num) && num > 0 && num < 2000) {
      const nameQuery = currentWords.join(' ');
      const rawNameQuery = currentRawWords.join(' ');

      if (nameQuery) {
        const matchedItem = matchItem(nameQuery, existingItems);
        // Ưu tiên chuỗi gốc có dấu nếu Web Speech API trả về có dấu (ví dụ "su hào")
        const bestNameQuery = rawNameQuery || nameQuery;
        const standardName = matchedItem ? matchedItem.name : restoreVietnameseAccents(bestNameQuery);

        updates.push({
          rawQuery: nameQuery,
          matchedItem: matchedItem,
          newPrice: num,
          matchedName: standardName
        });
      }
      currentWords = [];
      currentRawWords = [];
    } else {
      currentWords.push(word);
      currentRawWords.push(rawWord);
    }
  }

  return updates;
}

/**
 * Parse a voice search query
 */
export function parseVoiceSearch(text, existingItems) {
  if (!text) return null;
  
  let clean = removeAccents(text)
    .replace(/gia/g, '')
    .replace(/bao nhieu/g, '')
    .replace(/bao nhieu tien/g, '')
    .replace(/tim/g, '')
    .replace(/tim kiem/g, '')
    .replace(/hoi/g, '')
    .trim();

  return matchItem(clean, existingItems);
}
