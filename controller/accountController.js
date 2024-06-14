const userCollection = require("../models/userModel");
const addressCollection = require("../models/addressModel");
const AppError = require("../middlewares/errorHandling");

const userDetailsPage = async (req, res, next) => {
  try {
    const email = req.session.currentUser.email;
    const user = await userCollection.findOne({ email: email });
    res.render("userViews/userDetails", { user: user });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const profileEdit = async (req, res, next) => {
  try {
    const { username, email, phone } = req.body;

    const userDet = await userCollection.findOne({ email: email });
    if (!userDet) {
      return res.status(404).send({ error: true, message: "User not found" });
    } else {
      await userCollection.updateOne(
        { email: email },
        {
          $set: {
            username: username,
            phonenumber: phone,
          },
        }
      );
      res.send({ success: true, name: username, phone: phone });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const addressPage = async (req, res, next) => {
  try {
    const userId = req.session.currentUser._id;
    const userAddress = await addressCollection.find({
      userId: userId,
    });
    res.render("userViews/address", {
      user: req.session.currentUser,
      addresses: userAddress,
    });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const addAddressPage = async (req, res, next) => {
  try {
    let user;
    if (req.session.logged) {
      const email = req.session.currentUser.email;
      user = await userCollection.findOne({ email: email });
    } else {
      user = {};
    }
    res.render("userViews/addAddress", { user: user });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const addAddress = async (req, res, next) => {
  try {
    const userId = req.session.currentUser._id;
    const address = {
      userId: userId,
      addressTitle: req.body.addressTitle,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      addressLine1: req.body.addressLine1,
      addressLine2: req.body.addressLine2,
      city: req.body.city,
      state: req.body.state,
      zipcode: req.body.pinCode,
      phone: req.body.phone,
      alternateNumber: req.body.alternateNumber,
    };
    await addressCollection.insertMany([address]);
    res.send({ success: true });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const editAddress = async (req, res, next) => {
  try {
    const editAddress = addressCollection.findOne({ _id: req.query.id });
    if (!editAddress) {
      console.log("Address is not Exsisted");
    } else {
      await addressCollection.updateOne(
        { _id: req.query.id },
        {
          $set: {
            addressTitle: req.body.title,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            city: req.body.city,
            state: req.body.state,
            zipcode: req.body.pinCode,
            phone: req.body.phone,
            alternateNumber: req.body.alternateNumber,
          },
        }
      );
      res.send({ success: true });
    }
  } catch (error) {
    next(new AppError(error, 500));
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    const addressId = req.query.id;
    const address = await addressCollection.findByIdAndDelete(addressId);

    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    res.send({ success: true });
  } catch (error) {
    next(new AppError(error, 500));
  }
};

module.exports = {
  userDetailsPage,
  profileEdit,
  addressPage,
  addAddressPage,
  addAddress,
  editAddress,
  deleteAddress,
};
