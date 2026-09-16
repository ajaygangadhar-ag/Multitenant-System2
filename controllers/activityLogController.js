const mongoose = require("mongoose");

const Organization = require("../models/organization");
const User = require("../models/user");

// =====================================================
// CREATE ACTIVITY LOG
// SAVE INSIDE SPECIFIC USER.ACTIVITYLOGS[]
// =====================================================

const createActivityLog = async ({
  userId,
  tenantId = null,
  action,
  description,
  category = "System",
  ipAddress = "",
  status = "Success",
}) => {
  try {
    let organization = null;
    let activityUser = null;

    // =================================================
    // 1. FIRST FIND USER INSIDE ORGANIZATIONS
    // =================================================

    if (userId) {
      organization = await Organization.findOne({
        "users._id": userId,
      });

      if (organization) {
        activityUser = organization.users.id(userId);
      }
    }

    // =================================================
    // 2. FALLBACK TO TENANT ID
    // =================================================

    if (!organization && tenantId) {
      organization = await Organization.findById(tenantId);

      if (organization && userId) {
        activityUser = organization.users.id(userId);
      }
    }

    // =================================================
    // 3. SUPERADMIN SYSTEM ORGANIZATION FALLBACK
    // =================================================

    if (!organization && userId) {
      const oldSuperAdmin = await User.findById(userId);

      if (
        oldSuperAdmin &&
        oldSuperAdmin.role === "SuperAdmin"
      ) {
        organization = await Organization.findOne({
          companyName: "System Organization",
        });

        // ---------------------------------------------
        // Create System Organization if missing
        // ---------------------------------------------

        if (!organization) {
          organization = new Organization({
            companyName: "System Organization",
            companyEmail: "system@multitenant.local",
            phone: "0000000000",
            address: "System Organization",
            status: "Active",

            users: [
              {
                _id: oldSuperAdmin._id,
                employeeId:
                  oldSuperAdmin.employeeId || "",
                name: oldSuperAdmin.name,
                email: oldSuperAdmin.email,
                password: oldSuperAdmin.password,

                resetPasswordToken:
                  oldSuperAdmin.resetPasswordToken ||
                  null,

                resetPasswordExpire:
                  oldSuperAdmin.resetPasswordExpire ||
                  null,

                phone:
                  oldSuperAdmin.phone || "",

                department:
                  oldSuperAdmin.department || "",

                designation:
                  oldSuperAdmin.designation || "",

                role: "SuperAdmin",

                status:
                  oldSuperAdmin.status || "Active",

                profileImage:
                  oldSuperAdmin.profileImage || "",

                notificationSettings: {
                  emailNotifications:
                    oldSuperAdmin
                      .notificationSettings
                      ?.emailNotifications ??
                    true,

                  systemNotifications:
                    oldSuperAdmin
                      .notificationSettings
                      ?.systemNotifications ??
                    true,
                },

                activityLogs: [],
              },
            ],

            activityLogs: [],
          });

          await organization.save();
        }

        activityUser =
          organization.users.id(userId);
      }
    }

    // =================================================
    // 4. ORGANIZATION NOT FOUND
    // =================================================

    if (!organization) {
      console.error(
        "❌ Activity log creation failed: Organization not found"
      );

      return;
    }

    // =================================================
    // 5. USER NOT FOUND
    // =================================================

    if (!activityUser && userId) {
      activityUser =
        organization.users.id(userId);
    }

    if (!activityUser) {
      console.error(
        "❌ Activity log creation failed: User not found in organization"
      );

      return;
    }

    // =================================================
    // 6. CREATE ACTIVITY LOG
    // =================================================

    const newActivityLog = {
      _id: new mongoose.Types.ObjectId(),

      userId: activityUser._id,

      action,
      description,
      category,
      ipAddress,
      status,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // =================================================
    // 7. SAVE LOG INSIDE USER.ACTIVITYLOGS[]
    // =================================================

    const result = await Organization.updateOne(
      {
        _id: organization._id,
        "users._id": activityUser._id,
      },
      {
        $push: {
          "users.$.activityLogs":
            newActivityLog,
        },
      }
    );

    // =================================================
    // 8. CHECK SAVE RESULT
    // =================================================

    if (result.modifiedCount === 0) {
      console.error(
        "❌ Activity log creation failed: Log was not saved"
      );

      return;
    }

    console.log(
      "✅ Activity log saved successfully:",
      action
    );
  } catch (error) {
    console.error(
      "❌ Activity log creation failed:",
      error.message
    );
  }
};

// =====================================================
// GET ACTIVITY LOGS
// READ FROM USER.ACTIVITYLOGS[]
// =====================================================

const getActivityLogs = async (req, res) => {
  try {
    const {
      search = "",
      category = "",
      status = "",
      page = 1,
      limit = 10,
    } = req.query;

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const pageLimit = Math.max(
      Number(limit) || 10,
      1
    );

    // =================================================
    // FIND ORGANIZATIONS
    // =================================================

    let organizations = [];

    // =================================================
    // SUPERADMIN
    // SEE ALL ORGANIZATIONS
    // =================================================

    if (req.user.role === "SuperAdmin") {
      organizations =
        await Organization.find({}).lean();
    }

    // =================================================
    // TENANTADMIN
    // FIND ORGANIZATION USING EMBEDDED USER ID
    // =================================================

    else if (
      req.user.role === "TenantAdmin"
    ) {
      let organization =
        await Organization.findOne({
          "users._id": req.user.userId,
        }).lean();

      // Fallback for older JWT
      if (
        !organization &&
        req.user.tenantId
      ) {
        organization =
          await Organization.findById(
            req.user.tenantId
          ).lean();
      }

      if (organization) {
        organizations = [organization];
      }
    }

    // =================================================
    // USER
    // FIND ORGANIZATION USING EMBEDDED USER ID
    // =================================================

    else if (
      req.user.role === "User"
    ) {
      let organization =
        await Organization.findOne({
          "users._id": req.user.userId,
        }).lean();

      // Fallback for older JWT
      if (
        !organization &&
        req.user.tenantId
      ) {
        organization =
          await Organization.findById(
            req.user.tenantId
          ).lean();
      }

      if (organization) {
        organizations = [organization];
      }
    }

    // =================================================
    // COLLECT ACTIVITY LOGS
    // =================================================

    let allLogs = [];

    organizations.forEach(
      (organization) => {
        const users =
          organization.users || [];

        users.forEach((user) => {
          // -------------------------------------------
          // USER CAN ONLY SEE THEIR OWN LOGS
          // -------------------------------------------

          if (
            req.user.role === "User" &&
            user._id.toString() !==
              req.user.userId.toString()
          ) {
            return;
          }

          // -------------------------------------------
          // READ EMBEDDED USER ACTIVITY LOGS
          // -------------------------------------------

          const userLogs =
            user.activityLogs || [];

          userLogs.forEach((log) => {
            allLogs.push({
              _id: log._id,

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

              action:
                log.action,

              description:
                log.description,

              category:
                log.category,

              ipAddress:
                log.ipAddress,

              status:
                log.status,

              createdAt:
                log.createdAt,

              updatedAt:
                log.updatedAt,
            });
          });
        });
      }
    );

    // =================================================
    // SEARCH
    // =================================================

    const searchText =
      search.trim().toLowerCase();

    if (searchText) {
      allLogs = allLogs.filter(
        (log) => {
          return (
            log.action
              ?.toLowerCase()
              .includes(searchText) ||

            log.description
              ?.toLowerCase()
              .includes(searchText) ||

            log.userId?.name
              ?.toLowerCase()
              .includes(searchText) ||

            log.userId?.email
              ?.toLowerCase()
              .includes(searchText) ||

            log.organization
              ?.companyName
              ?.toLowerCase()
              .includes(searchText)
          );
        }
      );
    }

    // =================================================
    // CATEGORY FILTER
    // =================================================

    if (category.trim() !== "") {
      allLogs = allLogs.filter(
        (log) =>
          log.category ===
          category.trim()
      );
    }

    // =================================================
    // STATUS FILTER
    // =================================================

    if (status.trim() !== "") {
      allLogs = allLogs.filter(
        (log) =>
          log.status ===
          status.trim()
      );
    }

    // =================================================
    // SORT — NEWEST FIRST
    // =================================================

    allLogs.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

    // =================================================
    // TOTAL
    // =================================================

    const totalLogs =
      allLogs.length;

    // =================================================
    // PAGINATION
    // =================================================

    const skip =
      (currentPage - 1) *
      pageLimit;

    const logs =
      allLogs.slice(
        skip,
        skip + pageLimit
      );

    // =================================================
    // DEBUG
    // =================================================

    console.log(
      "============================================="
    );

    console.log(
      "ACTIVITY LOG READ"
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
      "Organizations found:",
      organizations.length
    );

    console.log(
      "Total Activity Logs:",
      totalLogs
    );

    console.log(
      "============================================="
    );

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      totalLogs,

      currentPage,

      totalPages:
        Math.ceil(
          totalLogs /
            pageLimit
        ),

      logs,
    });
  } catch (error) {
    console.error(
      "❌ Get activity logs error:",
      error.message
    );

    return res.status(500).json({
      message:
        "Unable to load activity logs.",
    });
  }
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  createActivityLog,
  getActivityLogs,
};