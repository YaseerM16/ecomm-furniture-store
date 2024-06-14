const adminCollection = require("../models/adminModel");
const userCollection = require("../models/userModel");
const AppError = require("../middlewares/errorHandling");
const categoryCollection = require("../models/categoryModel");
const productCollection = require("../models/productModel");
const dashBoardHelpers = require("../helpers/adminDashboardData");
const orderCollection = require("../models/orderModel");

const adminLoginPage = (req, res, next) => {
  try {
    if (req.session.adminLog) {
      res.redirect("/adimDashBoard");
    } else {
      res.render("adminViews/login", {
        invalid: req.session.invalidCredentials,
        errors: false,
        user: null,
      });

      req.session.invalidCredentials = false;
      req.session.save();
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const adminLoginSubmit = async (req, res, next) => {
  try {
    let adminData = await adminCollection.findOne({
      email: req.session.loginEmail,
    });
    if (adminData) {
      if (
        adminData.email == req.session.loginEmail &&
        adminData.password == req.session.loginPass
      ) {
        req.session.adminLog = true;
        req.session.adminUser = adminData;
        req.session.save();
        res.redirect("/adimDashBoard");
      } else {
        req.session.invalidCredentials = true;
        res.redirect("/adminLogin");
      }
    } else {
      req.session.invalidCredentials = true;
      res.redirect("/adminLogin");
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const dashBoard = async (req, res, next) => {
  try {
    let user;
    if (req.session.adminLog) {
      user = await adminCollection.findOne({ _id: req.session.adminUser._id });
    } else {
      user = {};
    }

    const salesData = [
      { date: "2024-05-01", sales: 150 },
      { date: "2024-05-02", sales: 200 },
      { date: "2024-05-03", sales: 175 },
      // Add more data points as needed
    ];
    const category = await categoryCollection.find({});
    const Product = await productCollection.find({});
    const users = await userCollection.find({});
    res.render("adminViews/home", {
      user: user,
      salesData,
      ordersLen: req.session.sreportLen,
      category,
      Product,
      users,
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};
const adminDashBoardData = async (req, res, next) => {
  try {
    const [
      getProductsCount,
      getCategoryCount,
      pendingOrdersCount,
      deliveredOrdersCount,
      currentDayRevenue,
      fourteenDaysRevenue,
      categoryWiseRevenue,
      revenue,
      monthlyRevenue,
      activeUser,
    ] = await Promise.all([
      dashBoardHelpers.getProductsCount(),
      dashBoardHelpers.getCategoryCount(),
      dashBoardHelpers.pendingOrdersCount(),
      dashBoardHelpers.deliveredOrdersCount(),
      dashBoardHelpers.currentDayRevenue(),
      dashBoardHelpers.fourteenDaysRevenue(req.query.filter),
      dashBoardHelpers.categoryWiseRevenue(req.query.filter),
      dashBoardHelpers.revenue(),
      dashBoardHelpers.monthlyRevenue(),
      dashBoardHelpers.activeUser(),
    ]);

    const data = {
      getProductsCount,
      getCategoryCount,
      pendingOrdersCount,
      deliveredOrdersCount,
      currentDayRevenue,
      fourteenDaysRevenue,
      categoryWiseRevenue,
      revenue,
      monthlyRevenue,
      activeUser,
    };

    res.json(data);
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const topProduct = async (req, res, next) => {
  try {
    const topProducts = await orderCollection.aggregate([
      {
        $match: { orderStatus: "Delivered" },
      },
      {
        $unwind: "$cartData",
      },
      {
        $group: {
          _id: "$cartData.productId",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: "$product",
      },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          count: 1,
          productName: "$product.productName",
          productPrice: "$product.offerPrice",
        },
      },
    ]);

    res.render("adminPages/topProducts", { topProducts });
  } catch (err) {
    next(new AppError("Sorry...Something went wrong", 500));
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};

const userListing = async (req, res, next) => {
  try {
    let user;
    if (req.session.adminLog) {
      user = await adminCollection.findOne({ _id: req.session.adminUser._id });
    } else {
      user = {};
    }

    const page = Number(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const userDetail = await userCollection.find().skip(skip).limit(limit);

    let pages;

    await userCollection
      .countDocuments()
      .then((count) => {
        pages = count;
      })
      .catch((err) => console.log("Error while counting the docment" + err));

    res.render("adminViews/userList", {
      userDet: userDetail,
      page: page,
      pages: Math.ceil(pages / limit),
      user: user,
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};
const blockUser = async (req, res, next) => {
  try {
    await userCollection.updateOne(
      { _id: req.query.id },
      { $set: { isBlocked: false } }
    );
    res.send({ success: true });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const unBlockUser = async (req, res, next) => {
  try {
    await userCollection.updateOne(
      { _id: req.query.id },
      { $set: { isBlocked: true } }
    );
    res.send({ success: true });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const logout = (req, res, next) => {
  try {
    req.session.adminLog = false;
    req.session.save();

    res.redirect("/adminLogin");
  } catch (error) {
    next(new AppError(error, 500));
  }
};

module.exports = {
  adminLoginPage,
  adminLoginSubmit,
  dashBoard,
  userListing,
  blockUser,
  unBlockUser,
  logout,
  adminDashBoardData,
};
