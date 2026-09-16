const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  getDashboardStats,
  getRecentActivities,
} = require("../controllers/dashboardController");


// =====================================================
// DASHBOARD STATISTICS
// =====================================================

router.get(
  "/",
  authMiddleware,
  getDashboardStats
);


// =====================================================
// DASHBOARD RECENT ACTIVITIES
// =====================================================

router.get(
  "/recent-activities",
  authMiddleware,
  getRecentActivities
);


module.exports = router;