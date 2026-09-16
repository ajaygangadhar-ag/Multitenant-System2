const express = require("express");

const router = express.Router();

const {
  createTenant,
  getAllTenants,
  getSingleTenant,
  updateTenant,
  deleteTenant,
  getMyTenant,
} = require("../controllers/tenantController");

const authMiddleware = require("../middleware/authMiddleware");

const authorizeRoles = require("../middleware/rolemiddleware");


// =====================================================
// CREATE TENANT
// ONLY SUPERADMIN
// =====================================================

router.post(
  "/",
  authMiddleware,
  authorizeRoles("SuperAdmin"),
  createTenant
);


// =====================================================
// GET CURRENT TENANT
// ONLY TENANT ADMIN
// =====================================================

router.get(
  "/my-tenant",
  authMiddleware,
  authorizeRoles("TenantAdmin", "User"),
  getMyTenant
);


// =====================================================
// GET ALL TENANTS
// ONLY SUPERADMIN
//
// This now returns:
// - organization details
// - total users
// - active users
// - inactive users
// =====================================================

router.get(
  "/",
  authMiddleware,
  authorizeRoles("SuperAdmin"),
  getAllTenants
);


// =====================================================
// GET SINGLE TENANT
// ONLY SUPERADMIN
// =====================================================

router.get(
  "/:id",
  authMiddleware,
  authorizeRoles("SuperAdmin"),
  getSingleTenant
);


// =====================================================
// UPDATE TENANT
// ONLY SUPERADMIN
// =====================================================

router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("SuperAdmin"),
  updateTenant
);


// =====================================================
// DELETE TENANT
// ONLY SUPERADMIN
// =====================================================

router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("SuperAdmin"),
  deleteTenant
);


module.exports = router;