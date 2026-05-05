require("dotenv").config();
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const path       = require("path");
const { Telegraf, Markup } = require("telegraf");

const Order     = require("./models/Order");
const Product   = require("./models/Product");
const Discount  = require("./models/Discount");
const deliver   = require("./services/delivery");
const { checkLimit, formatRetry } = require("./utils/rateLimit");

// ── MongoDB ───────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => { console.error("❌ MongoDB:", err.message); process.exit(1); });

const app      = express();
const bot      = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = Number(process.env.ADMIN_ID);
const PORT     = process.env.PORT || 3000;

bot.use((ctx, next) => {
  if (!ctx.session) ctx.session = {};
  return next();
});

app.use(cors());
app.use(express.json());
app.use("/admin", express.static(path.join(__dirname, "../admin")));
app.use("/",      express.static(path.join(__dirname, "../client")));

const isAdmin = (id) => id === ADMIN_ID;

// ── Admin auth middleware ─────────────────────────────────
const adminAuth = (req, res, next) => {
  if (req.headers["x-admin-token"] !== process.env.ADMIN_TOKEN) return res.sendStatus(401);
  next();
};

// ── Helpers ───────────────────────────────────────────────
function buildQR(amount, orderId) {
  return `https://img.vietqr.io/image/${process.env.BANK_BIN}-${process.env.BANK_ACCOUNT}-qr_only.png?amount=${amount}&addInfo=${orderId}`;
}

/* ============================================================
   BOT — TELEGRAM
   ============================================================ */

// /start
bot.start(async (ctx) => {
  await ctx.replyWithHTML(
    `👋 Chào <b>${ctx.from.first_name}</b>! Chào mừng đến ALX SHOP.\n\n` +
    `🛒 /products  — Xem sản phẩm\n` +
    `📦 /orders    — Đơn hàng của tôi\n` +
    `🏷️ /coupon    — Mã giảm giá`
  );
});

// /products
bot.command("products", async (ctx) => {
  const products = await Product.find({ isActive: true });
  if (!products.length) return ctx.reply("🛒 Hiện chưa có sản phẩm nào.");
  for (const p of products) {
    await ctx.replyWithHTML(
      `${p.icon || "📦"} <b>${p.name}</b>\n` +
      `💰 <b>${p.price.toLocaleString("vi-VN")}đ</b>\n` +
      `📊 ${p.stock > 0 ? `Còn ${p.stock}` : "Hết hàng"}\n` +
      (p.description ? `📝 ${p.description}` : ""),
      Markup.inlineKeyboard([[
        Markup.button.callback(p.stock > 0 ? "🛒 Mua ngay" : "❌ Hết hàng", p.stock > 0 ? `buy_${p._id}` : "out_of_stock")
      ]])
    );
  }
});

// Callback mua
bot.action(/^buy_(.+)$/, async (ctx) => {
  const productId = ctx.match[1];
  const userId    = ctx.from.id;
  const { limited, retryAfter } = checkLimit(userId, "buy");
  if (limited) return ctx.answerCbQuery(`⏳ Chờ ${formatRetry(retryAfter)}`, { show_alert: true });
  await ctx.answerCbQuery();

  const product = await Product.findById(productId);
  if (!product?.inStock) return ctx.reply("❌ Sản phẩm đã hết hàng!");

  const discountCode   = ctx.session?.discountCode  || null;
  const discountAmount = ctx.session?.discountAmount || 0;
  const finalTotal     = Math.max(0, product.price - discountAmount);

  const order = await Order.create({
    telegramId: userId, username: ctx.from.username || "",
    items: [{ productId: product._id, productName: product.name, price: product.price, quantity: 1 }],
    total: finalTotal,
  });

  if (discountCode) {
    const disc = await Discount.findOne({ code: discountCode }).catch(() => null);
    if (disc) await disc.applyCode(userId, ctx.from.username, order.orderId, product.price).catch(() => {});
    if (ctx.session) { delete ctx.session.discountCode; delete ctx.session.discountAmount; }
  }

  await ctx.replyWithPhoto(
    { url: buildQR(order.total, order.orderId) },
    {
      caption:
        `🧾 <b>Đơn hàng #${order.orderId}</b>\n\n` +
        `📦 ${product.name}\n` +
        `💰 Giá gốc: ${product.price.toLocaleString("vi-VN")}đ\n` +
        (discountAmount ? `🏷️ Giảm giá: -${discountAmount.toLocaleString("vi-VN")}đ\n` : "") +
        `💳 Thanh toán: <b>${finalTotal.toLocaleString("vi-VN")}đ</b>\n\n` +
        `🏦 STK: <code>${process.env.BANK_ACCOUNT}</code>\n` +
        `📝 Nội dung CK: <code>${order.orderId}</code>\n\n` +
        `⏰ Hết hạn sau 30 phút`,
      parse_mode: "HTML",
    }
  );
});

bot.action("out_of_stock", ctx => ctx.answerCbQuery("❌ Hết hàng!", { show_alert: true }));

// Handle web_app_data from Telegram Mini App checkout
bot.on("web_app_data", async (ctx) => {
  try {
    const data = JSON.parse(ctx.webAppData.data);
    const order = await Order.create(data);

    await ctx.replyWithPhoto(
      { url: buildQR(order.total, order.orderId) },
      {
        caption:
          `🧾 <b>Đơn hàng #${order.orderId}</b>\n\n` +
          `📦 ${order.items.map(i => i.productName).join(", ")}\n` +
          `💳 Thanh toán: <b>${order.total.toLocaleString("vi-VN")}đ</b>\n\n` +
          `🏦 STK: <code>${process.env.BANK_ACCOUNT}</code>\n` +
          `📝 Nội dung CK: <code>${order.orderId}</code>\n\n` +
          `⏰ Hết hạn sau 30 phút`,
        parse_mode: "HTML",
      }
    );
  } catch (err) {
    console.error("[web_app_data]", err.message);
    await ctx.reply("❌ Lỗi tạo đơn hàng!");
  }
});

// /orders
bot.command("orders", async (ctx) => {
  const orders = await Order.find({ telegramId: ctx.from.id }).sort({ createdAt: -1 }).limit(5);
  if (!orders.length) return ctx.reply("📦 Bạn chưa có đơn hàng nào.");
  const icons = { waiting_payment:"⏳", paid:"💳", delivering:"🚚", completed:"✅", cancelled:"❌" };
  const lines = orders.map(o => `${icons[o.status] || "❓"} <code>${o.orderId}</code> — ${o.total.toLocaleString("vi-VN")}đ — ${o.status}`);
  ctx.replyWithHTML(`📦 <b>5 đơn gần nhất:</b>\n\n` + lines.join("\n"));
});

// /coupon
bot.command("coupon", async (ctx) => {
  const { limited, retryAfter } = checkLimit(ctx.from.id, "coupon");
  if (limited) return ctx.reply(`⏳ Chờ ${formatRetry(retryAfter)}`);
  const [, code] = ctx.message.text.split(" ");
  if (!code) return ctx.reply("⚠️ Dùng: /coupon <MÃ>");
  const cartTotal = ctx.session?.cartTotal || 0;
  if (!cartTotal) return ctx.reply("🛒 Chọn sản phẩm trước!");
  try {
    const { discount, discountAmount } = await Discount.validate(code, ctx.from.id, cartTotal);
    if (!ctx.session) ctx.session = {};
    ctx.session.discountCode   = discount.code;
    ctx.session.discountAmount = discountAmount;
    ctx.replyWithHTML(`✅ Mã <b>${discount.code}</b> hợp lệ!\n💰 Giảm: <b>${discountAmount.toLocaleString("vi-VN")}đ</b>\n🔢 Còn lại: ${discount.remaining} lượt`);
  } catch (err) { ctx.reply(`❌ ${err.message}`); }
});

// ── ADMIN COMMANDS ────────────────────────────────────────

bot.command("addstock", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Không có quyền!");
  const parts = ctx.message.text.split(" ");
  const productId = parts[1];
  const keys = parts.slice(2).join(" ").split(",").map(k => k.trim()).filter(Boolean);
  if (!productId || !keys.length) return ctx.reply("⚠️ Dùng: /addstock <productId> <key1,key2>");
  const product = await Product.findById(productId).catch(() => null);
  if (!product) return ctx.reply("❌ Không tìm thấy sản phẩm!");
  const newStock = await product.addStock(keys);
  if (!product.isActive) { product.isActive = true; await product.save(); }
  ctx.reply(`✅ Đã thêm ${keys.length} key\n📦 Tồn kho: ${newStock}`);
});

bot.command("confirm", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Không có quyền!");
  const [, orderId, amount] = ctx.message.text.split(" ");
  const order = await Order.findOne({ orderId }).catch(() => null);
  if (!order) return ctx.reply("❌ Không tìm thấy đơn!");
  await order.confirmPayment(Number(amount));
  const result = await deliver(bot, order);
  ctx.reply(`✅ Đơn ${orderId}\n📦 Giao: ${result.deliveredItems.length} | ❌ Lỗi: ${result.failedItems.length}`);
});

bot.command("manualdeliver", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Không có quyền!");
  const parts   = ctx.message.text.split(" ");
  const orderId = parts[1];
  const content = parts.slice(2).join(" ");
  if (!orderId || !content) return ctx.reply("⚠️ Dùng: /manualdeliver <orderId> <content>");
  const order = await Order.findOne({ orderId }).catch(() => null);
  if (!order) return ctx.reply("❌ Không tìm thấy đơn!");
  await bot.telegram.sendMessage(order.telegramId, `✅ <b>Giao hàng</b>\n📋 Đơn: <code>${orderId}</code>\n🔑 <code>${content}</code>`, { parse_mode: "HTML" });
  order.status = "completed"; order.deliveredAt = new Date(); await order.save();
  ctx.reply(`✅ Đã giao thủ công đơn ${orderId}`);
});

bot.command("stats", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Không có quyền!");
  const [revenue, totalDone, pending] = await Promise.all([
    Order.getRevenueSummary(),
    Order.countDocuments({ status: "completed" }),
    Order.countDocuments({ status: "waiting_payment" }),
  ]);
  const r = revenue[0] || { totalRevenue: 0 };
  ctx.replyWithHTML(
    `📊 <b>Thống kê</b>\n\n` +
    `💰 Doanh thu: <b>${r.totalRevenue.toLocaleString("vi-VN")}đ</b>\n` +
    `✅ Đơn thành công: ${totalDone}\n` +
    `⏳ Chờ thanh toán: ${pending}`
  );
});

/* ============================================================
   WEBHOOK NGÂN HÀNG (Sepay / Casso / MB Auto)
   ============================================================ */
app.post("/bank-webhook", async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || !description) return res.sendStatus(400);

    const match   = String(description).match(/ORD\d+/i);
    const orderId = match?.[0]?.toUpperCase();
    if (!orderId) return res.sendStatus(200);

    const order = await Order.findOne({ orderId, status: "waiting_payment" });
    if (!order) return res.sendStatus(200);

    if (Math.abs(order.total - amount) > 1000) {
      await bot.telegram.sendMessage(ADMIN_ID, `⚠️ Sai số tiền!\nĐơn: ${orderId} | Cần: ${order.total} | Nhận: ${amount}`);
      return res.sendStatus(200);
    }

    await order.confirmPayment(amount);

    const { failedItems } = await deliver(bot, order);
    if (failedItems.length) {
      await bot.telegram.sendMessage(ADMIN_ID, `⚠️ Đơn ${orderId}: ${failedItems.length} item giao thất bại!`);
    }

    console.log(`[webhook] ${orderId} +${amount}đ OK`);
    res.sendStatus(200);
  } catch (err) {
    console.error("[webhook]", err.message);
    res.sendStatus(500);
  }
});

/* ============================================================
   REST API — PRODUCTS
   ============================================================ */
app.get("/api/products", async (req, res) => {
  try {
    const filter = req.headers["x-admin-token"] === process.env.ADMIN_TOKEN ? {} : { isActive: true };
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/products", adminAuth, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.patch("/api/products/:id", adminAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post("/api/products/:id/stock", adminAuth, async (req, res) => {
  try {
    const { keys } = req.body;
    const product  = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Không tìm thấy" });
    const newStock = await product.addStock(keys);
    if (!product.isActive) { product.isActive = true; await product.save(); }
    res.json({ stock: newStock, added: keys.length });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

/* ============================================================
   REST API — ORDERS
   ============================================================ */
app.post("/api/orders", async (req, res) => {
  try {
    const order = await Order.create(req.body);
    res.status(201).json(order);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get("/api/orders", async (req, res) => {
  try {
    const { status, page = 1, limit = 200, telegramId } = req.query;
    const isAdmin = req.headers["x-admin-token"] === process.env.ADMIN_TOKEN;

    const filter = {};
    if (status) filter.status = status;

    if (!isAdmin) {
      if (!telegramId) return res.status(400).json({ error: "telegramId required" });
      filter.telegramId = Number(telegramId);
    } else if (telegramId) {
      filter.telegramId = Number(telegramId);
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const total  = await Order.countDocuments(filter);
    res.json({ orders, total, page: Number(page) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/api/orders/:orderId/confirm", adminAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Không tìm thấy" });
    await order.confirmPayment(Number(req.body.amount));
    const result = await deliver(bot, order);
    res.json({ ok: true, ...result });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.patch("/api/orders/:orderId/deliver", adminAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Không tìm thấy" });
    await bot.telegram.sendMessage(order.telegramId,
      `✅ <b>Giao hàng thủ công</b>\n📋 <code>${order.orderId}</code>\n🔑 <code>${req.body.content}</code>`,
      { parse_mode: "HTML" }
    );
    order.status = "completed"; order.deliveredAt = new Date(); await order.save();
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.patch("/api/orders/:orderId/cancel", adminAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Không tìm thấy" });
    await order.cancel(req.body.note || "Admin huỷ");
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

/* ============================================================
   REST API — DISCOUNTS
   ============================================================ */
app.get("/api/discounts", adminAuth, async (req, res) => {
  try { res.json(await Discount.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/discounts", adminAuth, async (req, res) => {
  try { res.status(201).json(await Discount.create(req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete("/api/discounts/:id", adminAuth, async (req, res) => {
  try { await Discount.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

app.post("/api/discount/validate", async (req, res) => {
  try {
    const { code, telegramId, orderTotal } = req.body;
    const result = await Discount.validate(code, telegramId, orderTotal);
    res.json({ discountAmount: result.discountAmount, code: result.discount.code });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

/* ============================================================
   REST API — STATS
   ============================================================ */
app.get("/api/stats", adminAuth, async (req, res) => {
  try {
    const [revenue, products, pendingOrders] = await Promise.all([
      Order.getRevenueSummary(),
      Product.find().select("name stock isActive"),
      Order.countDocuments({ status: "waiting_payment" }),
    ]);
    res.json({
      revenue:       revenue[0] || { totalRevenue: 0, totalOrders: 0 },
      products,
      pendingOrders,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   START
   ============================================================ */
bot.launch()
  .then(() => console.log("🤖 Telegram bot started"))
  .catch(err => console.error("❌ Bot:", err.message));

app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`));

process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
