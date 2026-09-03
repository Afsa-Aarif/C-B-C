import mongoose from "mongoose";

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  reply: { type: String, default: "" },
  status: { type: String, enum: ["pending", "replied"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
  repliedAt: { type: Date }
});

const Contact = mongoose.model("Contact", contactSchema);
export default Contact;