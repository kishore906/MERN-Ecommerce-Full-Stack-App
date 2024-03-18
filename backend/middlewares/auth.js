import jwt from "jsonwebtoken";
import catchAsyncErrors from "./catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";
import User from "../models/user.js";

// Checks if user is authenticated or not
export const isAuthenticatedUser = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return next(new ErrorHandler("Login first to access this resource", 401));
  }

  // jwt.verify gives us the payload info nothing but {id: '', iat: somenum, exp: timeinseconds} here
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  // console.log(decoded); // { id: '65e2876fa75cbc07c439898b', iat: 1709348932, exp: 1709953732 }

  // including the user details(here decoded value) in the request, so that we can use user info in the controller functions
  req.user = await User.findById(decoded.id);

  next();
});

// Authorize user roles
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(
          `Role (${req.user.role}) is not allowed to access this resource`,
          403
        )
      );
    }

    next();
  };
};
