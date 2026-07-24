# 🧺 Sổ Giá Giọng Nói (Voice Price Card Web App)

Ứng dụng web/mobile hỗ trợ cửa hàng nông sản gia đình (Rau tươi, Hàng khô, Hoa quả). Cho phép đọc danh sách giá nông sản bằng giọng nói để tự động bóc tách tên sản phẩm & tạo thẻ giá trực quan.

---

## 🌟 Tính Năng Chính

1. **🗣️ Đọc Giọng Nói Tạo Thẻ Giá Tức Thì (Chế độ cho Mẹ)**:
   - Nhấn 1 nút Micro lớn và đọc tự nhiên danh sách giá (ví dụ: *"Hôm nay su hào 5, rau muống 10, đậu bắp 35, lạc lè 25, tỏi ta 45"*).
   - Tự động nhận diện từ viết tắt, nói không dấu, tên đa từ (`Lạc lè`, `Đậu bắp`, `Su hào`...).

2. **🔊 Tra Cứu Bằng Giọng Nói (Chế độ cho Bố & Người bán thay)**:
   - Nhấn Micro đọc tên sản phẩm bất kỳ: *"Rau muống bao nhiêu"*, *"Giá hành khô"*...
   - Ứng dụng tự động tìm kiếm, cuộn tới và **nổi bật (highlight)** thẻ giá tương ứng.

3. **🤖 Tích Hợp Mô Hình LLM AI (Gemini AI & AI Engine)**:
   - Hỗ trợ kết nối **Gemini API Key** để trích xuất ngữ nghĩa tự nhiên 100%.
   - Có sẵn **AI Engine nội bộ** khôi phục dấu tiếng Việt chuẩn mà không bắt buộc có API Key.

4. **📱 Giao Diện Mobile-First & Thẻ Giá Kèm Ảnh Minh Họa**:
   - Tự động gán hình ảnh & phân loại màu sắc theo 3 nhóm: 🥦 **Rau Tươi**, 🧅 **Hàng Khô**, 🍎 **Hoa Quả**.
   - Hỗ trợ thêm/sửa/xóa thủ công và tìm kiếm gõ phím.
   - **Lưu trữ Offline**: Dữ liệu tự động lưu trong máy (`LocalStorage`), không lo mất khi tắt app hay mất mạng.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 1. Yêu cầu hệ thống
- Đã cài đặt [Node.js](https://nodejs.org/) (phiên bản 18 trở lên).

### 2. Cài đặt dependencies
Mở terminal tại thư mục dự án và chạy:
```bash
npm install
```

### 3. Chạy môi trường phát triển (Development)
Chạy lệnh sau để phát ứng dụng ra mạng nội bộ (Wi-Fi):
```bash
npm run dev
```

Ứng dụng sẽ chạy tại địa chỉ:
- Máy tính cá nhân: `http://localhost:5173/`
- Điện thoại trong cùng mạng Wi-Fi: `http://<Địa-Chỉ-IP-Máy-Tính>:5173/` (ví dụ: `http://192.168.1.5:5173`)

### 4. Đóng gói Production (Build)
```bash
npm run build
```

---

## 📲 Hướng Dẫn Cài Ra Màn Hình Điện Thoại Như App Thật (PWA)

1. Trên điện thoại của Mẹ/Bố, kết nối cùng Wi-Fi với máy tính và mở trình duyệt Google Chrome hoặc Safari.
2. Truy cập địa chỉ IP máy tính (ví dụ: `http://192.168.1.5:5173`).
3. Nhấn nút **Menu (Dấu 3 chấm ở góc trên trình duyệt)** ➔ Chọn **"Thêm vào màn hình chính" (Add to Home screen)**.
4. Biểu tượng ứng dụng **🧺 Sổ Giá Giọng Nói** sẽ xuất hiện trên màn hình điện thoại, bấm 1 chạm để mở dùng ngay lập tức.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

- **Frontend Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS v4 + Custom Glassmorphism CSS
- **Voice Recognition**: Web Speech API (`vi-VN`)
- **AI / Natural Language Processing**: Gemini 2.5 Flash API / Rule-based AI Engine
- **Icons**: Lucide React
