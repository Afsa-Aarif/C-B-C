import express from "express";
import Coupon from "../models/couponModel.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import { sendNotificationEmail } from "../lib/notificationEmail.js";
const couponRouter = express.Router();

// Helper middleware for Admin authorization
const isAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== "admin" && req.user.type !== "admin")) {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }
  next();
};

// 1. Fetch Active Coupons (PUBLIC Customer Route for Banners & Product Page)
couponRouter.get("/public/active", async (req, res) => {
  try {
    const today = new Date();
    // Retrieve coupons that are explicitly active and not expired
    const activeCoupons = await Coupon.find({
      isActive: true,
      $or: [
        { expirationDate: { $gte: today } },
        { expirationDate: null }
      ]
    }).sort({ createdAt: -1 });

    res.json(activeCoupons);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch active coupons", error: error.message });
  }
});

// 2. Create a new coupon (Admin Only)
couponRouter.post("/", isAdmin, async (req, res) => {
  try {
    const { code, discountType, discountValue, minPurchase, expirationDate } = req.body;

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ message: "Promo code already exists." });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      minPurchase: Number(minPurchase) || 0,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
    });

    await newCoupon.save();

// Notify all customers about the new promotion
const customers = await User.find({
  role: "customer",
});

const promotionTitle = "New Promotion Available!";

const promotionMessage =
  `${newCoupon.code} is now available. ` +
  `Get ${newCoupon.discountType === "percentage"
    ? `${newCoupon.discountValue}% off`
    : `LKR ${newCoupon.discountValue} off`
  } on your purchase.` +
  `${newCoupon.minPurchase > 0
    ? ` Minimum purchase: LKR ${newCoupon.minPurchase}.`
    : ""
  }` +
  `${newCoupon.expirationDate
    ? ` Offer valid until ${new Date(newCoupon.expirationDate).toLocaleDateString()}.`
    : ""
  }`;

// Create in-app notifications for all customers
if (customers.length > 0) {
  await Notification.insertMany(
    customers.map((customer) => ({
      userId: customer._id,
      type: "PROMOTION",
      title: promotionTitle,
      message: promotionMessage,
    }))
  );

  // Send promotion emails
  for (const customer of customers) {
    await sendNotificationEmail({
      to: customer.email,
      firstName: customer.firstName,
      title: promotionTitle,
      message: promotionMessage,
    });
  }
}

res.status(201).json({
  message: "Promo code created successfully",
  coupon: newCoupon,
});
  } catch (error) {
    res.status(500).json({ message: "Failed to create promo code", error: error.message });
  }
});

// 3. Fetch all coupons (Admin Only)
couponRouter.get("/", isAdmin, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch coupons", error: error.message });
  }
});

// 4. Toggle Coupon Active Status (Admin Only)
couponRouter.put("/:id/toggle", isAdmin, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({ message: "Coupon status updated", coupon });
  } catch (error) {
    res.status(500).json({ message: "Failed to update coupon status", error: error.message });
  }
});

// 5. Delete a Coupon (Admin Only)
couponRouter.delete("/:id", isAdmin, async (req, res) => {
  try {
    const deletedCoupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!deletedCoupon) return res.status(404).json({ message: "Coupon not found" });

    res.json({ message: "Promo code deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete coupon", error: error.message });
  }
});

// 6. Validate Coupon for Checkout (Public / Customer Route)
couponRouter.post("/validate", async (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    if (!code) return res.status(400).json({ message: "Please provide a promo code" });

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) {
      return res.status(404).json({ message: "Invalid or inactive promo code" });
    }

    if (coupon.expirationDate && new Date() > new Date(coupon.expirationDate)) {
      return res.status(400).json({ message: "This promo code has expired" });
    }

    const minReq = coupon.minPurchase || coupon.minOrderAmount || 0;
    if (cartTotal < minReq) {
      return res.status(400).json({
        message: `Minimum order total of LKR ${minReq.toLocaleString()} required for this code`,
      });
    }

    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (cartTotal * coupon.discountValue) / 100;
    } else {
      discountAmount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed total
    if (discountAmount > cartTotal) discountAmount = cartTotal;

    res.json({
      valid: true,
      message: "Promo code applied successfully",
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      newTotal: cartTotal - discountAmount,
    });
  } catch (error) {
    res.status(500).json({ message: "Error validating coupon", error: error.message });
  }
});

export default couponRouter;