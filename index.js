import 'dotenv/config';
import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import cors from "cors";
import path from "path";

// Router Imports
import userRouter from "./routers/userRouter.js";
import productRouter from "./routers/productRouter.js";
import orderRouter from "./routers/orderRouter.js";
import paymentRouter from "./routers/paymentRouter.js";
import wishlistRouter from "./routers/wishlistRouter.js";
import contactRouter from "./routers/contactRouter.js";
import couponRouter from "./routers/couponRouter.js";

const app = express();

// 1. Path Configuration
const __dirname = path.resolve();

// 2. Updated CORS Configuration (Includes Netlify and Localhost)
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      
      if (
        allowedOrigins.indexOf(origin) !== -1 || 
        origin.endsWith(".vercel.app") || 
        origin.endsWith(".onrender.com") ||
        origin.endsWith(".netlify.app")
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json());

// --- STATIC FILES CONFIGURATION ---
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 3. Database Connection
const connectionString = process.env.MONGO_URL;

mongoose.connect(connectionString)
  .then(() => console.log("✅ Database connected successfully"))
  .catch((e) => console.error("❌ Database connection failed:", e));

// 4. Security Middleware (JWT Decoder)
app.use((req, res, next) => {
  let token = req.header("Authorization");
  
  if (token && token.startsWith("Bearer ")) {
    token = token.replace("Bearer ", "");
    
    const secret = process.env.JWT_KEY || "jwt-secret";
    
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        req.user = null;
      } else {
        req.user = decoded; 
      }
      next();
    });
  } else {
    req.user = null;
    next();
  }
});

// 5. API Routes
app.use("/api/users", userRouter); 
app.use("/api/products", productRouter);
app.use("/api/orders", orderRouter); 
app.use("/api/payment", paymentRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/contact", contactRouter);
app.use("/api/coupons", couponRouter);

// 6. Health Check
app.get("/", (req, res) => {
  res.json({ 
    message: "Crystal Beauty Backend is Running",
    dbStatus: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// 7. Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack);
  res.status(500).send({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
// CI/CD pipeline test 2