const adminCollection = require("../models/adminModel");
const productCollection = require("../models/productModel");
const productOfferCollection = require("../models/productOfferModel");
const categoryCollection = require("../models/categoryModel");
const categoryOffercollection = require("../models/categoryOfferModel");
const { applyProductOffer, formatDate } = require("../helpers/helper");
const AppError = require("../middlewares/errorHandling");

const productOfferPage = async (req, res, next) => {
  try {
    let user = await adminCollection.findOne({
      _id: req.session.adminUser._id,
    });

    const productDet = await productCollection.find();
    let productOfferData = await productOfferCollection
      .find()
      .populate("productId");

    productOfferData.forEach(async (v) => {
      await productOfferCollection.updateOne(
        { _id: v._id },
        {
          $set: {
            currentStatus:
              new Date(v.endDate) >= new Date() &&
              new Date(v.startDate) <= new Date(),
          },
        }
      );
    });

    //sending the formatted date to the page
    productOfferData = productOfferData.map((v) => {
      v.startDateFormatted = formatDate(v.startDate, "YYYY-MM-DD");
      v.endDateFormatted = formatDate(v.endDate, "YYYY-MM-DD");
      return v;
    });

    res.render("adminViews/productOffers", {
      productOfferData,
      productDet,
      page: 1,
      pages: 2,
      user: user,
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const addProductOffer = async (req, res, next) => {
  try {
    //check if the product already has an offer applied
    let { productName } = req.body;
    let existingOffer = await productOfferCollection.findOne({ productName });

    if (!existingOffer) {
      //if offer for that particular product doesn't exist:
      let productData = await productCollection.findOne({ productName });

      let { productOfferPercentage, startDate, endDate } = req.body;
      let currentStatus =
        new Date(endDate) >= new Date() && new Date(startDate) <= new Date();
      await productOfferCollection.insertMany([
        {
          productId: productData._id,
          productName,
          productOfferPercentage,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          currentStatus,
        },
      ]);
      // await applyProductOffer("addOffer");
      res.send({ success: true });
    } else {
      res.send({ success: false });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const editProductOffer = async (req, res, next) => {
  try {
    let { productName } = req.body;
    let existingOffer = await productOfferCollection.findOne({
      productName: { $regex: new RegExp(req.body.productName, "i") },
    });

    if (existingOffer || existingOffer._id == req.params.id) {
      let { productId, productOfferPercentage, startDate, endDate } = req.body;
      let currentStatus =
        new Date(endDate) >= new Date() && new Date(startDate) <= new Date();

      let updateFields = {
        productId,
        productName,
        productOfferPercentage,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        currentStatus,
      };

      await productOfferCollection.findOneAndUpdate(
        { _id: req.params.id },
        { $set: updateFields }
      );
      res.send({ success: true });
    } else {
      res.send({ success: false });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

//////// CATEGORY OFFER ////////

const categoryOffersPage = async (req, res, next) => {
  try {
    let user = await adminCollection.findOne({
      _id: req.session.adminUser._id,
    });

    const page = Number(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    let categoryDet = await categoryCollection.find();
    const catOffersCollection = await categoryOffercollection
      .find()
      .skip(skip)
      .limit(limit);

    catOffersCollection.forEach(async (cat) => {
      await categoryOffercollection.updateOne(
        { _id: cat._id },
        {
          $set: {
            currentStatus:
              new Date(cat.endDate) >= new Date() &&
              new Date(cat.startDate) <= new Date(),
          },
        }
      );
    });

    let pages;
    await categoryOffercollection
      .countDocuments()
      .then((count) => {
        pages = count;
      })
      .catch((err) => console.log("Error while counting the docment" + err));

    res.render("adminViews/categoryOffers", {
      categoryDet,
      categoryOffersDet: catOffersCollection,
      page: page,
      pages: Math.ceil(pages / limit),
      user: user,
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const addCategoryOffer = async (req, res, next) => {
  try {
    // let productData = await productCollection.find().populate("parentCategory");
    // let productsUnderSelectedCategory = productData.filter(
    //   (v) => v.parentCategory.categoryName == req.body.categoryName
    // );

    const categoryDet = await categoryCollection.findOne({
      categoryName: req.body.categoryName,
    });

    let existingOffer = await categoryOffercollection.findOne({
      categoryName: req.body.categoryName,
    });

    if (!existingOffer) {
      let {
        categoryOfferPercentage,
        categoryOfferStartDate,
        categoryOfferEndDate,
      } = req.body;

      let currentStatus =
        new Date(categoryOfferEndDate) >= new Date() &&
        new Date(categoryOfferStartDate) <= new Date();

      await categoryOffercollection.insertMany([
        {
          categoryId: categoryDet._id,
          categoryName: categoryDet.categoryName,
          categoryOfferPercentage,
          startDate: new Date(categoryOfferStartDate),
          endDate: new Date(categoryOfferEndDate),
          currentStatus,
        },
      ]);

      res.send({ success: true });
    } else {
      res.send({ success: false });
    }
    // productsUnderSelectedCategory.forEach(async (v) => {
    //   let existingOffer = await productOfferCollection.findOne({
    //     categoryName: v.productName,
    //   });

    //   if (!existingOffer) {
    //     //if offer for that particular product doesn't exist:
    //     let productData = await productCollection.findOne({
    //       productName: v.productName,
    //     });

    //     let {
    //       categoryOfferPercentage,
    //       categoryOfferStartDate,
    //       categoryOfferEndDate,
    //     } = req.body;
    //     await productOfferCollection.insertMany([
    //       {
    //         productId: productData._id,
    //         productName: v.productName,
    //         productOfferPercentage: categoryOfferPercentage,
    //         startDate: new Date(categoryOfferStartDate),
    //         endDate: new Date(categoryOfferEndDate),
    //       },
    //     ]);
    //     await applyProductOffer("addOffer");
    //   } else {
    //     let {
    //       categoryOfferPercentage,
    //       categoryOfferStartDate,
    //       categoryOfferEndDate,
    //     } = req.body;

    //     let updateFields = {
    //       productId: v.id,
    //       productName: v.productName,
    //       productOfferPercentage: categoryOfferPercentage,
    //       startDate: new Date(categoryOfferStartDate),
    //       endDate: new Date(categoryOfferEndDate),
    //     };

    //     await productOfferCollection.findOneAndUpdate(
    //       { _id: existingOffer._id },
    //       { $set: updateFields }
    //     );
    //     await applyProductOffer("editOffer");
    //   }
    // });

    // res.json({ success: true });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const editCategoryOffer = async (req, res, next) => {
  try {
    const { categoryName, categoryOfferPercentage, startDate, endDate } =
      req.body;

    let currentStatus =
      new Date(endDate) >= new Date() && new Date(startDate) <= new Date();

    let updateFields = {
      categoryName,
      categoryOfferPercentage,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      currentStatus,
    };

    const result = await categoryOffercollection.findByIdAndUpdate(
      { _id: req.params.id },
      { $set: updateFields }
    );

    if (result) {
      res.send({ success: true });
    } else {
      res.send({ success: false });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

module.exports = {
  productOfferPage,
  addProductOffer,
  editProductOffer,
  categoryOffersPage,
  addCategoryOffer,
  editCategoryOffer,
};
