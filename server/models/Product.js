const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price:       { type: Number, required: true, min: 0 },
    category:    { type: String, default: "other", enum: ["software","game","account","other"] },
    icon:        { type: String, default: "📦" },
    imageUrl:    { type: String, default: "" },

    appName:      { type: String, default: "" },
    packageLabel: { type: String, default: "" },
    sortOrder:    { type: Number, default: 0 },

    stock:       { type: Number, default: 0, min: 0 },
    autoDeliver: { type: Boolean, default: true },
    contentPool: { type: [String], default: [] },

    isActive:    { type: Boolean, default: true },
    isHot:       { type: Boolean, default: false },
    totalSold:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProductSchema.virtual("inStock").get(function () {
  return this.stock > 0 || !this.autoDeliver;
});

ProductSchema.methods.popContent = async function () {
  if (this.contentPool.length === 0) throw new Error("Hết hàng trong kho!");
  const content = this.contentPool.shift();
  this.stock    = Math.max(0, this.stock - 1);
  this.totalSold += 1;
  await this.save();
  return content;
};

ProductSchema.methods.addStock = async function (items = []) {
  this.contentPool.push(...items);
  this.stock += items.length;
  await this.save();
  return this.stock;
};

module.exports = mongoose.model("Product", ProductSchema);
