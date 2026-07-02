/* 404 handler */
function notFound(req, res, _next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/* Central error handler */
function errorHandler(err, _req, res, _next) {
  // Sequelize validation / unique errors
  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ message: "That record already exists.", fields: err.fields });
  }
  if (err.name === "SequelizeValidationError") {
    return res.status(422).json({ message: "Validation failed.", errors: err.errors.map((e) => e.message) });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File too large." });
  }
  const status = err.status || 500;
  if (status >= 500) console.error("\x1b[31m[error]\x1b[0m", err);
  res.status(status).json({ message: err.message || "Something went wrong." });
}

module.exports = { notFound, errorHandler };
