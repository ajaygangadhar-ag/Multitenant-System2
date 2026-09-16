const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Tenant = require("../models/tenant");
const Organization = require("../models/organization");

const {
  createActivityLog,
} = require("../controllers/activityLogController");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message:
          "No token provided",
      });
    }

    const token =
      authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message:
          "Invalid authorization token",
      });
    }

    // =================================================
    // VERIFY JWT
    // =================================================

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    // =================================================
    // FIRST: SEARCH NEW EMBEDDED USER
    // organizations.users[]
    // =================================================

    const organization =
      await Organization.findOne({
        "users._id":
          decoded.userId,
      });

    if (organization) {
      const user =
        organization.users.id(
          decoded.userId
        );

      if (!user) {
        return res.status(401).json({
          message:
            "User not found",
        });
      }

      // ===============================================
      // USER STATUS
      // ===============================================

      if (
        user.status ===
        "Inactive"
      ) {
        try {
          await createActivityLog({
            userId:
              user._id,

            tenantId:
              organization._id,

            action:
              "ACCESS_DENIED",

            description:
              "Access denied because user account is inactive",

            category:
              "Security",

            ipAddress:
              req.ip,

            status:
              "Failed",
          });
        } catch (logError) {
          console.error(
            "Activity log error:",
            logError.message
          );
        }

        return res.status(403).json({
          message:
            "Your account is inactive. Please contact your administrator.",
        });
      }

      // ===============================================
      // SUPERADMIN
      // ===============================================

      if (
        user.role ===
        "SuperAdmin"
      ) {
        req.user = {
          userId:
            user._id,

          role:
            user.role,

          tenantId:
            null,
        };

        return next();
      }

      // ===============================================
      // ORGANIZATION STATUS
      // ===============================================

      if (
        organization.status ===
        "Inactive"
      ) {
        try {
          await createActivityLog({
            userId:
              user._id,

            tenantId:
              organization._id,

            action:
              "ACCESS_DENIED",

            description:
              "Access denied because organization is inactive",

            category:
              "Security",

            ipAddress:
              req.ip,

            status:
              "Failed",
          });
        } catch (logError) {
          console.error(
            "Activity log error:",
            logError.message
          );
        }

        return res.status(403).json({
          message:
            "Your organization is inactive. Please contact your administrator.",
        });
      }

      // ===============================================
      // EMBEDDED USER AUTHENTICATION SUCCESS
      // ===============================================

      req.user = {
        userId:
          user._id,

        role:
          user.role,

        tenantId:
          organization._id,
      };

      return next();
    }

    // =================================================
    // SECOND: OLD USER COLLECTION
    // Keeps existing SuperAdmin working
    // =================================================

    const oldUser =
      await User.findById(
        decoded.userId
      );

    if (!oldUser) {
      return res.status(401).json({
        message:
          "User not found",
      });
    }

    // =================================================
    // OLD USER STATUS
    // =================================================

    if (
      oldUser.status ===
      "Inactive"
    ) {
      try {
        await createActivityLog({
          userId:
            oldUser._id,

          tenantId:
            oldUser.tenantId,

          action:
            "ACCESS_DENIED",

          description:
            "Access denied because user account is inactive",

          category:
            "Security",

          ipAddress:
            req.ip,

          status:
            "Failed",
        });
      } catch (logError) {
        console.error(
          "Activity log error:",
          logError.message
        );
      }

      return res.status(403).json({
        message:
          "Your account is inactive. Please contact your administrator.",
      });
    }

    // =================================================
    // OLD SUPERADMIN
    // =================================================

    if (
      oldUser.role ===
      "SuperAdmin"
    ) {
      req.user = {
        userId:
          oldUser._id,

        role:
          oldUser.role,

        tenantId:
          null,
      };

      return next();
    }

    // =================================================
    // OLD USER TENANT VALIDATION
    // =================================================

    if (!oldUser.tenantId) {
      return res.status(403).json({
        message:
          "Your account is not assigned to an organization.",
      });
    }

    // =================================================
    // OLD TENANT
    // =================================================

    const tenant =
      await Tenant.findById(
        oldUser.tenantId
      );

    if (!tenant) {
      return res.status(403).json({
        message:
          "Your organization could not be found.",
      });
    }

    // =================================================
    // OLD TENANT STATUS
    // =================================================

    if (
      tenant.status ===
      "Inactive"
    ) {
      return res.status(403).json({
        message:
          "Your organization is inactive. Please contact your administrator.",
      });
    }

    // =================================================
    // OLD USER AUTHENTICATION SUCCESS
    // =================================================

    req.user = {
      userId:
        oldUser._id,

      role:
        oldUser.role,

      tenantId:
        oldUser.tenantId,
    };

    return next();

  } catch (error) {
    console.error(
      "Authentication middleware error:",
      error.message
    );

    return res.status(401).json({
      message:
        error.message,
    });
  }
};

module.exports =
  authMiddleware;