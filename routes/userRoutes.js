const userRouter = require("express").Router();
const accountController = require("../controller/accountController");
const cartController = require("../controller/cartController");
const userController = require("../controller/userController");
const orderController = require("../controller/orderController");
require("../middlewares/googleAuth");
const {
  resendOTP,
  verifyOTP,
  retryOTP,
  sendOTP,
  otpSucessPage,
  sendForgetPassOtp,
  verifyForgetOTP,
  updatePassword,
  forgetResendOTP,
  otpPage,
  retryOtp,
  forgetOtpPage,
} = require("../helpers/helper");
const {
  signupValidationRules,
  signupValidation,
  loginValidationRules,
  loginValidation,
  isLogged,
  blockUserCheck,
  isLoggedIn,
} = require("../middlewares/middleware");
const passport = require("passport");
const {
  doPayment,
  paymentSucessPage,
  paymentFailed,
} = require("../controller/paymentController");

//sign-up Routes
userRouter.get("/", blockUserCheck, userController.landingPage);
userRouter.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);
userRouter.get(
  "/google/callback",
  passport.authenticate("google", {
    successRedirect: "/protected",
    failureRedirect: "/auth/failure",
  })
);
userRouter.get("/auth/failure", (req, res) =>
  res.send("Something Went wrong:::!!!")
);
userRouter.get("/protected", isLoggedIn, userController.googleUser);
userRouter.get("/signUp", userController.signUpPage);
userRouter.post(
  "/signUpSubmit",
  signupValidationRules(),
  signupValidation,
  userController.signUpSubmit
);
userRouter.get("/otpPage", otpPage);
userRouter.get("/sendOTP", sendOTP);
// userRouter.get("/sendOTP2",);
// userRouter.get("/retryOtp", retryOtp);/retry-otp
userRouter.get("/resend-otp", resendOTP);
userRouter.post("/verify-otp", verifyOTP);
userRouter.get("/retry-otp", retryOTP);
userRouter.get("/otpSuccess", otpSucessPage);
userRouter.get("/sendForgetOTP", sendForgetPassOtp);
userRouter.get("/forgetOtpPage", forgetOtpPage);
userRouter.get("/forgetResendOtp", forgetResendOTP);
userRouter.post("/verifyForgetOtp", verifyForgetOTP);
userRouter.post("/changePassword", updatePassword);

//LogIn Routes
userRouter.get("/logIn", userController.loginPage);
userRouter.post(
  "/logIn",
  loginValidationRules(),
  loginValidation,
  userController.loginSubmit
);
userRouter.get("/logout", userController.logout);

//Forget Password
userRouter.get("/forget-password", userController.forgetPasswordPage);
userRouter.post("/forget-password-submit", userController.forgetEmailSubmit);

//Product
userRouter.get("/products", userController.products);
userRouter.get("/singleProduct", userController.productDetail);
userRouter.get("/filterProduct", userController.shopSort);

//User Details
userRouter.get(
  "/userDetails",
  isLogged,
  blockUserCheck,
  accountController.userDetailsPage
);
userRouter.post("/editProfile", accountController.profileEdit);

userRouter.get(
  "/addressPage",
  isLogged,
  blockUserCheck,
  accountController.addressPage
);
userRouter.get(
  "/addAddress",
  isLogged,
  blockUserCheck,
  accountController.addAddressPage
);
userRouter.post("/addAddress", accountController.addAddress);
userRouter.post("/editAddress", accountController.editAddress);
userRouter.delete("/deleteAddress", accountController.deleteAddress);

//Cart
userRouter.post("/addToCart", cartController.addToCart);
userRouter.get("/cartPage", isLogged, blockUserCheck, cartController.cartPage);
userRouter.get("/cartIncBtn", cartController.cartIncDecBtn);
userRouter.post(
  "/selectAddress",
  isLogged,
  blockUserCheck,
  cartController.addressCheckOutPage
);
userRouter.get("/RedirectPaymentPage", cartController.redirecPaymentMethod);
userRouter.get(
  "/payMethodPage",
  isLogged,
  blockUserCheck,
  cartController.paymentMethodPage
);
userRouter.get(
  "/checkoutPage",
  isLogged,
  blockUserCheck,
  cartController.checkoutPage
);
userRouter.get(
  "/placeOrder",
  isLogged,
  blockUserCheck,
  cartController.placeOrder
);
userRouter.get(
  "/removePdCart",
  isLogged,
  blockUserCheck,
  cartController.removeFromCart
);
userRouter.get(
  "/applyCoupon",
  isLogged,
  blockUserCheck,
  cartController.applyCoupon
);
userRouter.get(
  "/removeCoupon",
  isLogged,
  blockUserCheck,
  cartController.removeCoupon
);

//Orders
userRouter.get(
  "/myOrdersPage",
  isLogged,
  blockUserCheck,
  orderController.orderPage
);
userRouter.get(
  "/orderDetail",
  isLogged,
  blockUserCheck,
  orderController.orderDetailsPage
);
userRouter.get(
  "/cancelOrder",
  isLogged,
  blockUserCheck,
  orderController.cancelOrder
);
userRouter.delete(
  "/singleProdCancel",
  isLogged,
  blockUserCheck,
  orderController.singleProdCancel
);

//Download Invoice
userRouter.get(
  "/user/account/myOrders/orderDetails/downloadInvoice",
  orderController.downloadInvoice
);

///WishList

userRouter.get("/wishList", userController.wishListing);
userRouter.get("/removeWishList", userController.removeWishList);
userRouter.get("/wishListPage", isLogged, userController.wishListPage);

//Wallet page
userRouter.get(
  "/walletPage",
  isLogged,
  blockUserCheck,
  userController.walletPage
);

///Order Return
userRouter.post("/user/returnOrder", orderController.returnSingleProd);

//Payment Page
userRouter.get("/payPalPaymentPage", isLogged, blockUserCheck, doPayment);
userRouter.get("/paymentSucess", paymentSucessPage);
userRouter.get("/paymentFailed", paymentFailed);
userRouter.get("/user/myOrders/resumePayment");

module.exports = userRouter;
