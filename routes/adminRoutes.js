const adminRouter = require("express").Router();
const adminController = require("../controller/adminController");
const categoryController = require("../controller/categoryController");
const productController = require("../controller/productController");
const manageOrderController = require("../controller/manageOrderController.js");
const upload = require("../services/multer.js");

const {
  loginValidationRules,
  adminloginValidation,
  isAdmin,
} = require("../middlewares/middleware");
const offersController = require("../controller/offersController.js");
const couponController = require("../controller/couponController.js");
const {
  SalesReportGet,
  salesReportDownloadPDF,
  salesReportDownload,
  filterDate,
  removeAllFillters,
  filterOptions,
} = require("../controller/salesReportController.js");
const {
  topProductsData,
  topCategories,
} = require("../helpers/adminDashboardData.js");

///Dashboard
adminRouter.get("/adminLogin", adminController.adminLoginPage);
adminRouter.post(
  "/adminLogin",
  loginValidationRules(),
  adminloginValidation,
  adminController.adminLoginSubmit
);
adminRouter.get("/adimDashBoard", isAdmin, adminController.dashBoard);
adminRouter.get(
  "/admin/adminDashBoardData",
  isAdmin,
  adminController.adminDashBoardData
);
adminRouter.get("/admin/dashBoard/topProducts", topProductsData);
adminRouter.get("/admin/dashBoard/topCategories", topCategories);
adminRouter.get("/adminLogout", adminController.logout);

////User Management
adminRouter.get(
  "/admin/userManagement/usersList",
  isAdmin,
  adminController.userListing
);
adminRouter.get(
  "/admin/userManagement/blockUser",
  isAdmin,
  adminController.blockUser
);
adminRouter.get(
  "/admin/userManagement/unBlockUser",
  isAdmin,
  adminController.unBlockUser
);

//Category Management
adminRouter.get(
  "/admin/categoryManagement/categoryList",
  isAdmin,
  categoryController.categoryList
);
adminRouter.post(
  "/admin/categoryManagement/addCategory",
  isAdmin,
  categoryController.addCategory
);
adminRouter.post(
  "/admin/categoryManagement/editCategory",
  isAdmin,
  categoryController.editCategory
);
adminRouter.get(
  "/admin/categoryManagement/listCategory",
  isAdmin,
  categoryController.listCategory
);
adminRouter.get(
  "/admin/categoryManagement/unListCategory",
  isAdmin,
  categoryController.unListCategory
);

//Product Management
adminRouter.get(
  "/admin/productManagement/productList",
  isAdmin,
  productController.productList
);
adminRouter.get(
  "/admin/productManagement/addProduct",
  isAdmin,
  productController.addProductPage
);
adminRouter.post(
  "/admin/productManagement/addProduct",
  isAdmin,
  upload.any(),
  productController.addProduct
);
adminRouter.get(
  "/admin/productManagement/blockProduct",
  isAdmin,
  productController.blockProduct
);
adminRouter.get(
  "/admin/productManagement/unBlockProduct",
  isAdmin,
  productController.unBlockProduct
);
adminRouter.get(
  "/admin/productManagement/editProduct",
  isAdmin,
  productController.editProductPage
);
adminRouter.post(
  "/admin/productManagement/editProduct/:id",
  upload.any(),
  productController.editProduct
);
adminRouter.post(
  "/admin/editProduct/delete-image",
  isAdmin,
  productController.deleteImage
);

//Order Management
adminRouter.get(
  "/admin/orderManagement/orderList",
  isAdmin,
  manageOrderController.orderListPage
);
adminRouter.get(
  "/admin/orderManagement/orderSummary",
  isAdmin,
  manageOrderController.orderSummaryDetails
);
adminRouter.post(
  "/admin/orderManagement/orderSummary/update-order-status",
  isAdmin,
  manageOrderController.updateOrderStatus
);
adminRouter.get(
  "/admin/orderManagement/returnedOrders",
  manageOrderController.returnOrdersPage
);
adminRouter.post(
  "/admin/orderManagement/returnApproval",
  manageOrderController.orderReturnApproval
);

///Offers Management
adminRouter.get(
  "/admin/productManagement/product-offers-page",
  isAdmin,
  offersController.productOfferPage
);
adminRouter.get(
  "/admin/categoryManagement/category-offers-page",
  offersController.categoryOffersPage
);
adminRouter.post(
  "/productOfferManagement/addOffer",
  offersController.addProductOffer
);
adminRouter.put(
  "/productOfferManagement/editOffer/:id",
  offersController.editProductOffer
);
adminRouter.post(
  "/categoryOfferManagement/addOffer",
  offersController.addCategoryOffer
);
adminRouter.put(
  "/categoryOfferManagement/editOffer/:id",
  offersController.editCategoryOffer
);

/// coupons

adminRouter.get(
  "/admin/couponManagement/coupons",
  isAdmin,
  couponController.couponsPage
);
adminRouter.post("/couponManagement/addCoupon", couponController.addCoupon);
adminRouter.put(
  "/couponManagement/editCoupon/:id",
  couponController.editCoupon
);
adminRouter.patch("/deleteCoupon", couponController.deleteCounpon);
adminRouter.patch("/admin/restoreCoupon", couponController.restoreCounpon);

/// Sales Report

adminRouter.get("/admin/salesReport", isAdmin, SalesReportGet);
adminRouter.get("/salesReport/download/pdf", salesReportDownloadPDF);
adminRouter.get("/salesReport/download/xlsx", salesReportDownload);
adminRouter.post("/filterdate", filterDate);
adminRouter.post("/admin/salesReport/filterOptions", filterOptions);
adminRouter.get("/removefilter", removeAllFillters);

module.exports = adminRouter;
