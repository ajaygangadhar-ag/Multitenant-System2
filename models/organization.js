const mongoose = require("mongoose");

// =====================================================
// EMBEDDED ACTIVITY LOG SCHEMA
// =====================================================

const embeddedActivityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: [
        "Authentication",
        "User",
        "Tenant",
        "Profile",
        "Security",
        "Settings",
        "System",
      ],
      default: "System",
    },

    ipAddress: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["Success", "Failed"],
      default: "Success",
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// EMBEDDED USER SCHEMA
// =====================================================

const embeddedUserSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      trim: true,
      default: "",
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpire: {
      type: Date,
      default: null,
    },

    phone: {
      type: String,
      default: "",
    },

    department: {
      type: String,
      default: "",
    },

    designation: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      enum: ["SuperAdmin", "TenantAdmin", "User"],
      default: "User",
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },



    profileImage: {
      type: String,
      default: "",
    },

    notificationSettings: {
  emailNotifications: {
    type: Boolean,
    default: true,
  },

  systemNotifications: {
    type: Boolean,
    default: true,
  },
},

activityLogs: {
  type: [embeddedActivityLogSchema],
  default: [],
},
  },
  {
    timestamps: true,
  }
);

// =====================================================
// ORGANIZATION SCHEMA
// =====================================================

const organizationSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    companyEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    userLimit: {
      type: Number,
      default: 10,
      min: 1,
    },

    // All users belonging to this organization
    users: {
      type: [embeddedUserSchema],
      default: [],
    },

    // All activity logs belonging to this organization
    activityLogs: {
      type: [embeddedActivityLogSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// ORGANIZATION MODEL
// =====================================================

const Organization =
  mongoose.models.Organization ||
  mongoose.model("Organization", organizationSchema);

module.exports = Organization;