import express from "express";
import jwt from "jsonwebtoken";
import {
  createUser,
  loginUser,
  getUser,
  getAllUsers,
  updateUser,
  updateUserStatus,
  sendOTP,
  changePassword,
} from "../controllers/userControllers.js";
import upload from "../middlewares/upload.js";

const userRouter = express.Router();

// --- 1. Token Decoder Middleware ---
const verifyTokenInline = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const secret = process.env.JWT_KEY || "jwt-secret";

      const decoded = jwt.verify(token, secret);
      req.user = decoded;
    }
  } catch (error) {
    console.error("Token verification failed inline:", error.message);
  }
  next();
};

// --- 2. Authentication Route Guard Middleware ---
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.email) {
    return res.status(401).json({
      message:
        "Access Denied: Your authentication token is invalid or missing. Please log in again.",
    });
  }
  next();
};

// --- Authentication Routes ---
userRouter.post("/", createUser);
userRouter.post("/login", loginUser);

// --- User Profile Routes ---
userRouter.get("/me", verifyTokenInline, requireAuth, getUser);
userRouter.put(
  "/me",
  verifyTokenInline,
  requireAuth,
  upload.single("image"),
  updateUser
);
userRouter.put("/me/password", verifyTokenInline, requireAuth, changePassword);

// --- Password Reset (Forgot Password) Routes ---
userRouter.post("/send-otp", sendOTP);
userRouter.get("/send-otp/:identifier", sendOTP);
userRouter.post("/change-password", changePassword);

// --- Admin Routes ---
userRouter.get("/all-users", verifyTokenInline, requireAuth, getAllUsers);
userRouter.put(
  "/block-unblock/:id",
  verifyTokenInline,
  requireAuth,
  updateUserStatus
);

// Backward compatibility route wrapper
userRouter.put("/:email", verifyTokenInline, requireAuth, updateUser);

export default userRouter;