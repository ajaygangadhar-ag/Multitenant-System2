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

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

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

app.use(errorMiddleware);

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});

module.exports = app;