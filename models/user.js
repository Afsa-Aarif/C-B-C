import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },

  phone: {
    type: String,
    unique: true,
    sparse: true,
  },

  firstName: {
    type: String,
    required: true,
  },

  lastName: {
    type: String,
    required: true,
  },

  name: {
    type: String,
    default: "",
  },

  password: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    required: true,
    default: "customer",
  },

  isBlock: {
    type: Boolean,
    default: false,
  },

  isEmailVerified: {
    type: Boolean,
    default: false,
  },

  image: {
    type: String,
    default: "",
  },

  address: {
    type: String,
    default: "",
  },

  shippingAddress: {
    street: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      default: "",
    },
    postalCode: {
      type: String,
      default: "",
    },
    country: {
      type: String,
      default: "",
    },
  },

  otp: {
    type: String,
  },

  otpExpiry: {
    type: Date,
  },
});

const User = mongoose.model("user", userSchema);

export default User;