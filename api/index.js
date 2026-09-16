const app = require("../server");
const connectDB = require("../config/db");

let isConnected = false;

module.exports = async (req, res) => {
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
    } catch (err) {
      console.error("Vercel Database Connection Error:", err.message);
    }
  }

  return app(req, res);
};