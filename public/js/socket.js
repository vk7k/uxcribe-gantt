// Real-Time Socket.IO Synchronization Client
class SyncSocket {
  constructor() {
    this.socket = null;
    this.currentProjectId = null;
    this.userName = "Usuario " + Math.floor(100 + Math.random() * 900);
    this.userAvatar = "US";
  }

  init() {
    if (typeof io === "undefined") {
      console.warn("Socket.io library not loaded");
      return;
    }

    this.socket = io();

    this.socket.on("connect", () => {
      console.log("Connected to real-time sync server:", this.socket.id);
      if (this.currentProjectId) {
        this.joinProject(this.currentProjectId);
      }
    });

    this.socket.on("project-presence", (data) => {
      const el = document.getElementById("live-users-count");
      if (el) {
        el.textContent = `${data.usersCount} en línea`;
      }
    });

    // Real-time task updates from other users
    this.socket.on("task-created", (task) => {
      if (window.App && window.App.currentProject && window.App.currentProject.id === task.projectId) {
        window.App.handleRemoteTaskCreated(task);
      }
    });

    this.socket.on("task-updated", (task) => {
      if (window.App && window.App.currentProject && window.App.currentProject.id === task.projectId) {
        window.App.handleRemoteTaskUpdated(task);
      }
    });

    this.socket.on("task-moved", (task) => {
      if (window.App && window.App.currentProject && window.App.currentProject.id === task.projectId) {
        window.App.handleRemoteTaskMoved(task);
      }
    });

    this.socket.on("task-deleted", (data) => {
      if (window.App && window.App.currentProject && window.App.currentProject.id === data.projectId) {
        window.App.handleRemoteTaskDeleted(data.id);
      }
    });

    this.socket.on("comment-added", (data) => {
      if (window.TaskModal && window.TaskModal.currentTask && window.TaskModal.currentTask.id === data.taskId) {
        window.TaskModal.appendComment(data.comment);
      }
      if (window.App) window.App.refreshDataSilently();
    });

    this.socket.on("checklist-updated", (data) => {
      if (window.TaskModal && window.TaskModal.currentTask && window.TaskModal.currentTask.id === data.taskId) {
        window.TaskModal.updateChecklistItem(data.item);
      }
    });

    this.socket.on("attachment-uploaded", (data) => {
      if (window.TaskModal && window.TaskModal.currentTask && window.TaskModal.currentTask.id === data.taskId) {
        window.TaskModal.appendAttachment(data.attachment);
      }
    });
  }

  joinProject(projectId) {
    this.currentProjectId = projectId;
    if (this.socket && this.socket.connected) {
      this.socket.emit("join-project", {
        projectId,
        user: { name: this.userName, avatar: this.userAvatar }
      });
    }
  }
}

window.syncSocket = new SyncSocket();
