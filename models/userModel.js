const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  phonenumber: { type: Number, required: true },
  password: { type: String, required: true },
  isBlocked: { type: Boolean, required: false },
  referralCode: { type: String, required: true },
  failedPayments: {
    type: [String], // Array of failed payment IDs
    default: [],
  },
});

module.exports = mongoose.model("users", userSchema);
