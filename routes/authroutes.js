const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

console.log("✅ authRoutes.js Loaded");

const {
  registerUser,
  registerSuperAdmin,
  registerOrganization,
  loginUser,
  forgotPassword,
  resetPassword,
  changePassword,
  getSettings,
  updateSettings,
} = require("../controllers/authcontroller");

const {
  registerValidation,
  loginValidation,
  validate,
} = require("../validations/authValidation");


// =====================================================
// REGISTER
// =====================================================

router.post(
  "/register",
  registerValidation,
  validate,
  registerUser
);

// =====================================================
// SUPERADMIN REGISTRATION
// =====================================================

router.post(
  "/superadmin-register",
  registerSuperAdmin
);

// =====================================================
// ORGANIZATION REGISTRATION
// =====================================================

router.post(
  "/register-organization",
  registerOrganization
);

// =====================================================
// LOGIN
// =====================================================

router.post(
  "/login",
  loginValidation,
  validate,
  loginUser
);


// =====================================================
// FORGOT PASSWORD
// =====================================================

router.post(
  "/forgot-password",
  forgotPassword
);


// =====================================================
// RESET PASSWORD
// =====================================================

router.post(
  "/reset-password",
  resetPassword
);


// =====================================================
// CHANGE PASSWORD
// =====================================================

router.put(
  "/change-password",
  authMiddleware,
  changePassword
);


// =====================================================
// SETTINGS
// =====================================================

// Get notification settings
router.get(
  "/settings",
  authMiddleware,
  getSettings
);

// Update notification settings
router.put(
  "/settings",
  authMiddleware,
  updateSettings
);


// =====================================================
// PROFILE
// =====================================================

router.get(
  "/profile",
  authMiddleware,
  (req, res) => {
    res.json({
      message: "Welcome to your profile",
    });
  }
);


// =====================================================
// SUPERADMIN
// =====================================================

router.get(
  "/admin",
  authMiddleware,
  authorizeRoles("SuperAdmin"),
  (req, res) => {
    res.json({
      message: "Welcome SuperAdmin!",
      user: req.user,
    });
  }
);


module.exports = router;