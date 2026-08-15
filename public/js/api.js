// REST API client for uxcribe-gantt
const API = {
  // Auth Token Management
  getToken() {
    return localStorage.getItem("uxcribe_auth_token");
  },

  setToken(token) {
    if (token) localStorage.setItem("uxcribe_auth_token", token);
    else localStorage.removeItem("uxcribe_auth_token");
  },

  getAuthHeaders(isJson = true) {
    const headers = {};
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (isJson) headers["Content-Type"] = "application/json";
    return headers;
  },

  async login(email, password) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al iniciar sesión");
    if (data.token) this.setToken(data.token);
    return data;
  },

  async register(userData) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al registrar usuario");
    if (data.token) this.setToken(data.token);
    return data;
  },

  async getMe() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const res = await fetch("/api/auth/me", {
        headers: this.getAuthHeaders()
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.user;
    } catch (e) {
      return null;
    }
  },

  async getUsers() {
    try {
      const res = await fetch("/api/auth/users", {
        headers: this.getAuthHeaders()
      });
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  async updateProfile(profileData) {
    const res = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(profileData)
    });
    return await res.json();
  },

  logout() {
    this.setToken(null);
  },

  // Projects
    async importProjectPackage(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/projects/import", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Error al importar el proyecto");
    }
    return data;
  },

  async importProject(projectData) {
    const res = await fetch("/api/projects/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectData)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Error al importar el proyecto");
    }
    return data;
  },

  exportProjectUrl(id) {
    return `/api/projects/${id}/export`;
  },
  async getProjects() {
    const res = await fetch("/api/projects");
    return res.json();
  },
  async getProject(id) {
    const res = await fetch(`/api/projects/${id}`);
    return res.json();
  },
  async createProject(data) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async updateProject(id, data) {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async deleteProject(id) {
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    return res.json();
  },
  async getProjectStats(id) {
    const res = await fetch(`/api/projects/${id}/stats`);
    return res.json();
  },

  // Tasks
  async getTask(id) {
    const res = await fetch(`/api/tasks/${id}`);
    return res.json();
  },
  async createTask(data) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async updateTask(id, data) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async moveTask(id, data) {
    const res = await fetch(`/api/tasks/${id}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },
    async reorderTasks(projectId, tasksOrder) {
    const res = await fetch("/api/tasks/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, tasksOrder })
    });
    return res.json();
  },
      async bulkMoveTasks(projectId, moves) {
    const res = await fetch("/api/tasks/bulk-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, moves })
    });
    return res.json();
  },
  async bulkDeleteTasks(projectId, taskIds) {
    const res = await fetch("/api/tasks/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, taskIds })
    });
    return res.json();
  },
  async deleteTask(id) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    return res.json();
  },

  // Comments
  async addComment(taskId, data) {
    const res = await fetch(`/api/comments/task/${taskId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async deleteComment(id) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    return res.json();
  },

  // Attachments
  async uploadAttachment(taskId, file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/attachments/task/${taskId}`, {
      method: "POST",
      body: formData
    });
    return res.json();
  },
  async deleteAttachment(id) {
    const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    return res.json();
  },

  // Checklists
  async addChecklistItem(taskId, text) {
    const res = await fetch(`/api/checklists/task/${taskId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    return res.json();
  },
  async toggleChecklistItem(id) {
    const res = await fetch(`/api/checklists/${id}/toggle`, { method: "PATCH" });
    return res.json();
  },
  async deleteChecklistItem(id) {
    const res = await fetch(`/api/checklists/${id}`, { method: "DELETE" });
    return res.json();
  },

  // Dependencies
  async addDependency(predecessorId, successorId, type = "FS") {
    const res = await fetch("/api/dependencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predecessorId, successorId, type })
    });
    return res.json();
  },
  async deleteDependency(id) {
    const res = await fetch(`/api/dependencies/${id}`, { method: "DELETE" });
    return res.json();
  },

  // Inline Image Upload for Rich Editor
  async uploadInlineImage(file) {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/upload/inline-image", {
      method: "POST",
      body: formData
    });
    return res.json();
  }
};
