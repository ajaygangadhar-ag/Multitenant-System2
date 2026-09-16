const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const migrateSuperAdmin = async () => {
  let sourceConnection;
  let destinationConnection;

  try {
    console.log("======================================");
    console.log("SUPERADMIN MIGRATION STARTED");
    console.log("======================================");

    // =====================================================
    // CONNECT TO TEST DATABASE
    // =====================================================

    sourceConnection =
      await mongoose.createConnection(
        process.env.MONGO_URI,
        {
          dbName: "test",
        }
      ).asPromise();

    console.log(
      "✅ Connected to test database"
    );

    // =====================================================
    // CONNECT TO MULTITENANT DATABASE
    // =====================================================

    destinationConnection =
      await mongoose.createConnection(
        process.env.MONGO_URI,
        {
          dbName: "multitenantDB",
        }
      ).asPromise();

    console.log(
      "✅ Connected to multitenantDB database"
    );

    // =====================================================
    // FIND EXISTING SUPERADMIN IN test.users
    // =====================================================

    const superAdmin =
      await sourceConnection
        .collection("users")
        .findOne({
          email:
            "ajaygajay82@gmail.com",
        });

    if (!superAdmin) {
      console.log(
        "❌ SuperAdmin not found in test.users"
      );

      return;
    }

    console.log(
      "✅ SuperAdmin found in test.users"
    );

    console.log({
      name: superAdmin.name,
      email: superAdmin.email,
      role: superAdmin.role,
    });

    // =====================================================
    // MAKE SURE THIS IS REALLY SUPERADMIN
    // =====================================================

    if (
      superAdmin.role !==
      "SuperAdmin"
    ) {
      console.log(
        "❌ Found user is not a SuperAdmin"
      );

      return;
    }

    // =====================================================
    // CHECK SYSTEM ORGANIZATION
    // =====================================================

    const organizations =
      destinationConnection.collection(
        "organizations"
      );

    let systemOrganization =
      await organizations.findOne({
        companyName:
          "System Organization",
      });

    // =====================================================
    // CREATE SYSTEM ORGANIZATION
    // =====================================================

    if (!systemOrganization) {
      console.log(
        "Creating System Organization..."
      );

      systemOrganization = {
        companyName:
          "System Organization",

        companyEmail:
          "system@multitenant.local",

        phone:
          "0000000000",

        address:
          "System Organization",

        status:
          "Active",

        users: [
          {
            _id:
              superAdmin._id,

            employeeId:
              superAdmin.employeeId ||
              "",

            name:
              superAdmin.name,

            email:
              superAdmin.email
                .toLowerCase()
                .trim(),

            password:
              superAdmin.password,

            resetPasswordToken:
              superAdmin.resetPasswordToken ||
              null,

            resetPasswordExpire:
              superAdmin.resetPasswordExpire ||
              null,

            phone:
              superAdmin.phone ||
              "",

            department:
              superAdmin.department ||
              "",

            designation:
              superAdmin.designation ||
              "",

            role:
              "SuperAdmin",

            status:
              superAdmin.status ||
              "Active",

            profileImage:
              superAdmin.profileImage ||
              "",

            notificationSettings:
              {
                emailNotifications:
                  superAdmin
                    .notificationSettings
                    ?.emailNotifications ??
                  true,

                systemNotifications:
                  superAdmin
                    .notificationSettings
                    ?.systemNotifications ??
                  true,
              },

            createdAt:
              superAdmin.createdAt ||
              new Date(),

            updatedAt:
              new Date(),
          },
        ],

        activityLogs: [],

        createdAt:
          new Date(),

        updatedAt:
          new Date(),

        __v: 0,
      };

      await organizations.insertOne(
        systemOrganization
      );

      console.log(
        "✅ System Organization created"
      );
    } else {
      console.log(
        "⚠️ System Organization already exists"
      );

      // =================================================
      // CHECK WHETHER SUPERADMIN IS ALREADY EMBEDDED
      // =================================================

      const existingSuperAdmin =
        systemOrganization.users?.find(
          (user) =>
            user.email ===
            superAdmin.email
        );

      if (!existingSuperAdmin) {
        await organizations.updateOne(
          {
            _id:
              systemOrganization._id,
          },
          {
            $push: {
              users: {
                _id:
                  superAdmin._id,

                employeeId:
                  superAdmin.employeeId ||
                  "",

                name:
                  superAdmin.name,

                email:
                  superAdmin.email
                    .toLowerCase()
                    .trim(),

                password:
                  superAdmin.password,

                resetPasswordToken:
                  superAdmin.resetPasswordToken ||
                  null,

                resetPasswordExpire:
                  superAdmin.resetPasswordExpire ||
                  null,

                phone:
                  superAdmin.phone ||
                  "",

                department:
                  superAdmin.department ||
                  "",

                designation:
                  superAdmin.designation ||
                  "",

                role:
                  "SuperAdmin",

                status:
                  superAdmin.status ||
                  "Active",

                profileImage:
                  superAdmin.profileImage ||
                  "",

                notificationSettings:
                  {
                    emailNotifications:
                      superAdmin
                        .notificationSettings
                        ?.emailNotifications ??
                      true,

                    systemNotifications:
                      superAdmin
                        .notificationSettings
                        ?.systemNotifications ??
                      true,
                  },

                createdAt:
                  superAdmin.createdAt ||
                  new Date(),

                updatedAt:
                  new Date(),
              },
            },

            $set: {
              updatedAt:
                new Date(),
            },
          }
        );

        console.log(
          "✅ SuperAdmin added to System Organization"
        );
      } else {
        console.log(
          "✅ SuperAdmin already exists in System Organization"
        );
      }
    }

    // =====================================================
    // VERIFY MIGRATION
    // =====================================================

    const verification =
      await organizations.findOne({
        companyName:
          "System Organization",
        "users.email":
          "ajaygajay82@gmail.com",
      });

    if (verification) {
      console.log(
        "======================================"
      );

      console.log(
        "✅ MIGRATION SUCCESSFUL"
      );

      console.log(
        "System Organization:",
        verification.companyName
      );

      console.log(
        "SuperAdmin:",
        verification.users.find(
          (user) =>
            user.email ===
            "ajaygajay82@gmail.com"
        )?.name
      );

      console.log(
        "======================================"
      );
    } else {
      console.log(
        "❌ Migration verification failed"
      );
    }
  } catch (error) {
    console.error(
      "❌ Migration failed:"
    );

    console.error(
      error.message
    );
  } finally {
    // =====================================================
    // CLOSE CONNECTIONS
    // =====================================================

    if (sourceConnection) {
      await sourceConnection.close();
    }

    if (destinationConnection) {
      await destinationConnection.close();
    }

    console.log(
      "Database connections closed."
    );
  }
};

migrateSuperAdmin();