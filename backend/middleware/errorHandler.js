// middleware/errorHandler.js

/*
==================================
GLOBAL ERROR HANDLER
==================================
This middleware catches errors passed with next(err)
or thrown inside asyncHandler-wrapped controllers.
*/
const errorHandler = (err, req, res, next) => {
  console.error("ERROR:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    status: "error",
    message,
  });
};

module.exports = errorHandler;