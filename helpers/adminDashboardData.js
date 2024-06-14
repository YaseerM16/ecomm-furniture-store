const orderCollection = require("../models/orderModel");
const userCollection = require("../models/userModel");
const categoryCollection = require("../models/categoryModel");
const productCollection = require("../models/productModel");
const adminCollection = require("../models/adminModel");

const deliveredOrdersCount = async () => {
  try {
    return await orderCollection.countDocuments({ orderStatus: "Delivered" });
  } catch (error) {
    console.error(error);
  }
};
const getProductsCount = async () => {
  return await productCollection
    .countDocuments()
    .catch((error) => console.error(error));
};

const getCategoryCount = async () => {
  return await categoryCollection
    .countDocuments()
    .catch((error) => console.error(error));
};

const pendingOrdersCount = async () => {
  try {
    return await orderCollection.countDocuments({
      orderStatus: { $ne: "Delivered" },
    });
  } catch (error) {
    console.error(error);
  }
};

const currentDayRevenue = async () => {
  try {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const result = await orderCollection.aggregate([
      { $match: { orderDate: { $gte: yesterday, $lt: today } } },
      { $group: { _id: "", totalRevenue: { $sum: "$grandTotalCost" } } },
    ]);
    return result.length > 0 ? result[0].totalRevenue : 0;
  } catch (error) {
    console.error(error);
  }
};

const fourteenDaysRevenue = async (filter) => {
  try {
    let startDate;
    switch (filter) {
      case "week":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "2week":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 14);
        break;
      case "month":
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "year":
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        // Default to 14 days if no filter specified
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 14);
    }
    const result = await orderCollection.aggregate([
      { $match: { orderStatus: "Delivered", orderDate: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
          dailyRevenue: { $sum: "$grandTotalCost" },
        },
      },
      {
        $sort: { _id: -1 },
      },
    ]);
    return {
      date: result.map((v) => v._id),
      revenue: result.map((v) => v.dailyRevenue),
    };
  } catch (error) {
    console.error(error);
  }
};

const categoryWiseRevenue = async (filter) => {
  try {
    let startDate;
    switch (filter) {
      case "week":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "2week":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 14);
        break;
      case "month":
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "year":
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        // Default to 14 days if no filter specified
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 14);
    }
    const result = await orderCollection.aggregate([
      { $match: { orderStatus: "Delivered", orderDate: { $gte: startDate } } },
      { $unwind: "$cartData" },
      {
        $lookup: {
          from: "products",
          localField: "cartData.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "categories",
          localField: "product.parentCategory",
          foreignField: "_id",
          as: "parentCategory",
        },
      },
      { $unwind: "$parentCategory" },
      {
        $group: {
          _id: "$parentCategory._id",
          revenuePerCategory: { $sum: "$cartData.totalCostPerProduct" },
          parentCategory: { $first: "$parentCategory" },
          product: { $push: "$product" },
        },
      },
      {
        $sort: { _id: -1 },
      },
    ]);

    return {
      categoryName: result.map((v) => v.parentCategory.categoryName),
      revenuePerCategory: result.map((v) => v.revenuePerCategory),
    };
  } catch (error) {
    console.error(error);
  }
};

const revenue = async () => {
  try {
    const result = await orderCollection.find();

    return {
      revenue: result.reduce((acc, curr) => (acc += curr.grandTotalCost), 0),
    };
  } catch (error) {
    console.error(error);
  }
};
const monthlyRevenue = async () => {
  try {
    const today = new Date();
    const lastmonth = new Date();
    lastmonth.setDate(today.getDate() - 28);

    const result = await orderCollection.aggregate([
      { $match: { orderDate: { $gte: lastmonth, $lt: today } } },
      { $group: { _id: "", MonthlyRevenue: { $sum: "$grandTotalCost" } } },
    ]);
    return result.length > 0 ? result[0].MonthlyRevenue : 0;
  } catch (error) {
    console.error(error);
  }
};
// ctsCount, activeUser, monthlyRevenue, revenue, categoryWiseRevenue, fourteenDa;

const activeUser = async () => {
  try {
    return await userCollection.find({ status: "Unblock" }).count();
  } catch (error) {
    console.error(error);
  }
};

const topProductsData = async (req, res, next) => {
  try {
    let user = await adminCollection.findOne({
      _id: req.session.adminUser._id,
    });
    const page = Number(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    let pages;

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
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$$ROOT", "$product"],
          },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "product.parentCategory",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: "$category",
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$$ROOT", "$category"],
          },
        },
      },
    ]);
    pages = topProducts.length;
    const paginatedProds = topProducts.slice(skip, skip + limit);

    res.render("adminViews/topProducts", {
      products: paginatedProds,
      user,
      page,
      pages: Math.ceil(pages / limit),
    });
  } catch (error) {
    next(new AppError("Sorry...Something went wrong", 500));
  }
};

const topCategories = async (req, res, next) => {
  try {
    let user = await adminCollection.findOne({
      _id: req.session.adminUser._id,
    });
    const page = Number(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    let pages;
    const topCategories = await orderCollection.aggregate([
      {
        $match: { orderStatus: "Delivered" },
      },
      {
        $unwind: "$cartData",
      },
      {
        $lookup: {
          from: "products",
          localField: "cartData.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: "$product",
      },
      {
        $lookup: {
          from: "categories",
          localField: "product.parentCategory",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: "$category",
      },
      {
        $group: {
          _id: "$category.categoryName",
          quantity: { $sum: 1 },
        },
      },
      {
        $sort: { quantity: -1 },
      },
      {
        $limit: 10,
      },
    ]);
    pages = topCategories.length;
    const paginatedProds = topCategories.slice(skip, skip + limit);

    res.render("adminViews/topCategories", {
      topCategories,
      products: [],
      user,
      page,
      pages: Math.ceil(pages / limit),
    });
  } catch (err) {
    // Consider using a centralized error handler
    next(new AppError("Sorry...Something went wrong", 500));
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  deliveredOrdersCount,
  getCategoryCount,
  getProductsCount,
  activeUser,
  monthlyRevenue,
  revenue,
  categoryWiseRevenue,
  fourteenDaysRevenue,
  currentDayRevenue,
  pendingOrdersCount,
  topProductsData,
  topCategories,
};
