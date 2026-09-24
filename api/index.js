const app = require("../server");
const connectDB = require("../config/db");

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error("Vercel Database Connection Error:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Database connection failed. Please ensure MongoDB Atlas IP Whitelist (0.0.0.0/0) is configured.",
      error: err.message,
    });
  }

  return app(req, res);
};