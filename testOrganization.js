const mongoose = require("mongoose");
require("dotenv").config();

const Organization = require("./models/organization");

const testOrganization = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    const organization = await Organization.create({
      companyName: "Test Organization",
      companyEmail: "testorganization@example.com",
      phone: "9876543210",
      address: "Test Address",
      status: "Active",

      users: [
        {
          employeeId: "TEST001",
          name: "Test Admin",
          email: "testadmin@example.com",
          password: "test-password",
          role: "TenantAdmin",
          status: "Active",
        },
      ],

      activityLogs: [
        {
          userId: new mongoose.Types.ObjectId(),
          action: "TEST_LOG",
          description: "Testing embedded activity logs",
          category: "System",
          ipAddress: "127.0.0.1",
          status: "Success",
        },
      ],
    });

    console.log("Organization created successfully:");
    console.log(organization);

    await mongoose.connection.close();

  } catch (error) {
    console.error("Test failed:", error.message);
    await mongoose.connection.close();
  }
};

testOrganization();