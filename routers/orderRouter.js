import express from "express";
import Order from "../models/order.js";
import Coupon from "../models/couponModel.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import { sendNotificationEmail } from "../lib/notificationEmail.js";
const orderRouter = express.Router();

// 1. Route to get orders for a SPECIFIC user (Required for MyOrdersPage)
orderRouter.get("/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    
    // Find all orders in MongoDB that match this email
    const orders = await Order.find({ email: email }).sort({ date: -1 });
    
    if (!orders) {
      return res.status(404).json({ message: "No orders found for this user" });
    }
    
    res.json(orders);
  } catch (error) {
    console.error("Fetch User Orders Error:", error);
    res.status(500).json({ message: "Error fetching user orders" });
  }
});

// 2. Route to create a new order (Supports Cards, COD, Guests, and Promo Codes)
orderRouter.post("/", async (req, res) => {
  try {
    const { 
      customerName, 
      email, 
      phone, 
      address, 
      items, 
      subtotal,
      discountAmount = 0,
      couponCode = null,
      paymentMethod, 
      total, 
      paymentStatus, 
      transactionId 
    } = req.body;

    // Determine tracking statuses safely based on frontend payment selection
    const assignedStatus = paymentMethod === "Card Payment" ? "Paid" : "Pending";
    const assignedOrderProgressStatus = paymentMethod === "Card Payment" ? "Processing" : "Order Placed";

    // Increment usage count for applied promo code if available
    if (couponCode) {
      try {
        await Coupon.findOneAndUpdate(
          { code: couponCode.toUpperCase() },
          { $inc: { uses: 1 } }
        );
      } catch (couponError) {
        console.error("Failed to increment coupon usage:", couponError);
      }
    }

    const newOrder = new Order({
      customerName,
      email,
      phone,
      address,
      items,
      subtotal: subtotal || total,
      discountAmount,
      couponCode: couponCode ? couponCode.toUpperCase() : null,
      paymentMethod,
      total,
      paymentStatus: paymentStatus || assignedStatus,
      transactionId: transactionId || "N/A",
      status: assignedOrderProgressStatus // Dynamically sets the order status flow safely
    });

    await newOrder.save();

// Find the customer account
const user = await User.findOne({ email });

if (user) {
  // Create in-app order notification
  await Notification.create({
    userId: user._id,
    type: "ORDER_PLACED",
    title: "Order placed successfully!",
    message: `Hi ${user.firstName}, your order has been placed successfully. Your order total is Rs. ${total}.`,
  });

  // Send order confirmation email
  await sendNotificationEmail({
    to: user.email,
    firstName: user.firstName,
    title: "Your order has been placed!",
    message: `Hi ${user.firstName}, your order has been placed successfully. Your total is Rs. ${total}. We will keep you updated about your order status.`,
  });
}

res.status(201).json({
  message: "Order placed successfully!",
  order: newOrder
});
  } catch (error) {
    console.error("Order Creation Error Stack:", error);
    res.status(500).json({ message: "Failed to process order", details: error.message });
  }
});

// 3. Route for Admin to see all orders
orderRouter.get("/", async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    const orders = await Order.find().sort({ date: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders" });
  }
});

// 4. Route to update order status
orderRouter.put("/status/:id", async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    const { id } = req.params;
    const { status } = req.body;

    const updatedOrder = await Order.findByIdAndUpdate(
  id,
  { status },
  { new: true }
);

if (!updatedOrder) {
  return res.status(404).json({ message: "Order not found" });
}

// Find the customer account
const user = await User.findOne({
  email: updatedOrder.email,
});

if (user) {
  // Create in-app status notification
  await Notification.create({
    userId: user._id,
    type: "ORDER_STATUS",
    title: `Order status updated: ${status}`,
    message: `Hi ${user.firstName}, your order status has been updated to "${status}".`,
  });

  // Send status update email
  await sendNotificationEmail({
    to: user.email,
    firstName: user.firstName,
    title: `Your order status is now ${status}`,
    message: `Hi ${user.firstName}, your order status has been updated to "${status}".`,
  });
}

res.json(updatedOrder);
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Error updating status" });
  }
});

export default orderRouter;