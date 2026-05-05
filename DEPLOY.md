# Hướng dẫn Deploy lên Production

## Phương án 1: Deploy lên Render.com (Khuyến nghị - Miễn phí)

### Bước 1: Chuẩn bị MongoDB Atlas

1. Truy cập https://cloud.mongodb.com
2. Tạo tài khoản/đăng nhập
3. Tạo cluster mới (Free tier M0)
4. Database Access → Add New Database User:
   - Username: `alxshop_user`
   - Password: Tạo password mạnh (lưu lại)
5. Network Access → Add IP Address:
   - Chọn "Allow Access from Anywhere" (0.0.0.0/0)
6. Lấy connection string:
   - Clusters → Connect → Connect your application
   - Copy connection string dạng: 
     ```
     mongodb+srv://alxshop_user:<password>@cluster0.xxxxx.mongodb.net/alxshop?retryWrites=true&w=majority
     ```
   - Thay `<password>` bằng password thật

### Bước 2: Push code lên GitHub

```powershell
cd C:\Users\Administrator\Downloads\newminiapp\newminiapp

# Khởi tạo git (nếu chưa có)
git init
git add .
git commit -m "Initial commit - ALX Shop"

# Tạo repo trên GitHub và push
git remote add origin https://github.com/YOUR_USERNAME/alxshop.git
git branch -M main
git push -u origin main
```

### Bước 3: Deploy lên Render.com

1. Truy cập https://render.com
2. Đăng nhập bằng GitHub
3. New → Web Service
4. Connect repository: chọn repo `alxshop`
5. Cấu hình:
   - **Name:** `alxshop`
   - **Region:** Singapore (gần VN nhất)
   - **Branch:** `main`
   - **Root Directory:** để trống
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

6. Environment Variables (Add từng biến):
   ```
   MONGO_URL=mongodb+srv://alxshop_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/alxshop?retryWrites=true&w=majority
   BOT_TOKEN=YOUR_BOT_TOKEN_HERE
   ADMIN_ID=YOUR_TELEGRAM_ID
   ADMIN_TOKEN=YOUR_SECURE_RANDOM_TOKEN
   BANK_BIN=970407
   BANK_ACCOUNT=YOUR_BANK_ACCOUNT
   PORT=3000
   NODE_ENV=production
   ```

7. Click "Create Web Service"
8. Đợi deploy xong (3-5 phút)
9. Lấy URL: `https://alxshop.onrender.com`

### Bước 4: Cấu hình Bot Telegram

1. Mở @BotFather trên Telegram
2. Gửi `/setcommands`
3. Chọn bot của bạn
4. Paste danh sách commands:
   ```
   start - Khởi động bot
   products - Xem sản phẩm
   orders - Đơn hàng của tôi
   coupon - Áp dụng mã giảm giá
   stats - Thống kê (admin)
   ```

5. Cấu hình Menu Button:
   - Gửi `/mybots`
   - Chọn bot
   - Bot Settings → Menu Button → Edit Menu Button
   - URL: `https://alxshop.onrender.com`
   - Text: `🛍️ Mở Shop`

### Bước 5: Test Production

1. Mở bot trên Telegram
2. Gửi `/start` → kiểm tra bot phản hồi
3. Click "🛍️ Mở Shop" → mini app mở ra
4. Test admin panel: `https://alxshop.onrender.com/admin`

---

## Cấu hình Webhook Ngân Hàng

### Sepay.vn (Khuyến nghị)

1. Đăng ký tài khoản tại https://sepay.vn
2. Liên kết tài khoản ngân hàng
3. Cấu hình webhook:
   - URL: `https://alxshop.onrender.com/bank-webhook`
   - Method: POST
   - Format: JSON

### Casso.vn

1. Đăng ký tại https://casso.vn
2. Liên kết ngân hàng
3. Webhook settings:
   - URL: `https://alxshop.onrender.com/bank-webhook`

---

## Checklist sau khi Deploy

- [ ] Bot Telegram online và phản hồi `/start`
- [ ] Mini app mở được từ Menu Button
- [ ] Admin panel truy cập được
- [ ] Thêm được sản phẩm qua admin panel
- [ ] Nhập kho thành công
- [ ] Tạo đơn hàng test
- [ ] Webhook ngân hàng hoạt động

---

## Test Webhook

```bash
curl -X POST https://alxshop.onrender.com/bank-webhook \
  -H "Content-Type: application/json" \
  -d '{"amount":150000,"description":"Test ORD1234567890"}'
```

---

## Lưu ý quan trọng

1. **Render Free tier:** Server sẽ sleep sau 15 phút không hoạt động. Lần đầu truy cập sau khi sleep sẽ mất ~30s để wake up.

2. **MongoDB Atlas Free tier:** Giới hạn 512MB storage, đủ cho vài nghìn đơn hàng.

3. **Backup dữ liệu:** MongoDB Atlas tự động backup (2 days retention trên free tier).

4. **Update code:** Push lên GitHub → Render tự động deploy lại.
