const userCollection = require("../models/userModel");
const crypto = require("crypto");
const productCollection = require("../models/productModel");
const cartCollection = require("../models/cartModel");
const wishListCollection = require("../models/wishListModel");
const walletCollection = require("../models/walletModel");
const categoryCollection = require("../models/categoryModel");
const AppError = require("../middlewares/errorHandling");
const bcrypt = require("bcrypt");

const {
  hashPassword,
  sendOTP,
  verifyOTP,
  resendOTP,
  applyOffers,
  checkOfferAvailability,
} = require("../helpers/helper");
const { ObjectId } = require("mongodb");
// const axios = require("axios");
// const https = require("https");

// const httpsAgent = new https.Agent({
//   rejectUnauthorized: false, // You can set this to true in production with proper certificates
//   secureProtocol: "TLSv1_2_method", // Specify the TLS version here
// });

const landingPage = async (req, res, next) => {
  try {
    const products = await productCollection.find({ isListed: true });
    let user;
    if (req.session.logged) {
      const email = req.session.currentUser.email;
      user = await userCollection.findOne({ email: email });
      res.render("userViews/home", { user, products });
    } else {
      user = null;
      wishListDet = [];
      res.render("userViews/home", { user, products });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const googleUser = async (req, res, next) => {
  try {
    const referralCode = crypto.randomBytes(10).toString("hex");
    const user = await userCollection.findOneAndUpdate(
      { email: req.user.email },
      { $set: { username: req.user.displayName, referralCode: referralCode } },
      { upsert: true, new: true }
    );
    if (user) {
      const userWallet = await walletCollection.findOne({ userId: user._id });
      if (!userWallet) {
        await walletCollection.create({
          userId: user._id,
        });
      }
      req.session.currentUser = user;
      req.session.logged = true;
      res.redirect("/");
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const signUpPage = (req, res, next) => {
  try {
    if (req.session.logged) {
      res.redirect("/");
    } else {
      let referralCodeAvail;
      // if (req.query.referral) {
      //   referralCodeAvail = req.query.referral;
      // }
      referralCodeAvail = req.query.referral ? req.query.referral : false;
      console.log(referralCodeAvail);
      res.render("userViews/signup", {
        errors: false,
        userExist: req.session.userExist,
        passwordMismatch: req.session.passwordMismatch,
        referralCode: referralCodeAvail,
        user: null,
      });
      req.session.userExist = false;
      req.session.passwordMismatch = false;
      req.session.save();
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const loginPage = (req, res, next) => {
  try {
    if (req.session.logged) {
      res.redirect("/");
    } else {
      res.render("userViews/login", {
        invalid: req.session.invalidCredentials,
        errors: false,
        user: null,
      });
    }
    req.session.invalidCredentials = false;
    req.session.save();
  } catch (error) {
    next(new AppError(error, 500));
  }
};
const signUpSubmit = async (req, res, next) => {
  try {
    const {
      username,
      email,
      phonenumber,
      password,
      confirmPassword,
      referralCode,
    } = req.body;

    const existingUser = await userCollection.findOne({ email });

    if (existingUser) {
      req.session.userExist = true;
      res.redirect("/signUp");
    } else {
      if (password !== confirmPassword) {
        req.session.passwordMismatch = true;
        res.redirect("/signUp");
      }
      const hashedPassword = await hashPassword(password);

      let addUser = {
        username,
        email,
        phonenumber,
        password: hashedPassword,
        isBlocked: false,
        referralCode,
      };

      if (referralCode) {
        addUser[referralCode] = referralCode;
      } else {
        addUser[referralCode] = null;
      }
      req.session.newUser = addUser;
      req.session.save();
      req.session.passed = true;
      res.redirect("/sendOTP");
    }
  } catch (err) {
    next(new AppError(error, 500));
  }
};

const loginSubmit = async (req, res, next) => {
  try {
    let exisitingUser = await userCollection.findOne({
      email: req.body.email,
    });
    if (exisitingUser) {
      let passwordMatch = bcrypt.compareSync(
        req.body.password,
        exisitingUser.password
      );
      if (passwordMatch) {
        req.session.currentUser = exisitingUser;
        req.session.logged = true;
        req.session.save();
        res.redirect("/");
      } else {
        console.log("Password does not match");
        req.session.invalidCredentials = true;
        res.redirect("/logIn");
        console.log("called with invalidCredentials");
      }
    } else {
      console.log("User Does not exist");
      req.session.invalidCredentials = true;
      res.redirect("/logIn");
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const forgetPasswordPage = (req, res, next) => {
  try {
    if (req.session.logged) {
      res.redirect("/");
    } else {
      res.render("userViews/forgetPassword", {
        invalid: req.session.invalidCredentials,
        errors: false,
        user: null,
      });
    }
    req.session.invalidCredentials = false;
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const forgetEmailSubmit = async (req, res, next) => {
  try {
    let exisitingUser = await userCollection.findOne({
      email: req.body.email,
    });
    if (exisitingUser) {
      req.session.forgetEmail = req.body.email;
      req.session.save();
      res.redirect("/sendForgetOTP");
    } else {
      console.log("User Does not exist");
      req.session.invalidCredentials = true;
      res.redirect("/forget-password");
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};
// const produects = async (req, res) => {
//   try {
//     const productDetails = await productCollection.find({ isListed: true });
//     res.render("userViews/products", {
//       userLogged: req.session.logged,
//       productDet: productDetails,
//     });
//   } catch (err) {
//     console.log(err);
//   }
// };

const products = async (req, res, next) => {
  let user;
  let wishListDet;
  if (req.session.logged) {
    const email = req.session.currentUser.email;
    user = await userCollection.findOne({ email: email });
    wishListDet = await wishListCollection.find({
      userId: req.session.currentUser._id,
    });
  } else {
    user = null;
    wishListDet = [];
  }
  let pages;
  await productCollection
    .countDocuments()
    .then((count) => {
      pages = count;
    })
    .catch((err) => console.log("Error while counting the docment" + err));
  const page = Number(req.query.page) || 1;
  const limit = 9;
  const skip = (page - 1) * limit;

  try {
    await checkOfferAvailability();
    await applyOffers();
    let productsDet = await productCollection
      .find({ isListed: true })
      .populate("parentCategory")
      .skip(skip)
      .limit(limit);

    let wishListArr = [];
    for (i = 0; i < wishListDet.length; i++) {
      wishListArr.push(wishListDet[i].productId.toString());
    }

    for (let i = 0; i < productsDet.length; i++) {
      productsDet[i] = productsDet[i].toObject();
      if (typeof productsDet[i] === "object" && productsDet[i]._id) {
        const productId = productsDet[i]._id.toString();
        productsDet[i].isWishListed = wishListArr.includes(productId);
      }
    }

    // pages = Math.ceil(productCollection.countDocuments() / limit);

    pages /= res.render("userViews/products", {
      title: "Products",
      userLogged: req.session.logged,
      productDet: productsDet,
      page: page,
      pages: Math.ceil(pages / limit),
      user: user,
      queryFilters: {},
    });
  } catch (error) {
    // res.status(500).send(error);
    next(new AppError(error, 500));
  }
};

const productDetail = async (req, res, next) => {
  try {
    let user;
    if (req.session.logged) {
      const email = req.session.currentUser.email;
      user = await userCollection.findOne({ email: email });
    } else {
      user = {};
    }
    const existInCart = await cartCollection.findOne({
      productId: req.query.id,
    });
    const currentProduct = await productCollection
      .findOne({
        _id: req.query.id,
      })
      .populate("parentCategory");
    if (existInCart) {
      const availLimit = parseInt(existInCart.productQuantity);
      res.render("userViews/productDetails", {
        _id: req.body.user_id,
        user: req.session.logged,
        currentProduct,
        productQtyLimit: availLimit,
      });
    } else {
      res.render("userViews/productDetails", {
        _id: req.body.user_id,
        user: user,
        currentProduct,
        productQtyLimit: 0,
        user: user,
      });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const filterProduct = async (req, res) => {
  try {
    console.log("Filtering value" + req.query.filterBy);
  } catch (error) {
    console.log(
      "ERrror while Filtering the Product and render the page :" + error
    );
  }
};

const shopSort = async (req, res, next) => {
  let user;
  if (req.session.logged) {
    const email = req.session.currentUser.email;
    user = await userCollection.findOne({ email: email });
  } else {
    user = {};
  }

  const page = Number(req.query.page) || 1;
  const limit = 9;
  const skip = (page - 1) * limit;

  try {
    const category = req.query.category;
    const priceRange = req.query["price-range"];
    const sort = req.query.sort;
    const productName = req.query.bySearch; // Get the search query from req.query
    console.log(productName);

    const filters = {
      category: {
        chair: new ObjectId("66135a08275fc1e896a0e319"),
        sofa: new ObjectId("66135a55275fc1e896a0e321"),
        tableLamp: new ObjectId("66135a2d275fc1e896a0e31d"),
        dining: new ObjectId("661359e8275fc1e896a0e315"),
      },
      priceRange: {
        "2000-3000": { $gte: 2000, $lte: 3000 },
        "3000-4000": { $gte: 3000, $lte: 4000 },
        "5000-7000": { $gte: 5000, $lte: 7000 },
        "10000-17000": { $gte: 10000, $lte: 17000 },
      },
      sort: {
        "name-ascending": { productName: 1 },
        "name-descending": { productName: -1 },
        "price-ascending": { productPrice: 1 },
        "price-descending": { productPrice: -1 },
      },
      bySearch: {
        productName: { $regex: productName, $options: "i" }, // Create a regex pattern for case-insensitive search
      },
    };

    let aggregationPipeline = [{ $match: { isListed: true } }];

    if (category) {
      aggregationPipeline.push({
        $match: { parentCategory: filters.category[category] },
      });
    }

    if (priceRange) {
      aggregationPipeline.push({
        $match: { productPrice: filters.priceRange[priceRange] },
      });
    }

    if (productName) {
      aggregationPipeline.push({
        $match: filters.bySearch, // Add search filter
      });
    }

    if (sort) {
      aggregationPipeline.push({ $sort: filters.sort[sort] });
    }

    console.log(aggregationPipeline);
    const beforeLimit = await productCollection.aggregate(aggregationPipeline);
    const totalProductsCount = beforeLimit.length;
    const totalPages = Math.ceil(totalProductsCount / limit);
    const queryFilters = req.query;

    aggregationPipeline.push({ $skip: skip });
    aggregationPipeline.push({ $limit: limit });

    const products = await productCollection.aggregate(aggregationPipeline);

    res.render("userViews/products", {
      productDet: products,
      page: page,
      pages: totalPages,
      user: user,
      queryFilters,
    });
  } catch (err) {
    next(new AppError(error, 500));
  }
};

const logout = (req, res, next) => {
  try {
    req.session.logged = false;
    req.session.currentUser = false;
    res.redirect("/");
  } catch (err) {
    next(new AppError(error, 500));
  }
};

const removeWishList = async (req, res, next) => {
  try {
    const productId = req.query.productId;
    const userId = req.session.currentUser._id;
    const deleteFrom = await wishListCollection.deleteOne({
      userId: userId,
      productId: productId,
    });
    if (deleteFrom.deletedCount > 0) {
      res.send({ success: true });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const wishListing = async (req, res, next) => {
  try {
    if (req.session.currentUser) {
      const wish = {
        userId: req.session.currentUser._id,
        productId: req.query.productId,
      };
      await wishListCollection.insertMany([wish]);
      res.json({ success: true });
    } else {
      console.log(
        "The product Id is not gettin while attempt to add to the wishlist"
      );
      res.json({ notUser: true });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const wishListPage = async (req, res, next) => {
  try {
    let user = req.session.logged
      ? await userCollection.findOne({ email: req.session.currentUser.email })
      : {};

    const wishListed = await wishListCollection
      .find({
        userId: req.session.currentUser._id,
      })
      .populate("productId");

    res.render("userViews/wishList", { user: user, Products: wishListed });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const walletPage = async (req, res, next) => {
  try {
    user = await userCollection.findOne({
      email: req.session.currentUser.email,
    });

    const userWallet = await walletCollection.findOne({
      userId: req.session.currentUser._id,
    });

    const page = Number(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const transactions = userWallet.walletTransaction;
    const paginatedTransactions = transactions.slice(skip, skip + limit);

    let pages;
    pages = userWallet.walletTransaction.length;

    res.render("userViews/userWallet", {
      orders: [],
      user,
      userWallet,
      walletTransData: paginatedTransactions,
      page: page,
      pages: Math.ceil(pages / limit),
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

module.exports = {
  landingPage,
  googleUser,
  signUpPage,
  signUpSubmit,
  loginPage,
  loginSubmit,
  forgetPasswordPage,
  forgetEmailSubmit,
  products,
  productDetail,
  shopSort,
  removeWishList,
  wishListing,
  wishListPage,
  walletPage,
  logout,
};
