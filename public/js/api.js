// REST API client for uxcribe-gantt with JWT Authentication
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

  async request(url, options = {}) {
    options.headers = options.headers || {};
    const token = this.getToken();
    if (token && !options.headers["Authorization"]) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, options);

    if (res.status === 401) {
      this.logout();
      if (window.Auth) {
        window.Auth.currentUser = null;
        window.Auth.renderUserBadge();
        window.Auth.showAuthGate();
      }
      throw new Error("No autorizado. Inicia sesión para continuar.");
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Error en la solicitud");
    }
    return data;
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
      if (!res.ok) {
        this.setToken(null);
        return null;
      }
      const data = await res.json();
      return data.user;
    } catch (e) {
      return null;
    }
  },

  async getUsers() {
    try {
      return await this.request("/api/auth/users");
    } catch (e) {
      return [];
    }
  },

  async updateProfile(profileData) {
    return await this.request("/api/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileData)
    });
  },

  logout() {
    this.setToken(null);
  },

  // Workspaces
  async getWorkspaces() {
    return await this.request("/api/workspaces");
  },

  async createWorkspace(data) {
    return await this.request("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  },

  async shareWorkspace(id, email, role = "EDITOR") {
    return await this.request(`/api/workspaces/${id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role })
    });
  },

  async removeWorkspaceMember(workspaceId, userId) {
    return await this.request(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: "DELETE"
    });
  },

  // Project Sharing & Members
  async shareProject(id, email, role = "EDITOR") {
    return await this.request(`/api/projects/${id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role })
    });
  },

  async getProjectMembers(id) {
    return await this.request(`/api/projects/${id}/members`);
  },

  async removeProjectMember(projectId, userId) {
    return await this.request(`/api/projects/${projectId}/members/${userId}`, {
      method: "DELETE"
    });
  },

  // Projects
  async importProjectPackage(file) {
    const formData = new FormData();
    formData.append("file", file);
    return await this.request("/api/projects/import", {
      method: "POST",
      body: formData
    });
  },

  async importProject(projectData) {
    return await this.request("/api/projects/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectData)
    });
  },

  exportProjectUrl(id) {
    const token = this.getToken();
    return `/api/projects/${id}/export${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  },

  async getProjects() {
    return await this.request("/api/projects");
  },

  async getProject(id) {
    return await this.request(`/api/projects/${id}`);
  },

  async createProject(data) {
    return await this.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  },

  async updateProject(id, data) {
    return await this.request(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  },

  async deleteProject(id) {
    return await this.request(`/api/projects/${id}`, { method: "DELETE" });
  },

  async getProjectStats(id) {
    return await this.request(`/api/projects/${id}/stats`);
  },

  // Tasks
  async getTask(id) {
    return await this.request(`/api/tasks/${id}`);
  },

  async createTask(data) {
    return await this.request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  },

  async updateTask(id, data) {
    return await this.request(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  },

  async moveTask(id, data) {
    return await this.request(`/api/tasks/${id}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  },

  async reorderTasks(projectId, tasksOrder) {
    return await this.request("/api/tasks/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, tasksOrder })
    });
  },

  async bulkMoveTasks(projectId, moves) {
    return await this.request("/api/tasks/bulk-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, moves })
    });
  },

  async bulkDeleteTasks(projectId, taskIds) {
    return await this.request("/api/tasks/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, taskIds })
    });
  },

  async deleteTask(id) {
    return await this.request(`/api/tasks/${id}`, { method: "DELETE" });
  },

  // Comments
  async addComment(taskId, data) {
    return await this.request(`/api/comments/task/${taskId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  },

  async deleteComment(id) {
    return await this.request(`/api/comments/${id}`, { method: "DELETE" });
  },

  // Attachments
  async uploadAttachment(taskId, file) {
    const formData = new FormData();
    formData.append("file", file);
    return await this.request(`/api/attachments/task/${taskId}`, {
      method: "POST",
      body: formData
    });
  },

  async deleteAttachment(id) {
    return await this.request(`/api/attachments/${id}`, { method: "DELETE" });
  },

  // Checklists
  async addChecklistItem(taskId, text) {
    return await this.request(`/api/checklists/task/${taskId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
  },

  async toggleChecklistItem(id) {
    return await this.request(`/api/checklists/${id}/toggle`, { method: "PATCH" });
  },

  async deleteChecklistItem(id) {
    return await this.request(`/api/checklists/${id}`, { method: "DELETE" });
  },

  // Dependencies
  async createDependency(data) {
    return await this.request("/api/dependencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  },

  async deleteDependency(id) {
    return await this.request(`/api/dependencies/${id}`, { method: "DELETE" });
  }
};

window.API = API;
