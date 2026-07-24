
// Các mã lỗi HTTP cần thử chuyển sang model tiếp theo
const FALLBACK_HTTP_CODES = new Set([429, 402, 503, 529]);

/**
 * Gửi đoạn text giọng nói của Mẹ đến OpenAI-Compatible LLM Cloud API.
 * Hỗ trợ danh sách nhiều model: tự động chuyển sang model kế tiếp khi gặp lỗi rate-limit.
 */
export async function extractItemsWithLLM(text, existingItems, config = {}) {
  if (!text) return { items: [], source: 'llm', error: 'Chưa có nội dung giọng nói' };

  const {
    apiKey = '',
    baseUrl = 'https://api.openai.com/v1',
    model,
    models,
  } = typeof config === 'string' ? { apiKey: config } : config;

  if (!apiKey) {
    return { items: [], source: 'llm', error: 'Chưa cấu hình API Key. Vui lòng bấm vào icon chiếc chìa khóa 🔑 để nhập API Key!' };
  }

  // Hỗ trợ cả dạng models (array) lẫn model (string cũ)
  const modelList = (Array.isArray(models) && models.length > 0)
    ? models
    : (model ? [model] : ['gpt-4o-mini']);

  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const endpoint = cleanBaseUrl.endsWith('/chat/completions')
    ? cleanBaseUrl
    : `${cleanBaseUrl}/chat/completions`;

  const promptText = `Bạn là trợ lý cho cửa hàng bán nông sản Việt Nam (rau tươi, hàng khô, hoa quả). 
Hãy phân tích đoạn văn giọng nói sau: "${text}"
Trích xuất danh sách các mặt hàng và giá tiền tương ứng.

QUY TẮC QUAN TRỌNG VỀ TÊN MẶT HÀNG:
1. Giữ NGUYÊN VẸN tên ghép đầy đủ của nông sản Việt Nam. KHÔNG ĐƯỢC cắt bớt từ trong tên (ví dụ: "củ đậu" phải ghi đúng là "Củ đậu" (KHÔNG được cắt thành "Đậu"), "bắp cải" ghi đúng "Bắp cải", "đậu bắp" ghi đúng "Đậu bắp", "cải thảo" ghi đúng "Cải thảo", "khoai sọ" ghi đúng "Khoai sọ", "cà chua" ghi đúng "Cà chua").
2. Viết hoa chữ cái đầu tiên của từng từ trong tên sản phẩm (ví dụ: Củ Đậu, Cải Thảo, Khoai Sọ).
3. KHÔNG gộp phần số chỉ giá tiền vào tên mặt hàng (ví dụ: "mùng tơi 7" -> tên là "Mùng Tơi", không phải "Mùng Tơi 7").

QUY TẮC QUAN TRỌNG VỀ GIÁ TIỀN:
1. Người dùng thường đọc tên mặt hàng kèm theo số tiền viết tắt (ví dụ: "mùng tơi 7" nghĩa là Mùng Tơi giá 7 nghìn, "su hào 5" nghĩa là Su Hào giá 5 nghìn).
2. Hãy luôn trích xuất phần số đứng ngay sau tên mặt hàng làm giá tiền của mặt hàng đó. Ví dụ: "mùng tơi 7" -> price: 7, "rau muống 10k" -> price: 10, "bí xanh 15" -> price: 15.
3. Luôn luôn trích xuất giá tiền là một số nguyên (ví dụ: 7, 10, 15), KHÔNG được bỏ sót hoặc trả về 0 nếu có số đi kèm trong câu.

Yêu cầu trả về đúng định dạng JSON Array chứa các object:
[
  {
    "name": "Tên mặt hàng đầy đủ tiếng Việt chuẩn có dấu (Ví dụ: Củ Đậu, Cải Thảo, Khoai Sọ, Đậu Bắp, Rau Muống, Su Hào)",
    "price": số tiền (tính theo nghìn/k, là số nguyên ví dụ: 10, 7, 5, 20),
    "category": "rau" (rau củ tươi) hoặc "kho" (củ/hàng khô/gia vị) hoặc "qua" (hoa quả),
    "unit": "kg" hoặc "mớ" hoặc "nải" hoặc "củ"
  }
]
Chỉ trả về JSON thuần túy, không kèm Markdown hay lời giải thích.`;

  let lastError = null;

  // Thử từng model trong danh sách, chuyển sang model kế tiếp khi gặp lỗi rate-limit
  for (let i = 0; i < modelList.length; i++) {
    const currentModel = modelList[i].trim();
    if (!currentModel) continue;

    const isLast = i === modelList.length - 1;
    const modelTag = modelList.length > 1 ? `[${i + 1}/${modelList.length}] ` : '';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: 'system', content: 'Bạn là trợ lý trích xuất dữ liệu JSON chính xác.' },
            { role: 'user', content: promptText }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errJson = JSON.parse(errorText);
          if (errJson.error?.message) errorDetail = errJson.error.message;
        } catch (e) {}

        // Nếu lỗi rate-limit/quota và còn model tiếp theo → thử tiếp
        if (FALLBACK_HTTP_CODES.has(response.status) && !isLast) {
          lastError = `${modelTag}${currentModel}: ${errorDetail}`;
          console.warn(`⚠️ Model ${currentModel} lỗi ${response.status}, chuyển sang model tiếp theo...`);
          continue;
        }

        return { items: [], source: 'llm', error: `${modelTag}${currentModel}: ${errorDetail}` };
      }

      const data = await response.json();
      const rawJsonText = data.choices?.[0]?.message?.content || data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawJsonText) {
        if (!isLast) { lastError = `${currentModel}: phản hồi rỗng`; continue; }
        return { items: [], source: 'llm', error: 'LLM trả về phản hồi rỗng' };
      }

      const cleanJson = rawJsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedArray = JSON.parse(cleanJson);

      if (Array.isArray(parsedArray)) {
        const mapped = parsedArray.map(item => {
          const normName = removeAccents(item.name);
          const matched = existingItems.find(ex => removeAccents(ex.name) === normName);

          let priceVal = item.price;
          if (typeof priceVal === 'string') {
            const cleanPrice = priceVal.toLowerCase().replace(/k|nghìn|nghin|ngàn|ngan|đ|d|đồng|dong|\s/g, '');
            priceVal = parseInt(cleanPrice, 10);
          } else {
            priceVal = parseInt(priceVal, 10);
          }
          if (isNaN(priceVal) || priceVal < 0) priceVal = 0;

          return {
            matchedItem: matched,
            matchedName: item.name,
            newPrice: priceVal,
            category: item.category || 'rau',
            unit: item.unit || 'kg'
          };
        });

        return { items: mapped, source: 'llm', model: currentModel, modelIndex: i };
      }

      if (!isLast) { lastError = `${currentModel}: JSON không hợp lệ`; continue; }
      return { items: [], source: 'llm', error: 'Dữ liệu trả về không phải JSON Array hợp lệ' };

    } catch (e) {
      // Lỗi mạng hoặc parse → thử model tiếp theo
      lastError = `${currentModel}: ${e.message}`;
      if (!isLast) {
        console.warn(`⚠️ Model ${currentModel} lỗi mạng, chuyển model tiếp theo...`);
        continue;
      }
    }
  }

  return { items: [], source: 'llm', error: `Tất cả model đều thất bại. Lỗi cuối: ${lastError}` };
}

function removeAccents(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}
