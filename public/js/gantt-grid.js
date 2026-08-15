// Left Spreadsheet Grid for Gantt Chart with Multi-Selection (Shift & Ctrl) and Bulk Deletion
class GanttGrid {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.tasks = [];
    this.collapsedPhases = new Set();
    this.selectedTaskIds = new Set();
    this.lastSelectedTaskId = null;
    this.draggedTaskId = null;
    this.initResizer();
    this.bindKeyboardShortcuts();
    this.bindFloatingBar();
  }

  setTasks(tasks) {
    this.tasks = tasks || [];
    // Prune invalid selected task ids
    const existingIds = new Set(this.tasks.map(t => t.id));
    for (const id of this.selectedTaskIds) {
      if (!existingIds.has(id)) this.selectedTaskIds.delete(id);
    }
    this.render();
    this.updateSelectionUI();
  }

  getVisibleTasks() {
    const visible = [];
    for (const task of this.tasks) {
      if (task.parentId && this.collapsedPhases.has(task.parentId)) {
        continue;
      }
      visible.push(task);
    }
    return visible;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    const visibleTasks = this.getVisibleTasks();

    visibleTasks.forEach((task, index) => {
      const row = document.createElement("div");
      let rowClasses = ["grid-row"];
      if (task.isPhase) rowClasses.push("is-phase");
      if (task.isMilestone) rowClasses.push("is-milestone");
      if (this.selectedTaskIds.has(task.id)) rowClasses.push("selected");
      row.className = rowClasses.join(" ");
      row.dataset.taskId = String(task.id);
      row.draggable = true;

      const startDate = task.startDate ? new Date(task.startDate).toLocaleDateString("es-ES") : "-";
      const endDate = task.endDate ? new Date(task.endDate).toLocaleDateString("es-ES") : "-";
      const isCompleted = (task.progress || 0) === 100;
      const indentLevel = task.parentId ? 24 : 8;

      let iconHtml = "";
      if (task.isPhase) {
        const isCollapsed = this.collapsedPhases.has(task.id);
        const btnText = isCollapsed ? "▶" : "▼";
        const btnTitle = isCollapsed ? "Expandir" : "Colapsar";
        iconHtml = "<button class=\"phase-toggle-btn\" data-phase-id=\"" + task.id + "\" title=\"" + btnTitle + "\">" + btnText + "</button>";
      } else if (task.isMilestone) {
        const c = task.color || "#0ea5e9";
        iconHtml = "<span style=\"color:" + c + "; font-size:10px; margin-right:4px;\">◆</span>";
      } else {
        const c = task.color || "#0284c7";
        iconHtml = "<span class=\"phase-bar-color-dot\" style=\"background:" + c + ";\"></span>";
      }

      let assigneeHtml = "-";
      if (task.assignedTo) {
        const initials = task.assignedTo.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
        assigneeHtml = "<span class=\"avatar-badge\" title=\"" + task.assignedTo + "\">" + initials + "</span><span style=\"overflow:hidden; text-overflow:ellipsis;\">" + task.assignedTo + "</span>";
      }

      row.innerHTML =
        "<div class=\"grid-col col-num\">" +
        "<span class=\"row-drag-handle\" title=\"Arrastra verticalmente para mover de posición o cambiar de fase\">⠿</span>" +
        "<span>" + (index + 1) + "</span>" +
        "</div>" +
        "<div class=\"grid-col col-status\">" +
        "<input type=\"checkbox\"" + (isCompleted ? " checked" : "") + " class=\"task-row-checkbox\" data-task-id=\"" + task.id + "\" title=\"Marcar completada\" />" +
        "</div>" +
        "<div class=\"grid-col col-name\" style=\"padding-left: " + indentLevel + "px;\">" +
        "<div class=\"task-name-cell\">" +
        iconHtml +
        "<span class=\"task-name-text\" title=\"Haz clic para abrir tarjeta\">" + task.name + "</span>" +
        "</div>" +
        "</div>" +
        "<div class=\"grid-col col-start\">" + startDate + "</div>" +
        "<div class=\"grid-col col-end\">" + endDate + "</div>" +
        "<div class=\"grid-col col-assigned\">" + assigneeHtml + "</div>" +
        "<div class=\"grid-col col-progress\">" + (task.progress || 0) + "%</div>";

      row.addEventListener("click", (e) => {
        if (e.target.classList.contains("phase-toggle-btn")) {
          const phaseId = parseInt(e.target.dataset.phaseId);
          this.togglePhaseCollapse(phaseId);
          return;
        }

        if (e.target.classList.contains("task-row-checkbox")) {
          const isChecked = e.target.checked;
          const newProgress = isChecked ? 100 : 0;
          if (window.App) {
            window.App.updateTaskProgressQuick(task.id, newProgress);
          }
          return;
        }

        this.handleRowClick(task.id, e);

        if (e.target.classList.contains("task-name-text") && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
          if (window.TaskModal) {
            window.TaskModal.open(task.id);
          }
        }
      });

      row.addEventListener("dblclick", () => {
        if (window.TaskModal) {
          window.TaskModal.open(task.id);
        }
      });

      this.attachRowDragEvents(row, task);
      this.container.appendChild(row);
    });

    const timelineBody = document.getElementById("timeline-body");
    if (timelineBody && !this.container.hasScrollBound) {
      this.container.hasScrollBound = true;
      this.container.addEventListener("scroll", () => {
        timelineBody.scrollTop = this.container.scrollTop;
      });
      timelineBody.addEventListener("scroll", () => {
        this.container.scrollTop = timelineBody.scrollTop;
      });
    }
  }

  handleRowClick(taskId, e) {
    const visibleTasks = this.getVisibleTasks();

    if (e.ctrlKey || e.metaKey) {
      // Toggle single item in multi-select
      if (this.selectedTaskIds.has(taskId)) {
        this.selectedTaskIds.delete(taskId);
      } else {
        this.selectedTaskIds.add(taskId);
      }
      this.lastSelectedTaskId = taskId;
    } else if (e.shiftKey && this.lastSelectedTaskId) {
      // Range select between lastSelectedTaskId and current taskId
      const lastIdx = visibleTasks.findIndex(t => t.id === this.lastSelectedTaskId);
      const currIdx = visibleTasks.findIndex(t => t.id === taskId);

      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        for (let i = start; i <= end; i++) {
          this.selectedTaskIds.add(visibleTasks[i].id);
        }
      } else {
        this.selectedTaskIds.add(taskId);
        this.lastSelectedTaskId = taskId;
      }
    } else {
      // Single select
      this.selectedTaskIds.clear();
      this.selectedTaskIds.add(taskId);
      this.lastSelectedTaskId = taskId;
    }

    this.updateSelectionUI();
  }

  selectTask(taskId) {
    this.selectedTaskIds.clear();
    this.selectedTaskIds.add(taskId);
    this.lastSelectedTaskId = taskId;
    this.updateSelectionUI();
  }

  clearSelection() {
    this.selectedTaskIds.clear();
    this.lastSelectedTaskId = null;
    this.updateSelectionUI();
  }

  updateSelectionUI() {
    // Highlight rows in table
    this.container.querySelectorAll(".grid-row").forEach(r => {
      const tId = parseInt(r.dataset.taskId);
      if (this.selectedTaskIds.has(tId)) {
        r.classList.add("selected");
      } else {
        r.classList.remove("selected");
      }
    });

    // Highlight corresponding bars on timeline
    const allTimelineElements = document.querySelectorAll(".gantt-bar-item, .gantt-milestone-diamond, .gantt-phase-bar");
    allTimelineElements.forEach(el => {
      const tId = parseInt(el.dataset.taskId);
      if (this.selectedTaskIds.has(tId)) {
        el.classList.add("selected");
      } else {
        el.classList.remove("selected");
      }
    });

    // Floating selection bar update
    const floatingBar = document.getElementById("floating-selection-bar");
    const badge = document.getElementById("selection-count-badge");
    const count = this.selectedTaskIds.size;

    if (floatingBar && badge) {
      badge.textContent = String(count);
      if (count > 1) {
        floatingBar.classList.add("active");
      } else {
        floatingBar.classList.remove("active");
      }
    }

    // Update delete toolbar button title
    const tbDeleteBtn = document.getElementById("btn-delete-task");
    if (tbDeleteBtn) {
      if (count > 1) {
        tbDeleteBtn.title = "Eliminar " + count + " elementos seleccionados";
      } else {
        tbDeleteBtn.title = "Eliminar elemento";
      }
    }
  }

  getSelectedTask() {
    if (this.selectedTaskIds.size === 0) return null;
    const firstId = this.selectedTaskIds.values().next().value;
    return this.tasks.find(t => t.id === firstId);
  }

  getSelectedTasks() {
    return this.tasks.filter(t => this.selectedTaskIds.has(t.id));
  }

  async deleteSelectedTasks() {
    const count = this.selectedTaskIds.size;
    if (count === 0) {
      if (window.App) window.App.showToast("Selecciona una o más tareas para eliminar", "info");
      return;
    }

    const message = count === 1
      ? "¿Estás seguro de eliminar la tarea seleccionada?"
      : "¿Estás seguro de eliminar los " + count + " elementos seleccionados (tareas, fases e hitos)?";

    if (!confirm(message)) return;

    const taskIdsToDelete = Array.from(this.selectedTaskIds);
    try {
      if (window.App && window.App.currentProject) {
        await API.bulkDeleteTasks(window.App.currentProject.id, taskIdsToDelete);
        this.clearSelection();
        window.App.showToast(count + " elementos eliminados con éxito", "success");
        await window.App.refreshData();
      }
    } catch (err) {
      console.error("Error deleting tasks in bulk:", err);
      if (window.App) window.App.showToast("Error al eliminar tareas", "error");
    }
  }

  bindFloatingBar() {
    document.getElementById("btn-bulk-delete-selection")?.addEventListener("click", () => {
      this.deleteSelectedTasks();
    });
    document.getElementById("btn-clear-selection")?.addEventListener("click", () => {
      this.clearSelection();
    });
  }

  bindKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target.tagName || "").toUpperCase();
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) {
          return;
        }
        // Modal open check
        const modalOverlay = document.getElementById("task-card-modal-overlay");
        if (modalOverlay && modalOverlay.classList.contains("active")) {
          return;
        }
        if (this.selectedTaskIds.size > 0) {
          e.preventDefault();
          this.deleteSelectedTasks();
        }
      }
    });
  }

  attachRowDragEvents(row, task) {
    row.addEventListener("dragstart", (e) => {
      this.draggedTaskId = task.id;
      row.classList.add("row-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(task.id));
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!this.draggedTaskId || this.draggedTaskId === task.id) return;

      const rect = row.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const height = rect.height;

      row.classList.remove("drop-above", "drop-below", "drop-inside-phase");

      if (task.isPhase && relY > height * 0.25 && relY < height * 0.75) {
        row.classList.add("drop-inside-phase");
      } else if (relY < height / 2) {
        row.classList.add("drop-above");
      } else {
        row.classList.add("drop-below");
      }
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drop-above", "drop-below", "drop-inside-phase");
    });

    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      const draggedId = parseInt(e.dataTransfer.getData("text/plain") || String(this.draggedTaskId));
      row.classList.remove("drop-above", "drop-below", "drop-inside-phase");

      if (!draggedId || draggedId === task.id) return;

      const rect = row.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const isAbove = relY < rect.height / 2;
      const isInside = task.isPhase && relY >= rect.height * 0.25 && relY <= rect.height * 0.75;

      await this.handleRowDrop(draggedId, task.id, isAbove, isInside);
    });

    row.addEventListener("dragend", () => {
      this.draggedTaskId = null;
      document.querySelectorAll(".grid-row").forEach(r => {
        r.classList.remove("row-dragging", "drop-above", "drop-below", "drop-inside-phase");
      });
    });
  }

  async handleRowDrop(draggedId, targetId, isAbove, isInside) {
    const allTasks = [...this.tasks];
    const draggedIdx = allTasks.findIndex(t => t.id === draggedId);
    if (draggedIdx === -1) return;

    const [draggedTask] = allTasks.splice(draggedIdx, 1);
    const targetIdx = allTasks.findIndex(t => t.id === targetId);
    if (targetIdx === -1) return;

    const targetTask = allTasks[targetIdx];
    let insertIdx = isAbove ? targetIdx : targetIdx + 1;

    let newParentId = null;
    if (draggedTask.isPhase) {
      newParentId = null;
    } else if (isInside) {
      newParentId = targetTask.id;
    } else {
      const prevTask = insertIdx > 0 ? allTasks[insertIdx - 1] : null;
      if (prevTask) {
        if (prevTask.isPhase) {
          newParentId = prevTask.id;
        } else if (prevTask.parentId) {
          newParentId = prevTask.parentId;
        } else {
          newParentId = null;
        }
      } else {
        newParentId = null;
      }
    }

    draggedTask.parentId = newParentId;
    allTasks.splice(insertIdx, 0, draggedTask);

    const tasksOrder = allTasks.map((t, index) => ({
      id: t.id,
      orderIndex: index + 1,
      parentId: t.parentId
    }));

    try {
      if (window.App) {
        await API.reorderTasks(window.App.currentProject.id, tasksOrder);
        window.App.showToast("Posición y jerarquía actualizadas", "success");
        await window.App.refreshData();
      }
    } catch (err) {
      console.error("Error reordering tasks:", err);
    }
  }

  async moveTaskUp(taskId) {
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx <= 0) return;

    const allTasks = [...this.tasks];
    const [task] = allTasks.splice(idx, 1);
    allTasks.splice(idx - 1, 0, task);

    if (!task.isPhase) {
      const prev = allTasks[idx - 2];
      if (prev) {
        task.parentId = prev.isPhase ? prev.id : (prev.parentId || null);
      } else {
        task.parentId = null;
      }
    }

    const tasksOrder = allTasks.map((t, index) => ({
      id: t.id,
      orderIndex: index + 1,
      parentId: t.parentId
    }));

    await API.reorderTasks(window.App.currentProject.id, tasksOrder);
    await window.App.refreshData();
  }

  async moveTaskDown(taskId) {
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx === -1 || idx >= this.tasks.length - 1) return;

    const allTasks = [...this.tasks];
    const [task] = allTasks.splice(idx, 1);
    allTasks.splice(idx + 1, 0, task);

    if (!task.isPhase) {
      const prev = allTasks[idx];
      if (prev) {
        task.parentId = prev.isPhase ? prev.id : (prev.parentId || null);
      } else {
        task.parentId = null;
      }
    }

    const tasksOrder = allTasks.map((t, index) => ({
      id: t.id,
      orderIndex: index + 1,
      parentId: t.parentId
    }));

    await API.reorderTasks(window.App.currentProject.id, tasksOrder);
    await window.App.refreshData();
  }

  togglePhaseCollapse(phaseId) {
    if (this.collapsedPhases.has(phaseId)) {
      this.collapsedPhases.delete(phaseId);
    } else {
      this.collapsedPhases.add(phaseId);
    }
    this.render();
    if (window.ganttTimeline) {
      window.ganttTimeline.render();
    }
  }

  initResizer() {
    const resizer = document.getElementById("gantt-pane-resizer");
    const gridPane = document.getElementById("gantt-grid-pane");
    if (!resizer || !gridPane) return;

    let isResizing = false;

    resizer.addEventListener("mousedown", () => {
      isResizing = true;
      resizer.classList.add("resizing");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    });

    window.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      const containerRect = document.getElementById("gantt-split-container").getBoundingClientRect();
      const newWidth = Math.max(260, Math.min(800, e.clientX - containerRect.left));
      gridPane.style.width = newWidth + "px";
    });

    window.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        resizer.classList.remove("resizing");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    });
  }
}

window.GanttGrid = GanttGrid;