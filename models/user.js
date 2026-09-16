const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
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
      unique: true,
      lowercase: true,
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

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
      required: false,
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

    // Notification Settings
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
  },
  {
    timestamps: true,
  }
);

// Employee number must be unique within each tenant
userSchema.index(
  { tenantId: 1, employeeId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      employeeId: {
        $type: "string",
        $ne: "",
      },
    },
  }
);

module.exports = mongoose.model("User", userSchema);