import express from "express";
import dotenv from "dotenv";
import { connectDatabase } from "./config/dbConnect.js";
import cookieParser from "cookie-parser";

// Importing all routes
import productRoutes from "./routes/products.js";
import authRoutes from "./routes/auth.js";
import orderRoutes from "./routes/order.js";
import paymentRoutes from "./routes/payment.js";

// Importing custom errorMiddleware function
import errorMiddleWare from "./middlewares/errors.js";

// Handle uncaught Exceptions
process.on("uncaughtException", (err) => {
  console.log(`ERROR: ${err}`);
  console.log("Shutting down due to uncaught exception");
  process.exit(1);
});

// dotenv.config({ path: "backend/config/config.env" }); // if we have .env file in separate config folder inside backend folder
dotenv.config();

// Connecting to database
connectDatabase();

const app = express();

// middleware function which parses the incoming request with JSON payloads
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(cookieParser());

// using routes
app.use("/api", productRoutes);
app.use("/api", authRoutes);
app.use("/api", orderRoutes);
app.use("/api", paymentRoutes);

// using error middleware (this should be written after the accessing the routes statement)
app.use(errorMiddleWare);

const server = app.listen(process.env.PORT, () => {
  console.log(`Server started on PORT: ${process.env.PORT}`);
});

// handle Unhandled Promise rejections (errors in mongoDB connection like that)
process.on("unhandledRejection", (err) => {
  console.log(`ERROR: ${err}`);
  console.log("Shutting down the server due to Unhandles Promise Rejection");
  server.close(() => {
    process.exit(1);
  });
});
