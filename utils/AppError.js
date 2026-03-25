// utils/AppError.js

/*
==================================
CUSTOM APP ERROR
==================================
This class lets us throw custom errors
with a message and HTTP status code.
*/
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;

    // Keep correct error name
    this.name = "AppError";

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;