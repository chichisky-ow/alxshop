# Hướng dẫn Test Dự Án

## Chuẩn bị

### 1. Cài đặt MongoDB

**Windows:**
```powershell
# Download MongoDB Community từ https://www.mongodb.com/try/download/community
# Hoặc dùng Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 2. Tạo file .env

```bash
cp .env.example .env
```

Điền thông tin thật vào `.env`:
```env
MONGO_URL=mongodb://localhost:27017/alxshop
BOT_TOKEN=8782848049:AAHnQmTxY3krMHQl-v4t4SoiB6EZs3fEndk
ADMIN_ID=5446467416
ADMIN_TOKEN=your_secure_random_token_here
BANK_BIN=970407
BANK_ACCOUNT=777777777865
PORT=3000
```

### 3. Cài dependencies và chạy

```bash
npm install
npm start
```

Server sẽ chạy tại `http://localhost:3000`

---

## Test Từng Chức Năng

### 1. Test Telegram Bot

**Mở Telegram và chat với bot:**

```
/start
```
✅ Kỳ vọng: Bot chào và hiển thị menu commands

```
/products
```
✅ Kỳ vọng: Bot hiển thị danh sách sản phẩm (nếu đã thêm)

```
/orders
```
✅ Kỳ vọng: Bot hiển thị "Bạn chưa có đơn hàng nào"

```
/stats
```
✅ Kỳ vọng: Bot hiển thị thống kê (chỉ admin)

---

### 2. Test Admin Panel

**Truy cập:** `http://localhost:3000/admin`

#### Bước 1: Kết nối
1. Nhập `ADMIN_TOKEN` từ file `.env`
2. Click "Kết nối"
3. ✅ Kỳ vọng: Chấm xanh hiện lên, dashboard load dữ liệu

#### Bước 2: Thêm sản phẩm
1. Vào tab "Sản phẩm"
2. Click "+ Thêm sản phẩm"
3. Điền:
   - Tên: Windows 11 Pro
   - Icon: 🪟
   - Giá: 150000
   - Danh mục: Phần mềm
   - Mô tả: Key bản quyền Windows 11
   - ✓ Giao hàng tự động
4. Click "Tạo sản phẩm"
5. ✅ Kỳ vọng: Sản phẩm xuất hiện trong bảng

#### Bước 3: Nhập kho
1. Click "📥 Nhập kho" ở sản phẩm vừa tạo
2. Nhập key (mỗi dòng 1 key):
   ```
   KEY-XXXX-YYYY-ZZZZ-1111
   KEY-AAAA-BBBB-CCCC-2222
   KEY-DDDD-EEEE-FFFF-3333
   ```
3. Click "Nhập kho"
4. ✅ Kỳ vọng: Tồn kho tăng lên 3

#### Bước 4: Tạo mã giảm giá
1. Vào tab "Mã giảm giá"
2. Click "+ Tạo mã mới"
3. Điền:
   - Mã: FLASH20
   - Loại: Giảm theo %
   - Giá trị: 20
   - Giảm tối đa: 50000
   - Đơn tối thiểu: 0
   - Giới hạn lượt: 100
   - Hết hạn sau: 30 (ngày)
4. Click "Tạo mã"
5. ✅ Kỳ vọng: Mã xuất hiện trong bảng

---

### 3. Test Mini App (Telegram)

#### Cấu hình Menu Button
1. Mở @BotFather
2. Gửi `/mybots`
3. Chọn bot của bạn
4. Bot Settings → Menu Button → Edit Menu Button
5. Nhập URL: `http://localhost:3000` (hoặc URL public nếu đã deploy)
6. Text: `🛍️ Mở Shop`

#### Test trong Telegram
1. Mở bot
2. Click nút "🛍️ Mở Shop" ở dưới cùng
3. ✅ Kỳ vọng: Mini app mở ra với giao diện shop

#### Test các chức năng:
- **Xem sản phẩm:** ✅ Hiển thị sản phẩm đã thêm
- **Lọc category:** ✅ Tab "Phần mềm", "Game", etc hoạt động
- **Chi tiết sản phẩm:** ✅ Click vào sản phẩm → modal hiện lên
- **Thêm giỏ hàng:** ✅ Click "Thêm vào giỏ" → badge số lượng tăng
- **Xem giỏ hàng:** ✅ Click icon 🛒 → drawer hiện ra
- **Áp mã giảm giá:** ✅ Nhập "FLASH20" → giảm 20%
- **Checkout:** ✅ Click "Thanh toán" → QR code hiện trong Telegram

---

### 4. Test Mini App (Browser - không qua Telegram)

**Truy cập:** `http://localhost:3000`

⚠️ **Lưu ý:** Một số tính năng Telegram sẽ không hoạt động (HapticFeedback, sendData)

#### Test các chức năng:
- **Xem sản phẩm:** ✅ Hoạt động bình thường
- **Giỏ hàng:** ✅ Hoạt động bình thường
- **Mã giảm giá:** ✅ Hoạt động bình thường
- **Checkout:** ⚠️ Sẽ gọi API trực tiếp thay vì qua Telegram
- **Xem đơn hàng:** ⚠️ Cần có `telegramId` thật

---

### 5. Test Webhook Ngân Hàng (Tự động xác nhận)

#### Dùng Postman/curl để test:

```bash
curl -X POST http://localhost:3000/bank-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 150000,
    "description": "Chuyen khoan ORD1715234567890"
  }'
```

**Luồng tự động:**
1. ✅ Server tìm đơn hàng có mã `ORD1715234567890`
2. ✅ Kiểm tra số tiền (cho phép sai lệch ±1000đ)
3. ✅ Xác nhận thanh toán
4. ✅ Lấy key từ kho và gửi cho khách qua Telegram
5. ✅ Thông báo admin về kết quả

**Kiểm tra:**
- Khách nhận được tin nhắn có key
- Admin nhận thông báo "✅ Giao hàng thành công!"
- Tồn kho giảm đi 1

---

### 6. Test Bot Commands (Admin)

#### Test /addstock
```
/addstock <productId> KEY-1111,KEY-2222,KEY-3333
```
✅ Kỳ vọng: Tồn kho tăng lên 3

#### Test /confirm (xác nhận thủ công)
```
/confirm ORD1715234567890 150000
```
✅ Kỳ vọng: 
- Đơn được xác nhận
- Key được gửi cho khách
- Admin nhận thông báo

#### Test /manualdeliver
```
/manualdeliver ORD1715234567890 KEY-MANUAL-TEST-1234
```
✅ Kỳ vọng: Khách nhận key thủ công

---

## Checklist Test Đầy Đủ

### Backend
- [ ] MongoDB kết nối thành công
- [ ] Server khởi động không lỗi
- [ ] Bot Telegram online

### Admin Panel
- [ ] Đăng nhập admin thành công
- [ ] Thêm sản phẩm
- [ ] Nhập kho
- [ ] Tạo mã giảm giá
- [ ] Xem đơn hàng
- [ ] Xác nhận thanh toán thủ công
- [ ] Giao hàng thủ công

### Mini App
- [ ] Xem danh sách sản phẩm
- [ ] Lọc theo category
- [ ] Xem chi tiết sản phẩm
- [ ] Thêm vào giỏ hàng
- [ ] Kiểm tra tồn kho (không cho thêm quá số lượng)
- [ ] Áp mã giảm giá
- [ ] Checkout
- [ ] Xem đơn hàng của mình

### Bot Commands
- [ ] /start
- [ ] /products
- [ ] /orders
- [ ] /coupon
- [ ] /addstock (admin)
- [ ] /confirm (admin)
- [ ] /manualdeliver (admin)
- [ ] /stats (admin)

### Webhook & Auto Delivery
- [ ] Webhook nhận được request
- [ ] Tìm đúng đơn hàng
- [ ] Xác nhận thanh toán tự động
- [ ] Giao hàng tự động
- [ ] Thông báo admin
- [ ] Tồn kho giảm đúng

---

## Lỗi Thường Gặp

### 1. "Cannot connect to MongoDB"
**Giải pháp:** Kiểm tra MongoDB đang chạy
```bash
# Windows
net start MongoDB

# Docker
docker start mongodb
```

### 2. "Bot token invalid"
**Giải pháp:** Kiểm tra `BOT_TOKEN` trong `.env` đúng chưa

### 3. "Admin panel không kết nối được"
**Giải pháp:** Kiểm tra `ADMIN_TOKEN` trong `.env` và nhập đúng token

### 4. "Mini app không load sản phẩm"
**Giải pháp:** 
- Kiểm tra server đang chạy
- Mở DevTools xem lỗi API
- Kiểm tra đã thêm sản phẩm chưa

### 5. "Checkout không tạo đơn"
**Giải pháp:**
- Trong Telegram: Kiểm tra handler `web_app_data` đã có
- Ngoài browser: Kiểm tra API `/api/orders` hoạt động

---

## Test Production (sau khi deploy)

1. Thay `http://localhost:3000` bằng URL production
2. Cấu hình webhook ngân hàng thật (Sepay/Casso/MB Auto)
3. Test với đơn hàng thật nhỏ
4. Kiểm tra log trên Render/server

---

## Debug Tips

### Xem log server:
```bash
npm start
# Hoặc
npm run dev  # có nodemon auto-reload
```

### Xem log MongoDB:
```bash
# Kết nối MongoDB shell
mongosh mongodb://localhost:27017/alxshop

# Xem orders
db.orders.find().pretty()

# Xem products
db.products.find().pretty()
```

### Test API trực tiếp:
```bash
# Lấy sản phẩm
curl http://localhost:3000/api/products

# Lấy đơn hàng (cần telegramId)
curl "http://localhost:3000/api/orders?telegramId=5446467416"

# Validate coupon
curl -X POST http://localhost:3000/api/discount/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"FLASH20","telegramId":5446467416,"orderTotal":150000}'
```
