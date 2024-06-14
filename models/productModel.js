const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "category",
    required: true,
  },
  productImage: [{ type: String }],

  productPrice: { type: Number, required: true },
  productStock: { type: Number, required: true },
  productOfferId: { type: mongoose.Types.ObjectId, default: null },
  productOfferPercentage: { type: Number, default: null },
  priceBeforeOffer: { type: Number, default: null },
  isListed: { type: Boolean, default: true },
});

module.exports = mongoose.model("products", productSchema);
