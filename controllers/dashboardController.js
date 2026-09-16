const Organization = require("../models/organization");

// =====================================================
// GET DASHBOARD STATISTICS
// =====================================================

const getDashboardStats = async (req, res) => {
  try {
    let totalUsers = 0;
    let activeUsers = 0;
    let inactiveUsers = 0;
    let totalTenants = 0;

    // =================================================
    // SUPERADMIN
    // =================================================

    if (req.user.role === "SuperAdmin") {
      const organizations = await Organization.find({
        companyName: {
          $ne: "System Organization",
        },
      }).lean();

      totalTenants = organizations.length;

      organizations.forEach((organization) => {
        const users = organization.users || [];

        users.forEach((user) => {
          if (
            ["User", "TenantAdmin"].includes(
              user.role
            )
          ) {
            totalUsers++;

            if (user.status === "Active") {
              activeUsers++;
            }

            if (user.status === "Inactive") {
              inactiveUsers++;
            }
          }
        });
      });
    }

    // =================================================
    // TENANT ADMIN / NORMAL USER
    // =================================================

    else {
      let organization = null;

      // =================================================
      // FIRST: FIND ORGANIZATION USING EMBEDDED USER ID
      // =================================================

      if (req.user.userId) {
        organization =
          await Organization.findOne({
            "users._id": req.user.userId,
          }).lean();
      }

      // =================================================
      // FALLBACK: USE TENANT ID FROM TOKEN
      // =================================================

      if (!organization && req.user.tenantId) {
        organization =
          await Organization.findById(
            req.user.tenantId
          ).lean();
      }

      if (!organization) {
        return res.status(404).json({
          message:
            "Organization not found.",
        });
      }

      const users =
        organization.users || [];

      users.forEach((user) => {
        if (
          ["User", "TenantAdmin"].includes(
            user.role
          )
        ) {
          totalUsers++;

          if (user.status === "Active") {
            activeUsers++;
          }

          if (user.status === "Inactive") {
            inactiveUsers++;
          }
        }
      });
    }

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      totalTenants,
      totalUsers,
      activeUsers,
      inactiveUsers,
    });
  } catch (error) {
    console.error(
      "Dashboard statistics error:",
      error.message
    );

    return res.status(500).json({
      message:
        "Unable to load dashboard statistics.",
    });
  }
};

// =====================================================
// GET RECENT ACTIVITIES FOR DASHBOARD
// =====================================================

const getRecentActivities = async (req, res) => {
  try {
    let organizations = [];

    // =================================================
    // SUPERADMIN
    // ALL ORGANIZATIONS
    // =================================================

    if (req.user.role === "SuperAdmin") {
      organizations =
        await Organization.find({})
          .select(
            "companyName users activityLogs"
          )
          .lean();
    }

    // =================================================
    // TENANT ADMIN / USER
    // FIND ORGANIZATION BY EMBEDDED USER ID FIRST
    // =================================================

    else {
      let organization = null;

      // =================================================
      // PRIMARY LOOKUP
      // =================================================

      if (req.user.userId) {
        organization =
          await Organization.findOne({
            "users._id": req.user.userId,
          })
            .select(
              "companyName users activityLogs"
            )
            .lean();
      }

      // =================================================
      // FALLBACK LOOKUP
      // =================================================

      if (!organization && req.user.tenantId) {
        organization =
          await Organization.findById(
            req.user.tenantId
          )
            .select(
              "companyName users activityLogs"
            )
            .lean();
      }

      if (organization) {
        organizations = [organization];
      }
    }

    // =================================================
    // NO ORGANIZATION
    // =================================================

    if (organizations.length === 0) {
      console.log(
        "❌ DASHBOARD ACTIVITY: No organization found"
      );

      return res.status(200).json([]);
    }

    // =================================================
    // COLLECT ACTIVITIES
    // =================================================

    const activities = [];

    const activityIds = new Set();

    organizations.forEach((organization) => {
      const users = organization.users || [];

      // =================================================
      // NEW ARCHITECTURE
      // users[].activityLogs[]
      // =================================================

      users.forEach((user) => {
        // Normal User sees only own activities
        if (
          req.user.role === "User" &&
          String(user._id) !==
            String(req.user.userId)
        ) {
          return;
        }

        const userLogs = Array.isArray(
          user.activityLogs
        )
          ? user.activityLogs
          : [];

        userLogs.forEach((log) => {
          if (!log) {
            return;
          }

          const logId = log._id
            ? String(log._id)
            : `${user._id}-${log.createdAt}-${log.action}`;

          // Prevent duplicates
          if (activityIds.has(logId)) {
            return;
          }

          activityIds.add(logId);

          activities.push({
            _id: log._id,

            action: log.action || "",

            description:
              log.description || "",

            category:
              log.category || "System",

            ipAddress:
              log.ipAddress || "",

            status:
              log.status || "Success",

            createdAt:
              log.createdAt || null,

            updatedAt:
              log.updatedAt || null,

            userId: {
              _id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
            },

            tenantId:
              organization._id,

            organization: {
              _id: organization._id,
              companyName:
                organization.companyName,
            },
          });
        });
      });

      // =================================================
      // LEGACY TOP-LEVEL ACTIVITY LOGS
      // KEEP OLD HISTORY DURING MIGRATION
      // =================================================

      const oldLogs = Array.isArray(
        organization.activityLogs
      )
        ? organization.activityLogs
        : [];

      oldLogs.forEach((log) => {
        if (!log) {
          return;
        }

        const logId = log._id
          ? String(log._id)
          : `${organization._id}-${log.createdAt}-${log.action}`;

        if (activityIds.has(logId)) {
          return;
        }

        // Find user who owns this old log
        const matchingUser =
          users.find(
            (user) =>
              String(user._id) ===
              String(log.userId)
          );

        // Normal User can only see own logs
        if (
          req.user.role === "User" &&
          (!matchingUser ||
            String(matchingUser._id) !==
              String(req.user.userId))
        ) {
          return;
        }

        activityIds.add(logId);

        activities.push({
          _id: log._id,

          action: log.action || "",

          description:
            log.description || "",

          category:
            log.category || "System",

          ipAddress:
            log.ipAddress || "",

          status:
            log.status || "Success",

          createdAt:
            log.createdAt || null,

          updatedAt:
            log.updatedAt || null,

          userId: matchingUser
            ? {
                _id: matchingUser._id,
                name: matchingUser.name,
                email: matchingUser.email,
                role: matchingUser.role,
              }
            : {
                _id: log.userId,
                name: "Unknown User",
                email: "",
                role: "User",
              },

          tenantId:
            organization._id,

          organization: {
            _id: organization._id,
            companyName:
              organization.companyName,
          },
        });
      });
    });

    // =================================================
    // SORT NEWEST FIRST
    // =================================================

    activities.sort((a, b) => {
      const dateA = a.createdAt
        ? new Date(a.createdAt).getTime()
        : 0;

      const dateB = b.createdAt
        ? new Date(b.createdAt).getTime()
        : 0;

      return dateB - dateA;
    });

    // =================================================
    // GET LATEST FIVE
    // =================================================

    const recentActivities =
      activities.slice(0, 5);

    // =================================================
    // DEBUG
    // =================================================

    console.log(
      "============================================="
    );

    console.log(
      "DASHBOARD RECENT ACTIVITY"
    );

    console.log(
      "Role:",
      req.user.role
    );

    console.log(
      "User ID:",
      req.user.userId
    );

    console.log(
      "Tenant ID:",
      req.user.tenantId
    );

    console.log(
      "Organizations:",
      organizations.map(
        (organization) => ({
          id: organization._id,
          companyName:
            organization.companyName,
          users:
            organization.users?.length || 0,
        })
      )
    );

    console.log(
      "Total Activities:",
      activities.length
    );

    console.log(
      "Returning:",
      recentActivities.length
    );

    console.log(
      "Latest Activities:",
      recentActivities.map(
        (activity) => ({
          action: activity.action,
          description:
            activity.description,
          createdAt:
            activity.createdAt,
          user:
            activity.userId?.name,
          organization:
            activity.organization
              ?.companyName,
        })
      )
    );

    console.log(
      "============================================="
    );

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json(
      recentActivities
    );
  } catch (error) {
    console.error(
      "❌ Dashboard recent activity error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to load recent activities.",
    });
  }
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  getDashboardStats,
  getRecentActivities,
};