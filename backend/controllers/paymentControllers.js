import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import Order from "../models/order.js";
import Stripe from "stripe";

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Create stripe checkout session   =>  /api/payment/checkout_session
export const stripeCheckoutSession = catchAsyncErrors(
  async (req, res, next) => {
    const body = req?.body;

    const line_items = body?.orderItems?.map((item) => {
      return {
        price_data: {
          currency: "aud",
          product_data: {
            name: item?.name,
            images: [item?.image],
            metadata: { productId: item?.product },
          },
          unit_amount: item?.price * 100,
        },
        tax_rates: ["taxkey"],
        quantity: item?.quantity,
      };
    });

    const shippingInfo = body?.shippingInfo;

    const shipping_rate =
      body?.itemsPrice >= 200
        ? "free_key"
        : "shipping_key";

    // Creating a stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      success_url: `${process.env.FRONTEND_URL}/me/orders?order_success=true`,
      cancel_url: `${process.env.FRONTEND_URL}`,
      customer_email: req?.user?.email,
      client_reference_id: req?.user?._id?.toString(),
      mode: "payment",
      metadata: { ...shippingInfo, itemsPrice: body?.itemsPrice },
      shipping_options: [
        {
          shipping_rate,
        },
      ],
      line_items,
    });

    //console.log(session);

    res.status(200).json({
      url: session.url,
    });
  }
);

// Create new order after payment   =>  /api/payment/webhook
export const stripeWebhook = catchAsyncErrors(async (req, res, next) => {
  try {
    const signature = req.headers["stripe-signature"];

    // event to get entire session data(from above stripeCheckoutSession())
    const event = stripe.webhooks.constructEvent(
      req.rawBody, // raw text body received from webhook
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // "checkout.session.completed" means payment received successfully, so we need to create order
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      //console.log("session ->:", session);

      const line_items = await stripe.checkout.sessions.listLineItems(
        session.id
      );

      const orderItems = await getOrderItems(line_items);

      /*
      console.log("=======================");
      console.log("OrderItems =>", orderItems);
      console.log("=======================");
      */

      const user = session.client_reference_id;

      // amount is in cents we r /100 to get in dollars
      const totalAmount = session.amount_total / 100;
      const taxAmount = session.total_details.amount_tax / 100;
      const shippingAmount = session.total_details.amount_shipping / 100;
      const itemsPrice = session.metadata.itemsPrice;

      const shippingInfo = {
        address: session.metadata.address,
        city: session.metadata.city,
        phoneNo: session.metadata.phoneNo,
        zipCode: session.metadata.zipCode,
        country: session.metadata.country,
      };

      const paymentInfo = {
        id: session.payment_intent,
        status: session.payment_status,
      };

      //  final OrderData that we want to insert into DB
      const orderData = {
        shippingInfo,
        orderItems,
        itemsPrice,
        taxAmount,
        shippingAmount,
        totalAmount,
        paymentInfo,
        paymentMethod: "Card",
        user,
      };

      // inserting orderData into DB
      await Order.create(orderData);

      res.status(200).json({ success: true });
    }
  } catch (error) {
    console.log("Error => ", error);
  }
});

// function for formatting the line_items into the format that we want
const getOrderItems = async (line_items) => {
  return new Promise((resolve, reject) => {
    let cartItems = [];

    line_items?.data?.forEach(async (item) => {
      // item.price.product -> is the stripe productId not the mongoose productId
      const product = await stripe.products.retrieve(item.price.product);

      // retrieving mongoose productId
      const productId = product.metadata.productId;

      /*
      console.log("=======================");
      console.log("item =>", item);
      console.log("=======================");
      console.log("product =>", product);
      console.log("=======================");
      */

      // formatting and pushing the item to cartItems array
      cartItems.push({
        product: productId,
        name: product.name,
        price: item.price.unit_amount_decimal / 100,
        quantity: item.quantity,
        image: product.images[0],
      });

      if (cartItems.length === line_items?.data?.length) {
        resolve(cartItems);
      }
    });
  });
};
