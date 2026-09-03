import mongoose from "mongoose";
import "./product.js"; // Ensures Product schema is registered

const wishlistSchema = new mongoose.Schema({
  userEmail: { 
    type: String, 
    required: true, 
    unique: true 
  },
  products: [
    {
      productID: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Product" // CHANGED: Now matches your Product model name exactly
      },
      addedAt: { 
        type: Date, 
        default: Date.now 
      }
    }
  ]
});

const Wishlist = mongoose.model("wishlist", wishlistSchema);
export default Wishlist;