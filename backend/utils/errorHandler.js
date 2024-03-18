// custom error Handler class

class ErrorHandler extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;

    // Create stack property => useful in getting complete error stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ErrorHandler;
