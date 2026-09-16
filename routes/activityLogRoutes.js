const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/rolemiddleware");

const {
  getActivityLogs,
} = require("../controllers/activityLogController");

// Get Activity Logs
// SuperAdmin → all logs
// TenantAdmin → own tenant logs
// User → own tenant logs
router.get(
  "/",
  authMiddleware,
  authorizeRoles(
    "SuperAdmin",
    "TenantAdmin",
    "User"
  ),
  getActivityLogs
);

module.exports = router;