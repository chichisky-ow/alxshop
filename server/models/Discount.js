const mongoose = require("mongoose");

const UsageHistorySchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true },
    username:   { type: String, default: "" },
    orderId:    { type: String, required: true },
    discount:   { type: Number, required: true },
  },
  { timestamps: true }
);

const DiscountSchema = new mongoose.Schema(
  {
    code:        { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, default: "" },

    type:        { type: String, enum: ["percent","fixed","freeship"], default: "percent" },
    percent:     { type: Number, min: 0, max: 100, default: null },
    fixedAmount: { type: Number, min: 0, default: null },

    maxDiscountAmount: { type: Number, default: null },
    minOrderAmount:    { type: Number, default: 0 },
    applicableProducts:{ type: [mongoose.Schema.Types.ObjectId], ref: "Product", default: [] },

    maxUse:        { type: Number, default: null },
    maxUsePerUser: { type: Number, default: 1 },
    used:          { type: Number, default: 0, min: 0 },

    startAt:  { type: Date, default: Date.now },
    expireAt: { type: Date, default: null, index: true },
    isActive: { type: Boolean, default: true },

    usageHistory: { type: [UsageHistorySchema], default: [] },
  },
  { timestamps: true }
);

DiscountSchema.virtual("isValid").get(function () {
  const now = Date.now();
  if (!this.isActive)                             return false;
  if (this.startAt  && this.startAt  > now)       return false;
  if (this.expireAt && this.expireAt < now)        return false;
  if (this.maxUse   && this.used >= this.maxUse)  return false;
  return true;
});

DiscountSchema.virtual("remaining").get(function () {
  if (this.maxUse === null) return "∞";
  return Math.max(0, this.maxUse - this.used);
});

DiscountSchema.methods.calcDiscount = function (orderTotal) {
  if (!this.isValid) throw new Error("Mã giảm giá không hợp lệ!");
  if (orderTotal < this.minOrderAmount)
    throw new Error(`Đơn hàng tối thiểu ${this.minOrderAmount.toLocaleString("vi-VN")}đ!`);
  let amount = 0;
  if (this.type === "percent") {
    amount = Math.floor(orderTotal * this.percent / 100);
    if (this.maxDiscountAmount) amount = Math.min(amount, this.maxDiscountAmount);
  } else if (this.type === "fixed") {
    amount = Math.min(this.fixedAmount, orderTotal);
  }
  return amount;
};

DiscountSchema.methods.checkUserUsage = function (telegramId) {
  return this.usageHistory.filter(h => h.telegramId === telegramId).length < this.maxUsePerUser;
};

DiscountSchema.methods.applyCode = async function (telegramId, username, orderId, orderTotal) {
  if (!this.isValid)               throw new Error("Mã không còn hiệu lực!");
  if (!this.checkUserUsage(telegramId)) throw new Error(`Bạn đã dùng hết lượt cho mã này!`);
  const discountAmount = this.calcDiscount(orderTotal);
  this.usageHistory.push({ telegramId, username, orderId, discount: discountAmount });
  this.used += 1;
  await this.save();
  return discountAmount;
};

DiscountSchema.statics.validate = async function (code, telegramId, orderTotal) {
  const discount = await this.findOne({ code: code.toUpperCase() });
  if (!discount)                        throw new Error("Mã giảm giá không tồn tại!");
  if (!discount.isValid)                throw new Error("Mã đã hết hạn hoặc dùng hết!");
  if (!discount.checkUserUsage(telegramId)) throw new Error("Bạn đã dùng hết lượt cho mã này!");
  if (orderTotal < discount.minOrderAmount) throw new Error(`Đơn tối thiểu ${discount.minOrderAmount.toLocaleString("vi-VN")}đ!`);
  const discountAmount = discount.calcDiscount(orderTotal);
  return { discount, discountAmount };
};

DiscountSchema.statics.getStats = async function () {
  return this.aggregate([
    { $project: { code: 1, type: 1, used: 1, maxUse: 1, totalDiscount: { $sum: "$usageHistory.discount" }, isActive: 1, expireAt: 1 } },
    { $sort: { used: -1 } },
  ]);
};

module.exports = mongoose.model("Discount", DiscountSchema);
