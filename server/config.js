const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL || "mysql://root:@localhost:3306/uxcribe_gantt",
  uploadDir: path.join(__dirname, "..", "uploads"),
  isDev: process.env.NODE_ENV !== "production"
};
