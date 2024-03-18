import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import Product from "../models/product.js";
import Order from "../models/order.js";
import ErrorHandler from "../utils/errorHandler.js";

// Create new order -> /api/orders/new
// this route is only for cash on delivery case
export const newOrder = catchAsyncErrors(async (req, res, next) => {
  const {
    orderItems,
    shippingInfo,
    itemsPrice,
    taxAmount,
    shippingAmount,
    totalAmount,
    paymentMethod,
    paymentInfo,
  } = req.body;

  //console.log(req.body);

  const order = await Order.create({
    orderItems,
    shippingInfo,
    itemsPrice,
    taxAmount,
    shippingAmount,
    totalAmount,
    paymentMethod,
    paymentInfo,
    user: req.user._id,
  });

  res.status(200).json({ order });
});

// Get order details -> /api/orders/:id
export const getOrderDetails = catchAsyncErrors(async (req, res, next) => {
  // populate('field name in model') -> this method will place the document of other collection that we r referencing (here it is user doc)
  //const order = await Order.findById(req.params.id).populate("user"); // will populate complete user doc with specified ID

  // this will populate doc with {_id: '', name: '', email: ''}
  const order = await Order.findById(req.params.id).populate(
    "user",
    "name email"
  );

  if (!order) {
    return next(
      new ErrorHandler(`Not order found with this ${req.params.id}`, 404)
    );
  }

  res.status(200).json({ order });
});

// Get current user orders  =>  /api/me/orders
export const myOrders = catchAsyncErrors(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id });

  res.status(200).json({
    orders,
  });
});

// Get all orders - ADMIN  =>  /api/admin/orders
export const allOrders = catchAsyncErrors(async (req, res, next) => {
  const orders = await Order.find();

  res.status(200).json({
    orders,
  });
});

// Update Order - ADMIN  =>  /api/admin/orders/:id
export const updateOrder = catchAsyncErrors(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(
      new ErrorHandler(`No Order found with this ${req.params.id}`, 404)
    );
  }

  if (order?.orderStatus === "Delivered") {
    return next(new ErrorHandler("You have already delivered this order", 400));
  }

  let productNotFound = false;

  // Update products stock
  /*
  order?.orderItems?.forEach(async (item) => {
    const product = await Product.findById(item?.product?.toString());
    if (!product) {
      return next(new ErrorHandler("No Product found with this ID", 404));
    }
    product.stock = product.stock - item.quantity;
    await product.save({ validateBeforeSave: false });
  });
  */

  for (const item of order.orderItems) {
    const product = await Product.findById(item?.product?.toString());
    if (!product) {
      productNotFound = true;
      break;
    }
    product.stock = product.stock - item.quantity;
    await product.save({ validateBeforeSave: false });
  }

  if (productNotFound) {
    return next(
      new ErrorHandler("No Product found with one or more IDs.", 404)
    );
  }

  order.orderStatus = req.body.status;
  order.deliveredAt = Date.now();

  if (req.body.status === "Delivered") {
    order.paymentInfo.status = "paid";
  }

  await order.save();

  res.status(200).json({
    success: true,
  });
});

// Delete order  =>  /api/admin/orders/:id
export const deleteOrder = catchAsyncErrors(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(
      new ErrorHandler(`No Order found with this ${req.params.id}`, 404)
    );
  }

  await order.deleteOne();

  res.status(200).json({
    success: true,
  });
});

// Get Sales Data  =>  /api/admin/get_sales
export const getSales = catchAsyncErrors(async (req, res, next) => {
  const startDate = new Date(req.query.startDate);
  const endDate = new Date(req.query.endDate);

  // selecting sales from startDate(12AM) to endDate(23PM) -> considering 24hrs(1 day)
  startDate.setUTCHours(0, 0, 0, 0); // 12AM
  endDate.setUTCHours(23, 59, 59, 999); // 23PM (before 24)

  // calling getSalesData() to get salesData
  const { salesData, totalSales, totalNumOrders } = await getSalesData(
    startDate,
    endDate
  );

  res.status(200).json({
    totalSales,
    totalNumOrders,
    sales: salesData,
  });
});

async function getSalesData(startDate, endDate) {
  // Aggregation operation process multiple documents and retun computed results
  // 1. means we can group values from multiple documents together
  // 2. perform operations on the grouped data to retun a single result

  /* Explanation for below two stages
  Stage 1 -> first we will get all the orders placed between two dates
  Stage 2 -> we will group all the orders into one entity({} -> object) based on 'createdAt' field
          -> means if createdAt is '2024-03-06' then it will group all the orders placed on that date into one entity
          -> that entity has {_id:{ date: 'createdAt'}, totalSales: 'which is totalAmount of all orders on that date', numOfOrders: "total orders on that date"}   
  */
  const salesData = await Order.aggregate([
    {
      // Stage 1 - Filter results
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      },
    },
    {
      // Stage 2 - Group Data
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, // $dateToString -> converts a date object to a string according to user-specified format
        },
        totalSales: { $sum: "$totalAmount" }, // here $totalAmount is the field name of Order model
        numOrders: { $sum: 1 }, // count the number of orders
      },
    },
  ]);

  /*
  console.log("==============");
  console.log(salesData);
  console.log("==============");
  */

  // Create a Map to store sales data and num of order by data
  const salesMap = new Map();
  let totalSales = 0;
  let totalNumOrders = 0;

  salesData.forEach((entry) => {
    const date = entry?._id.date;
    const sales = entry?.totalSales;
    const numOrders = entry?.numOrders;

    salesMap.set(date, { sales, numOrders });
    totalSales += sales;
    totalNumOrders += numOrders;
  });

  // Generate an array of dates between start & end Date
  const datesBetween = getDatesBetween(startDate, endDate);

  // console.log(datesBetween);

  // Create final sales data array with 0 for dates without sales
  const finalSalesData = datesBetween.map((date) => ({
    date,
    sales: (salesMap.get(date) || { sales: 0 }).sales,
    numOrders: (salesMap.get(date) || { numOrders: 0 }).numOrders,
  }));

  // console.log(finalSalesData);

  return { salesData: finalSalesData, totalSales, totalNumOrders };
}

function getDatesBetween(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);

  while (currentDate <= new Date(endDate)) {
    const formattedDate = currentDate.toISOString().split("T")[0]; //2024-03-06T10:03:26.000Z -> splits at 'T' and get first part which is '2024-03-06'
    dates.push(formattedDate);
    currentDate.setDate(currentDate.getDate() + 1); // incremeting the dates until endDate
  }

  return dates;
}
