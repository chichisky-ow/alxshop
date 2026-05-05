const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema(
  {
    productId:        { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName:      String,
    price:            Number,
    quantity:         { type: Number, default: 1 },
    deliveredContent: [String],
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderId:   { type: String, unique: true, default: () => "ORD" + Date.now() },
    telegramId:{ type: Number, required: true, index: true },
    username:  { type: String, default: "" },
    items:     { type: [OrderItemSchema], required: true },
    total:     { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["waiting_payment","paid","delivering","completed","cancelled","refunded"],
      default: "waiting_payment",
      index: true,
    },

    paymentMethod: { type: String, enum: ["bank_transfer","momo","manual"], default: "bank_transfer" },
    paidAt:        { type: Date, default: null },
    paidAmount:    { type: Number, default: 0 },

    deliveredAt: { type: Date, default: null },
    note:        { type: String, default: "" },
  },
  { timestamps: true }
);

OrderSchema.virtual("isPaid").get(function () {
  return ["paid","delivering","completed"].includes(this.status);
});

OrderSchema.virtual("isExpired").get(function () {
  return this.status === "waiting_payment" && Date.now() - this.createdAt.getTime() > 30 * 60 * 1000;
});

OrderSchema.methods.confirmPayment = async function (amount) {
  this.status     = "paid";
  this.paidAt     = new Date();
  this.paidAmount = amount;
  await this.save();
  return this;
};

OrderSchema.methods.markDelivered = async function (deliveredItems = []) {
  for (const d of deliveredItems) {
    const item = this.items.find(i => String(i.productId) === String(d.productId));
    if (item) item.deliveredContent = d.content;
  }
  this.status      = "completed";
  this.deliveredAt = new Date();
  await this.save();
  return this;
};

OrderSchema.methods.cancel = async function (note = "") {
  this.status = "cancelled";
  this.note   = note;
  await this.save();
  return this;
};

OrderSchema.statics.getPendingByUser = function (telegramId) {
  return this.findOne({ telegramId, status: "waiting_payment" }).sort({ createdAt: -1 });
};

OrderSchema.statics.getRevenueSummary = async function () {
  return this.aggregate([
    { $match: { status: "completed" } },
    { $group: { _id: null, totalRevenue: { $sum: "$total" }, totalOrders: { $count: {} } } },
  ]);
};

module.exports = mongoose.model("Order", OrderSchema);
