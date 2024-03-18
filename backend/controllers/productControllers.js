import Product from "../models/product.js";
import Order from "../models/order.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import APIFilters from "../utils/APIFilters.js";
import { delete_file, upload_file } from "../utils/cloudinary.js";

// Get All products => /api/products
export const getProducts = catchAsyncErrors(async (req, res) => {
  // const products = await Product.find({});
  // const products = await Product.find({ category: 'Electronics'});

  // console.log("req?.user:", req?.user);

  // varaible for noOfrequests per page
  const resPerPage = 4;

  // req.query => comes from the url after '?' eg: /api/products?keyword=Apple
  const apiFilters = new APIFilters(Product, req.query).search().filters();

  // executing the query
  let products = await apiFilters.query;
  let filteredProductsCount = products.length;

  // calling pagination method to limit products display based on applied filters(above)
  apiFilters.pagination(resPerPage);
  products = await apiFilters.query.clone();

  res.status(200).json({ resPerPage, filteredProductsCount, products });
});

// Create a new Product => /api/admin/products
export const newProduct = catchAsyncErrors(async (req, res) => {
  req.body.user = req.user._id;

  const product = await Product.create(req.body);
  res.status(200).json({ product });
});

// Get a Single Product Details => /api/products/:id
export const getProductDetails = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const product = await Product.findById(id).populate("reviews.user");

  if (!product) {
    //return res.status(404).json({ error: "Product not found" });
    // throwing custom error using ErrorHandler class
    return next(new ErrorHandler("Product not found", 404));
  }
  res.status(200).json({ product });
});

// Get products - ADMIN   =>  /api/admin/products
export const getAdminProducts = catchAsyncErrors(async (req, res, next) => {
  const products = await Product.find();

  res.status(200).json({
    products,
  });
});

// Update Product Details => /api/products/:id
export const updateProduct = catchAsyncErrors(async (req, res, next) => {
  let product = await Product.findById(req?.params?.id);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  product = await Product.findByIdAndUpdate(req?.params?.id, req.body, {
    new: true,
  });

  res.status(200).json({ product });
});

// Upload product images   =>  /api/admin/products/:id/upload_images
export const uploadProductImages = catchAsyncErrors(async (req, res) => {
  let product = await Product.findById(req?.params?.id);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  const uploader = async (image) => upload_file(image, "GloboMart/products");

  // grabs all images from frontend and upload them to 'GloboMart/products' in cloudinary and in return we will get all urls of the images uploaded
  const urls = await Promise.all((req?.body?.images).map(uploader));

  product?.images?.push(...urls);
  await product?.save();

  res.status(200).json({
    product,
  });
});

// Delete product image   =>  /api/admin/products/:id/delete_image
export const deleteProductImage = catchAsyncErrors(async (req, res) => {
  let product = await Product.findById(req?.params?.id);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  // this will delete image in cloudinary
  const isDeleted = await delete_file(req.body.imgId);

  // this will delete image in DB
  if (isDeleted) {
    product.images = product?.images?.filter(
      (img) => img.public_id !== req.body.imgId
    );

    await product?.save();
  }

  res.status(200).json({
    product,
  });
});

// Delete a product => /api/products/:id
export const deleteProduct = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req?.params?.id);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  // Deleting images associated with product in cloudinary
  for (let i = 0; i < product?.images?.length; i++) {
    await delete_file(product?.images[i].public_id);
  }

  await product.deleteOne();

  res.status(200).json({
    message: "Product Deleted Successfully",
  });
});

/* --------- Get, Create, Update, Delete a Review Controllers ------- */

// Create/Update product review   =>  /api/reviews
export const createProductReview = catchAsyncErrors(async (req, res, next) => {
  const { rating, comment, productId } = req.body;

  // Creating a review Object
  const review = {
    user: req?.user?._id,
    rating: Number(rating),
    comment,
  };

  const product = await Product.findById(productId);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  // checking whether the user is given review or not
  const isReviewed = product?.reviews?.find(
    (r) => r.user.toString() === req?.user?._id.toString()
  );

  // if user was given review we will update it or else we will create a new review
  if (isReviewed) {
    product.reviews.forEach((review) => {
      if (review?.user?.toString() === req?.user?._id.toString()) {
        review.comment = comment;
        review.rating = rating;
      }
    });
  } else {
    product.reviews.push(review);
    product.numOfReviews = product.reviews.length;
  }

  // calculating total product rating
  product.ratings =
    product.reviews.reduce((acc, item) => item.rating + acc, 0) /
    product.reviews.length;

  await product.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
  });
});

// Get product reviews   =>  /api/reviews
// will pass id as query string
export const getProductReviews = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req.query.id).populate("reviews.user");

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  res.status(200).json({
    reviews: product.reviews,
  });
});

// Delete product review   =>  /api/admin/reviews
// will pass productId & review._id as query string
export const deleteReview = catchAsyncErrors(async (req, res, next) => {
  let product = await Product.findById(req.query.productId);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  const reviews = product?.reviews?.filter(
    (review) => review._id.toString() !== req?.query?.id.toString()
  );

  const numOfReviews = reviews.length;

  const ratings =
    numOfReviews === 0
      ? 0
      : product.reviews.reduce((acc, item) => item.rating + acc, 0) /
        numOfReviews;

  product = await Product.findByIdAndUpdate(
    req.query.productId,
    { reviews, numOfReviews, ratings },
    { new: true }
  );

  res.status(200).json({
    success: true,
    product,
  });
});

// Can user review   =>  /api/can_review
export const canUserReview = catchAsyncErrors(async (req, res) => {
  const orders = await Order.find({
    user: req.user._id,
    "orderItems.product": req.query.productId, //"orderItems.product" is the syntax to find an object property(here product) in an array(orderItems here)
  });

  if (orders.length === 0) {
    return res.status(200).json({ canReview: false });
  }

  res.status(200).json({
    canReview: true,
  });
});
