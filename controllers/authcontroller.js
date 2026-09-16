const User = require("../models/user");
const Tenant = require("../models/tenant");
const Organization = require("../models/organization");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const {
  createActivityLog,
} = require("./activityLogController");

const {
  sendUserCredentials,
  sendPasswordResetEmail,
} = require("../utils/emailService");


// =====================================================
// NORMAL REGISTER
// SAVE USER INSIDE ORGANIZATION.USERS[]
// =====================================================

const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      tenantId,
    } = req.body;

    // =================================================
    // SUPERADMIN REGISTRATION BLOCK
    // =================================================

    if (role === "SuperAdmin") {
      return res.status(403).json({
        message:
          "SuperAdmin registration must use the SuperAdmin registration process",
      });
    }

    // =================================================
    // VALIDATE INPUT
    // =================================================

    if (!name || !email || !password) {
      return res.status(400).json({
        message:
          "Name, email and password are required",
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        message: "Organization is required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // =================================================
    // FIND ORGANIZATION
    // =================================================

    const organization =
      await Organization.findById(tenantId);

    if (!organization) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    // =================================================
    // CHECK ORGANIZATION STATUS
    // =================================================

    if (organization.status === "Inactive") {
      return res.status(403).json({
        message:
          "Cannot register a user in an inactive organization",
      });
    }

    // =================================================
    // CHECK EMAIL GLOBALLY
    // =================================================

    const existingUser =
      await Organization.findOne({
        "users.email": normalizedEmail,
      });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists",
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
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role || "User",
      tenantId: undefined,
      status: "Active",
      employeeId: "",
      phone: "",
      department: "",
      designation: "",
      profileImage: "",
      notificationSettings: {
        emailNotifications: true,
        systemNotifications: true,
      },
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
        userId: createdUser._id,
        tenantId: organization._id,
        action: "USER_REGISTERED",
        description:
          `User ${createdUser.name} registered successfully`,
        category: "Authentication",
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
    // RESPONSE
    // =================================================

    return res.status(201).json({
      message: "User registered successfully",
    });
  } catch (error) {
    console.error(
      "Register user error:",
      error
    );

    if (error.code === 11000) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      message: error.message,
    });
  }
};


// =====================================================
// SUPERADMIN REGISTER
// SAVE SUPERADMIN INSIDE SYSTEM ORGANIZATION.USERS[]
// =====================================================

const registerSuperAdmin = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      registrationKey,
    } = req.body;

    // =================================================
    // VALIDATE INPUT
    // =================================================

    if (
      !name ||
      !email ||
      !password ||
      !registrationKey
    ) {
      return res.status(400).json({
        message:
          "Name, email, password and registration key are required",
      });
    }

    // =================================================
    // CHECK REGISTRATION KEY
    // =================================================

    if (
      registrationKey !==
      process.env.SUPERADMIN_REGISTRATION_KEY
    ) {
      return res.status(403).json({
        message:
          "Invalid SuperAdmin registration key",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // =================================================
    // FIND SYSTEM ORGANIZATION
    // =================================================

    let systemOrganization =
      await Organization.findOne({
        companyName: "System Organization",
      });

    // =================================================
    // CREATE SYSTEM ORGANIZATION IF NOT EXISTS
    // =================================================

    if (!systemOrganization) {
      systemOrganization = new Organization({
        companyName: "System Organization",
        companyEmail: "system@multitenant.local",
        phone: "0000000000",
        address: "System Organization",
        status: "Active",
        users: [],
        activityLogs: [],
      });
    }

    // =================================================
    // CHECK EXISTING SUPERADMIN
    // =================================================

    const existingSuperAdmin =
      systemOrganization.users.find(
        (user) =>
          user.role === "SuperAdmin"
      );

    if (existingSuperAdmin) {
      return res.status(409).json({
        message:
          "SuperAdmin already exists. SuperAdmin registration is already completed.",
      });
    }

    // =================================================
    // CHECK EMAIL GLOBALLY
    // =================================================

    const existingUser =
      await Organization.findOne({
        "users.email": normalizedEmail,
      });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    // =================================================
    // HASH PASSWORD
    // =================================================

    const hashedPassword =
      await bcrypt.hash(password, 10);

    // =================================================
    // ADD SUPERADMIN TO SYSTEM ORGANIZATION
    // =================================================

    systemOrganization.users.push({
      employeeId: "",
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "SuperAdmin",
      status: "Active",
      phone: "",
      department: "",
      designation: "",
      profileImage: "",
      notificationSettings: {
        emailNotifications: true,
        systemNotifications: true,
      },
    });

    // =================================================
    // SAVE SYSTEM ORGANIZATION
    // =================================================

    await systemOrganization.save();

    // =================================================
    // GET CREATED SUPERADMIN
    // =================================================

    const newSuperAdmin =
      systemOrganization.users[
        systemOrganization.users.length - 1
      ];

    // =================================================
    // ACTIVITY LOG
    // =================================================

    try {
      await createActivityLog({
        userId: newSuperAdmin._id,
        tenantId: systemOrganization._id,
        action: "SUPERADMIN_REGISTERED",
        description:
          "SuperAdmin account registered successfully",
        category: "Authentication",
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
    // RESPONSE
    // =================================================

    return res.status(201).json({
      message:
        "SuperAdmin registered successfully",
    });
  } catch (error) {
    console.error(
      "SuperAdmin registration error:",
      error
    );

    if (error.code === 11000) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      message: error.message,
    });
  }
};

// =====================================================
// ORGANIZATION + TENANT ADMIN REGISTER
// SAVE BOTH INSIDE ONE ORGANIZATION DOCUMENT
// =====================================================

const registerOrganization = async (req, res) => {
  try {
    const {
      companyName,
      companyEmail,
      phone,
      address,
      adminEmployeeId,
      adminName,
      adminEmail,
      adminPassword,
    } = req.body;

    // =================================================
    // VALIDATE INPUT
    // =================================================

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
          "All organization and admin fields are required",
      });
    }

    const normalizedCompanyEmail =
      companyEmail.trim().toLowerCase();

    const normalizedAdminEmail =
      adminEmail.trim().toLowerCase();

    // =================================================
    // CHECK ORGANIZATION EMAIL
    // =================================================

    const existingOrganization =
      await Organization.findOne({
        companyEmail: normalizedCompanyEmail,
      });

    if (existingOrganization) {
      return res.status(400).json({
        message:
          "Organization email already exists",
      });
    }

    // =================================================
    // CHECK ADMIN EMAIL GLOBALLY
    // =================================================

    const existingUser =
      await Organization.findOne({
        "users.email": normalizedAdminEmail,
      });

    if (existingUser) {
      return res.status(400).json({
        message:
          "Admin email already exists",
      });
    }

    // =================================================
    // HASH ADMIN PASSWORD
    // =================================================

    const hashedPassword =
      await bcrypt.hash(adminPassword, 10);

    // =================================================
    // CREATE ORGANIZATION
    // =================================================

    const newOrganization =
      new Organization({
        companyName: companyName.trim(),
        companyEmail: normalizedCompanyEmail,
        phone: phone.trim(),
        address: address.trim(),
        status: "Active",

        users: [
          {
            employeeId:
              adminEmployeeId.trim(),
            name: adminName.trim(),
            email: normalizedAdminEmail,
            password: hashedPassword,
            role: "TenantAdmin",
            status: "Active",
            phone: "",
            department: "",
            designation: "",
            profileImage: "",
            notificationSettings: {
              emailNotifications: true,
              systemNotifications: true,
            },
          },
        ],

        activityLogs: [],
      });

    // =================================================
    // SAVE ORGANIZATION
    // =================================================

    await newOrganization.save();

    // =================================================
    // GET CREATED TENANT ADMIN
    // =================================================

    const newTenantAdmin =
      newOrganization.users[0];

    // =================================================
    // ACTIVITY LOG
    // =================================================

    try {
      await createActivityLog({
        userId: newTenantAdmin._id,
        tenantId: newOrganization._id,
        action: "ORGANIZATION_REGISTERED",
        description:
          `Organization ${newOrganization.companyName} ` +
          `and TenantAdmin ${newTenantAdmin.name} ` +
          `registered successfully`,
        category: "Tenant",
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
    // RESPONSE
    // =================================================

    return res.status(201).json({
      message:
        "Organization and TenantAdmin registered successfully",

      organization: {
        id: newOrganization._id,
        companyName:
          newOrganization.companyName,
        companyEmail:
          newOrganization.companyEmail,
        phone:
          newOrganization.phone,
        address:
          newOrganization.address,
        status:
          newOrganization.status,
      },

      admin: {
        id: newTenantAdmin._id,
        employeeId:
          newTenantAdmin.employeeId,
        name:
          newTenantAdmin.name,
        email:
          newTenantAdmin.email,
        role:
          newTenantAdmin.role,
        tenantId:
          newOrganization._id,
      },
    });
  } catch (error) {
    console.error(
      "Organization registration error:",
      error
    );

    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "Organization email or admin email already exists",
      });
    }

    return res.status(500).json({
      message: error.message,
    });
  }
};


// =====================================================
// LOGIN
// SUPPORT OLD USER COLLECTION + EMBEDDED USERS
// =====================================================

const loginUser = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password are required",
      });
    }

    const normalizedEmail =
      email.toLowerCase().trim();

    // =================================================
    // FIRST: SEARCH EMBEDDED USERS
    // =================================================

    const organization =
      await Organization.findOne({
        "users.email":
          normalizedEmail,
      });

    if (organization) {
      const user =
        organization.users.find(
          (item) =>
            item.email ===
            normalizedEmail
        );

      if (user) {
        // Check user status
        if (user.status === "Inactive") {
          return res.status(403).json({
            message:
              "Your account is inactive. Please contact your administrator.",
          });
        }

        // Check organization status
        if (
          organization.status ===
          "Inactive"
        ) {
          return res.status(403).json({
            message:
              "Your organization is inactive. Please contact your administrator.",
          });
        }

        // Check password
        const isMatch =
          await bcrypt.compare(
            password,
            user.password
          );

        if (!isMatch) {
          return res.status(401).json({
            message:
              "Invalid password",
          });
        }

        const tenantId =
          user.role === "SuperAdmin"
            ? null
            : organization._id;

        const token =
          jwt.sign(
            {
              userId:
                user._id,

              role:
                user.role,

              tenantId:
                tenantId,
            },

            process.env.JWT_SECRET,

            {
              expiresIn:
                "1d",
            }
          );

        try {
          await createActivityLog({
            userId:
              user._id,

            tenantId:
              tenantId,

            action:
              "LOGIN",

            description:
              "User logged in successfully",

            category:
              "Authentication",

            ipAddress:
              req.ip,

            status:
              "Success",
          });
        } catch (logError) {
          console.error(
            "Activity log error:",
            logError.message
          );
        }

        return res.status(200).json({
          message:
            "Login successful",

          token,

          user: {
            id:
              user._id,

            name:
              user.name,

            email:
              user.email,

            role:
              user.role,

            tenantId:
              tenantId,

            tenant: {
              _id:
                organization._id,

              companyName:
                organization.companyName,
            },
          },
        });
      }
    }

    // =================================================
    // SECOND: SEARCH OLD USER COLLECTION
    // THIS KEEPS EXISTING SUPERADMIN WORKING
    // =================================================

    const oldUser =
      await User.findOne({
        email: normalizedEmail,
      });

      console.log("========== DB CHECK ==========");

      console.log("Database:", User.db.name);
      console.log("Collection:", User.collection.name);

      const allUsers = await User.find({})
        .select("email role")
        .lean();

      console.log("Users found:", allUsers);

      console.log("==============================");

    console.log(
      "LOGIN DEBUG - Email:",
      normalizedEmail
    );

    console.log(
      "LOGIN DEBUG - Old User:",
      oldUser
        ? {
            id: oldUser._id,
            email: oldUser.email,
            role: oldUser.role,
            status: oldUser.status,
          }
        : "NOT FOUND"
    );

    if (!oldUser) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    // =================================================
    // CHECK OLD USER STATUS
    // =================================================

    if (
      oldUser.status ===
      "Inactive"
    ) {
      return res.status(403).json({
        message:
          "Your account is inactive. Please contact your administrator.",
      });
    }

    // =================================================
    // CHECK OLD USER PASSWORD
    // =================================================

    const oldPasswordMatch =
      await bcrypt.compare(
        password,
        oldUser.password
      );

    if (!oldPasswordMatch) {
      return res.status(401).json({
        message:
          "Invalid password",
      });
    }

    // =================================================
    // OLD SUPERADMIN
    // =================================================

    if (
      oldUser.role ===
      "SuperAdmin"
    ) {
      const token =
        jwt.sign(
          {
            userId:
              oldUser._id,

            role:
              oldUser.role,

            tenantId:
              null,
          },

          process.env.JWT_SECRET,

          {
            expiresIn:
              "1d",
          }
        );

      try {
        await createActivityLog({
          userId:
            oldUser._id,

          tenantId:
            null,

          action:
            "LOGIN",

          description:
            "SuperAdmin logged in successfully",

          category:
            "Authentication",

          ipAddress:
            req.ip,

          status:
            "Success",
        });
      } catch (logError) {
        console.error(
          "Activity log error:",
          logError.message
        );
      }

      return res.status(200).json({
        message:
          "Login successful",

        token,

        user: {
          id:
            oldUser._id,

          name:
            oldUser.name,

          email:
            oldUser.email,

          role:
            oldUser.role,

          tenantId:
            null,
        },
      });
    }

    // =================================================
    // OLD NON-SUPERADMIN USER
    // =================================================

    if (!oldUser.tenantId) {
      return res.status(403).json({
        message:
          "Your account is not assigned to an organization. Please contact your administrator.",
      });
    }

    const oldTenant =
      await Tenant.findById(
        oldUser.tenantId
      );

    if (!oldTenant) {
      return res.status(403).json({
        message:
          "Your organization could not be found. Please contact your administrator.",
      });
    }

    if (
      oldTenant.status ===
      "Inactive"
    ) {
      return res.status(403).json({
        message:
          "Your organization is inactive. Please contact your administrator.",
      });
    }

    const token =
      jwt.sign(
        {
          userId:
            oldUser._id,

          role:
            oldUser.role,

          tenantId:
            oldUser.tenantId,
        },

        process.env.JWT_SECRET,

        {
          expiresIn:
            "1d",
        }
      );

    try {
      await createActivityLog({
        userId:
          oldUser._id,

        tenantId:
          oldUser.tenantId,

        action:
          "LOGIN",

        description:
          "User logged in successfully",

        category:
          "Authentication",

        ipAddress:
          req.ip,

        status:
          "Success",
      });
    } catch (logError) {
      console.error(
        "Activity log error:",
        logError.message
      );
    }

    return res.status(200).json({
      message:
        "Login successful",

      token,

      user: {
        id:
          oldUser._id,

        name:
          oldUser.name,

        email:
          oldUser.email,

        role:
          oldUser.role,

        tenantId:
          oldUser.tenantId,
      },
    });

  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      message:
        error.message,
    });
  }
};


// =====================================================
// FORGOT PASSWORD
// FIND USER INSIDE ORGANIZATION.USERS[]
// =====================================================

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // =================================================
    // FIND ORGANIZATION CONTAINING USER
    // =================================================

    const organization = await Organization.findOne({
      "users.email": normalizedEmail,
    });

    // Do not reveal whether email exists
    if (!organization) {
      return res.status(200).json({
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // =================================================
    // FIND EMBEDDED USER
    // =================================================

    const user = organization.users.find(
      (item) => item.email === normalizedEmail
    );

    if (!user) {
      return res.status(200).json({
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // =================================================
    // CHECK USER STATUS
    // =================================================

    if (user.status === "Inactive") {
      return res.status(200).json({
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // =================================================
    // GENERATE SECURE RESET TOKEN
    // =================================================

    const resetToken = crypto
      .randomBytes(32)
      .toString("hex");

    // =================================================
    // HASH TOKEN BEFORE STORAGE
    // =================================================

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;

    // Token expires after 15 minutes
    user.resetPasswordExpire =
      new Date(Date.now() + 15 * 60 * 1000);

    // =================================================
    // SAVE ORGANIZATION
    // =================================================

    await organization.save();

    // =================================================
    // SEND RESET EMAIL
    // =================================================

    await sendPasswordResetEmail({
      name: user.name,
      email: user.email,
      resetToken,
    });

    // =================================================
    // ACTIVITY LOG
    // =================================================

    try {
      await createActivityLog({
        userId: user._id,
        tenantId:
          user.role === "SuperAdmin"
            ? null
            : organization._id,
        action: "PASSWORD_RESET_REQUESTED",
        description:
          "Password reset link requested",
        category: "Authentication",
        ipAddress: req.ip,
        status: "Success",
      });
    } catch (logError) {
      console.error(
        "Activity log error:",
        logError.message
      );
    }

    return res.status(200).json({
      message:
        "If an account exists with this email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error(
      "Forgot password error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to process password reset request",
    });
  }
};


// =====================================================
// RESET PASSWORD
// UPDATE PASSWORD INSIDE ORGANIZATION.USERS[]
// =====================================================

const resetPassword = async (req, res) => {
  try {
    const {
      token,
      newPassword,
    } = req.body;

    // =================================================
    // VALIDATE INPUT
    // =================================================

    if (!token || !newPassword) {
      return res.status(400).json({
        message:
          "Reset token and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters",
      });
    }

    // =================================================
    // HASH TOKEN
    // =================================================

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // =================================================
    // FIND ORGANIZATION CONTAINING VALID RESET TOKEN
    // =================================================

    const organization = await Organization.findOne({
      "users.resetPasswordToken": hashedToken,
      "users.resetPasswordExpire": {
        $gt: new Date(),
      },
    });

    if (!organization) {
      return res.status(400).json({
        message:
          "Reset link is invalid or has expired",
      });
    }

    // =================================================
    // FIND EMBEDDED USER
    // =================================================

    const user = organization.users.find(
      (item) =>
        item.resetPasswordToken === hashedToken &&
        item.resetPasswordExpire &&
        item.resetPasswordExpire > new Date()
    );

    if (!user) {
      return res.status(400).json({
        message:
          "Reset link is invalid or has expired",
      });
    }

    // =================================================
    // HASH NEW PASSWORD
    // =================================================

    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    // =================================================
    // UPDATE PASSWORD
    // =================================================

    user.password = hashedPassword;

    // =================================================
    // INVALIDATE RESET TOKEN
    // =================================================

    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;

    // =================================================
    // SAVE ORGANIZATION
    // =================================================

    await organization.save();

    // =================================================
    // ACTIVITY LOG
    // =================================================

    try {
      await createActivityLog({
        userId: user._id,
        tenantId:
          user.role === "SuperAdmin"
            ? null
            : organization._id,
        action: "PASSWORD_RESET",
        description:
          "Password reset successfully",
        category: "Security",
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
    // RESPONSE
    // =================================================

    return res.status(200).json({
      message:
        "Password reset successfully",
    });
  } catch (error) {
    console.error(
      "Reset password error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to reset password",
    });
  }
};


// =====================================================
// CHANGE PASSWORD
// UPDATE PASSWORD INSIDE ORGANIZATION.USERS[]
// =====================================================

const changePassword = async (
  req,
  res
) => {
  try {

    const {
      currentPassword,
      newPassword,
    } = req.body;

    // =================================================
    // VALIDATE INPUT
    // =================================================

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message:
          "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message:
          "New password must be at least 6 characters",
      });
    }

    // =================================================
    // FIND ORGANIZATION CONTAINING CURRENT USER
    // =================================================

    const organization =
      await Organization.findOne({
        "users._id":
          req.user.userId,
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
    // VERIFY CURRENT PASSWORD
    // =================================================

    const isMatch =
      await bcrypt.compare(
        currentPassword,
        user.password
      );

    if (!isMatch) {
      return res.status(401).json({
        message:
          "Current password is incorrect",
      });
    }

    // =================================================
    // HASH NEW PASSWORD
    // =================================================

    const hashedPassword =
      await bcrypt.hash(
        newPassword,
        10
      );

    // =================================================
    // UPDATE PASSWORD
    // =================================================

    user.password =
      hashedPassword;

    // =================================================
    // SAVE ORGANIZATION
    // =================================================

    await organization.save();

    // =================================================
    // ACTIVITY LOG
    // =================================================

    await createActivityLog({
      userId:
        user._id,

      tenantId:
        req.user.tenantId,

      action:
        "PASSWORD_CHANGED",

      description:
        "Password changed successfully",

      category:
        "Security",

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
        "Password changed successfully",
    });

  } catch (error) {

    console.error(
      "Change password error:",
      error
    );

    return res.status(500).json({
      message:
        error.message,
    });
  }
};


// =====================================================
// GET SETTINGS
// READ SETTINGS FROM ORGANIZATION.USERS[]
// =====================================================

const getSettings = async (
  req,
  res
) => {
  try {

    // =================================================
    // FIND ORGANIZATION CONTAINING CURRENT USER
    // =================================================

    const organization =
      await Organization.findOne({
        "users._id":
          req.user.userId,
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
    // RETURN NOTIFICATION SETTINGS
    // =================================================

    return res.status(200).json({
      notificationSettings: {
        emailNotifications:
          user.notificationSettings
            ?.emailNotifications ??
          true,

        systemNotifications:
          user.notificationSettings
            ?.systemNotifications ??
          true,
      },
    });

  } catch (error) {

    console.error(
      "Get settings error:",
      error
    );

    return res.status(500).json({
      message:
        error.message,
    });
  }
};


// =====================================================
// UPDATE SETTINGS
// UPDATE SETTINGS INSIDE ORGANIZATION.USERS[]
// =====================================================

const updateSettings = async (
  req,
  res
) => {
  try {

    const {
      emailNotifications,
      systemNotifications,
    } = req.body;

    // =================================================
    // FIND ORGANIZATION CONTAINING CURRENT USER
    // =================================================

    const organization =
      await Organization.findOne({
        "users._id":
          req.user.userId,
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
    // UPDATE NOTIFICATION SETTINGS
    // =================================================

    user.notificationSettings.emailNotifications =
      Boolean(emailNotifications);

    user.notificationSettings.systemNotifications =
      Boolean(systemNotifications);

    // =================================================
    // SAVE ORGANIZATION
    // =================================================

    await organization.save();

    // =================================================
    // ACTIVITY LOG
    // =================================================

    await createActivityLog({
      userId:
        user._id,

      tenantId:
        req.user.tenantId,

      action:
        "SETTINGS_UPDATED",

      description:
        "Notification settings updated",

      category:
        "Settings",

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
        "Settings updated successfully",

      notificationSettings: {
        emailNotifications:
          user.notificationSettings
            .emailNotifications,

        systemNotifications:
          user.notificationSettings
            .systemNotifications,
      },
    });

  } catch (error) {

    console.error(
      "Update settings error:",
      error.message
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
  registerUser,
  registerSuperAdmin,
  registerOrganization,
  loginUser,
  forgotPassword,
  resetPassword,
  changePassword,
  getSettings,
  updateSettings,
};