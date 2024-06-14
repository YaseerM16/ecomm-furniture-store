const mongoose = require("mongoose");

const wishListSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, required: true, ref: "users" },
  productId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "products",
  },
  wishList: { type: Boolean, default: false },
});

module.exports = mongoose.model("wishlist", wishListSchema);
