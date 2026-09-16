const express = require("express");
const router = express.Router();

const {
  createUser,
  getAllUsers,
  getSingleUser,
  updateUser,
  deleteUser,
  uploadProfileImage,
  getMyProfile,
  updateMyProfile,
} = require("../controllers/userController");

const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const upload = require("../middleware/uploadMiddleware");
// Create User
router.post(
  "/",
  authMiddleware,
  authorizeRoles("SuperAdmin", "TenantAdmin"),
  createUser
);

// Get My Profile
router.get(
  "/me",
  authMiddleware,
  getMyProfile
);

// Update My Profile
router.put(
  "/me",
  authMiddleware,
  updateMyProfile
);

// Get All Users
router.get(
  "/",
  authMiddleware,
  authorizeRoles("SuperAdmin", "TenantAdmin"),
  getAllUsers
);
// Get Single Users
router.get(
  "/:id",
  authMiddleware,
  authorizeRoles("SuperAdmin", "TenantAdmin"),
  getSingleUser
);
// Get update users
router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("SuperAdmin", "TenantAdmin"),
  updateUser
);
// Get delete users
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("SuperAdmin", "TenantAdmin"),
  deleteUser
);
// Get Upload Users
router.post(
  "/upload/:id",
  authMiddleware,
  upload.single("profileImage"),
  uploadProfileImage
);
module.exports = router;