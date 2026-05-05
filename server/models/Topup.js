const mongoose = require("mongoose");

const TopupSchema = new mongoose.Schema(
  {
    topupId:    { type: String, unique: true, default: () => "NAP" + Date.now() },
    telegramId: { type: Number, required: true, index: true },
    username:   { type: String, default: "" },

    amount:     { type: Number, required: true, min: 0 },
    status:     { type: String, enum: ["pending","paid","cancelled"], default: "pending", index: true },

    paidAt:     { type: Date, default: null },
    note:       { type: String, default: "" },
  },
  { timestamps: true }
);

TopupSchema.methods.markPaid = async function () {
  this.status = "paid";
  this.paidAt = new Date();
  await this.save();
  return this;
};

TopupSchema.statics.getMonthlyLeaderboard = async function () {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  return this.aggregate([
    { $match: { status: "paid", paidAt: { $gte: startOfMonth } } },
    { $group: { _id: "$telegramId", username: { $first: "$username" }, total: { $sum: "$amount" } } },
    { $sort: { total: -1 } },
    { $limit: 10 },
  ]);
};

module.exports = mongoose.model("Topup", TopupSchema);
