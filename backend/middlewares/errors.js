import ErrorHandler from "../utils/errorHandler.js";

// this function is a middleware to handle global errors in the backend
export default (err, req, res, next) => {
  let error = {
    statusCode: err?.statusCode || 500,
    message: err?.message || "Internal Server Error",
  };

  // Handle Invalid Mongoose ID Error
  if (err.name === "CastError") {
    const message = `Resource not found. Invalid: ${err?.path}`;
    error = new ErrorHandler(message, 404);
  }

  // Handle Validation Errors
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors).map((value) => value.message);
    error = new ErrorHandler(message, 400);
  }

  // Handle Mongoose Duplicate Key Error (if user tries to register with email that already exists in DB)
  // code = 11000 is duplicate key error code
  if (err.code === 11000) {
    const message = `Duplicate ${Object.keys(err.keyValue)} entered..`;
    error = new ErrorHandler(message, 404);
  }

  // Handle wrong JWT Error
  if (err.name === "JsonWebTokenError") {
    const message = `JSON Web Token is invalid. Try Again!!!`;
    error = new ErrorHandler(message, 400);
  }

  // Handle expired JWT Error
  if (err.name === "TokenExpiredError") {
    const message = `JSON Web Token is expired. Try Again!!!`;
    error = new ErrorHandler(message, 400);
  }

  if (process.env.NODE_ENV === "DEVELOPMENT") {
    res
      .status(error.statusCode)
      .json({ message: error.message, error: err, stack: err?.stack });
  }

  //   if (process.env.NODE_ENV === "PRODUCTION") {
  //     res.status(error.statusCode).json({ message: error.message });
  //   }

  // res.status(error.statusCode).json({ message: error.message });
};
