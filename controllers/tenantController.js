const Organization = require("../models/organization");
const bcrypt = require("bcryptjs");

const {
  createActivityLog,
} = require("./activityLogController");

// =====================================================
// CREATE ORGANIZATION
// WITH TENANT ADMIN
// =====================================================

const createTenant = async (req, res) => {
  try {
    const {
      companyName,
      companyEmail,
      phone,
      address,
      status,

      // Tenant Admin details
      adminEmployeeId,
      adminName,
      adminEmail,
      adminPassword,
    } = req.body;

    // =====================================================
    // VALIDATE ORGANIZATION + TENANT ADMIN DETAILS
    // =====================================================

    if (
      !companyName ||
      !companyEmail ||
      !phone ||
      !address ||
      !adminEmployeeId ||
      !adminName ||
      !adminEmail ||
      !adminPassword
    ) {
      return res.status(400).json({
        message:
          "All organization and TenantAdmin fields are required",
      });
    }

    // =====================================================
    // CHECK ORGANIZATION EMAIL
    // =====================================================

    const normalizedCompanyEmail =
      companyEmail.trim().toLowerCase();

    const normalizedAdminEmail =
      adminEmail.trim().toLowerCase();

    // =====================================================
    // CHECK ORGANIZATION EMAIL
    // =====================================================

    const existingOrganization =
      await Organization.findOne({
        companyEmail: normalizedCompanyEmail,
      });

    if (existingOrganization) {
      return res.status(400).json({
        message: "Tenant already exists",
      });
    }

    // =====================================================
    // CHECK TENANT ADMIN EMAIL
    // =====================================================

    const existingUser =
      await Organization.findOne({
        "users.email": normalizedAdminEmail,
      });

    if (existingUser) {
      return res.status(400).json({
        message: "Admin email already exists",
      });
    }

    // =====================================================
    // HASH TENANT ADMIN PASSWORD
    // =====================================================

    const hashedPassword =
      await bcrypt.hash(adminPassword, 10);

    // =====================================================
    // CREATE ORGANIZATION
    // WITH EMBEDDED TENANT ADMIN
    // =====================================================

    const organization =
      new Organization({
        companyName: companyName.trim(),

        companyEmail:
          normalizedCompanyEmail,

        phone: phone.trim(),

        address: address.trim(),

        status: status || "Active",

        users: [
          {
            employeeId:
              adminEmployeeId.trim(),

            name:
              adminName.trim(),

            email:
              normalizedAdminEmail,

            password:
              hashedPassword,

            role:
              "TenantAdmin",

            status:
              "Active",
          },
        ],

        activityLogs: [],
      });

    // =====================================================
    // SAVE ORGANIZATION
    // =====================================================

    await organization.save();

    // =====================================================
    // GET CREATED TENANT ADMIN
    // =====================================================

    const tenantAdmin =
      organization.users[0];

    // =====================================================
    // SUCCESS RESPONSE
    // =====================================================

    return res.status(201).json({
      message:
        "Organization and TenantAdmin created successfully",

      tenant: {
        _id: organization._id,

        id: organization._id,

        companyName:
          organization.companyName,

        companyEmail:
          organization.companyEmail,

        phone:
          organization.phone,

        address:
          organization.address,

        status:
          organization.status,

        createdAt:
          organization.createdAt,

        updatedAt:
          organization.updatedAt,
      },

      admin: {
        id:
          tenantAdmin._id,

        employeeId:
          tenantAdmin.employeeId,

        name:
          tenantAdmin.name,

        email:
          tenantAdmin.email,

        role:
          tenantAdmin.role,

        tenantId:
          organization._id,
      },
    });
  } catch (error) {
    console.error(
      "Create tenant error:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Unable to create organization and TenantAdmin",
    });
  }
};
// =====================================================
// GET ALL TENANTS
// WITH USER STATISTICS
// SUPERADMIN
// =====================================================

const getAllTenants = async (req, res) => {
  try {
    const organizations =
      await Organization.find({
        companyName: {
          $ne: "System Organization",
        },
      })
        .select("-__v")
        .lean();

    // =====================================================
    // ADD USER STATISTICS
    // =====================================================

    const tenantsWithStats =
      organizations.map(
        (organization) => {
          const users =
            organization.users || [];

          // -------------------------------------------------
          // ALL USERS INCLUDING TENANT ADMIN
          // -------------------------------------------------

          const totalUsers =
            users.length;

          const activeUsers =
            users.filter(
              (user) =>
                user.status === "Active"
            ).length;

          const inactiveUsers =
            users.filter(
              (user) =>
                user.status === "Inactive"
            ).length;

          // -------------------------------------------------
          // REMOVE PASSWORD FROM RESPONSE
          // -------------------------------------------------

          const safeUsers =
            users.map((user) => {
              const safeUser = {
                ...user,
              };

              delete safeUser.password;
              delete safeUser.resetPasswordToken;

              return safeUser;
            });

          // -------------------------------------------------
          // RETURN ORGANIZATION
          // -------------------------------------------------

          return {
            ...organization,

            users:
              safeUsers,

            userStats: {
              totalUsers:
                totalUsers,

              activeUsers:
                activeUsers,

              inactiveUsers:
                inactiveUsers,
            },
          };
        }
      );

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      count:
        tenantsWithStats.length,

      tenants:
        tenantsWithStats,
    });

  } catch (error) {
    console.error(
      "Get all tenants error:",
      error
    );

    return res.status(500).json({
      message:
        error.message,
    });
  }
};
// =====================================================
// GET SINGLE TENANT
// =====================================================

const getSingleTenant = async (
  req,
  res
) => {
  try {
    const organization =
      await Organization.findById(
        req.params.id
      ).select("-__v");

    if (!organization) {
      return res.status(404).json({
        message:
          "Tenant not found",
      });
    }

    return res.status(200).json({
      tenant:
        organization,
    });

  } catch (error) {
    console.error(
      "Get single tenant error:",
      error
    );

    return res.status(500).json({
      message:
        error.message,
    });
  }
};


// =====================================================
// UPDATE ORGANIZATION
// UPDATE ORGANIZATION + CREATE ACTIVITY LOG
// =====================================================

const updateTenant = async (
  req,
  res
) => {
  try {

    // =================================================
    // FIND ORGANIZATION
    // =================================================

    const organization =
      await Organization.findById(
        req.params.id
      );

    if (!organization) {
      return res.status(404).json({
        message:
          "Tenant not found",
      });
    }

    // =================================================
    // STORE OLD VALUES
    // =================================================

    const oldCompanyName =
      organization.companyName;

    const oldCompanyEmail =
      organization.companyEmail;

    const oldPhone =
      organization.phone;

    const oldAddress =
      organization.address;

    const oldStatus =
      organization.status;

    // =================================================
    // UPDATE ORGANIZATION DETAILS
    // =================================================

    if (
      req.body.companyName !==
      undefined
    ) {
      organization.companyName =
        req.body.companyName
          .trim();
    }

    if (
      req.body.companyEmail !==
      undefined
    ) {
      organization.companyEmail =
        req.body.companyEmail
          .trim()
          .toLowerCase();
    }

    if (
      req.body.phone !==
      undefined
    ) {
      organization.phone =
        req.body.phone
          .trim();
    }

    if (
      req.body.address !==
      undefined
    ) {
      organization.address =
        req.body.address
          .trim();
    }

    if (
      req.body.status !==
      undefined
    ) {
      organization.status =
        req.body.status;
    }

    // =================================================
    // DETERMINE WHAT CHANGED
    // =================================================

    const changedFields = [];

    if (
      oldCompanyName !==
      organization.companyName
    ) {
      changedFields.push(
        "Company Name"
      );
    }

    if (
      oldCompanyEmail !==
      organization.companyEmail
    ) {
      changedFields.push(
        "Company Email"
      );
    }

    if (
      oldPhone !==
      organization.phone
    ) {
      changedFields.push(
        "Phone"
      );
    }

    if (
      oldAddress !==
      organization.address
    ) {
      changedFields.push(
        "Address"
      );
    }

    if (
      oldStatus !==
      organization.status
    ) {
      changedFields.push(
        "Status"
      );
    }

    // =================================================
    // SAVE ORGANIZATION
    // =================================================

    await organization.save();

    // =================================================
    // CREATE ACTIVITY LOG
    // =================================================

    if (changedFields.length > 0) {

      await createActivityLog({
        userId:
          req.user.userId,

        tenantId:
          organization._id,

        action:
          "ORGANIZATION_UPDATED",

        description:
          `Organization ${organization.companyName} was updated. Changed fields: ${changedFields.join(", ")}`,

        category:
          "Tenant",

        ipAddress:
          req.ip,

        status:
          "Success",
      });
    }

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      message:
        "Tenant updated successfully",

      tenant:
        organization,
    });

  } catch (error) {

    console.error(
      "Update tenant error:",
      error
    );

    if (
      error.code ===
      11000
    ) {
      return res.status(400).json({
        message:
          "Organization email already exists",
      });
    }

    return res.status(500).json({
      message:
        error.message,
    });
  }
};


// =====================================================
// DELETE TENANT
// =====================================================

const deleteTenant = async (
  req,
  res
) => {
  try {
    const organization =
      await Organization.findByIdAndDelete(
        req.params.id
      );

    if (!organization) {
      return res.status(404).json({
        message:
          "Tenant not found",
      });
    }

    return res.status(200).json({
      message:
        "Tenant deleted successfully",
    });

  } catch (error) {
    console.error(
      "Delete tenant error:",
      error
    );

    return res.status(500).json({
      message:
        error.message,
    });
  }
};


// =====================================================
// GET MY TENANT
// TENANT ADMIN / USER
// =====================================================

const getMyTenant = async (
  req,
  res
) => {
  try {
    const organization =
      await Organization.findById(
        req.user.tenantId
      ).select("-__v");

    if (!organization) {
      return res.status(404).json({
        message:
          "Tenant not found",
      });
    }

    return res.status(200).json({
      tenant:
        organization,
    });

  } catch (error) {
    console.error(
      "Get my tenant error:",
      error
    );

    return res.status(500).json({
      message:
        error.message,
    });
  }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  createTenant,
  getAllTenants,
  getSingleTenant,
  updateTenant,
  deleteTenant,
  getMyTenant,
};