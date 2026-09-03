import express from "express";
import Wishlist from "../models/wishlist.js";
import Product from "../models/product.js"; // Explicitly import Product for populate

const wishlistRouter = express.Router();

// 1. Get user's wishlist
wishlistRouter.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const wishlist = await Wishlist.findOne({ userEmail: email }).populate("products.productID");
    
    res.json(wishlist || { products: [] });
  } catch (error) {
    console.error("Fetch Wishlist Error:", error);
    res.status(500).json({ message: "Error fetching wishlist" });
  }
});

// 2. Add or Remove item from wishlist
wishlistRouter.post("/toggle", async (req, res) => {
  const { email, productID } = req.body;
  
  try {
    let wishlist = await Wishlist.findOne({ userEmail: email });

    if (!wishlist) {
      wishlist = new Wishlist({ userEmail: email, products: [{ productID }] });
    } else {
      const itemIndex = wishlist.products.findIndex(
        (p) => p.productID && p.productID.toString() === productID
      );

      if (itemIndex > -1) {
        wishlist.products.splice(itemIndex, 1);
      } else {
        wishlist.products.push({ productID });
      }
    }
    
    await wishlist.save();
    const updatedWishlist = await Wishlist.findOne({ userEmail: email }).populate("products.productID");
    res.json(updatedWishlist);
  } catch (error) {
    console.error("Toggle Wishlist Error:", error);
    res.status(500).json({ message: "Error updating wishlist" });
  }
});

export default wishlistRouter;