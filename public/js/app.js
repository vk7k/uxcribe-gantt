// Main Application Controller for uxcribe-gantt
class AppController {
  constructor() {
    this.projects = [];
    this.currentProject = null;
    this.currentView = "gantt";
    this.ganttGrid = null;
    this.ganttTimeline = null;
    this.openProjectIds = new Set();
    this.init();
  }

  async init() {
    // 1. Initialize real-time socket
    if (window.syncSocket) {
      window.syncSocket.init();
    }

    // 2. Initialize Gantt components
    this.ganttGrid = new window.GanttGrid("gantt-grid-rows-container");
    this.ganttTimeline = new window.GanttTimeline(this.ganttGrid);
    window.ganttGrid = this.ganttGrid;
    window.ganttTimeline = this.ganttTimeline;

    // 3. Bind UI event listeners
    this.bindEvents();

    // 4. Load projects list & restore open tabs
    await this.loadProjects();

    // 5. Select initial project (from URL hash, first open tab, or first project)
    const hash = window.location.hash.replace("#", "");
    const initialId = hash ? parseInt(hash) : (Array.from(this.openProjectIds)[0] || this.projects[0]?.id || 1);
    await this.openProjectInTab(initialId);
  }

  bindEvents() {
    // Views Switcher
    document.querySelectorAll(".view-nav-item").forEach(item => {
      item.addEventListener("click", () => {
        const view = item.dataset.view;
        this.switchView(view);
      });
    });

    // Zoom Buttons
    document.querySelectorAll(".zoom-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".zoom-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.ganttTimeline.setZoom(btn.dataset.zoom);
      });
    });

    // Task Search / Filter
    const filterInput = document.getElementById("task-filter-input");
    filterInput?.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!this.currentProject) return;

      if (!q) {
        this.ganttGrid.setTasks(this.currentProject.tasks);
        this.ganttTimeline.setData(this.currentProject.tasks, this.extractDependencies(this.currentProject.tasks));
      } else {
        const filtered = this.currentProject.tasks.filter(t =>
          t.name.toLowerCase().includes(q) ||
          (t.assignedTo && t.assignedTo.toLowerCase().includes(q)) ||
          (t.tags && t.tags.toLowerCase().includes(q))
        );
        this.ganttGrid.setTasks(filtered);
        this.ganttTimeline.setData(filtered, this.extractDependencies(filtered));
      }
    });

    // Quick Add Task / Phase / Milestone
    document.getElementById("btn-add-task-quick")?.addEventListener("click", () => this.quickAddTask(false));
    document.getElementById("btn-add-phase-quick")?.addEventListener("click", () => this.quickAddTask(true, false));
    document.getElementById("btn-add-milestone-quick")?.addEventListener("click", () => this.quickAddTask(false, true));

    // Move Up / Down
    document.getElementById("btn-move-task-up")?.addEventListener("click", () => {
      const selected = this.ganttGrid.getSelectedTask();
      if (selected) this.ganttGrid.moveTaskUp(selected.id);
      else this.showToast("Selecciona una tarea primero", "info");
    });
    document.getElementById("btn-move-task-down")?.addEventListener("click", () => {
      const selected = this.ganttGrid.getSelectedTask();
      if (selected) this.ganttGrid.moveTaskDown(selected.id);
      else this.showToast("Selecciona una tarea primero", "info");
    });

    // Indent / Outdent
    document.getElementById("btn-indent-task")?.addEventListener("click", () => this.indentSelectedTask());
    document.getElementById("btn-outdent-task")?.addEventListener("click", () => this.outdentSelectedTask());

    // Delete Selected
    document.getElementById("btn-delete-selected")?.addEventListener("click", () => this.deleteSelectedTask());

    // New Project Modal
    const modalNewProject = document.getElementById("modal-new-project-overlay");
    document.getElementById("btn-open-new-project-modal")?.addEventListener("click", () => {
      modalNewProject.classList.add("active");
      document.getElementById("new-project-name").focus();
    });
    document.getElementById("btn-close-new-project-modal")?.addEventListener("click", () => {
      modalNewProject.classList.remove("active");
    });
    document.getElementById("btn-cancel-new-project")?.addEventListener("click", () => {
      modalNewProject.classList.remove("active");
    });

    // Color Swatches in New Project Modal
    const newProjColors = document.getElementById("new-project-color-picker");
    newProjColors?.querySelectorAll(".color-swatch-dot").forEach(dot => {
      dot.addEventListener("click", () => {
        newProjColors.querySelectorAll(".color-swatch-dot").forEach(d => d.classList.remove("active"));
        dot.classList.add("active");
      });
    });

    // Create Project Submit
    document.getElementById("btn-create-project-submit")?.addEventListener("click", async () => {
      const name = document.getElementById("new-project-name").value.trim();
      const desc = document.getElementById("new-project-desc").value.trim();
      const activeDot = newProjColors?.querySelector(".color-swatch-dot.active");
      const color = activeDot ? activeDot.dataset.color : "#0284c7";

      if (!name) {
        alert("Por favor ingresa un nombre para el proyecto.");
        return;
      }

      try {
        const created = await API.createProject({ name, description: desc, color });
        modalNewProject.classList.remove("active");
        document.getElementById("new-project-name").value = "";
        document.getElementById("new-project-desc").value = "";
        this.showToast("Proyecto creado exitosamente", "success");
        await this.loadProjects();
        await this.openProjectInTab(created.id);
      } catch (err) {
        console.error("Error creating project:", err);
      }
    });

    // Export Project
    document.getElementById("btn-export-project")?.addEventListener("click", () => {
      if (this.currentProject) {
        window.open(API.exportProjectUrl(this.currentProject.id), "_blank");
      }
    });

    // Import Project Handlers
    const fileInput = document.getElementById("input-import-json-file");
    document.getElementById("btn-import-project")?.addEventListener("click", () => {
      if (fileInput) fileInput.click();
    });
    document.getElementById("btn-mgr-import-project")?.addEventListener("click", () => {
      if (fileInput) fileInput.click();
    });

    fileInput?.addEventListener("change", async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        await this.importProjectFile(file);
        fileInput.value = "";
      }
    });

    // Project Manager Modal
    document.getElementById("btn-open-projects-manager")?.addEventListener("click", () => {
      this.openProjectsManager();
    });
    document.getElementById("btn-close-projects-manager")?.addEventListener("click", () => {
      this.closeProjectsManager();
    });
    document.getElementById("modal-manage-projects-overlay")?.addEventListener("click", (e) => {
      if (e.target.id === "modal-manage-projects-overlay") this.closeProjectsManager();
    });

    document.getElementById("btn-mgr-new-project")?.addEventListener("click", () => {
      this.closeProjectsManager();
      modalNewProject.classList.add("active");
      document.getElementById("new-project-name").focus();
    });

    document.getElementById("input-search-projects")?.addEventListener("input", (e) => {
      this.renderProjectsManagerList(e.target.value.toLowerCase().trim());
    });
  }

  async loadProjects() {
    try {
      this.projects = await API.getProjects();
      
      // Load stored open tab IDs
      const savedTabs = localStorage.getItem("uxcribe_open_tabs");
      if (savedTabs) {
        try {
          const parsed = JSON.parse(savedTabs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.openProjectIds = new Set(parsed);
          }
        } catch (e) {}
      }

      // If no open tabs stored or valid, open all existing projects by default
      if (this.openProjectIds.size === 0) {
        this.projects.forEach(p => this.openProjectIds.add(p.id));
      }

      this.renderProjectTabs();
    } catch (err) {
      console.error("Error loading projects:", err);
    }
  }

  saveOpenTabs() {
    localStorage.setItem("uxcribe_open_tabs", JSON.stringify(Array.from(this.openProjectIds)));
  }

  renderProjectTabs() {
    const tabsContainer = document.getElementById("project-tabs-list");
    if (!tabsContainer) return;
    tabsContainer.innerHTML = "";

    const visibleProjects = this.projects.filter(p => this.openProjectIds.has(p.id));

    visibleProjects.forEach(p => {
      const tab = document.createElement("div");
      const isActive = this.currentProject && this.currentProject.id === p.id;
      tab.className = `project-tab-item ${isActive ? "active" : ""}`;
      tab.dataset.projectId = p.id;
      
      tab.innerHTML = `
        <span style="width:8px; height:8px; border-radius:50%; background:${p.color || "#0284c7"}; flex-shrink:0;"></span>
        <span style="overflow:hidden; text-overflow:ellipsis; max-width:140px;">${p.name}</span>
        <span class="project-tab-close-btn" title="Cerrar pestaña">✕</span>
      `;

      tab.addEventListener("click", (e) => {
        if (e.target.classList.contains("project-tab-close-btn")) {
          e.stopPropagation();
          this.closeProjectTab(p.id);
          return;
        }
        this.selectProject(p.id);
      });

      tabsContainer.appendChild(tab);
    });
  }

  async openProjectInTab(projectId) {
    this.openProjectIds.add(projectId);
    this.saveOpenTabs();
    this.closeProjectsManager();
    await this.selectProject(projectId);
  }

  async closeProjectTab(projectId) {
    this.openProjectIds.delete(projectId);
    this.saveOpenTabs();

    if (this.currentProject && this.currentProject.id === projectId) {
      const remainingIds = Array.from(this.openProjectIds);
      if (remainingIds.length > 0) {
        await this.selectProject(remainingIds[0]);
      } else {
        this.currentProject = null;
        this.renderProjectTabs();
        this.openProjectsManager();
      }
    } else {
      this.renderProjectTabs();
    }
  }

  async selectProject(projectId) {
    try {
      const project = await API.getProject(projectId);
      this.currentProject = project;
      window.location.hash = `#${projectId}`;

      // Update Topbar indicator
      document.getElementById("current-project-name").textContent = project.name;
      document.getElementById("current-project-color").style.background = project.color || "#0284c7";

      // Join real-time socket room
      if (window.syncSocket) {
        window.syncSocket.joinProject(projectId);
      }

      // Update Tabs styling
      this.renderProjectTabs();

      // Render Active View
      this.renderCurrentView();
    } catch (err) {
      console.error("Error selecting project:", err);
      if (this.projects.length > 0 && this.projects[0].id !== projectId) {
        this.selectProject(this.projects[0].id);
      }
    }
  }

  openProjectsManager() {
    const modal = document.getElementById("modal-manage-projects-overlay");
    if (!modal) return;
    modal.classList.add("active");
    this.renderProjectsManagerList();
  }

  closeProjectsManager() {
    const modal = document.getElementById("modal-manage-projects-overlay");
    if (modal) modal.classList.remove("active");
  }

  async renderProjectsManagerList(searchQuery = "") {
    const listContainer = document.getElementById("projects-manager-list");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    try {
      this.projects = await API.getProjects();
      const filtered = this.projects.filter(p =>
        !searchQuery || p.name.toLowerCase().includes(searchQuery)
      );

      if (filtered.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8; font-size:13px;">No se encontraron proyectos.</div>`;
        return;
      }

      filtered.forEach(p => {
        const row = document.createElement("div");
        row.className = "project-card-row";
        const isOpen = this.openProjectIds.has(p.id);
        const taskCount = p._count?.tasks ?? (p.tasks?.length || 0);

        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="width:12px; height:12px; border-radius:50%; background:${p.color || "#0284c7"};"></span>
            <div>
              <div style="font-weight:600; font-size:14px; color:#1e293b;">${p.name}</div>
              <div style="font-size:12px; color:#64748b;">${taskCount} elementos • Creado el ${new Date(p.createdAt).toLocaleDateString("es-ES")}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-sm btn-open-card" style="padding:6px 12px; font-size:12px; background:${isOpen ? "#e0f2fe" : "#0284c7"}; color:${isOpen ? "#0369a1" : "#ffffff"}; border:none; border-radius:6px; cursor:pointer; font-weight:600;">
              ${isOpen ? "En Pestaña" : "Abrir Pestaña"}
            </button>
            <a href="${API.exportProjectUrl(p.id)}" class="btn btn-sm" style="padding:6px 10px; font-size:12px; background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; border-radius:6px; text-decoration:none; display:flex; align-items:center;" title="Exportar JSON" download>
              ⬇
            </a>
            <button class="btn btn-sm btn-delete-card" style="padding:6px 10px; font-size:12px; background:#fee2e2; color:#ef4444; border:none; border-radius:6px; cursor:pointer;" title="Eliminar proyecto">
              ✕
            </button>
          </div>
        `;

        row.querySelector(".btn-open-card").addEventListener("click", () => {
          this.openProjectInTab(p.id);
        });

        row.querySelector(".btn-delete-card").addEventListener("click", async () => {
          if (confirm(`¿Estás seguro de eliminar el proyecto "${p.name}" y todas sus tareas?`)) {
            await API.deleteProject(p.id);
            this.openProjectIds.delete(p.id);
            this.saveOpenTabs();
            this.showToast("Proyecto eliminado", "success");
            await this.loadProjects();
            this.renderProjectsManagerList(searchQuery);
            if (this.currentProject?.id === p.id) {
              const remaining = this.projects.filter(x => x.id !== p.id);
              if (remaining.length > 0) this.openProjectInTab(remaining[0].id);
            }
          }
        });

        listContainer.appendChild(row);
      });
    } catch (err) {
      console.error("Error rendering projects list:", err);
    }
  }

  async importProjectFile(file) {
    try {
      this.showToast("Validando e importando paquete de proyecto...", "info");
      const imported = await API.importProjectPackage(file);
      this.showToast(`Proyecto "${imported.name}" importado con éxito`, "success");

      await this.loadProjects();
      await this.openProjectInTab(imported.id);
    } catch (err) {
      console.error("Error importing project file:", err);
      alert(err.message || "Error al importar el archivo: formato no válido o archivo corrupto.");
    }
  }

  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll(".view-nav-item").forEach(item => {
      if (item.dataset.view === viewName) item.classList.add("active");
      else item.classList.remove("active");
    });

    document.querySelectorAll(".view-pane").forEach(pane => {
      if (pane.id === `pane-${viewName}`) pane.classList.add("active");
      else pane.classList.remove("active");
    });

    // Toolbar visibility
    const toolbar = document.getElementById("gantt-view-toolbar");
    if (toolbar) {
      toolbar.style.display = viewName === "gantt" ? "flex" : "none";
    }

    this.renderCurrentView();
  }

  renderCurrentView() {
    if (!this.currentProject) return;

    if (this.currentView === "gantt") {
      const deps = this.extractDependencies(this.currentProject.tasks);
      this.ganttGrid.setTasks(this.currentProject.tasks);
      this.ganttTimeline.setData(this.currentProject.tasks, deps);
    } else if (this.currentView === "dashboard") {
      window.DashboardViews.renderDashboard(this.currentProject.id);
    } else if (this.currentView === "calendar") {
      window.DashboardViews.renderCalendar(this.currentProject);
    } else if (this.currentView === "files") {
      window.DashboardViews.renderFiles(this.currentProject);
    } else if (this.currentView === "discuss") {
      window.DashboardViews.renderDiscuss(this.currentProject);
    }
  }

  extractDependencies(tasks) {
    const deps = [];
    (tasks || []).forEach(t => {
      (t.predecessors || []).forEach(d => deps.push(d));
    });
    return deps;
  }

  async refreshData() {
    if (!this.currentProject) return;
    const refreshed = await API.getProject(this.currentProject.id);
    this.currentProject = refreshed;
    this.renderCurrentView();
  }

  async refreshDataSilently() {
    if (!this.currentProject) return;
    const refreshed = await API.getProject(this.currentProject.id);
    this.currentProject = refreshed;
    if (this.currentView === "gantt") {
      const deps = this.extractDependencies(this.currentProject.tasks);
      this.ganttGrid.setTasks(this.currentProject.tasks);
      this.ganttTimeline.setData(this.currentProject.tasks, deps);
    }
  }

  async updateTaskDates(taskId, startDate, endDate) {
    try {
      await API.moveTask(taskId, { startDate, endDate });
      await this.refreshData();
    } catch (err) {
      console.error("Error moving task:", err);
    }
  }

  async updateTaskProgressQuick(taskId, progress) {
    try {
      await API.updateTask(taskId, { progress });
      await this.refreshData();
    } catch (err) {
      console.error("Error updating progress:", err);
    }
  }

  async quickAddTask(isPhase = false, isMilestone = false) {
    if (!this.currentProject) return;

    let parentId = null;
    const selected = this.ganttGrid.getSelectedTask();
    if (selected) {
      if (selected.isPhase) parentId = selected.id;
      else if (selected.parentId) parentId = selected.parentId;
    }

    const defaultName = isPhase
      ? `${(this.currentProject.tasks.filter(t => t.isPhase).length + 1)}. Nueva Fase`
      : isMilestone
      ? "Nuevo Hito Clave"
      : "Nueva Tarea";

    const now = new Date();
    const endDate = isMilestone ? now : new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    try {
      const created = await API.createTask({
        projectId: this.currentProject.id,
        parentId,
        name: defaultName,
        startDate: now,
        endDate,
        progress: 0,
        color: isPhase ? "#64748b" : (isMilestone ? "#0ea5e9" : "#0284c7"),
        isPhase,
        isMilestone,
        assignedTo: isPhase ? "" : "Sin Asignar"
      });

      this.showToast("Tarea creada", "success");
      await this.refreshData();
      this.ganttGrid.selectTask(created.id);
      if (window.TaskModal) {
        window.TaskModal.open(created.id);
      }
    } catch (err) {
      console.error("Error creating quick task:", err);
    }
  }

  async indentSelectedTask() {
    const selected = this.ganttGrid.getSelectedTask();
    if (!selected || selected.isPhase) {
      this.showToast("Selecciona una tarea para indentar", "info");
      return;
    }

    const tasks = this.currentProject.tasks;
    const idx = tasks.findIndex(t => t.id === selected.id);
    if (idx <= 0) return;

    for (let i = idx - 1; i >= 0; i--) {
      if (tasks[i].isPhase) {
        await API.updateTask(selected.id, { parentId: tasks[i].id });
        this.showToast("Subtarea asignada a la fase", "success");
        await this.refreshData();
        break;
      }
    }
  }

  async outdentSelectedTask() {
    const selected = this.ganttGrid.getSelectedTask();
    if (!selected || !selected.parentId) {
      this.showToast("La tarea ya no tiene nivel superior", "info");
      return;
    }

    await API.updateTask(selected.id, { parentId: null });
    this.showToast("Tarea des-indentada", "success");
    await this.refreshData();
  }

  async deleteSelectedTask() {
    if (this.ganttGrid) {
      await this.ganttGrid.deleteSelectedTasks();
    }
  }

  // Socket Remote Event Handlers
  handleRemoteTaskCreated(task) {
    this.showToast(`Nueva tarea: "${task.name}"`, "info");
    this.refreshDataSilently();
  }

  handleRemoteTaskUpdated(task) {
    this.refreshDataSilently();
  }

  handleRemoteTaskMoved(task) {
    this.refreshDataSilently();
  }

  handleRemoteTaskDeleted(taskId) {
    this.refreshDataSilently();
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast-item";

    let icon = "ℹ️";
    if (type === "success") icon = "✓";
    else if (type === "error") icon = "⚠️";

    toast.innerHTML = `<span style="font-weight:700;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.App = new AppController();
});
