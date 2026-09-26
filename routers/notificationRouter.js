import express from "express";
import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
} from "../controllers/notificationControllers.js";

const notificationRouter = express.Router();

// Get notifications for logged-in user
notificationRouter.get("/", getUserNotifications);

// Create a notification
notificationRouter.post("/", createNotification);

// Mark a notification as read
notificationRouter.put("/:id/read", markNotificationAsRead);

export default notificationRouter;