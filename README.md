# ALX SHOP - Telegram Mini App

Shop bán hàng số tự động với Telegram Bot + Mini App + Admin Panel + Ví nạp tiền.

## Tính năng

- Telegram Bot bán hàng tự động
- Telegram Mini App giao diện hiện đại
- Hệ thống ví nạp tiền và thanh toán bằng số dư
- Admin panel quản lý sản phẩm, đơn hàng, mã giảm giá
- Thanh toán QR ngân hàng VietQR
- Tự động giao key/tài khoản sau thanh toán
- Quản lý tồn kho
- Mã giảm giá
- Theo dõi đơn hàng
- Top nạp tiền tháng
- Kho key cá nhân

## Cài đặt

### 1. Cài dependencies

```bash
npm install
```

### 2. Cấu hình môi trường

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Chỉnh các giá trị trong `.env`:

```env
MONGO_URL=mongodb://localhost:27017/alxshop
BOT_TOKEN=your_bot_token_here
ADMIN_ID=your_telegram_user_id
ADMIN_TOKEN=your_secure_admin_token_here
BANK_BIN=970407
BANK_ACCOUNT=your_bank_account_number
PORT=3000
```

### 3. Chạy MongoDB

Đảm bảo MongoDB đang chạy local hoặc dùng MongoDB Atlas.

### 4. Chạy dự án

```bash
npm start
```

Hoặc development mode:

```bash
npm run dev
```

## Cấu trúc

```
newminiapp/
├── client/          # Mini app cho khách hàng
│   └── index.html
├── admin/           # Admin panel
│   └── admin.html
├── server/          # Backend API + Bot
│   ├── server.js
│   ├── models/
│   │   ├── Product.js
│   │   ├── Order.js
│   │   ├── Discount.js
│   │   ├── User.js
│   │   └── Topup.js
│   ├── services/
│   │   └── delivery.js
│   └── utils/
│       └── rateLimit.js
├── start.js         # Entry point
└── package.json
```

## URL

- Mini app: `http://localhost:3000`
- Admin panel: `http://localhost:3000/admin`

## Cấu hình Bot Telegram

1. Tạo bot qua @BotFather và lấy `BOT_TOKEN`
2. Cấu hình Menu Button:
   - Vào @BotFather
   - `/mybots` → chọn bot của bạn
   - Bot Settings → Menu Button → Edit Menu Button
   - Nhập URL: `https://your-domain.com`
   - Text button: `🛍️ Mở Shop`

## Webhook ngân hàng

Endpoint: `POST /bank-webhook`

Body format:
```json
{
  "amount": 150000,
  "description": "NAP1234567890"
}
```

Hỗ trợ cả mã đơn hàng (ORD...) và mã nạp tiền (NAP...).

## Bot Commands

- `/start` - Khởi động bot
- `/products` - Xem sản phẩm
- `/orders` - Đơn hàng của tôi
- `/coupon <MÃ> <SỐ_TIỀN>` - Kiểm tra mã giảm giá

### Admin Commands

- `/addstock <productId> <key1,key2>` - Nhập kho
- `/confirm <orderId> <amount>` - Xác nhận thanh toán
- `/manualdeliver <orderId> <content>` - Giao hàng thủ công
- `/stats` - Thống kê

## API Endpoints

### User & Wallet
- `GET /api/me?telegramId=...` - Lấy profile, số dư, kho key

### Topups
- `POST /api/topups` - Tạo yêu cầu nạp tiền
- `GET /api/topups?telegramId=...` - Lịch sử nạp
- `GET /api/leaderboard/topups` - Top nạp tháng

### Products
- `GET /api/products` - Lấy danh sách sản phẩm
- `POST /api/products` - Tạo sản phẩm (admin)
- `PATCH /api/products/:id` - Cập nhật sản phẩm (admin)
- `POST /api/products/:id/stock` - Nhập kho (admin)

### Orders
- `GET /api/orders` - Lấy đơn hàng (user: cần telegramId, admin: tất cả)
- `POST /api/orders` - Tạo đơn hàng (server tự tính giá, trừ ví)
- `PATCH /api/orders/:orderId/confirm` - Xác nhận thanh toán (admin)
- `PATCH /api/orders/:orderId/deliver` - Giao hàng thủ công (admin)
- `PATCH /api/orders/:orderId/cancel` - Hủy đơn (admin)

### Discounts
- `GET /api/discounts` - Lấy danh sách mã (admin)
- `POST /api/discounts` - Tạo mã (admin)
- `DELETE /api/discounts/:id` - Xóa mã (admin)
- `POST /api/discount/validate` - Validate mã giảm giá

### Stats & Feed
- `GET /api/stats` - Thống kê tổng quan (admin)
- `GET /api/feed/recent` - Feed giao dịch gần đây

## License

MIT
