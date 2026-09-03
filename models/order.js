import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  email: { type: String, required: true }, 
  phone: { type: String, required: true }, 
  address: { type: String, required: true },
  items: [
    {
      productID: { type: mongoose.Schema.Types.ObjectId, ref: "products", required: true },
      quantity: { type: Number, required: true },
    }
  ],
  subtotal: { type: Number, required: true, default: 0 },
  discountAmount: { type: Number, default: 0 },
  couponCode: { type: String, default: null },
  total: { type: Number, required: true }, 
  paymentMethod: { type: String, required: true },
  paymentStatus: { type: String, required: true, default: "Pending" }, 
  transactionId: { type: String, required: true, default: "N/A" }, 
  status: { type: String, default: "pending" },
  date: { type: Date, default: Date.now }
});

const Order = mongoose.model("orders", orderSchema);
export default Order;