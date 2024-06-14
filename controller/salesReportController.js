const adminCollection = require("../models/adminModel");
const orderCollection = require("../models/orderModel");
const userCollection = require("../models/userModel");
const addressCollection = require("../models/addressModel");
const productCollection = require("../models/productModel");
const walletCollection = require("../models/walletModel");
const puppeteer = require("puppeteer");
const exceljs = require("exceljs");
const AppError = require("../middlewares/errorHandling");
const ReadableStream = require("readable-stream");

const SalesReportGet = async (req, res, next) => {
  try {
    const user = await adminCollection.findOne({
      _id: req.session.adminUser._id,
    });

    let startDate, endDate;
    if (req.session.startDate && req.session.endDate) {
      startDate = req.session.startDate;
      endDate = req.session.endDate;
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      endDate = new Date();
    }
    let startDate2, endDate2;
    if (req.session.startDate2 && req.session.endDate2) {
      startDate2 = new Date(req.session.startDate2);
      endDate2 = new Date(req.session.endDate2);
    }

    var salesDetails =
      req.session.salesDetails ||
      (await orderCollection
        .find({
          orderDate: { $gte: startDate, $lte: endDate },
          orderStatus: "Delivered",
        })
        .sort({ orderDate: -1 })
        .populate({
          path: "cartData.productId",
          model: "products",
          as: "productDetails",
        })
        .populate({
          path: "userId",
          model: "users",
          as: "userDetails",
        })
        .populate({
          path: "couponApplied",
          model: "coupons",
          as: "couponDetails",
        }));

    const productsPerPage = 15;
    const totalPages = salesDetails.length / productsPerPage;
    const pageNo = req.query.pages || 1;
    const start = (pageNo - 1) * productsPerPage;
    const end = start + productsPerPage;
    let allSales = salesDetails;
    salesDetails = salesDetails.slice(start, end);
    let totalSales = salesDetails.reduce(
      (total, sale) => total + sale.grandTotalCost,
      0
    );
    let totalSum = [];
    let total = [];
    let totalSum1 = [];
    let total2 = [];
    for (i = 0; i < salesDetails.length; i++) {
      totalSum = salesDetails[i].cartData.map((item) => item.productprice);
      total.push(totalSum);
      totalSum1 = salesDetails[i].cartData.map((item) => item.priceBeforeOffer);
      total2.push(totalSum1);
    }
    let sum = total.flat();
    let sum2 = total2.flat();
    let totalSales1 = sum.reduce((total, sale) => (total = total + sale), 0);
    let totalSales2 = sum2.reduce((total, sale) => (total = total + sale), 0);
    let coupontotal = salesDetails.reduce(
      (total, sale) => (total = total + sale.couponApplied),
      0
    );

    let totalDiscount = coupontotal + totalSales2 - totalSales1;

    req.session.sreportLen = salesDetails.length;

    const products = await orderCollection
      .find({ orderStatus: "Delivered" })
      .populate("userId")
      .sort({ _id: -1 });
    const totalcount = products.reduce((total, item) => total + item.Total, 0);

    res.render("adminViews/salesReport", {
      Sreports: salesDetails,
      totalPages,
      user,
      orders: [],
      page: 1,
      pages: 1,
      totalcount,
      startDate2,
      endDate2,
      products,
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const salesReportDownloadPDF = async (req, res, next) => {
  try {
    let startDate, endDate;
    if (req.session.startDate && req.session.endDate) {
      startDate = req.session.startDate;
      endDate = req.session.endDate;
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      endDate = new Date();
    }

    const salesData = await orderCollection
      .find({
        orderDate: { $gte: startDate, $lte: endDate },
        orderStatus: "Delivered",
      })
      .populate({
        path: "cartData.productId",
        model: "products",
        as: "productDetails",
      })
      .populate({
        path: "userId",
        model: "users",
        as: "userDetails",
      })
      .populate({
        path: "couponApplied",
        model: "coupons",
        as: "couponDetails",
      });

    const browser = await puppeteer.launch({
      channel: "chrome",
    });

    const page = await browser.newPage();

    let htmlContent = `

    <h1 style="text-align: center;">Sales Report</h1>
    <table style="width:100%; border-collapse: collapse;" border="1">

  <tr>
    <th>Order Number</th>
    <th>UserName</th>
    <th>Order Date</th>
    <th>Products</th>
    <th>Product Offer</th>
    <th>Quantity</th>
    <th>Before Offer</th>
    <th>Total Cost</th>
    <th>Payment Method</th>
    <th>Status</th>
    <th>Coupons</th>
    <th>Before Coupon</th>
    <th>Ordered Price</th>
  </tr>`;

    salesData.forEach((order) => {
      let i = 0;
      htmlContent += `
    <tr>
      <td rowspan="${order.cartData.length}" style="text-align: center;">${
        order._id
      }</td>
      <td rowspan="${order.cartData.length}" style="text-align: center;">${
        order.userId.username
      }</td>
      <td rowspan="${
        order.cartData.length
      }" style="text-align: center;">${formatDate(order.orderDate)}</td>
  `;

      order.cartData.forEach((cartItem) => {
        htmlContent += `
      <td style="text-align: center;">${cartItem.productId.productName}</td>
      <td style="text-align: center;">${
        cartItem.productId.productOfferPercentage
          ? `${cartItem.productId.productOfferPercentage}%`
          : "Nil"
      }</td>
      <td style="text-align: center;">${cartItem.productQuantity}</td>
      <td style="text-align: center;">Rs.${
        cartItem.totalCostPerProduct +
        (cartItem.productId.priceBeforeOffer * cartItem.productQuantity -
          cartItem.totalCostPerProduct)
      }</td>
      <td style="text-align: center;">Rs.${cartItem.totalCostPerProduct}</td>
    `;

        if (i === 0) {
          htmlContent += `
        <td rowspan="${order.cartData.length}" style="text-align: center;">${
            order.paymentType
          }</td>
        <td rowspan="${order.cartData.length}" style="text-align: center;">${
            order.orderStatus
          }</td>
        <td rowspan="${order.cartData.length}" style="text-align: center;">${
            order.couponApplied
              ? `${order.couponApplied.discountPercentage}%`
              : "Nil"
          }</td>
        <td rowspan="${order.cartData.length}" style="text-align: center;">${
            order.couponApplied
              ? `Rs.${Math.round(
                  order.grandTotalCost /
                    (1 - order.couponApplied.discountPercentage / 100)
                )}`
              : "Nil"
          }</td>
          <td rowspan="${
            order.cartData.length
          }" style="text-align: center;">Rs.${order.grandTotalCost}</td>
      `;
        }

        htmlContent += `
    </tr>
  `;
        i++;
      });
    });

    htmlContent += "</table>";

    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({ format: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=salesReport.pdf"
    );
    res.send(pdfBuffer);

    await browser.close();
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const formatDate = (date) => {
  // Implement your date formatting function here
  return date.toISOString().split("T")[0]; // Example implementation
};

const filterDate = async (req, res) => {
  try {
    const startOfDay = (date) => {
      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        6,
        0,
        0,
        0
      );
    };

    const endOfDay = (date) => {
      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999
      );
    };
    if (req.body.filterDateFrom && req.body.filterDateTo) {
      let startDate = new Date(req.body.filterDateFrom);
      let endDate = new Date(req.body.filterDateTo);
      startDate = startOfDay(new Date(startDate));
      endDate = endOfDay(new Date(endDate));
      if (startDate > endDate) {
        res.send({ dateInvalid: true });
      }
      const salesData = await orderCollection
        .find({
          orderDate: { $gte: startDate, $lte: endDate },
          orderStatus: "Delivered",
        })
        .sort({ orderDate: -1 })
        .populate({
          path: "cartData.productId",
          model: "products",
          as: "productDetails",
        })
        .populate({
          path: "userId",
          model: "users",
          as: "userDetails",
        })
        .populate({
          path: "couponApplied",
          model: "coupons",
          as: "couponDetails",
        });
      req.session.salesDetails = salesData;
      req.session.filterDates = { datevalues: {} };
      req.session.startDate = startDate;
      req.session.endDate = endDate;
      req.session.startDate2 = startDate;
      req.session.endDate2 = endDate;
      req.session.filterDates.datevalues = { startDate, endDate };
      req.session.save();
      res.send({ success: true });
    }
  } catch (error) {
    console.log(error);
  }
};
const salesReportDownload = async (req, res, next) => {
  try {
    let startDate, endDate;
    if (
      req.session.filterDates.datevalues.startDate &&
      req.session.filterDates.datevalues.endDate
    ) {
      startDate = req.session.filterDates.datevalues.startDate;
      endDate = req.session.filterDates.datevalues.endDate;
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      endDate = new Date();
    }

    let salesData = await orderCollection
      .find({
        orderDate: { $gte: startDate, $lte: endDate },
        orderStatus: "Delivered",
      })
      .populate({
        path: "cartData.productId",
        model: "products",
        as: "productDetails",
      })
      .populate({
        path: "userId",
        model: "users",
        as: "userDetails",
      })
      .populate({
        path: "couponApplied",
        model: "coupons",
        as: "couponDetails",
      });

    if (!salesData || !Array.isArray(salesData)) {
      console.error("salesData is undefined or not an array");
    }

    salesData = salesData.map((v) => {
      v.orderDateFormatted = formatDate(v.orderDate);
      return v;
    });
    const workBook = new exceljs.Workbook();
    const sheet = workBook.addWorksheet("book");
    sheet.columns = [
      {
        header: "Order Number",
        key: "orderNumber",
        width: 15,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
      {
        header: "UserName",
        key: "userName",
        width: 20,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
      {
        header: "Order Date",
        key: "orderDate",
        width: 20,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
      {
        header: "Products",
        key: "products",
        width: 30,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
      {
        header: "Product Offer",
        key: "productOffer",
        width: 20,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
      {
        header: "Quantity",
        key: "quantity",
        width: 15,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
      {
        header: "Before Offer",
        key: "beforeOffer",
        width: 20,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
      {
        header: "Total Cost",
        key: "totalCost",
        width: 20,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
      {
        header: "Payment Method",
        key: "paymentMethod",
        width: 20,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
      {
        header: "Status",
        key: "status",
        width: 15,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
      {
        header: "Coupons",
        key: "coupons",
        width: 20,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
      {
        header: "Before Coupon",
        key: "beforeCoupon",
        width: 20,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
      {
        header: "Ordered Price",
        key: "orderedPrice",
        width: 20,
        style: { alignment: { horizontal: "center", vertical: "middle" } },
      },
    ];

    let currentRow = 1;

    salesData.forEach((order) => {
      order.cartData.forEach((cartItem, index) => {
        const row = sheet.addRow([
          index === 0 ? order._id : "",
          index === 0 ? order.userId.username : "",
          index === 0 ? order.orderDateFormatted : "",
          cartItem.productId.productName,
          cartItem.productId.productOfferPercentage
            ? `${cartItem.productId.productOfferPercentage}%`
            : "Nil",
          cartItem.productQuantity,
          `Rs.${
            cartItem.totalCostPerProduct +
            (cartItem.productId.priceBeforeOffer * cartItem.productQuantity -
              cartItem.totalCostPerProduct)
          }`,
          `Rs.${cartItem.totalCostPerProduct}`,
          index === 0 ? order.paymentType : "",
          index === 0 ? order.orderStatus : "",
          index === 0
            ? order.couponApplied
              ? `${order.couponApplied.discountPercentage}%`
              : "Nil"
            : "",
          index === 0
            ? order.couponApplied
              ? `Rs.${Math.round(
                  order.grandTotalCost /
                    (1 - order.couponApplied.discountPercentage / 100)
                )}`
              : "Nil"
            : "",
          index === 0 ? `Rs.${order.grandTotalCost}` : "",
        ]);
      });
    });
    let startIndex = 1;
    let endIndex;
    salesData.forEach((order, orderIndex) => {
      startIndex += 1;
      endIndex = startIndex + order.cartData.length - 1;
      sheet.mergeCells(`A${startIndex}:A${endIndex}`);
      sheet.mergeCells(`B${startIndex}:B${endIndex}`);
      sheet.mergeCells(`C${startIndex}:C${endIndex}`);
      sheet.mergeCells(`I${startIndex}:I${endIndex}`);
      sheet.mergeCells(`J${startIndex}:J${endIndex}`);
      sheet.mergeCells(`K${startIndex}:K${endIndex}`);
      sheet.mergeCells(`L${startIndex}:L${endIndex}`);
      sheet.mergeCells(`M${startIndex}:M${endIndex}`);

      sheet.getCell(`A${startIndex}:M${endIndex}`).style.alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      startIndex += order.cartData.length - 1;
    });

    const totalOrders = salesData.length;
    const totalSales = salesData.reduce(
      (total, sale) => total + sale.grandTotalCost,
      0
    );
    const totalDiscount = salesData.reduce((total, sale) => {
      let discountAmount = sale.cartData.reduce((discount, cartItem) => {
        let productPrice = cartItem.productId.productPrice;
        let priceBeforeOffer = cartItem.productId.priceBeforeOffer;
        let discountPercentage = cartItem.productId.productOfferPercentage || 0;
        let actualAmount = productPrice * cartItem.productQuantity;
        let paidAmount =
          actualAmount - (actualAmount * discountPercentage) / 100;
        return discount + (actualAmount - paidAmount);
      }, 0);
      return total + discountAmount;
    }, 0);

    sheet.addRow({});
    sheet.addRow({ "Total Orders": totalOrders });
    sheet.addRow({ "Total Sales": "₹" + totalSales });
    sheet.addRow({ "Total Discount": "₹" + totalDiscount });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=salesReport.xlsx"
    );

    await workBook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const removeAllFillters = async (req, res, next) => {
  try {
    req.session.salesDetails = null;
    req.session.startDate2 = null;
    req.session.endDate2 = null;
    res.redirect("/admin/salesReport");
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const filterOptions = async (req, res, next) => {
  try {
    let { filterOption } = req.body;
    let startDate, endDate;

    if (filterOption === "month") {
      endDate = new Date();
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 30);
    } else if (filterOption === "week") {
      let currentDate = new Date();
      let currentDay = currentDate.getDay();
      let diff = currentDate.getDate() - currentDay - 7;
      startDate = new Date(currentDate.setDate(diff));
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else if (filterOption === "year") {
      let currentYear = new Date().getFullYear();
      startDate = new Date(currentYear, 0, 1);
      endDate = new Date(currentYear, 11, 31);
    }

    let salesDataFiltered = await orderCollection
      .find({
        orderDate: { $gte: startDate, $lte: endDate },
        orderStatus: "Delivered",
      })
      .sort({ orderDate: -1 })
      .populate({
        path: "cartData.productId",
        model: "products",
        as: "productDetails",
      })
      .populate({
        path: "userId",
        model: "users",
        as: "userDetails",
      })
      .populate({
        path: "couponApplied",
        model: "coupons",
        as: "couponDetails",
      });

    req.session.admin = {};
    req.session.admin.dateValues = { startDate, endDate };
    req.session.salesDetails = salesData = JSON.parse(
      JSON.stringify(salesDataFiltered)
    );

    res.status(200).json({ success: true });
  } catch (error) {
    next(new AppError("Somthing went Wrong", 500));
  }
};

module.exports = {
  SalesReportGet,
  salesReportDownloadPDF,
  salesReportDownload,
  filterDate,
  filterOptions,
  removeAllFillters,
};
