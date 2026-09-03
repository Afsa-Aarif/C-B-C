import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 } // Document auto-deletes after 10 mins (600s)
});

const OTP = mongoose.model("OTP", otpSchema);

export default OTP;