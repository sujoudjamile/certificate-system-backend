/*
==================================
ASYNC HANDLER
==================================
This helper wraps async controller functions.

Why do we use it?
Because in Express, async errors are not always caught automatically.
This wrapper sends any error to the next middleware (errorHandler).
*/
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Export the function directly
module.exports = asyncHandler;