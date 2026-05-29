// @ts-nocheck
import { Router } from "express";
import Stripe from "stripe";
import { requireAuth } from "../lib/auth";

const router = Router();
router.use(requireAuth);

// POST /api/checkout/stripe
router.post("/stripe", async (req, res) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { plan } = req.body || {};
    if (!plan) return res.status(400).send("Plan required");

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: plan.name,
              description: plan.description,
            },
            unit_amount: Math.round(parseFloat(String(plan.price).replace("$", "")) * 100) || 0,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/dashboard?status=success`,
      cancel_url: `${baseUrl}/pricing?status=cancelled`,
      metadata: {
        userId: req.session.user.id,
        planName: plan.name,
        credits: plan.credits.toString(),
      },
    });

    res.json({ url: checkoutSession.url });
  } catch (error) {
    req.log?.error({ err: error }, "[STRIPE_CHECKOUT_ERROR]");
    res.status(500).send("Internal Error");
  }
});

export default router;
