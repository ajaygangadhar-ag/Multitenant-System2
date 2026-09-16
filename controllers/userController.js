const User = require("../models/user");
const Organization = require("../models/organization");
const bcrypt = require("bcryptjs");

const {
  createActivityLog,
} = require("./activityLogController");

const {
  sendUserCredentials,
} = require("../utils/emailService");

// =====================================================
// CREATE USER
// SAVE USER INSIDE ORGANIZATION.USERS[]
// =====================================================

const createUser = async (req, res) => {
  try {
    let {
      employeeId,
      name,
      email,
      password,
      phone,
      department,
      designation,
      role,
      tenantId,
      status,
    } = req.body;

    if (
      !employeeId ||
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Employee ID, name, email and password are required",
      });
    }

    employeeId = employeeId.trim();
    name = name.trim();
    email = email.trim().toLowerCase();

    // =================================================
    // TENANT ADMIN CREATES USER
    // =================================================

    if (req.user.role === "TenantAdmin") {
      role = "User";
      tenantId = req.user.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          message:
            "TenantAdmin is not linked to an organization",
        });
      }
    }

    // =================================================
    // SUPER ADMIN CREATES TENANT ADMIN
    // =================================================

    if (req.user.role === "SuperAdmin") {
      if (role !== "TenantAdmin") {
        return res.status(403).json({
          message:
            "SuperAdmin can create only TenantAdmin accounts",
        });
      }

      if (!tenantId) {
        return res.status(400).json({
          message:
            "TenantAdmin must be assigned to an organization",
        });
      }
    }

    // =================================================
    // ORGANIZATION REQUIRED
    // =================================================

    if (!tenantId) {
      return res.status(400).json({
        message:
          "Organization is required",
      });
    }

    // =================================================
    // FIND ORGANIZATION
    // =================================================

    const organization =
      await Organization.findById(tenantId);

    if (!organization) {
      return res.status(404).json({
        message:
          "Organization not found",
      });
    }

// =================================================
// CHECK ORGANIZATION USER LIMIT
// =================================================

const userLimit = organization.userLimit ?? 10;
const currentUserCount = organization.users.length;

if (currentUserCount >= userLimit) {
  return res.status(400).json({
    message:
      `User limit reached. This organization can have a maximum of ${userLimit} users.`,
  });
}

    // =================================================
    // CHECK ORGANIZATION STATUS
    // =================================================

    if (organization.status === "Inactive") {
      return res.status(403).json({
        message:
          "Cannot create a user in an inactive organization",
      });
    }

    // =================================================
    // CHECK EMAIL GLOBALLY
    // =================================================

    const existingEmail =
      await Organization.findOne({
        "users.email": email,
      });

    if (existingEmail) {
      return res.status(400).json({
        message:
          "Email already exists",
      });
    }

    // =================================================
    // CHECK EMPLOYEE ID
    // =================================================

    const existingEmployee =
      organization.users.find(
        (user) =>
          String(user.employeeId || "").toLowerCase() ===
          employeeId.toLowerCase()
      );

    if (existingEmployee) {
      return res.status(400).json({
        message:
          "Employee ID already exists in this organization",
      });
    }

    // =================================================
    // HASH PASSWORD
    // =================================================

    const hashedPassword =
      await bcrypt.hash(password, 10);

    // =================================================
    // ADD USER TO ORGANIZATION.USERS[]
    // =================================================

   organization.users.push({
  employeeId,
  name,
  email,
  password: hashedPassword,
  phone: phone || "",
  department: department || "",
  designation: designation || "",
  role: role || "User",
  status: status || "Active",
  profileImage: "",

  notificationSettings: {
    emailNotifications: true,
    systemNotifications: true,
  },

  // IMPORTANT
  // Every embedded user gets their own activity log
  activityLogs: [],
});

    // =================================================
    // SAVE ORGANIZATION
    // =================================================

    await organization.save();

    // =================================================
    // GET CREATED USER
    // =================================================

    const createdUser =
      organization.users[
        organization.users.length - 1
      ];

    // =================================================
    // ACTIVITY LOG
    // =================================================

    try {
      await createActivityLog({
        userId: req.user.userId,
        tenantId: organization._id,
        action: "USER_CREATED",
        description:
          `User ${createdUser.name} was created in ${organization.companyName}`,
        category: "User",
        ipAddress: req.ip,
        status: "Success",
      });
    } catch (logError) {
      console.error(
        "Activity log error:",
        logError.message
      );
    }

    // =================================================
    // SEND USER CREDENTIALS
    // =================================================

    try {
      await sendUserCredentials({
        name: createdUser.name,
        email: createdUser.email,
        password,
        employeeId: createdUser.employeeId,
        companyName: organization.companyName,
      });
    } catch (emailError) {
      console.error(
        "❌ Email sending failed:"
      );

      console.error(
        "Message:",
        emailError.message
      );

      console.error(
        "Code:",
        emailError.code
      );

      console.error(
        "Response:",
        emailError.response
      );
    }

    // =================================================
    // SAFE RESPONSE
    // =================================================

    const userResponse =
      createdUser.toObject();

    delete userResponse.password;
    delete userResponse.__v;
    delete userResponse.resetPasswordToken;
    delete userResponse.resetPasswordExpire;

    // Keep frontend compatibility
    userResponse.tenantId =
      organization._id;

    userResponse.tenant = {
      _id: organization._id,
      companyName:
        organization.companyName,
    };

    // =================================================
    // SUCCESS
    // =================================================

    return res.status(201).json({
      message:
        "User created successfully",
      user:
        userResponse,
    });

  } catch (error) {
    console.error(
      "Create user error:",
      error
    );

    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "Email already exists",
      });
    }

    return res.status(500).json({
      message:
        error.message,
    });
  }
};

// =====================================================
// GET ALL USERS
// SEARCH, FILTER, ORGANIZATION FILTER AND PAGINATION
// =====================================================

const getAllUsers = async (req, res) => {
  try {
    const {
      search,
      department,
      role,
      status,
      tenantId,
      page = 1,
      limit = 5,
    } = req.query;

    // =================================================
    // DETERMINE ORGANIZATIONS TO SEARCH
    // =================================================

    let organizations;

    if (req.user.role === "SuperAdmin") {
      if (tenantId) {
        organizations =
          await Organization.findById(
            tenantId
          ).lean();

        organizations =
          organizations
            ? [organizations]
            : [];

      } else {
        organizations =
          await Organization.find().lean();
      }

    } else {
      if (!req.user.tenantId) {
        return res.status(400).json({
          message:
            "User is not linked to an organization",
        });
      }

      const organization =
        await Organization.findById(
          req.user.tenantId
        ).lean();

      organizations =
        organization
          ? [organization]
          : [];
    }

    // =================================================
    // EXTRACT EMBEDDED USERS
    // =================================================

    let users = [];

    organizations.forEach(
      (organization) => {
        const organizationUsers =
          organization.users || [];

        organizationUsers.forEach(
          (user) => {
            users.push({
              ...user,

              tenantId:
                organization._id,

              tenant: {
                _id:
                  organization._id,

                companyName:
                  organization.companyName,
              },
            });
          }
        );
      }
    );

    // =================================================
    // SEARCH
    // =================================================

    if (search) {
      const searchRegex =
        new RegExp(search, "i");

      users =
        users.filter(
          (user) =>
            searchRegex.test(
              user.name || ""
            ) ||
            searchRegex.test(
              user.email || ""
            ) ||
            searchRegex.test(
              user.employeeId || ""
            )
        );
    }

    // =================================================
    // DEPARTMENT FILTER
    // =================================================

    if (department) {
      users =
        users.filter(
          (user) =>
            user.department ===
            department
        );
    }

    // =================================================
    // ROLE FILTER
    // =================================================

    if (role) {
      users =
        users.filter(
          (user) =>
            user.role === role
        );
    }

    // =================================================
    // STATUS FILTER
    // =================================================

    if (status) {
      users =
        users.filter(
          (user) =>
            user.status === status
        );
    }

    // =================================================
    // SORT
    // =================================================

    users.sort(
      (a, b) =>
        String(
          a.employeeId || ""
        ).localeCompare(
          String(
            b.employeeId || ""
          )
        )
    );

    // =================================================
    // PAGINATION
    // =================================================

    const pageNumber =
      Number(page);

    const pageLimit =
      Number(limit);

    const totalUsers =
      users.length;

    const skip =
      (pageNumber - 1) *
      pageLimit;

    const paginatedUsers =
      users.slice(
        skip,
        skip + pageLimit
      );

    // =================================================
    // REMOVE SENSITIVE DATA
    // =================================================

    const safeUsers =
      paginatedUsers.map(
        (user) => {
          const safeUser = {
            ...user,
          };

          delete safeUser.password;
          delete safeUser.__v;

          return safeUser;
        }
      );

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      totalUsers,

      currentPage:
        pageNumber,

      totalPages:
        Math.ceil(
          totalUsers /
            pageLimit
        ),

      users:
        safeUsers,
    });

  } catch (error) {
    console.error(
      "Get all users error:",
      error
    );

    return res.status(500).json({
      message:
        error.message,
    });
  }
};
// =====================================================
// GET SINGLE USER
// READ USER FROM ORGANIZATION.USERS[]
// =====================================================

const getSingleUser = async (
  req,
  res
) => {
  try {

    // =================================================
    // FIND ORGANIZATION CONTAINING USER
    // =================================================

    const organization =
      await Organization.findOne({
        "users._id":
          req.params.id,
      });

    if (!organization) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    // =================================================
    // FIND EMBEDDED USER
    // =================================================

    const user =
      organization.users.id(
        req.params.id
      );

    if (!user) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    // =================================================
    // TENANT ISOLATION
    // =================================================

    if (
      req.user.role !== "SuperAdmin" &&
      String(organization._id) !==
        String(req.user.tenantId)
    ) {

      // =================================================
      // SECURITY ACTIVITY LOG
      // =================================================

      try {
        await createActivityLog({
          userId:
            req.user.userId,

          tenantId:
            req.user.tenantId,

          action:
            "ACCESS_DENIED",

          description:
            "Attempted to access a user from another organization",

          category:
            "Security",

          ipAddress:
            req.ip,

          status:
            "Failed",
        });
      } catch (logError) {
        console.error(
          "Failed to create security activity log:",
          logError.message
        );
      }

      return res.status(403).json({
        message:
          "Access denied. You cannot access a user from another organization.",
      });
    }

    // =================================================
    // SAFE USER RESPONSE
    // =================================================

    const userResponse =
      user.toObject();

    delete userResponse.password;
    delete userResponse.__v;
    delete userResponse.resetPasswordToken;
    delete userResponse.resetPasswordExpire;

    // =================================================
    // FRONTEND COMPATIBILITY
    // =================================================

    userResponse.tenantId =
      organization._id;

    userResponse.tenant = {
      _id:
        organization._id,

      companyName:
        organization.companyName,
    };

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      user:
        userResponse,
    });

  } catch (error) {

    console.error(
      "Get single user error:",
      error
    );

    return res.status(500).json({
      message:
        error.message,
    });
  }
};


// =====================================================
// UPDATE USER
// UPDATE USER INSIDE ORGANIZATION.USERS[]
// =====================================================

const updateUser = async (req, res) => {
  try {

    // =================================================
    // FIND ORGANIZATION CONTAINING USER
    // =================================================

    const organization =
      await Organization.findOne({
        "users._id":
          req.params.id,
      });

    if (!organization) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    // =================================================
    // FIND EMBEDDED USER
    // =================================================

    const user =
      organization.users.id(
        req.params.id
      );

    if (!user) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    const oldStatus =
      user.status;

    // =================================================
    // TENANT ISOLATION
    // =================================================

    if (
      req.user.role !== "SuperAdmin" &&
      String(organization._id) !==
        String(req.user.tenantId)
    ) {

      // =================================================
      // SECURITY ACTIVITY LOG
      // =================================================

      try {
        await createActivityLog({
          userId:
            req.user.userId,

          tenantId:
            req.user.tenantId,

          action:
            "ACCESS_DENIED",

          description:
            "Attempted to update a user from another organization",

          category:
            "Security",

          ipAddress:
            req.ip,

          status:
            "Failed",
        });
      } catch (logError) {
        console.error(
          "Failed to create security activity log:",
          logError.message
        );
      }

      return res.status(403).json({
        message:
          "Access denied. You cannot update a user from another organization.",
      });
    }

    // =================================================
    // TENANT ADMIN SECURITY
    // =================================================

    if (
      req.user.role ===
      "TenantAdmin"
    ) {

      // TenantAdmin can manage only normal Users
      if (user.role !== "User") {
        return res.status(403).json({
          message:
            "Access denied. TenantAdmin cannot modify another administrator.",
        });
      }

    } else if (
      req.user.role ===
      "SuperAdmin"
    ) {

      // =================================================
      // SUPERADMIN CAN UPDATE ROLE
      // =================================================

      if (
        req.body.role !==
        undefined
      ) {

        if (
          ![
            "TenantAdmin",
            "User",
          ].includes(
            req.body.role
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid user role",
          });
        }

        user.role =
          req.body.role;
      }
    }

    // =================================================
    // UPDATE EMPLOYEE ID
    // =================================================

    if (
      req.body.employeeId !==
      undefined
    ) {

      const newEmployeeId =
        String(
          req.body.employeeId
        ).trim();

      if (
        newEmployeeId !==
        user.employeeId
      ) {

        const existingEmployee =
          organization.users.find(
            (item) =>
              String(item._id) !==
                String(user._id) &&
              String(
                item.employeeId || ""
              ).toLowerCase() ===
                newEmployeeId.toLowerCase()
          );

        if (existingEmployee) {
          return res.status(400).json({
            message:
              "Employee ID already exists in this organization",
          });
        }
      }

      user.employeeId =
        newEmployeeId;
    }

    // =================================================
    // UPDATE NAME
    // =================================================

    if (
      req.body.name !==
      undefined
    ) {

      user.name =
        String(
          req.body.name
        ).trim();
    }

    // =================================================
    // UPDATE EMAIL
    // =================================================

    if (
      req.body.email !==
      undefined
    ) {

      const newEmail =
        String(
          req.body.email
        )
          .trim()
          .toLowerCase();

      if (
        newEmail !==
        user.email
      ) {

        const existingEmail =
          await Organization.findOne({
            "users.email":
              newEmail,

            _id: {
              $ne:
                organization._id,
            },
          });

        if (existingEmail) {
          return res.status(400).json({
            message:
              "Email already exists",
          });
        }

        const sameOrganizationEmail =
          organization.users.find(
            (item) =>
              String(item._id) !==
                String(user._id) &&
              item.email ===
                newEmail
          );

        if (sameOrganizationEmail) {
          return res.status(400).json({
            message:
              "Email already exists",
          });
        }
      }

      user.email =
        newEmail;
    }

    // =================================================
    // UPDATE PHONE
    // =================================================

    if (
      req.body.phone !==
      undefined
    ) {

      user.phone =
        req.body.phone;
    }

    // =================================================
    // UPDATE DEPARTMENT
    // =================================================

    if (
      req.body.department !==
      undefined
    ) {

      user.department =
        req.body.department;
    }

    // =================================================
    // UPDATE DESIGNATION
    // =================================================

    if (
      req.body.designation !==
      undefined
    ) {

      user.designation =
        req.body.designation;
    }

    // =================================================
    // UPDATE STATUS
    // =================================================

    if (
      req.body.status !==
      undefined
    ) {

      if (
        ![
          "Active",
          "Inactive",
        ].includes(
          req.body.status
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid user status",
        });
      }

      user.status =
        req.body.status;
    }

    // =================================================
    // SAVE ORGANIZATION
    // =================================================

    await organization.save();

    // =================================================
    // ACTIVITY LOG
    // =================================================

    let activityAction =
      "USER_UPDATED";

    let activityDescription =
      `User ${user.name} was updated`;

    // =================================================
    // CHECK STATUS CHANGE
    // =================================================

    if (
      req.body.status !==
        undefined &&
      oldStatus !==
        user.status
    ) {

      activityAction =
        "USER_STATUS_CHANGED";

      if (
        user.status ===
        "Inactive"
      ) {

        activityDescription =
          `User ${user.name} was deactivated`;

      } else if (
        user.status ===
        "Active"
      ) {

        activityDescription =
          `User ${user.name} was activated`;
      }
    }

    await createActivityLog({
      userId:
        req.user.userId,

      tenantId:
        organization._id,

      action:
        activityAction,

      description:
        activityDescription,

      category:
        "User",

      ipAddress:
        req.ip,

      status:
        "Success",
    });

    // =================================================
    // SAFE USER RESPONSE
    // =================================================

    const userResponse =
      user.toObject();

    delete userResponse.password;
    delete userResponse.__v;
    delete userResponse.resetPasswordToken;
    delete userResponse.resetPasswordExpire;

    // =================================================
    // FRONTEND COMPATIBILITY
    // =================================================

    userResponse.tenantId =
      organization._id;

    userResponse.tenant = {
      _id:
        organization._id,

      companyName:
        organization.companyName,
    };

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      message:
        "User updated successfully",

      user:
        userResponse,
    });

  } catch (error) {

    console.error(
      "Update user error:",
      error
    );

    if (
      error.code ===
      11000
    ) {
      return res.status(400).json({
        message:
          "Email or Employee ID already exists",
      });
    }

    return res.status(500).json({
      message:
        error.message,
    });
  }
};

// =====================================================
// DELETE USER
// DELETE USER FROM ORGANIZATION.USERS[]
// =====================================================

const deleteUser = async (req, res) => {
  try {
    // =================================================
    // FIND ORGANIZATION CONTAINING USER
    // =================================================

    const organization = await Organization.findOne({
      "users._id": req.params.id,
    });

    if (!organization) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // =================================================
    // FIND EMBEDDED USER
    // =================================================

    const user = organization.users.id(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // =================================================
    // TENANT ISOLATION
    // =================================================

    if (
      req.user.role !== "SuperAdmin" &&
      String(organization._id) !== String(req.user.tenantId)
    ) {
      // =================================================
      // SECURITY ACTIVITY LOG
      // =================================================

      try {
        await createActivityLog({
          userId: req.user.userId,
          tenantId: req.user.tenantId,
          action: "ACCESS_DENIED",
          description:
            "Attempted to delete a user from another organization",
          category: "Security",
          ipAddress: req.ip,
          status: "Failed",
        });
      } catch (logError) {
        console.error(
          "Failed to create security activity log:",
          logError.message
        );
      }

      return res.status(403).json({
        message:
          "Access denied. You cannot delete a user from another organization.",
      });
    }

    // =================================================
    // SAVE USER DETAILS BEFORE DELETE
    // =================================================

    const deletedUserName = user.name;
    const deletedUserEmail = user.email;
    const deletedUserEmployeeId = user.employeeId;

    // =================================================
    // DELETE USER FROM ORGANIZATION.USERS[]
    // =================================================

    organization.users.pull(req.params.id);

    // =================================================
    // SAVE ORGANIZATION
    // =================================================

    await organization.save();

    // =================================================
    // ACTIVITY LOG
    // =================================================

    await createActivityLog({
      userId: req.user.userId,
      tenantId: organization._id,
      action: "USER_DELETED",
      description:
        `User ${deletedUserName} (${deletedUserEmail}) ` +
        `with Employee ID ${deletedUserEmployeeId || "N/A"} ` +
        `was deleted from ${organization.companyName}`,
      category: "User",
      ipAddress: req.ip,
      status: "Success",
    });

    // =================================================
    // SUCCESS RESPONSE
    // =================================================

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);

    return res.status(500).json({
      message: error.message,
    });
  }
};  


// =====================================================
// UPLOAD PROFILE IMAGE
// UPDATE USER INSIDE ORGANIZATION.USERS[]
// =====================================================

const uploadProfileImage =
  async (req, res) => {
    try {

      // =================================================
      // CHECK FILE
      // =================================================

      if (!req.file) {
        return res.status(400).json({
          message:
            "Please upload an image",
        });
      }

      // =================================================
      // FIND ORGANIZATION CONTAINING CURRENT USER
      // =================================================

      const organization =
        await Organization.findOne({
          "users._id":
            req.params.id,
        });

      if (!organization) {
        return res.status(404).json({
          message:
            "Organization not found for this user",
        });
      }

      // =================================================
      // FIND EMBEDDED USER
      // =================================================

      const user =
        organization.users.id(
          req.params.id
        );

      if (!user) {
        return res.status(404).json({
          message:
            "User not found",
        });
      }

      // =================================================
      // TENANT ISOLATION
      // =================================================

      if (
        req.user.role !== "SuperAdmin" &&
        String(organization._id) !==
          String(req.user.tenantId)
      ) {

        // =================================================
        // SECURITY ACTIVITY LOG
        // =================================================

        try {
          await createActivityLog({
            userId:
              req.user.userId,

            tenantId:
              req.user.tenantId,

            action:
              "ACCESS_DENIED",

            description:
              "Attempted to update another organization's user profile image",

            category:
              "Security",

            ipAddress:
              req.ip,

            status:
              "Failed",
          });
        } catch (logError) {
          console.error(
            "Failed to create security activity log:",
            logError.message
          );
        }

        return res.status(403).json({
          message:
            "Access denied. You cannot update this user's profile image.",
        });
      }

      // =================================================
      // SAVE PROFILE IMAGE
      // =================================================

      user.profileImage =
        `/uploads/${req.file.filename}`;

      // =================================================
      // SAVE ORGANIZATION
      // =================================================

      await organization.save();

      // =================================================
      // ACTIVITY LOG
      // =================================================

      await createActivityLog({
        userId:
          req.user.userId,

        tenantId:
          req.user.tenantId,

        action:
          "PROFILE_IMAGE_UPDATED",

        description:
          `Profile image updated for ${user.name}`,

        category:
          "Profile",

        ipAddress:
          req.ip,

        status:
          "Success",
      });

      // =================================================
      // RESPONSE
      // =================================================

      return res.status(200).json({
        message:
          "Profile image uploaded successfully",

        profileImage:
          user.profileImage,
      });

    } catch (error) {

      console.error(
        "Profile image upload error:",
        error
      );

      return res.status(500).json({
        message:
          error.message,
      });
    }
  };


// =====================================================
// GET MY PROFILE
// READ USER FROM ORGANIZATION.USERS[]
// =====================================================

const getMyProfile = async (
  req,
  res
) => {
  try {

    // =================================================
    // FIND ORGANIZATION CONTAINING CURRENT USER
    // =================================================

    const organization =
      await Organization.findOne({
        "users._id": req.user.userId,
      });

    if (!organization) {
      return res.status(404).json({
        message:
          "Organization not found for current user",
      });
    }

    // =================================================
    // FIND CURRENT EMBEDDED USER
    // =================================================

    const user =
      organization.users.id(
        req.user.userId
      );

    if (!user) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    // =================================================
    // SAFE USER RESPONSE
    // =================================================

    const userResponse =
      user.toObject();

    delete userResponse.password;
    delete userResponse.__v;
    delete userResponse.resetPasswordToken;
    delete userResponse.resetPasswordExpire;

    // =================================================
    // FRONTEND COMPATIBILITY
    // =================================================

    userResponse.tenantId =
      organization._id;

    userResponse.tenant = {
      _id:
        organization._id,

      companyName:
        organization.companyName,
    };

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      user:
        userResponse,
    });

  } catch (error) {

    console.error(
      "Get my profile error:",
      error
    );

    return res.status(500).json({
      message:
        error.message,
    });
  }
};
// =====================================================
// UPDATE MY PROFILE
// UPDATE USER INSIDE ORGANIZATION.USERS[]
// =====================================================

const updateMyProfile =
  async (req, res) => {
    try {

      const {
        employeeId,
        name,
        email,
        phone,
        department,
        designation,
      } = req.body;

      // =================================================
      // FIND ORGANIZATION CONTAINING CURRENT USER
      // =================================================

      const organization =
        await Organization.findOne({
          "users._id": req.user.userId,
        });

      if (!organization) {
        return res.status(404).json({
          message:
            "Organization not found for current user",
        });
      }

      // =================================================
      // FIND CURRENT EMBEDDED USER
      // =================================================

      const user =
        organization.users.id(
          req.user.userId
        );

      if (!user) {
        return res.status(404).json({
          message:
            "User not found",
        });
      }

      // =================================================
      // CHECK EMAIL CHANGE
      // =================================================

      const normalizedEmail =
        email?.trim().toLowerCase();

      if (
        normalizedEmail &&
        normalizedEmail !== user.email
      ) {

        const existingEmail =
          await Organization.findOne({
            "users.email":
              normalizedEmail,
            _id: {
              $ne:
                organization._id,
            },
          });

        if (existingEmail) {
          return res.status(400).json({
            message:
              "Email already exists",
          });
        }

        // Check another user in same organization
        const sameOrganizationEmail =
          organization.users.find(
            (item) =>
              String(item._id) !==
                String(user._id) &&
              item.email ===
                normalizedEmail
          );

        if (sameOrganizationEmail) {
          return res.status(400).json({
            message:
              "Email already exists",
          });
        }
      }

      // =================================================
      // UPDATE PROFILE FIELDS
      // =================================================

      user.employeeId =
        employeeId?.trim() || "";

      user.name =
        name?.trim() || user.name;

      user.email =
        normalizedEmail || user.email;

      user.phone =
        phone || "";

      user.department =
        department || "";

      user.designation =
        designation || "";

      // =================================================
      // SAVE ORGANIZATION
      // =================================================

      await organization.save();

      // =================================================
      // ACTIVITY LOG
      // =================================================

      await createActivityLog({
        userId:
          req.user.userId,

        tenantId:
          req.user.tenantId,

        action:
          "PROFILE_UPDATED",

        description:
          `User ${user.name} updated their profile`,

        category:
          "Profile",

        ipAddress:
          req.ip,

        status:
          "Success",
      });

      // =================================================
      // SAFE RESPONSE
      // =================================================

      const userResponse =
        user.toObject();

      delete userResponse.password;
      delete userResponse.__v;
      delete userResponse.resetPasswordToken;
      delete userResponse.resetPasswordExpire;

      // =================================================
      // FRONTEND COMPATIBILITY
      // =================================================

      userResponse.tenantId =
        organization._id;

      userResponse.tenant = {
        _id:
          organization._id,

        companyName:
          organization.companyName,
      };

      // =================================================
      // RESPONSE
      // =================================================

      return res.status(200).json({
        message:
          "Profile updated successfully",

        user:
          userResponse,
      });

    } catch (error) {

      console.error(
        "Update my profile error:",
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
  createUser,
  getAllUsers,
  getSingleUser,
  updateUser,
  deleteUser,
  uploadProfileImage,
  getMyProfile,
  updateMyProfile,
};