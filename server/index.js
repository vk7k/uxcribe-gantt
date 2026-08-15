const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const config = require("./config");
const { initSocket } = require("./socket");

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static files
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(config.uploadDir));

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/attachments", require("./routes/attachments"));
app.use("/api/checklists", require("./routes/checklists"));
app.use("/api/dependencies", require("./routes/dependencies"));
app.use("/api/upload", require("./routes/upload"));

// Fallback SPA
app.get("*", (req, res) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return res.status(404).json({ error: "Endpoint no encontrado" });
  }
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// Start server

// Auto seed if empty
async function checkAndSeed() {
  try {
    const prisma = require("./db");
    const count = await prisma.project.count();
    if (count === 0) {
      console.log("No projects found in DB. Auto-seeding sample projects...");
      const seed = require("../prisma/seed");
      await seed();
    }
  } catch (err) {
    console.warn("Auto-seed check:", err.message);
  }
}

server.listen(config.port, async () => {
  await checkAndSeed();
  console.log(`======================================================`);
  console.log(`🚀 uxcribe-gantt server running on http://localhost:${config.port}`);
  console.log(`📊 Database URL: ${config.databaseUrl.replace(/:[^:@]*@/, ":****@")}`);
  console.log(`📁 Uploads directory: ${config.uploadDir}`);
  console.log(`======================================================`);
});
