const dotenv = require("dotenv");

dotenv.config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authroutes");
const tenantRoutes = require("./routes/tenantRoutes");
const userRoutes = require("./routes/userRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const path = require("path");
const errorMiddleware = require("./middleware/errorMiddleware");
const activityLogRoutes = require("./routes/activityLogRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Root endpoint (deployment verification and health check)
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Multi-tenant Backend API is running successfully!",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      tenants: "/api/tenants",
      users: "/api/users",
      dashboard: "/api/dashboard",
      activityLogs: "/api/activity-logs",
    },
  });
});

// Favicon handlers to prevent 404 logs from browser requests
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads")
  )
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/tenants",
  tenantRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/dashboard",
  dashboardRoutes
);

app.use(
  "/api/activity-logs",
  activityLogRoutes
);

// Catch-all 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    status: "fail",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

app.use(errorMiddleware);

// Only listen locally, serverless environments (e.g. Vercel) export the handler
if (require.main === module) {
  connectDB();
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;