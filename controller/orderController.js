const { calcStatus } = require("../helpers/helper");
const orderCollection = require("../models/orderModel");
const productCollection = require("../models/productModel");
const userCollection = require("../models/userModel");
const { ObjectId } = require("mongodb");
const mongoose = require("mongoose");
const AppError = require("../middlewares/errorHandling");

const walletCollection = require("../models/walletModel");
const { invoicePdf } = require("../services/invoicePdf");

const orderData = async (req) => {
  const id = req.session.currentUser._id;
  const find = new ObjectId(id);
  const orderid = req.query.orderID;
  const orderID = new ObjectId(orderid);
  const orderDet = await orderCollection.aggregate([
    { $match: { _id: orderID, userId: find } },
    {
      $unwind: "$cartData",
    },
    {
      $lookup: {
        from: "products",
        localField: "cartData.productId",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    {
      $unwind: "$productDetails",
    },
    {
      $lookup: {
        from: "addresses",
        localField: "addressChosen",
        foreignField: "_id",
        as: "addressDetails",
      },
    },
    { $unwind: "$addressDetails" },
    {
      $lookup: {
        from: "coupons",
        localField: "couponApplied",
        foreignField: "_id",
        as: "couponDetails",
      },
    },
    { $unwind: "$couponDetails" },
  ]);
  return orderDet;
};
const orderPage = async (req, res, next) => {
  try {
    let user;
    if (req.session.logged) {
      const email = req.session.currentUser.email;
      user = await userCollection.findOne({ email: email });
    } else {
      user = {};
    }
    // const orders = await orderCollection
    //   .find({ userId: req.session.currentUser })
    //   .populate("addressChosen");
    // console.log(orders[0]);

    const page = Number(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const orders = await orderCollection
      .find({
        userId: req.session.currentUser._id,
      })
      .skip(skip)
      .limit(limit)
      .sort({ orderDate: -1 });

    let pages;

    await orderCollection
      .countDocuments()
      .then((count) => {
        pages = count;
      })
      .catch((err) => console.log("Error while counting the docment" + err));

    res.render("userViews/myOrders", {
      orders: orders,
      user: user,
      page: page,
      pages: Math.ceil(pages / limit),
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const orderDetailsPage = async (req, res, next) => {
  try {
    let user;
    if (req.session.logged) {
      const email = req.session.currentUser.email;
      user = await userCollection.findOne({ email: email });
    } else {
      user = {};
    }
    const availOrders = await orderData(req);
    const orderTot = await orderCollection.findOne({ _id: req.query.orderID });

    const grandTotal = orderTot.grandTotalCost;

    ///////////------Check for all Products Status and update Order Status ----//////

    const orderCancelUpdate = await orderCollection.findOne({
      _id: req.query.orderID,
    });

    /// ["shipped","shipped","shipped"] - shipped

    let calculatedStatus = calcStatus(orderCancelUpdate);
    if (calculatedStatus.allSameStatus) {
      orderStatus = calculatedStatus.productStatusValues[0];
      await orderCollection.updateOne(
        { _id: req.query.orderID },
        { $set: { orderStatus: calculatedStatus.productStatusValues[0] } }
      );
    }

    /// ["cancelled","cancelled","cancelled"] - cancelled
    else if (calculatedStatus.allCancelled) {
      orderStatus = "Cancelled";
      await orderCollection.updateOne(
        { _id: req.query.orderID },
        { $set: { orderStatus: "Cancelled" } }
      );
    }

    /// ["cancelled","shipped","shipped"] - shipped
    else if (calculatedStatus.oneCancelledAndRestSame) {
      orderStatus = calculatedStatus.productStatusValues.find(
        (val) => val !== "Cancelled"
      );
      await orderCollection.updateOne(
        { _id: req.query.orderID },
        { $set: { orderStatus: orderStatus } }
      );
    }

    /// ["cancelled","shipped","cancelled"] - shipped
    else if (calculatedStatus.nonCancelledCount === 1) {
      orderStatus = calculatedStatus.differentStatus;
      await orderCollection.updateOne(
        { _id: req.query.orderID },
        { $set: { orderStatus: calculatedStatus.differentStatus } }
      );
    }

    ///["cancelled","delivered","shipped"] - pending
    else {
      orderStatus = "Pending";
      await orderCollection.updateOne(
        { _id: req.query.orderID },
        { $set: { orderStatus: "Pending" } }
      );
    }

    ///////////////////// --------- ////////////////////////

    req.session.orderStatus = orderStatus;

    res.render("userViews/orderDetails", {
      orders: availOrders,
      grandTotal: grandTotal,
      user: user,
      orderStatus: req.session.orderStatus,
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

// const cancelOrder = async (req, res) => {
//   try {
//     console.log(req.query.orderID);

// const orderId = new ObjectId(req.query.orderID);
// const productId = new ObjectId(req.query.productID);
// const productQty = req.query.quantity;

// // const removedProduct = await orderCollection.findOne(
// //   { _id: orderId },
// //   { cartData: { $elemMatch: { productId: productId } } }
// // );

// const product = await productCollection.findOneAndUpdate(
//   { _id: productId }, // Match the product by its ID
//   { $inc: { productStock: productQty } }, // Increment the productStock by the removedQuantity
//   { new: true } // Return the updated document
// );

// const result = await orderCollection.updateOne(
//   { _id: orderId },
//   { $pull: { cartData: { productId: productId } } }
// );
// if (result) {
//   const updatedOrder = await orderCollection.findOne({ _id: orderId });
//   if (updatedOrder.cartData.length === 0) {
//     const deleteResult = await orderCollection.deleteOne({ _id: orderId });
//     if (deleteResult.deletedCount > 0) {
//       res.send({
//         success: true,
//         message:
//           "Product and also the order doc is deleted from the orderCollection hence the cartData Arr is Empty :",
//       });
//     }
//   } else {
//     res.send({
//       success: true,
//       message:
//         "Product is deleted form the cartData Arr in the Order Doc Which the product present :",
//     });
//   }
// } else {
//   res.status(404).send("Product with ID not found in cartData.");
// }
//   } catch (error) {
//     console.log(
//       "Error while Deleting the Product From OrdersDetails Page: " + error
//     );
//   }
// };

const cancelOrder = async (req, res, next) => {
  try {
    const orderId = req.query.orderID;
    const order = await orderCollection.findByIdAndUpdate(
      orderId,
      { orderStatus: "Cancelled" },
      { new: true }
    );

    if (!order) {
      return res.status(404).send({ message: "Order not found" });
    }
    res.send({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error(error);
    next(new AppError(error, 500));
  }
};

const singleProdCancel = async (req, res, next) => {
  try {
    const orderId = req.query.orderId;
    const cartProdId = req.query.cartProdId;

    const order = await orderCollection.findOne({ _id: orderId });

    const matchedCartData = order.cartData.find((cartItem) =>
      cartItem._id.equals(cartProdId)
    );

    const productId = matchedCartData.productId;
    const prodQty = matchedCartData.productQuantity;
    const totalCostOfProd = matchedCartData.totalCostPerProduct;

    if (order.paymentType == "wallet" || order.paymentType == "paypal") {
      await walletCollection.findOneAndUpdate(
        { userId: req.session.currentUser._id },
        {
          $inc: { walletBalance: +totalCostOfProd },
          $push: {
            walletTransaction: {
              transactionDate: new Date(),
              transactionAmount: totalCostOfProd,
              transactionType: "credited",
              transactionMethod: "Cancelled Order",
            },
          },
        },
        { new: true }
      );
    }

    const updateResult = await orderCollection.updateOne(
      {
        _id: orderId,
        cartData: { $elemMatch: { _id: cartProdId } },
      },
      {
        $set: { "cartData.$.productStatus": "Cancelled" },
        $inc: { grandTotalCost: -totalCostOfProd },
      }
    );

    if (updateResult.modifiedCount > 0) {
      const prodQtyUpdate = await productCollection.updateOne(
        { _id: productId },
        { $inc: { productStock: prodQty } }
      );
      if (prodQtyUpdate.modifiedCount > 0) {
        res.status(200).send({ success: true });
      } else {
        res.status(404).send({
          failed: true,
          error:
            "Error while updating the Product Quantity in the Product Collection",
        });
      }
    } else {
      res.status(404).send({ failed: true, error: "Order not found" });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};
const returnSingleProd = async (req, res, next) => {
  try {
    const cartId = req.query.cartId;
    const orderId = req.query.orderId;
    const reason = req.query.reason;

    const cartIdObject = new mongoose.Types.ObjectId(cartId);
    // const res = await orderCollection.findOne({
    //   _id: orderId,
    //   "cartData._id": cartIdObject,
    // });

    const res = await orderCollection.findOneAndUpdate(
      {
        _id: orderId,
        "cartData._id": cartIdObject,
      },
      {
        $set: {
          "cartData.$.productStatus": "Requested Return",
          "cartData.$.returnReason": reason,
        },
      }
    );

    // }
    // const orderData = await orderCollection.findOne({
    //   _id: new mongoose.Types.ObjectId(id),
    // });
    // const allReturned = orderData.cartData.every(
    //   (item) => item.status === "Request Return"
    // );

    // If all products have been returned, update orderStatus to 'Returned'
    // if (allReturned) {
    //   await orderCollection.findOneAndUpdate(
    //     { _id: new mongoose.Types.ObjectId(id) },
    //     { $set: { orderStatus: "Request Return" } }
    //   );
    // }
    console.log(res);
    // res.send({ success: true });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const downloadInvoice = async (req, res, next) => {
  try {
    let orderData = await orderCollection
      .findOne({ _id: req.query.orderId })
      .populate("addressChosen")
      .populate("userId")
      .populate({
        path: "cartData.productId",
        model: "products",
        select: "productName", // select only the fields you need
        options: { as: "productDetails" },
      });

    if (!orderData) {
      return next(new AppError("Order not found", 404));
    }

    // Extract order number
    const orderNumber = orderData.orderId;

    // Construct filename with order number
    const filename = `invoice_order_${orderNumber}.pdf`;

    const stream = res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${filename}`,
    });

    invoicePdf(
      (chunk) => stream.write(chunk),
      () => stream.end(),
      orderData
    );
  } catch (err) {
    console.error("Error generating invoice:", err);
    next(new AppError("Sorry...Something went wrong", 500));
  }
};

module.exports = {
  orderPage,
  orderDetailsPage,
  cancelOrder,
  singleProdCancel,
  returnSingleProd,
  downloadInvoice,
};
