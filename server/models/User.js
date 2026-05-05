const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    telegramId:  { type: Number, required: true, unique: true, index: true },
    username:    { type: String, default: "" },
    displayName: { type: String, default: "" },

    balance:     { type: Number, default: 0, min: 0 },
    totalTopup:  { type: Number, default: 0, min: 0 },
    totalSpent:  { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

UserSchema.virtual("totalKeys").get(function () {
  return 0;
});

UserSchema.statics.findOrCreate = async function (telegramId, username = "", displayName = "") {
  let user = await this.findOne({ telegramId });
  if (!user) {
    user = await this.create({ telegramId, username, displayName: displayName || username });
  }
  return user;
};

UserSchema.methods.addBalance = async function (amount) {
  this.balance += amount;
  this.totalTopup += amount;
  await this.save();
  return this.balance;
};

UserSchema.methods.deductBalance = async function (amount) {
  if (this.balance < amount) throw new Error("Số dư không đủ!");
  this.balance -= amount;
  this.totalSpent += amount;
  await this.save();
  return this.balance;
};

module.exports = mongoose.model("User", UserSchema);
