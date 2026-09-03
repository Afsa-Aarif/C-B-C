import express from "express";
import Contact from "../models/contactModel.js";

const contactRouter = express.Router();

// 1. Submit Inquiry (Public)
contactRouter.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newMessage = new Contact({ name, email, message });
    await newMessage.save();

    res.status(201).json({ success: true, message: "Message sent successfully", data: newMessage });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
});

// 2. Fetch All Inquiries (Admin Only)
contactRouter.get("/", async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const messages = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 3. Save Admin Reply (Admin Only)
contactRouter.put("/reply/:id", async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const { reply } = req.body;
    if (!reply) {
      return res.status(400).json({ message: "Reply text cannot be empty" });
    }

    const updatedInquiry = await Contact.findByIdAndUpdate(
      req.params.id,
      { reply, status: "replied", repliedAt: new Date() },
      { new: true }
    );

    res.status(200).json({ success: true, message: "Reply saved", data: updatedInquiry });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 4. Fetch User's Own Inquiries (Logged-in Customer)
contactRouter.get("/my-messages", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const myMessages = await Contact.find({ email: req.user.email }).sort({ createdAt: -1 });
    res.status(200).json(myMessages);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

export default contactRouter;