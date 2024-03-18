import crypto from "crypto";
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";
import User from "../models/user.js";
import sendToken from "../utils/sendToken.js";
import { getResetPasswordTemplate } from "../utils/emailTemplates.js";
import sendEmail from "../utils/sendEmail.js";
import { delete_file, upload_file } from "../utils/cloudinary.js";

// Register user -> /api/register
export const registerUser = catchAsyncErrors(async (req, res, next) => {
  const { name, email, password } = req.body;

  const user = await User.create({ name, email, password });

  // generating the token
  // const token = user.getJwtToken();

  // this function will generate token and save it in the cookie
  sendToken(user, 201, res);
});

// Login user -> /api/login
export const loginUser = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorHandler("Please Enter email & password", 400));
  }

  // Finding user in the database
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  // checking if password is correct or not
  const isPswdMatched = await user.comparePassword(password);

  if (!isPswdMatched) {
    return next(new ErrorHandler("Invalid Password", 401));
  }

  //const token = user.getJwtToken();

  sendToken(user, 200, res);
});

// Logout user -> /api/logout
export const logout = catchAsyncErrors((req, res, next) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });

  res.status(200).json({ message: "Logged Out Successfully.." });
});

// Upload user avatar   =>  /api/me/upload_avatar
export const uploadAvatar = catchAsyncErrors(async (req, res, next) => {
  const avatarResponse = await upload_file(
    req.body.avatar,
    "GloboMart/avatars"
  );

  // Remove previous avatar in cloudinary
  if (req?.user?.avatar?.url) {
    await delete_file(req?.user?.avatar?.public_id);
  }

  const user = await User.findByIdAndUpdate(req?.user?._id, {
    avatar: avatarResponse,
  });

  res.status(200).json({
    user,
  });
});

// Forgot Password -> /api/password/forgot
export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
  // Finding user in the database
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorHandler("User not found with this email", 404));
  }

  // Get reset password token
  const resetToken = user.getResetPasswordToken();

  // in getResetPasswordToken() method we r storing the hased token in resetPasswordToken field in order to save that token in the field we r using save()
  await user.save();

  // Create reset password URL
  const resetUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;

  // message to send in email (which is html template coming from getResetPasswordTemplate() method)
  const message = getResetPasswordTemplate(user?.name, resetUrl);

  // this try catch block will handle email sending or errors in email sending
  try {
    await sendEmail({
      email: user.email,
      subject: "GloboMart Password Recovery",
      message,
    });

    res.status(200).json({ message: `Email sent to: ${user.email}` });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    return next(new ErrorHandler(error?.message, 500));
  }

  // const token = user.getJwtToken();
  // sendToken(user, 200, res);
});

// Reset Password -> /api/password/reset/:token
export const resetPassword = catchAsyncErrors(async (req, res, next) => {
  // Hash the URL Token
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  // Searching for user based on resetPasswordToken & resetPasswordExpire
  // making sure that hashed token in User model is not expired so that we can reset password with the available token
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      new ErrorHandler(
        "Password reset token is invalid or has been expired",
        400
      )
    );
  }

  // both password(new) & confirm password will come from frontend
  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHandler("Passwords does not match", 400));
  }

  // Setting the new password
  user.password = req.body.password;

  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  sendToken(user, 200, res);
});

// Get current user profile -> /api/me
export const getUserProfile = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req?.user?._id);

  res.status(200).json({
    user,
  });
});

// Update Password  =>  /api/password/update
export const updatePassword = catchAsyncErrors(async (req, res, next) => {
  // .select("+password") will include the the password field while returning the user
  // in User Schema we assigned a property called (select) to false by default that's why
  const user = await User.findById(req?.user?._id).select("+password");

  // Check the previous user password
  const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Old Password is incorrect", 400));
  }

  user.password = req.body.password;
  user.save();

  res.status(200).json({
    success: true,
  });
});

// Update User Profile  =>  /api/me/update
export const updateProfile = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
  };

  const user = await User.findByIdAndUpdate(req.user._id, newUserData, {
    new: true,
  });

  // another way to update without creating newUserData object
  // const user = await User.findByIdAndUpdate(
  //   req.user._id,
  //   { ...req.body },
  //   {
  //     new: true,
  //   }
  // );

  res.status(200).json({
    user,
  });
});

// Get all Users - ADMIN  =>  /api/admin/users
export const allUsers = catchAsyncErrors(async (req, res, next) => {
  const users = await User.find();

  res.status(200).json({
    users,
  });
});

// Get User Details - ADMIN  =>  /api/admin/users/:id
export const getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHandler(`User not found with id: ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    user,
  });
});

// Update User Details - ADMIN  =>  /api/admin/users/:id
export const updateUser = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
  };

  const user = await User.findByIdAndUpdate(req.params.id, newUserData, {
    new: true,
  });

  res.status(200).json({
    user,
  });
});

// Delete User - ADMIN  =>  /api/admin/users/:id
export const deleteUser = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHandler(`User not found with id: ${req.params.id}`, 404)
    );
  }

  // Remove user avatar from cloudinary
  if (user?.avatar?.public_id) {
    await delete_file(user?.avatar?.public_id);
  }

  await user.deleteOne();

  res.status(200).json({
    success: true,
  });
});
