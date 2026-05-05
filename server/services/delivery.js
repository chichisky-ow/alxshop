const Product = require("../models/Product");
const Order   = require("../models/Order");

module.exports = async function deliver(bot, order) {
  const deliveredItems = [];
  const failedItems    = [];

  for (const item of order.items) {
    try {
      const product = await Product.findById(item.productId);
      if (!product)                           { failedItems.push({ item, reason: "Sản phẩm không tồn tại" }); continue; }
      if (!product.autoDeliver)               { failedItems.push({ item, reason: "Giao hàng thủ công" }); continue; }
      if (product.contentPool.length === 0)   { failedItems.push({ item, reason: "Hết hàng trong kho" }); continue; }

      const qty      = item.quantity || 1;
      const contents = [];
      for (let i = 0; i < qty; i++) {
        if (!product.contentPool.length) break;
        contents.push(product.contentPool.shift());
        product.stock = Math.max(0, product.stock - 1);
      }
      product.totalSold += contents.length;
      await product.save();

      const lines = contents.map((c, i) => `  ${i + 1}. <code>${c}</code>`).join("\n");
      await bot.telegram.sendMessage(
        order.telegramId,
        `✅ <b>Giao hàng thành công!</b>\n\n` +
        `📦 <b>${product.name}</b> × ${contents.length}\n\n` +
        `🔑 Nội dung:\n${lines}\n\n` +
        `📋 Đơn: <code>${order.orderId}</code>`,
        { parse_mode: "HTML" }
      );

      deliveredItems.push({ productId: item.productId, content: contents });

      if (product.stock === 0) {
        product.isActive = false;
        await product.save();
        await _notifyAdmin(bot, `🚨 <b>Hết hàng!</b>\n📦 ${product.name} đã hết kho và bị ẩn tự động.\nDùng /addstock để nhập thêm.`);
      } else if (product.stock <= 5) {
        await _notifyAdmin(bot, `⚠️ <b>Sắp hết hàng!</b>\n📦 ${product.name}\n📊 Còn lại: <b>${product.stock}</b>`);
      }
    } catch (err) {
      console.error(`[delivery] ${item.productId}:`, err.message);
      failedItems.push({ item, reason: err.message });
    }
  }

  if (failedItems.length === 0) {
    await order.markDelivered(deliveredItems);
    await _notifyAdmin(bot,
      `✅ <b>Giao hàng thành công!</b>\n` +
      `📋 Đơn: <code>${order.orderId}</code>\n` +
      `👤 @${order.username || order.telegramId}\n` +
      `💰 ${order.total.toLocaleString("vi-VN")}đ\n` +
      `📦 ${deliveredItems.length} sản phẩm đã giao`
    );
  } else if (deliveredItems.length > 0) {
    await order.markDelivered(deliveredItems);
    order.note = `Chưa giao: ${failedItems.map(f => f.item.productName).join(", ")}`;
    await order.save();
    await _notifyAdmin(bot,
      `⚠️ <b>Giao hàng một phần</b>\nĐơn: <code>${order.orderId}</code>\n❌ Thất bại:\n` +
      failedItems.map(f => `  • ${f.item.productName}: ${f.reason}`).join("\n")
    );
  } else {
    order.note = "Giao hàng tự động thất bại";
    await order.save();
    await _notifyAdmin(bot,
      `🚨 <b>Giao hàng thất bại!</b>\nĐơn: <code>${order.orderId}</code>\n👤 @${order.username}\n💰 ${order.total.toLocaleString("vi-VN")}đ\n❌ ` +
      failedItems.map(f => f.reason).join(", ")
    );
    await bot.telegram.sendMessage(
      order.telegramId,
      `⏳ Đơn <code>${order.orderId}</code> đang được xử lý thủ công.\nBạn sẽ nhận hàng trong vài phút!`,
      { parse_mode: "HTML" }
    );
  }

  return { deliveredItems, failedItems };
};

async function _notifyAdmin(bot, message) {
  try {
    await bot.telegram.sendMessage(process.env.ADMIN_ID, message, { parse_mode: "HTML" });
  } catch {}
}
