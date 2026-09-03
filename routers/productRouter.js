import express from 'express';
import {
  createProduct,
  deleteProduct,
  updateProduct,
  getProducts,
  getProductByID 
} from "../controllers/productControllers.js";
import { verifyAdmin } from "../controllers/userControllers.js"; 
import Product from "../models/product.js"; 
import upload from "../middlewares/upload.js"; // IMPORTED: Your multipart file upload middleware

const productRouter = express.Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================

productRouter.get("/", getProducts);

// FETCH STREAM OF RELATED CATALOG PRODUCTS
productRouter.get("/recommendations/explore", async (req, res) => {
  try {
    const currentCategoryId = req.query.category;
    const excludeId = req.query.exclude;

    let query = {};
    if (currentCategoryId) {
      query.category = currentCategoryId;
    }
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    // Grab up to 10 products matching the criteria
    let items = await Product.find(query).limit(10);
    
    // Fallback if the specific category doesn't have enough alternative items
    if (items.length < 4) {
      items = await Product.find({ _id: { $ne: excludeId } }).limit(10);
    }

    res.status(200).json({ success: true, products: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// SUBMIT USER COMMENT & RATING UPDATE
// Note: Placed explicitly BEFORE the /:id route to prevent pattern matching conflicts
productRouter.post("/:id/review", async (req, res) => {
  try {
    const { username, email, rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Parse the input rating properly to ensure it's a valid integer
    const parsedRating = Number(rating) || 5;

    // Build sub-document schema item payload
    const newReview = { 
      username: username || "Verified Buyer", 
      email, 
      rating: parsedRating, 
      comment,
      createdAt: new Date()
    };
    
    // Secure the reviews array locally
    const currentReviews = product.reviews || [];
    currentReviews.push(newReview);

    // Safeguard star metric equations from calculating NaN values
    const reviewsCount = currentReviews.length;
    const totalStars = currentReviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0);
    const finalRating = parseFloat((totalStars / reviewsCount).toFixed(1));

    // BYPASS TOP-LEVEL VALIDATION: Update only the review metrics atomically
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          reviews: currentReviews,
          reviewsCount: reviewsCount,
          rating: finalRating
        }
      },
      { new: true, runValidators: false } // Prevents top-level product schema properties from blocking this update
    );

    res.status(201).json({ success: true, product: updatedProduct });
  } catch (error) {
    console.error("🔥 Review Endpoint Failure:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

productRouter.get("/:id", getProductByID);

// ==========================================
// PROTECTED ADMIN ROUTES
// ==========================================
// UPDATED: Added upload validation directly following verifyAdmin verification
productRouter.post("/", verifyAdmin, upload.array("images", 10), createProduct);
productRouter.put("/:id", verifyAdmin, upload.array("images", 10), updateProduct);
productRouter.delete("/:id", verifyAdmin, deleteProduct);

export default productRouter;