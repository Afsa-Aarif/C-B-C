import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  productID: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  altNames: {
    type: [String],
    default: [],
  },
  images: {
    type: [String], 
    default: [],
  },
  price: {
    type: Number,
    required: true,
  },
  labelledPrice: {
    type: Number,
    required: true,
  },
  stock: {
    type: Number,
    default: 0,
  },
  category: {
    type: String,
    default: "Beauty",
  },
  description: {
    type: String,
    required: true, 
  },
  usage: {
    type: String,
    default: "Apply a small amount to the desired area and massage gently until fully absorbed.",
  },
  shippingInfo: {
    type: String,
    default: "Fast delivery within 1-3 business days across Sri Lanka.",
  },
  features: {
    type: [String],
    default: ["Vegan", "Cruelty Free", "Dermatologically Tested"],
  },
  rating: {
    type: Number,
    default: 5.0, // Default to a clean initial rating
  },
  reviewsCount: {
    type: Number,
    default: 0,
  },
  reviews: [reviewSchema] // Nested array for individual user feedbacks
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
export default Product;