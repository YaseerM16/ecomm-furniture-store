const cartCollection = require("../models/cartModel");
const orderCollection = require("../models/orderModel");
const productCollection = require("../models/productModel");
const userCollection = require("../models/userModel");
const crypto = require("crypto");
const AppError = require("../middlewares/errorHandling");
const { default: axios } = require("axios");

const paypal = require("paypal-rest-sdk");
const { PAYPAL_MODE, PAYPAL_CLIENT_KEY, PAYPAL_SECRET_KEY } = process.env;

paypal.configure({
  mode: PAYPAL_MODE,
  client_id: PAYPAL_CLIENT_KEY,
  client_secret: PAYPAL_SECRET_KEY,
});

const doPayment = async (req, res) => {
  try {
    let total = req.query.grandTot || String(req.session.cartTotal);
    const response = await axios.get(
      "https://v6.exchangerate-api.com/v6/44a9e911496b7fa81ee41d59/latest/USD"
    );
    const exchangeRates = response.data;
    if (exchangeRates.conversion_rates && exchangeRates.conversion_rates.INR) {
      const usdToInrRate = exchangeRates.conversion_rates.INR;
      total = total / usdToInrRate;
    } else {
      console.log("USD to INR conversion rate not available");
    }
    const orderId = req.query.orderID || crypto.randomBytes(6).toString("hex");
    if (req.query.orderID) {
      const pendingPayment = await orderCollection.findOne({
        orderId: req.query.orderID,
      });
      req.session.addressId = pendingPayment.addressChosen;
      req.session.cartTotal = pendingPayment.grandTotalCost;
      req.session.appliedCouponId = pendingPayment.couponApplied;
      req.session.paymentMethod = pendingPayment.paymentType;
    }

    const create_payment_json = {
      intent: "sale",
      payer: {
        payment_method: "paypal",
      },
      redirect_urls: {
        return_url: `https://furniturehub.shop/paymentSucess?orderId=${orderId}`,
        cancel_url: `https://furniturehub.shop/paymentFailed?orderId=${orderId}`,
      },
      transactions: [
        {
          item_list: {
            items: [
              {
                name: "Book",
                sku: "001",
                price: total.toFixed(2),
                currency: "USD",
                quantity: 1,
              },
            ],
          },
          amount: {
            currency: "USD",
            total: total.toFixed(2),
          },
          description: "Hat for the best team ever",
        },
      ],
    };

    paypal.payment.create(create_payment_json, function (err, payment) {
      if (err) {
        throw err;
      } else {
        req.session.paymentId = payment.id;
        req.session.orderId = orderId;

        for (let i = 0; i < payment.links.length; i++) {
          if (payment.links[i].rel === "approval_url") {
            res.redirect(payment.links[i].href);
          }
        }
      }
    });
  } catch (error) {
    console.log("ERrror while dOing the payment :", error);
  }
};

const paymentSucessPage = async (req, res, next) => {
  try {
    const user = await userCollection.findById(req.session.currentUser._id);
    // let user1 = await userCollection.findOne({
    //   email: req.session.currentUser.email,
    // });
    if (user.failedPayments.includes(req.query.orderId)) {
      await orderCollection.updateOne(
        { orderId: req.query.orderId },
        {
          $set: {
            paymentType: "paypal",
          },
        }
      );

      let indx = user.failedPayments.indexOf(req.query.orderId);
      user.failedPayments.splice(indx, 1);
      await user.save();

      const cartDet = await cartCollection.find({
        userId: req.session.currentUser._id,
      });
      for (let cart of cartDet) {
        await productCollection.updateOne(
          { _id: cart.productId },
          { $inc: { productStock: -cart.productQuantity } }
        );
      }
      await cartCollection.deleteMany({ userId: req.session.currentUser._id });

      res.render("userViews/orderSuccess", { user });
    } else {
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

      await cartCollection.deleteMany({ userId: req.session.currentUser._id });

      await orderCollection.insertMany([
        {
          orderId: req.session.orderId,
          userId: req.session.currentUser._id,
          orderDate: new Date(),
          paymentType: req.session.paymentMethod,
          addressChosen: req.session.addressId,
          cartData: clonedCartDet,
          grandTotalCost: req.session.cartTotal,
          paymentId: req.query.paymentId,
          couponApplied: req.session.appliedCouponId,
        },
      ]);

      req.session.cartTotal = null;
      req.session.couponApplied = false;
      req.session.orderId = null;
      req.session.save();

      res.render("userViews/orderSuccess", { user });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const paymentFailed = async (req, res, next) => {
  try {
    const user = await userCollection.findById(req.session.currentUser._id);
    if (user.failedPayments.includes(req.query.orderId)) {
      await orderCollection.updateOne(
        { orderId: req.query.orderId },
        {
          $set: {
            paymentType: req.session.paymentMethod,
          },
        }
      );
      req.session.cartTotal = null;
      req.session.couponApplied = false;
      req.session.orderId = null;
      req.session.save();
      let user = req.session.logged
        ? await userCollection.findOne({ email: req.session.currentUser.email })
        : {};

      res.render("userViews/paymentFailed", { user });
    } else {
      const cartDet = await cartCollection.find({
        userId: req.session.currentUser._id,
      });

      await userCollection.findByIdAndUpdate(req.session.currentUser._id, {
        $push: { failedPayments: req.query.orderId },
      });

      const clonedCartDet = cartDet.map((cart) => ({ ...cart }));
      const storingDet = new orderCollection({
        orderId: req.session.orderId,
        userId: req.session.currentUser._id,
        orderDate: new Date(),
        paymentType: "Payment Pending",
        addressChosen: req.session.addressId,
        cartData: clonedCartDet,
        grandTotalCost: req.session.cartTotal,
        paymentId: req.query.paymentId,
        couponApplied: req.session.appliedCouponId,
      });

      const stored = await storingDet.save();

      req.session.cartTotal = null;
      req.session.couponApplied = false;
      req.session.orderId = null;
      req.session.save();

      // let user = req.session.logged
      //   ? await userCollection.findOne({ email: req.session.currentUser.email })
      //   : {};

      res.render("userViews/paymentFailed", { user });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

module.exports = { doPayment, paymentSucessPage, paymentFailed };
