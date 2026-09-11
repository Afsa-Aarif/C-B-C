import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import OTP from "../models/otpModel.js";
import nodemailer from "nodemailer";
import dns from "dns";
import getDesignedEmail from "../lib/emailDesigner.js";

// Force default DNS lookup to IPv4 globally in Node.js
dns.setDefaultResultOrder("ipv4first");

// --- CONFIGURATION FOR EMAIL USING ENVIRONMENT VARIABLES WITH STRICT IPv4 LOOKUP ---
const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Port 587 uses STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Force custom DNS lookup to guarantee IPv4 resolution on Render
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { family: 4 }, callback);
    },
    connectionTimeout: 10000, // 10 seconds connection timeout
    greetingTimeout: 10000,
    socketTimeout: 10000,
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// --- 1. SEND OTP ---
export const sendOTP = async (req, res) => {
  try {
    const identifier =
      req.body.email || req.body.identifier || req.params.identifier || req.params.email;

    if (!identifier) {
      return res
        .status(400)
        .json({ message: "Email or phone number is required" });
    }

    const cleanIdentifier = identifier.trim();

    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found with that email/phone" });
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    console.log("------------------------------------------");
    console.log(`🔑 GENERATED OTP FOR ${user.email}: ${otp}`);
    console.log("------------------------------------------");

    // Store/Update OTP in User model
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Upsert in standalone OTP model
    await OTP.findOneAndUpdate(
      { email: user.email },
      { otp },
      { upsert: true, new: true }
    );

    if (cleanIdentifier.includes("@")) {
      // Verify if email environment variables exist
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("⚠️ WARNING: EMAIL_USER or EMAIL_PASS environment variables are missing on Render.");
        return res.json({
          message: "OTP generated successfully (Email delivery skipped: Missing credentials in environment variables)",
          otp: process.env.NODE_ENV === "development" ? otp : undefined
        });
      }

      try {
        const transporter = createTransporter();
        const mailOptions = {
          from: `"Crystal Beauty Clear" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: "Your Password Reset OTP",
          text: `Hi ${user.firstName || "there"}! Your OTP for resetting your password is: ${otp}. It will expire in 10 minutes.`,
          html: typeof getDesignedEmail === "function" ? getDesignedEmail({
            otp,
            firstName: user.firstName || "Customer",
            brandName: "Crystal Beauty Clear",
            supportEmail: process.env.EMAIL_USER,
          }) : `<p>Your OTP is <b>${otp}</b></p>`,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Email sent successfully:", info.response);

        return res.json({
          message: "OTP sent to your email",
        });
      } catch (emailError) {
        console.error("❌ NODEMAILER ERROR DETECTED:", emailError);
        return res.status(500).json({
          message: "Failed to send OTP email: " + (emailError.message || "Email transport failure"),
        });
      }
    } else {
      console.log("------------------------------------------");
      console.log(`📱 SMS SIMULATOR: Sending to ${cleanIdentifier}`);
      console.log(`💬 MESSAGE: Your CrystalBeauty OTP is ${otp}`);
      console.log("------------------------------------------");

      return res.json({
        message: "OTP sent via SMS",
      });
    }
  } catch (error) {
    console.error("OTP General Error:", error);
    return res.status(500).json({
      message: "Internal server error: " + (error.message || "Server failure"),
    });
  }
};

// --- 2. CHANGE PASSWORD ---
export const changePassword = async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;

    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields (identifier, otp, newPassword) are required" });
    }

    const cleanIdentifier = identifier.trim();
    const cleanOtp = otp.trim();

    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
      otp: cleanOtp,
      otpExpiry: {
        $gt: Date.now(),
      },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    user.otpExpiry = undefined;

    await user.save();

    await OTP.deleteOne({ email: user.email });

    res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Password Change Error:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

// --- 3. CREATE USER ---
export const createUser = async (req, res) => {
  try {
    const { email, firstName, lastName, password, phone } = req.body;

    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      phone,
      firstName,
      lastName,
      password: hashedPassword,
      role: "customer",
      isEmailVerified: true,
    });

    await user.save();

    return res.status(201).json({
      message: "User created successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create user",
    });
  }
};

// --- 4. LOGIN USER ---
export async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.isBlock) {
      return res.status(403).json({
        message: "Account suspended.",
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid password",
      });
    }

    const secret = process.env.JWT_KEY || "jwt-secret";

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      secret,
      {
        expiresIn: "24h",
      }
    );

    return res.json({
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Login Error Context:", error);
    return res.status(500).json({
      message: "An error occurred",
    });
  }
}

// --- 5. GET USER PROFILE ---
export async function getUser(req, res) {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user = await User.findOne({
      email: req.user.email,
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User profile not found",
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
}

// --- UPDATE USER PROFILE ---
export const updateUser = async (req, res) => {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({
        message: "Unauthorized token state context",
      });
    }

    const email = req.user.email;

    let updateData = {
      ...(req.body || {}),
    };

    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }

    let streetVal =
      updateData.address ||
      updateData["shippingAddress[street]"] ||
      (updateData.shippingAddress && updateData.shippingAddress.street);

    let cityVal =
      updateData["shippingAddress[city]"] ||
      (updateData.shippingAddress && updateData.shippingAddress.city) ||
      "Colombo";

    let postalCodeVal =
      updateData["shippingAddress[postalCode]"] ||
      (updateData.shippingAddress && updateData.shippingAddress.postalCode) ||
      "00300";

    let countryVal =
      updateData["shippingAddress[country]"] ||
      (updateData.shippingAddress && updateData.shippingAddress.country) ||
      "Sri Lanka";

    if (streetVal) {
      updateData.shippingAddress = {
        street: streetVal,
        city: cityVal,
        postalCode: postalCodeVal,
        country: countryVal,
      };

      updateData.address = streetVal;
    }

    delete updateData["shippingAddress[street]"];
    delete updateData["shippingAddress[city]"];
    delete updateData["shippingAddress[postalCode]"];
    delete updateData["shippingAddress[country]"];

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $set: updateData },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        message: "Could not find a user profile to update",
      });
    }

    res.json({
      message: "Successfully updated profile details!",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Backend Profile Update Failure:", error);
    res.status(500).json({
      message: "Update process failed inside database records",
    });
  }
};

// --- UPDATE USER STATUS (ADMIN BLOCK / UNBLOCK) ---
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlock } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.email === process.env.EMAIL_USER) {
      return res.status(403).json({
        message: "Admin protected",
      });
    }

    user.isBlock = isBlock;
    await user.save();

    res.json({
      message: "Status updated",
      user,
    });
  } catch (error) {
    console.error("Update User Status Error:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

// --- GET ALL USERS (ADMIN) ---
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Fetch Users Error:", error);
    res.status(500).json({
      message: "Fetch failed",
    });
  }
};

// --- VERIFY ADMIN MIDDLEWARE ---
export function verifyAdmin(req, res, next) {
  if (
    req.user &&
    req.user.role === "admin"
  ) {
    next();
  } else {
    res.status(403).json({
      message: "Access Denied: Admins Only",
    });
  }
}