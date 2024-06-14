const productCollection = require("../models/productModel");
const categoryCollection = require("../models/categoryModel");
const { default: mongoose } = require("mongoose");
const adminCollection = require("../models/adminModel");
const AppError = require("../middlewares/errorHandling");

const productList = async (req, res, next) => {
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

    const proCollection = await productCollection
      .find()
      .skip(skip)
      .limit(limit)
      .populate("parentCategory");

    let pages;

    await productCollection
      .countDocuments()
      .then((count) => {
        pages = count;
      })
      .catch((err) => console.log("Error while counting the docment" + err));

    // console.log(proCollection);
    res.render("adminViews/productList", {
      productDet: proCollection,
      page: page,
      pages: Math.ceil(pages / limit),
      user: user,
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const addProductPage = async (req, res, next) => {
  try {
    let user;
    if (req.session.adminLog) {
      user = await adminCollection.findOne({ _id: req.session.adminUser._id });
    } else {
      user = {};
    }
    const categoryDetails = await categoryCollection.find();
    res.render("adminViews/addProduct", {
      categoryDet: categoryDetails,
      user: user,
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const addProduct = async (req, res, next) => {
  try {
    let imgFiles = [];
    for (i = 0; i < req.files.length; i++) {
      imgFiles[i] = req.files[i].filename;
    }

    const newProduct = new productCollection({
      productName: req.body.productName,
      parentCategory: req.body.parentCategory,
      productImage: imgFiles,
      productPrice: req.body.productPrice,
      productStock: req.body.productStock,
      priceBeforeOffer: req.body.productPrice,
    });
    const productDetails = await productCollection.find({
      productName: {
        $regex: new RegExp("^" + req.body.productName.toLowerCase() + "$", "i"),
      },
    });
    if (
      /^\s*$/.test(req.body.productName) ||
      /^\s*$/.test(req.body.productPrice) ||
      /^\s*$/.test(req.body.productStock)
    ) {
      res.send({ noValue: true });
    } else if (productDetails.length > 0) {
      res.send({ exists: true });
    } else {
      res.send({ success: true });
      newProduct.save();
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const blockProduct = async (req, res, next) => {
  try {
    await productCollection.updateOne(
      { _id: req.query.id },
      { $set: { isListed: false } }
    );
    res.send({ block: true });
  } catch (err) {
    next(new AppError(error, 500));
  }
};
const unBlockProduct = async (req, res, next) => {
  try {
    await productCollection.updateOne(
      { _id: req.query.id },
      { $set: { isListed: true } }
    );
    res.send({ unBlock: true });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const editProductPage = async (req, res, next) => {
  try {
    let user;
    if (req.session.adminLog) {
      user = await adminCollection.findOne({ _id: req.session.adminUser._id });
    } else {
      user = {};
    }
    const categoryDetail = await categoryCollection.find();
    const categoryDet = await categoryCollection.findOne({
      _id: req.query.cid,
    });
    const productDet = await productCollection.findOne({ _id: req.query.pid });

    res.render("adminViews/editProduct", {
      categoryDet,
      productDet,
      categoryDetail,
      user: user,
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const editProduct = async (req, res, next) => {
  try {
    let imgFiles = [];
    for (let i = 0; i < req.files.length; i++) {
      imgFiles[i] = req.files[i].filename;
    }

    const productDetails = await productCollection.findOne({
      productName: req.body.productName,
    });
    if (
      /^\s*$/.test(req.body.productName) ||
      /^\s*$/.test(req.body.productPrice) ||
      /^\s*$/.test(req.body.productStock)
    ) {
      res.send({ noValue: true });
    }
    // catDetails._id != req.body.categoryId
    // (catDetails && catDetails._id != req.body.categoryId)
    else if (productDetails && productDetails._id != req.params.id) {
      res.send({ exists: true });
    } else {
      await productCollection.updateOne(
        { _id: req.params.id },
        {
          $set: {
            productName: req.body.productName,
            parentCategory: req.body.parentCategory,
            productPrice: req.body.productPrice,
            productStock: req.body.productStock,
            priceBeforeOffer: req.body.productPrice,
          },
          $push: { productImage: { $each: imgFiles } },
        }
      );
      res.send({ success: true });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const deleteImage = async (req, res, next) => {
  try {
    const updatedProduct = await productCollection.findOne({
      _id: req.body.productId,
    });
    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" }); // Remove the first element
    }
    if (
      req.body.index >= 0 &&
      req.body.index < updatedProduct.productImage.length
    ) {
      updatedProduct.productImage.splice(req.body.index, 1);
      await updatedProduct.save();
      res.status(200).json({
        message: "Image deleted successfully",
        product: updatedProduct,
      });
    } else {
      res.status(400).json({ error: "Invalid image index" });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

module.exports = {
  productList,
  addProductPage,
  addProduct,
  blockProduct,
  unBlockProduct,
  editProductPage,
  editProduct,
  deleteImage,
};
