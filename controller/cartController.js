const cartCollection = require("../models/cartModel");
const productCollection = require("../models/productModel");
const addressCollection = require("../models/addressModel");
const orderCollection = require("../models/orderModel");
const userCollection = require("../models/userModel");
const couponCollection = require("../models/couponModel");
const walletCollection = require("../models/walletModel");
const couponController = require("../controller/couponController");
const paymentController = require("../controller/paymentController");
const crypto = require("crypto");
const AppError = require("../middlewares/errorHandling");

const addToCart = async (req, res, next) => {
  try {
    console.log(typeof req.query.pid);
    const productExist = await cartCollection.findOne({
      userId: req.session.currentUser._id,
      productId: req.query.pid,
    });

    if (productExist) {
      const presentQty = parseInt(productExist.productQuantity);
      const qty = parseInt(req.query.quantity);
      const productPrice = parseInt(req.query.productPrice);

      await cartCollection.updateOne(
        { productId: req.query.pid },
        {
          $set: {
            productQuantity: presentQty + qty,
            totalCostPerProduct: (presentQty + qty) * productPrice,
          },
        }
      );
    } else {
      const qty = parseInt(req.query.quantity);
      const productPrice = parseInt(req.query.productPrice);
      const product = {
        userId: req.session.currentUser._id,
        productId: req.query.pid,
        productQuantity: qty,
        totalCostPerProduct: qty * productPrice,
      };
      await cartCollection.insertMany([product]);
    }
    res.send({ success: true });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.query.userID;
    const productId = req.query.productID;

    const result = await cartCollection.deleteOne({
      userId: userId,
      productId: productId,
    });

    if (result.deletedCount > 0) {
      res.send({ success: true, message: "Product removed from cart." });
    } else {
      res.status(404).send("Product not found in cart.");
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const cartPage = async (req, res, next) => {
  try {
    let user;
    if (req.session.logged) {
      const email = req.session.currentUser.email;
      user = await userCollection.findOne({ email: email });
    } else {
      user = {};
    }
    const cartProducts = await cartCollection
      .find({
        userId: req.session.currentUser._id,
      })
      .populate("productId");

    let totalItems = 0;
    let grandTotal = 0;
    let outOfStockItems = [];

    // Loop through the cart items and check actual available quantities
    for (const item of cartProducts) {
      const product = item.productId;

      if (product.productStock < item.productQuantity) {
        // If available quantity is less than cart quantity, adjust it
        outOfStockItems.push({
          productName: product.productName,
          requestedQuantity: item.productQuantity,
          availableQuantity: product.productStock,
        });

        // Update the cart item to reflect the actual available quantity
        await cartCollection.updateOne(
          { _id: item._id },
          {
            $set: {
              productQuantity: product.productStock,
              totalCostPerProduct: product.productStock * product.productPrice,
            },
          }
        );

        item.productQuantity = product.productStock;
        item.totalCostPerProduct = product.productStock * product.productPrice;
      }

      totalItems += item.productQuantity;
      grandTotal += item.totalCostPerProduct;
    }

    if (!cartProducts || cartProducts.length === 0) {
      // Render the EJS page with an empty cartProducts array
      res.render("userViews/cart", {
        cartProducts: [],
        user: user,
      });
    } else {
      // Render the EJS page with the cartProducts data
      res.render("userViews/cart", {
        cartProducts: cartProducts,
        user: user,
        outOfStockItems,
      });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const cartIncDecBtn = async (req, res, next) => {
  try {
    const productId = req.query.productID;
    const quantity = parseInt(req.query.quantity);
    const action = req.query.action;

    // Retrieve the product from the database
    const product = await productCollection.findOne({ _id: productId });
    const productPrice = parseInt(product.productPrice);
    if (!product) {
      return res
        .status(404)
        .send({ success: false, message: "Product not found" });
    }

    const productStock = parseInt(product.productStock);
    const updateTotalCostPerProduct = quantity * productPrice;
    if (action === "minus") {
      // If action is 'minus' and quantity > 0, decrement the cart
      if (quantity > 1) {
        const cartProduct = await cartCollection.findOneAndUpdate(
          { productId },
          {
            $inc: { productQuantity: -1 },
            $set: {
              totalCostPerProduct: updateTotalCostPerProduct - productPrice,
            },
          },
          { new: true } // Return the updated document
        );

        // Send success response with updated cart product
        res.send({
          success: true,
          quantity: quantity - 1,
          action: "minus",
          totalCostPerProduct: updateTotalCostPerProduct - productPrice,
        });
      } else {
        res.send({
          success: false,
          quantity: quantity + 1,
          message: "Invalid quantity",
        });
      }
    } else if (action === "plus") {
      // If action is 'plus' and quantity < productStock, increment the cart
      if (quantity < productStock) {
        const cartProduct = await cartCollection.findOneAndUpdate(
          { productId },
          {
            $inc: { productQuantity: 1 },
            $set: {
              totalCostPerProduct: updateTotalCostPerProduct + productPrice,
            },
          },
          { new: true } // Return the updated document
        );

        // Send success response with updated cart product
        res.send({
          success: true,
          quantity: quantity + 1,
          action: "plus",
          totalCostPerProduct: updateTotalCostPerProduct + productPrice,
        });
      } else {
        res.status(400).send({ success: false, exceed: true });
      }
    } else {
      res.status(400).send({ success: false, message: "Invalid action" });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const quantityIncBtn = async (req, res, next) => {
  try {
    const product = await productCollection.findOne({ _id: req.query.pid });
    if (!product) {
      console.log("The product is not existing: !!!!");
    } else {
      const productStock = parseInt(product.productStock);
      if (req.query.inputQty > productStock) {
        res.send({ exceed: true });
      } else {
        res.send({ avail: true });
      }
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const addressCheckOutPage = async (req, res, next) => {
  try {
    let user;
    if (req.session.logged) {
      const email = req.session.currentUser.email;
      user = await userCollection.findOne({ email: email });
    } else {
      user = {};
    }
    req.session.cartData = req.body.cartData;
    req.session.cartTotal = req.query.grandTotal;

    req.session.save();
    const userId = req.session.currentUser._id;
    const userAddress = await addressCollection.find({
      userId: userId,
    });
    res.render("userViews/selectAddress", {
      user: req.session.currentUser,
      addresses: userAddress,
      user: user,
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const redirecPaymentMethod = async (req, res, next) => {
  try {
    if (!req.query.addressId) {
      console.log("The Address Id is not retrieve from the CheckOut Page :");
    } else {
      req.session.addressId = req.query.addressId;
      res.send({ success: true });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const paymentMethodPage = async (req, res, next) => {
  try {
    let user;
    if (req.session.logged) {
      const email = req.session.currentUser.email;
      user = await userCollection.findOne({ email: email });
    } else {
      user = {};
    }
    req.session.couponApplied = false;
    req.session.appliedCouponId = null;
    req.session.discountAmout ??= 0;
    req.session.couponID = null;
    req.session.cartTotal =
      parseInt(req.session.cartTotal) + parseInt(req.session.discountAmout);

    // console.log("address Id is retrieved in session:" + req.session.addressId);

    res.render("userViews/selectPayment", { user: user });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const checkoutPage = async (req, res, next) => {
  try {
    let user;
    if (req.session.logged) {
      const email = req.session.currentUser.email;
      user = await userCollection.findOne({ email: email });
    } else {
      user = {};
    }

    req.session.paymentMethod = req.query.paymentmethod;
    const cartProducts = await cartCollection
      .find({
        userId: req.session.currentUser._id,
      })
      .populate("productId");

    const addressDet = await addressCollection.findOne({
      _id: req.session.addressId,
    });

    let inSufficienBalance = null;

    /// Check for Wallet Balance
    if (req.query.paymentmethod === "wallet") {
      const userWallet = await walletCollection.findOne({
        userId: req.session.currentUser._id,
      });
      const transactionAmount = req.session.cartTotal;
      const walletBalance = userWallet.walletBalance;

      if (walletBalance < transactionAmount) {
        inSufficienBalance = "wallet";
      }
    }
    let insufficientCod = null;
    if (req.query.paymentmethod === "cod" && req.session.cartTotal < 5000) {
      req.session.insufficientCod = true;
    }
    await couponController.updateCouponsStatus();
    const coupons = await couponCollection.find({ currentStatus: true });

    if (!cartProducts && !addressDet) {
      console.log("The Cart product or Address is not getting");
    } else {
      res.render("userViews/checkOutPage", {
        cartProducts: cartProducts,
        addressDet: addressDet,
        user: user,
        coupons,
        grandTotal: req.session.cartTotal,
        paymentMethod: req.query.paymentmethod,
        inSufficienBalance,
        couponDet: {
          isApplied: req.session.couponApplied,
          providedDisc: req.session.discountAmout,
          couponId: req.session.couponID,
        },
        insufficientCod: req.session.insufficientCod,
      });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const applyCoupon = async (req, res, next) => {
  try {
    const requestCoupon = await couponCollection.findOne({
      _id: req.query.couponID,
      currentStatus: true,
    });
    if (req.session.couponApplied) {
      res.send({ couponCodeExists: true });
    } else {
      const minimumPurchase = requestCoupon.minimumPurchase;
      const discountPercent = requestCoupon.discountPercentage;
      const grandTotal = req.query.grandTotal;
      let discountAmount;
      let appliedDisCount;
      if (req.query.grandTotal >= minimumPurchase) {
        appliedDisCount = (grandTotal * discountPercent) / 100;
        discountAmount = grandTotal - (grandTotal * discountPercent) / 100;
        req.session.couponApplied = true;
        req.session.cartTotal = discountAmount;
        req.session.discountAmout = appliedDisCount;
        req.session.appliedCouponId = requestCoupon._id;
        req.session.couponID = req.query.couponID;
      } else if (req.query.grandTotal < minimumPurchase) {
        res.send({ notEligible: true });
      }
      res.send({ couponCofirmed: true, discountAmount, appliedDisCount });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const removeCoupon = async (req, res, next) => {
  try {
    const removeCoupon = await couponCollection.findOne({
      _id: req.query.couponID,
      currentStatus: true,
    });

    if (!removeCoupon) {
      res.send({ couponNotFound: true });
      return;
    } else {
      req.session.cartTotal =
        parseInt(req.session.cartTotal) + parseInt(req.session.discountAmout);
      req.session.discountAmout = 0;

      req.session.couponApplied = false;
      req.session.discountAmout ??= 0;
      req.session.couponID = null;

      res.send({ isRemoved: true });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const placeOrder = async (req, res, next) => {
  try {
    const cartDet = await cartCollection.find({
      userId: req.session.currentUser._id,
    });
    for (let cart of cartDet) {
      await productCollection.updateOne(
        { _id: cart.productId },
        { $inc: { productStock: -cart.productQuantity } }
      );
    }

    const clonedCartDet = cartDet.map((cart) => ({ ...cart }));

    if (req.session.paymentMethod == "wallet") {
      const userWallet = await walletCollection.findOne({
        userId: req.session.currentUser._id,
      });
      const availAmt = userWallet.walletBalance;
      const transactionAmount = req.session.cartTotal;

      const transactionDate = new Date();
      const firstPer = await walletCollection.findOneAndUpdate(
        { userId: req.session.currentUser._id },
        {
          $inc: { walletBalance: -transactionAmount },
          $push: {
            walletTransaction: {
              transactionDate: transactionDate,
              transactionAmount: transactionAmount,
              transactionType: "Debited",
              transactionMethod: "Purchased Products",
            },
          },
        },

        { new: true }
      );
    }
    req.session.paymentId = null;

    if (req.session.paymentMethod == "paypal") {
      // res.redirect(`/payPalPaymentPage?total=${req.session.cartTotal}`);
      return await paymentController.doPayment(req, res);
      // console.log(req.session.paymentId);
    }

    await cartCollection.deleteMany({ userId: req.session.currentUser._id });

    await orderCollection.insertMany([
      {
        orderId: crypto.randomBytes(6).toString("hex"),
        userId: req.session.currentUser._id,
        orderDate: new Date(),
        paymentType: req.session.paymentMethod,
        addressChosen: req.session.addressId,
        cartData: clonedCartDet,
        grandTotalCost: req.session.cartTotal,
        couponApplied: req.session.appliedCouponId,
      },
    ]);

    req.session.cartTotal = null;
    req.session.couponApplied = false;
    req.session.save();

    const email = req.session.currentUser.email;
    let user = await userCollection.findOne({ email: email });

    res.render("userViews/orderSuccess", { user });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

module.exports = {
  addToCart,
  cartPage,
  quantityIncBtn,
  addressCheckOutPage,
  redirecPaymentMethod,
  paymentMethodPage,
  checkoutPage,
  applyCoupon,
  removeCoupon,
  placeOrder,
  cartIncDecBtn,
  removeFromCart,
};
