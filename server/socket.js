const socketIo = require("socket.io");

let io = null;
const activeUsersByProject = new Map();

function initSocket(server) {
  io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
    }
  });

  io.on("connection", (socket) => {
    let currentProjectId = null;
    let userName = "Usuario " + Math.floor(100 + Math.random() * 900);

    socket.on("join-project", ({ projectId, user }) => {
      if (user && user.name) userName = user.name;
      if (currentProjectId) {
        socket.leave(`project-${currentProjectId}`);
        decrementUser(currentProjectId, socket.id);
      }

      currentProjectId = projectId;
      socket.join(`project-${projectId}`);
      incrementUser(projectId, socket.id, userName);

      // Emit updated presence
      emitPresence(projectId);
    });

    socket.on("leave-project", ({ projectId }) => {
      socket.leave(`project-${projectId}`);
      decrementUser(projectId, socket.id);
      emitPresence(projectId);
    });

    socket.on("disconnect", () => {
      if (currentProjectId) {
        decrementUser(currentProjectId, socket.id);
        emitPresence(currentProjectId);
      }
    });
  });

  return io;
}

function incrementUser(projectId, socketId, userName) {
  const pId = String(projectId);
  if (!activeUsersByProject.has(pId)) {
    activeUsersByProject.set(pId, new Map());
  }
  activeUsersByProject.get(pId).set(socketId, userName);
}

function decrementUser(projectId, socketId) {
  const pId = String(projectId);
  if (activeUsersByProject.has(pId)) {
    activeUsersByProject.get(pId).delete(socketId);
    if (activeUsersByProject.get(pId).size === 0) {
      activeUsersByProject.delete(pId);
    }
  }
}

function emitPresence(projectId) {
  if (!io) return;
  const pId = String(projectId);
  const users = activeUsersByProject.has(pId)
    ? Array.from(activeUsersByProject.get(pId).values())
    : [];
  io.to(`project-${projectId}`).emit("project-presence", {
    projectId: Number(projectId),
    usersCount: users.length,
    users
  });
}

function broadcastToProject(projectId, event, data) {
  if (!io) return;
  io.to(`project-${projectId}`).emit(event, data);
}

module.exports = {
  initSocket,
  broadcastToProject
};
