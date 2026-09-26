import express from "express";
import {
  getUserNotifications,
  markNotificationAsRead,
} from "../controllers/notificationControllers.js";

const notificationRouter = express.Router();

// Get notifications for logged-in user
notificationRouter.get("/", getUserNotifications);

// Create a notification


// Mark a notification as read
notificationRouter.put("/:id/read", markNotificationAsRead);

export default notificationRouter;