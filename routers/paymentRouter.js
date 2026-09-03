import express from "express";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const paymentRouter = express.Router();

paymentRouter.post("/create-intent", async (req, res) => {
  try {
    const { amount } = req.body; // Amount comes from the cart total

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe works in cents/cents-equivalent (LKR * 100)
      currency: "lkr",
      automatic_payment_methods: { enabled: true },
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

export default paymentRouter;