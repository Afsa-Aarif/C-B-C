import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import OTP from "../models/otpModel.js";
import { Resend } from "resend";
import getDesignedEmail from "../lib/emailDesigner.js";

// Initialize Resend Client with local fallback to prevent crashes when ENV is loading
const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key_for_local_dev");

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
      // Check if Resend API key is set
      if (!process.env.RESEND_API_KEY) {
        console.warn("⚠️ WARNING: RESEND_API_KEY environment variable is missing on Render.");
        return res.json({
          message: "OTP generated successfully (Email delivery skipped: Missing API key)",
          otp: process.env.NODE_ENV === "development" ? otp : undefined
        });
      }

      try {
        const { data, error } = await resend.emails.send({
          from: "Crystal Beauty Clear <onboarding@resend.dev>", // Default free testing sender
          to: user.email,
          subject: "Your Password Reset OTP",
          html: typeof getDesignedEmail === "function" ? getDesignedEmail({
            otp,
            firstName: user.firstName || "Customer",
            brandName: "Crystal Beauty Clear",
            supportEmail: "support@crystalbeauty.com",
          }) : `<p>Your OTP is <b>${otp}</b></p>`,
        });

        if (error) {
          console.error("❌ RESEND API ERROR:", error);
          return res.status(500).json({
            message: "Failed to send OTP email: " + error.message,
          });
        }

        console.log("✅ Email sent successfully via Resend API:", data);

        return res.json({
          message: "OTP sent to your email",
        });
      } catch (emailError) {
        console.error("❌ RESEND CATCH ERROR:", emailError);
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