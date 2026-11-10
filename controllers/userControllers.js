import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import MembershipRequest from "../models/membershipRequest.js";
import OTP from "../models/otpModel.js";
import nodemailer from "nodemailer";
import getDesignedEmail from "../lib/emailDesigner.js";
import Notification from "../models/notification.js";
import { sendNotificationEmail } from "../lib/notificationEmail.js";

// Configure Nodemailer Transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 2525,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// --- 1. SEND OTP ---
export const sendOTP = async (req, res) => {
  try {
    const identifier =
      req.body.email || req.body.identifier || req.params.identifier || req.params.email;

    if (!identifier) {
      return res.status(400).json({ message: "Email or phone number is required" });
    }

    const cleanIdentifier = identifier.trim();

    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { phone: cleanIdentifier }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found with that email/phone" });
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    console.log("------------------------------------------");
    console.log(`🔑 OTP generated for ${user.email}`);
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
      const mailOptions = {
        from: `"Crystal Beauty Clear" <f.afsaarif565@gmail.com>`,
        to: user.email,
        subject: "Your Password Reset OTP",
        html: typeof getDesignedEmail === "function" ? getDesignedEmail({
          otp,
          firstName: user.firstName || "Customer",
          brandName: "Crystal Beauty Clear",
          supportEmail: "support@crystalbeauty.com",
        }) : `<p>Your OTP is <b>${otp}</b></p>`,
      };

     // Handle SMTP sending errors safely
      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully via Brevo SMTP to ${user.email}`);
        return res.json({ message: "OTP sent to your email address!" });
      } catch (mailError) {
        console.error("⚠️ SMTP Network Error / Port Blocked:", mailError.message);
        
        // Fallback response so frontend presentation flow never breaks
        return res.status(500).json({
  message: "Failed to send OTP email. Please try again later."
});
      }
    } else {
      console.log("------------------------------------------");
      console.log(`📱 SMS SIMULATOR: Sending to ${cleanIdentifier}`);
      console.log(`💬 SMS OTP generated for ${cleanIdentifier}`);
      console.log("------------------------------------------");

      return res.json({ message: "OTP sent via SMS" });
    }
  } catch (error) {
    console.error("OTP General Error:", error);
    return res.status(500).json({
      message: "Failed to send OTP email: " + (error.message || "Server failure"),
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

// Create welcome notification
await Notification.create({
  userId: user._id,
  type: "WELCOME",
  title: "Welcome to Crystal Beauty Clear!",
  message: `Hi ${user.firstName}, welcome to Crystal Beauty Clear. We are happy to have you with us.`,
});

// Send welcome email
await sendNotificationEmail({
  to: user.email,
  firstName: user.firstName,
  title: "Welcome to Crystal Beauty Clear!",
  message: `Hi ${user.firstName}, welcome to Crystal Beauty Clear. Your account has been created successfully.`,
});

return res.status(201).json({
  message: "User created successfully",
});
  
  } catch (error) {
  console.error("Create User Error:", error);

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

// Create login notification
await Notification.create({
  userId: user._id,
  type: "LOGIN",
  title: "Welcome back!",
  message: `Hi ${user.firstName}, welcome back to Crystal Beauty Clear.`,
});

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
    // Send login notification email
await sendNotificationEmail({
  to: user.email,
  firstName: user.firstName,
  title: "Welcome back to Crystal Beauty Clear!",
  message: `Hi ${user.firstName}, you have successfully logged in to your Crystal Beauty Clear account.`,
});

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
// Prevent customers from changing protected account fields
delete updateData.role;
delete updateData.isBlock;
delete updateData.membershipCompletedCount;
delete updateData.isEmailVerified;
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
// --- RECORD COMPLETED MEMBERSHIP ACTIVITY ---
export const recordMembershipActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOneAndUpdate(
      { _id: id, role: "customer" },
      { $inc: { membershipCompletedCount: 1 } },
      { new: true, runValidators: true }
    ).select("-password -otp -otpExpiry");

    if (!user) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const count = user.membershipCompletedCount;

    let membershipTier = "Regular";

    if (count >= 10) {
      membershipTier = "VIP";
    } else if (count >= 5) {
      membershipTier = "Premium";
    }

    return res.status(200).json({
      message: "Membership activity recorded successfully",
      membershipCompletedCount: count,
      membershipTier,
      user,
    });

  } catch (error) {
    console.error("Membership Activity Error:", error);

    return res.status(500).json({
      message: "Failed to record membership activity",
    });
  }
};

// --- CUSTOMER: REQUEST MEMBERSHIP UPGRADE ---
export const requestMembershipUpgrade = async (req, res) => {
  try {
    const { requestedTier } = req.body;

    if (!["Premium", "VIP"].includes(requestedTier)) {
      return res.status(400).json({
        message: "Invalid membership tier requested",
      });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const customer = await User.findOne({
      _id: req.user.id,
      role: "customer",
    });

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const count = customer.membershipCompletedCount || 0;
const eligibleTier =
  count === 9 ? "VIP" : count === 4 ? "Premium" : null;
    if (eligibleTier !== requestedTier) {
      return res.status(400).json({
        message: "You are not yet eligible for this membership upgrade",
      });
    }

    const existingRequest = await MembershipRequest.findOne({
      customer: customer._id,
      status: "Pending",
    });

    if (existingRequest) {
      return res.status(409).json({
        message: "You already have a pending membership request",
      });
    }

    const membershipRequest = await MembershipRequest.create({
      customer: customer._id,
      requestedTier,
    });

    return res.status(201).json({
      message: "Membership upgrade request submitted successfully",
      request: membershipRequest,
    });

  } catch (error) {
    console.error("Membership Request Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "You already have a pending membership request",
      });
    }

    return res.status(500).json({
      message: "Failed to submit membership request",
    });
  }
};

 // --- ADMIN: GET ALL MEMBERSHIP REQUESTS ---
export const getMembershipRequests = async (req, res) => {
  try {
    const requests = await MembershipRequest.find()
      .populate(
        "customer",
        "firstName lastName email membershipCompletedCount"
      )
      .populate("reviewedBy", "firstName lastName email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Membership requests retrieved successfully",
      requests,
    });
  } catch (error) {
    console.error("Get Membership Requests Error:", error);

    return res.status(500).json({
      message: "Failed to retrieve membership requests",
    });
  }
};

 // --- ADMIN: APPROVE MEMBERSHIP REQUEST ---
export const approveMembershipRequest = async (req, res) => {
  let claimedRequest = null;

  try {
    const { id } = req.params;

    // Claim the pending request to prevent double approval
    claimedRequest = await MembershipRequest.findOneAndUpdate(
      { _id: id, status: "Pending" },
      {
        $set: {
          status: "Approved",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!claimedRequest) {
      return res.status(404).json({
        message: "Pending membership request not found",
      });
    }

    const expectedCount =
      claimedRequest.requestedTier === "Premium" ? 4 : 9;

    // Increase membership count only if the customer is eligible
    const customer = await User.findOneAndUpdate(
      {
        _id: claimedRequest.customer,
        role: "customer",
        membershipCompletedCount: expectedCount,
      },
      { $inc: { membershipCompletedCount: 1 } },
      { new: true, runValidators: true }
    ).select("-password -otp -otpExpiry");

    if (!customer) {
      // Restore request to Pending if customer is no longer eligible
      await MembershipRequest.updateOne(
        { _id: id, status: "Approved" },
        {
          $set: {
            status: "Pending",
            reviewedBy: null,
            reviewedAt: null,
          },
        }
      );

      claimedRequest = null;

      return res.status(409).json({
        message: "Customer is no longer eligible for this upgrade",
      });
    }

    return res.status(200).json({
      message: "Membership request approved successfully",
      membershipCompletedCount: customer.membershipCompletedCount,
      customer,
    });

  } catch (error) {
    console.error("Approve Membership Request Error:", error);

    if (claimedRequest) {
      await MembershipRequest.updateOne(
        { _id: claimedRequest._id, status: "Approved" },
        {
          $set: {
            status: "Pending",
            reviewedBy: null,
            reviewedAt: null,
          },
        }
      );
    }

    return res.status(500).json({
      message: "Failed to approve membership request",
    });
  }
};

// --- ADMIN: REJECT MEMBERSHIP REQUEST ---
export const rejectMembershipRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await MembershipRequest.findOneAndUpdate(
      { _id: id, status: "Pending" },
      {
        $set: {
          status: "Rejected",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({
        message: "Pending membership request not found",
      });
    }

    return res.status(200).json({
      message: "Membership request rejected successfully",
      request,
    });

  } catch (error) {
    console.error("Reject Membership Request Error:", error);

    return res.status(500).json({
      message: "Failed to reject membership request",
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