const mongoose = require("mongoose");
require("dotenv").config();

const Organization = require("./models/organization");

const migrateActivityLogs = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "multitenantDB",
    });

    console.log("✅ MongoDB Connected");

    const organizations =
      await Organization.collection.find({}).toArray();

    console.log(
      `Found ${organizations.length} organizations`
    );

    let migratedCount = 0;

    for (const organization of organizations) {
      const organizationLogs =
        organization.activityLogs || [];

      if (organizationLogs.length === 0) {
        continue;
      }

      console.log(
        `\nProcessing: ${organization.companyName}`
      );

      for (const user of organization.users || []) {
        const userLogs = organizationLogs.filter(
          (log) =>
            log.userId &&
            user._id &&
            log.userId.toString() ===
              user._id.toString()
        );

        if (userLogs.length === 0) {
          continue;
        }

        // Avoid duplicate logs if migration is run again
        const existingLogs =
          user.activityLogs || [];

        const existingIds = new Set(
          existingLogs.map((log) =>
            log._id?.toString()
          )
        );

        const newLogs = userLogs.filter(
          (log) =>
            !existingIds.has(
              log._id?.toString()
            )
        );

        if (newLogs.length === 0) {
          continue;
        }

        await Organization.collection.updateOne(
          {
            _id: organization._id,
            "users._id": user._id,
          },
          {
            $push: {
              "users.$.activityLogs": {
                $each: newLogs,
              },
            },
          }
        );

        migratedCount += newLogs.length;

        console.log(
          `✅ ${newLogs.length} logs migrated to ${user.name}`
        );
      }
    }

    console.log(
      `\n🎉 Migration completed: ${migratedCount} logs migrated`
    );

    await mongoose.disconnect();

    console.log("MongoDB disconnected");

  } catch (error) {
    console.error(
      "❌ Migration failed:",
      error.message
    );

    process.exit(1);
  }
};

migrateActivityLogs();