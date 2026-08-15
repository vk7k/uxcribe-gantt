// Trello-Style Task Card Modal Manager
class TaskModalManager {
  constructor() {
    this.currentTask = null;
    this.tagsList = [];
    this.richEditor = null;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.overlay = document.getElementById("task-card-modal-overlay");
    this.modal = document.getElementById("task-card-modal");
    this.accentBar = document.getElementById("tc-accent-bar");
    this.phaseBadge = document.getElementById("tc-phase-name");
    this.titleInput = document.getElementById("tc-title-input");
    this.startDateInput = document.getElementById("tc-start-date");
    this.endDateInput = document.getElementById("tc-end-date");
    this.progressSlider = document.getElementById("tc-progress-slider");
    this.progressVal = document.getElementById("tc-progress-val");
    this.assigneeInput = document.getElementById("tc-assignee-input");
    this.colorPicker = document.getElementById("tc-color-picker");
    this.tagsContainer = document.getElementById("tc-tags-container");
    this.tagInput = document.getElementById("tc-tag-input");

    this.tabButtons = document.querySelectorAll(".card-nav-tab");
    this.tabPanes = document.querySelectorAll(".card-tab-pane");

    const editorElem = document.getElementById("tc-rich-editor");
    if (editorElem && window.RichEditor) {
      this.richEditor = new window.RichEditor(editorElem);
    }

    this.dropzone = document.getElementById("tc-attachments-dropzone");
    this.fileInput = document.getElementById("tc-attachment-file-input");
    this.attachmentsGrid = document.getElementById("tc-attachments-grid");

    this.checklistItemsList = document.getElementById("tc-checklist-items");
    this.checklistFill = document.getElementById("tc-checklist-progress-fill");
    this.checklistPctText = document.getElementById("tc-checklist-pct");
    this.newChecklistInput = document.getElementById("tc-new-checklist-text");

    this.commentText = document.getElementById("tc-new-comment-text");
    this.commentsStream = document.getElementById("tc-comments-stream");
    this.postCommentBtn = document.getElementById("btn-post-comment");

    this.predecessorsList = document.getElementById("tc-predecessors-list");
    this.successorsList = document.getElementById("tc-successors-list");
    this.depTargetSelect = document.getElementById("tc-dep-target-task-select");
    this.depTypeSelect = document.getElementById("tc-dep-type-select");
  }

  bindEvents() {
    document.getElementById("btn-close-task-modal")?.addEventListener("click", () => this.close());
    document.getElementById("btn-cancel-task-card")?.addEventListener("click", () => this.close());
    this.overlay?.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.getElementById("btn-save-task-card")?.addEventListener("click", () => this.save());
    document.getElementById("btn-delete-task-from-card")?.addEventListener("click", () => this.delete());

    this.progressSlider?.addEventListener("input", (e) => {
      this.progressVal.textContent = e.target.value + "%";
    });

    this.tagInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const val = this.tagInput.value.trim().replace(/^,|,$/g, "");
        if (val && !this.tagsList.includes(val)) {
          this.tagsList.push(val);
          this.renderTags();
          this.tagInput.value = "";
        }
      }
    });

    this.tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    if (this.dropzone && this.fileInput) {
      this.dropzone.addEventListener("click", () => this.fileInput.click());
      this.fileInput.addEventListener("change", async (e) => {
        if (e.target.files && e.target.files.length > 0) {
          for (const file of e.target.files) {
            await this.uploadFile(file);
          }
          this.fileInput.value = "";
        }
      });

      this.dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        this.dropzone.classList.add("dragover");
      });
      this.dropzone.addEventListener("dragleave", () => {
        this.dropzone.classList.remove("dragover");
      });
      this.dropzone.addEventListener("drop", async (e) => {
        e.preventDefault();
        this.dropzone.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          for (const file of e.dataTransfer.files) {
            await this.uploadFile(file);
          }
        }
      });
    }

    document.getElementById("btn-add-checklist-item")?.addEventListener("click", () => this.addChecklistItem());
    this.newChecklistInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.addChecklistItem();
    });

    this.postCommentBtn?.addEventListener("click", () => this.postComment());
    document.getElementById("btn-add-dependency")?.addEventListener("click", () => this.addDependency());

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.overlay.classList.contains("active")) {
        this.close();
      }
    });
  }

  switchTab(tabName) {
    this.tabButtons.forEach(b => {
      if (b.dataset.tab === tabName) b.classList.add("active");
      else b.classList.remove("active");
    });
    this.tabPanes.forEach(p => {
      if (p.id === "tc-pane-" + tabName) p.classList.add("active");
      else p.classList.remove("active");
    });
  }

  async open(taskId) {
    try {
      const task = await API.getTask(taskId);
      this.currentTask = task;
      this.populateData(task);
      this.overlay.classList.add("active");
      this.switchTab("desc");
    } catch (err) {
      console.error("Error opening task modal:", err);
      if (window.App) window.App.showToast("Error al cargar la tarea", "error");
    }
  }

  close() {
    this.overlay.classList.remove("active");
    this.currentTask = null;
  }

  renderColorPicker(isPhase, selectedColor) {
    this.colorPicker.innerHTML = "";
    const colors = isPhase
      ? [
          { color: "#334155", title: "Pizarra Oscura" },
          { color: "#1e3a5f", title: "Azul Marino Oscuro" },
          { color: "#14532d", title: "Verde Bosque Oscuro" },
          { color: "#78350f", title: "Bronce / Ámbar Oscuro" },
          { color: "#7f1d1d", title: "Vino Tinto Oscuro" },
          { color: "#4c1d95", title: "Púrpura Oscuro" },
          { color: "#134e4a", title: "Petróleo Oscuro" },
          { color: "#0f172a", title: "Medianoche" }
        ]
      : [
          { color: "#0284c7", title: "Azul Océano" },
          { color: "#22c55e", title: "Verde Éxito" },
          { color: "#f59e0b", title: "Ámbar" },
          { color: "#ef4444", title: "Rojo Coral" },
          { color: "#8b5cf6", title: "Púrpura" },
          { color: "#06b6d4", title: "Cyan" },
          { color: "#64748b", title: "Gris Pizarra" }
        ];

    colors.forEach(item => {
      const dot = document.createElement("div");
      const isActive = item.color.toLowerCase() === (selectedColor || "").toLowerCase();
      dot.className = "color-swatch-dot" + (isActive ? " active" : "");
      dot.style.background = item.color;
      dot.dataset.color = item.color;
      dot.title = item.title;

      dot.addEventListener("click", () => {
        this.colorPicker.querySelectorAll(".color-swatch-dot").forEach(d => d.classList.remove("active"));
        dot.classList.add("active");
        this.accentBar.style.background = item.color;
      });

      this.colorPicker.appendChild(dot);
    });

    if (!this.colorPicker.querySelector(".color-swatch-dot.active")) {
      const first = this.colorPicker.querySelector(".color-swatch-dot");
      if (first) first.classList.add("active");
    }
  }

  populateData(task) {
    if (task.parent) {
      this.phaseBadge.textContent = task.parent.name;
      this.phaseBadge.style.display = "flex";
    } else if (task.isPhase) {
      this.phaseBadge.textContent = "Fase / Proceso";
      this.phaseBadge.style.display = "flex";
    } else {
      this.phaseBadge.textContent = "Tarea Independiente";
      this.phaseBadge.style.display = "flex";
    }

    const phaseSelect = document.getElementById("tc-parent-phase-select");
    const phaseContainer = document.getElementById("tc-parent-phase-container");
    if (phaseSelect && phaseContainer) {
      if (task.isPhase) {
        phaseContainer.style.display = "none";
      } else {
        phaseContainer.style.display = "flex";
        phaseSelect.innerHTML = "";
        const defaultOpt = document.createElement("option");
        defaultOpt.value = "";
        defaultOpt.textContent = "(Sin fase / Independiente)";
        phaseSelect.appendChild(defaultOpt);

        const allPhases = (window.App?.currentProject?.tasks || []).filter(t => t.isPhase && t.id !== task.id);
        allPhases.forEach(p => {
          const opt = document.createElement("option");
          opt.value = String(p.id);
          opt.textContent = p.name;
          if (task.parentId === p.id) opt.selected = true;
          phaseSelect.appendChild(opt);
        });
      }
    }

    this.titleInput.value = task.name || "";

    const color = task.color || (task.isPhase ? "#334155" : "#0284c7");
    this.accentBar.style.background = color;
    this.renderColorPicker(task.isPhase, color);

    this.startDateInput.value = task.startDate ? new Date(task.startDate).toISOString().split("T")[0] : "";
    this.endDateInput.value = task.endDate ? new Date(task.endDate).toISOString().split("T")[0] : "";

    const prog = task.progress || 0;
    this.progressSlider.value = prog;
    this.progressVal.textContent = prog + "%";

    this.assigneeInput.value = task.assignedTo || "";

    this.tagsList = task.tags ? task.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    this.renderTags();

    if (this.richEditor) {
      this.richEditor.setHTML(task.description || "");
    }

    this.renderAttachments(task.attachments || []);
    this.renderChecklist(task.checklists || []);
    this.renderComments(task.comments || []);
    this.renderDependencies(task);
  }

  renderTags() {
    this.tagsContainer.querySelectorAll(".tag-chip").forEach(c => c.remove());
    this.tagsList.forEach((tag, idx) => {
      const chip = document.createElement("div");
      chip.className = "tag-chip";
      chip.innerHTML = "<span>" + tag + "</span><span class=\"tag-chip-remove\" data-idx=\"" + idx + "\">✕</span>";
      chip.querySelector(".tag-chip-remove").addEventListener("click", () => {
        this.tagsList.splice(idx, 1);
        this.renderTags();
      });
      this.tagsContainer.insertBefore(chip, this.tagInput);
    });
  }

  renderAttachments(attachments) {
    this.attachmentsGrid.innerHTML = "";
    document.getElementById("tc-badge-attachments-count").textContent = String(attachments.length);

    attachments.forEach(att => {
      const card = document.createElement("div");
      card.className = "attachment-card";

      const ext = att.fileName.split(".").pop().toUpperCase();
      const sizeFormatted = att.fileSize > 1024 * 1024
        ? (att.fileSize / (1024 * 1024)).toFixed(1) + " MB"
        : Math.round(att.fileSize / 1024) + " KB";
      const dateFormatted = new Date(att.createdAt).toLocaleDateString("es-ES");

      card.innerHTML = "<div class=\"attachment-icon-box\"><strong>" + ext.slice(0, 4) + "</strong></div>" +
        "<div class=\"attachment-info\"><div class=\"attachment-name\" title=\"" + att.originalName + "\">" + att.originalName + "</div>" +
        "<div class=\"attachment-meta\">" + sizeFormatted + " • " + dateFormatted + "</div></div>" +
        "<div class=\"attachment-actions\">" +
        "<a href=\"/api/attachments/" + att.id + "/download\" class=\"attachment-action-btn\" title=\"Descargar\" download>" +
        "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path><polyline points=\"7 10 12 15 17 10\"></polyline><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"></line></svg>" +
        "</a>" +
        "<button class=\"attachment-action-btn btn-delete\" data-att-id=\"" + att.id + "\" title=\"Eliminar\">" +
        "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><polyline points=\"3 6 5 6 21 6\"></polyline><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"></path></svg>" +
        "</button></div>";

      card.querySelector(".btn-delete").addEventListener("click", async () => {
        if (confirm("¿Eliminar el archivo " + att.originalName + "?")) {
          await API.deleteAttachment(att.id);
          card.remove();
          this.currentTask.attachments = this.currentTask.attachments.filter(a => a.id !== att.id);
          document.getElementById("tc-badge-attachments-count").textContent = String(this.currentTask.attachments.length);
        }
      });

      this.attachmentsGrid.appendChild(card);
    });
  }

  async uploadFile(file) {
    if (!this.currentTask) return;
    try {
      const att = await API.uploadAttachment(this.currentTask.id, file);
      if (!this.currentTask.attachments) this.currentTask.attachments = [];
      this.currentTask.attachments.unshift(att);
      this.renderAttachments(this.currentTask.attachments);
      if (window.App) window.App.showToast("Archivo adjuntado con éxito", "success");
    } catch (err) {
      console.error("Error uploading file:", err);
      alert("Error al subir archivo");
    }
  }

  appendAttachment(att) {
    if (!this.currentTask) return;
    if (!this.currentTask.attachments) this.currentTask.attachments = [];
    this.currentTask.attachments.unshift(att);
    this.renderAttachments(this.currentTask.attachments);
  }

  renderChecklist(items) {
    this.checklistItemsList.innerHTML = "";
    const total = items.length;
    const completed = items.filter(i => i.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    this.checklistFill.style.width = pct + "%";
    this.checklistPctText.textContent = pct + "% (" + completed + " de " + total + ")";
    document.getElementById("tc-badge-checklist-count").textContent = completed + "/" + total;

    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "checklist-item-row" + (item.completed ? " completed" : "");

      row.innerHTML = "<input type=\"checkbox\" class=\"checklist-checkbox\"" + (item.completed ? " checked" : "") + " />" +
        "<span class=\"checklist-text\">" + item.text + "</span>" +
        "<button class=\"checklist-item-delete\" title=\"Eliminar\">✕</button>";

      row.querySelector(".checklist-checkbox").addEventListener("change", async () => {
        const updated = await API.toggleChecklistItem(item.id);
        item.completed = updated.completed;
        this.renderChecklist(items);
      });

      row.querySelector(".checklist-item-delete").addEventListener("click", async () => {
        await API.deleteChecklistItem(item.id);
        this.currentTask.checklists = this.currentTask.checklists.filter(i => i.id !== item.id);
        this.renderChecklist(this.currentTask.checklists);
      });

      this.checklistItemsList.appendChild(row);
    });
  }

  async addChecklistItem() {
    const text = this.newChecklistInput.value.trim();
    if (!text || !this.currentTask) return;

    try {
      const item = await API.addChecklistItem(this.currentTask.id, text);
      if (!this.currentTask.checklists) this.currentTask.checklists = [];
      this.currentTask.checklists.push(item);
      this.renderChecklist(this.currentTask.checklists);
      this.newChecklistInput.value = "";
    } catch (err) {
      console.error("Error adding checklist item:", err);
    }
  }

  updateChecklistItem(item) {
    if (!this.currentTask || !this.currentTask.checklists) return;
    const idx = this.currentTask.checklists.findIndex(i => i.id === item.id);
    if (idx !== -1) {
      this.currentTask.checklists[idx] = item;
      this.renderChecklist(this.currentTask.checklists);
    }
  }

  renderComments(comments) {
    this.commentsStream.innerHTML = "";
    document.getElementById("tc-badge-comments-count").textContent = String(comments.length);

    comments.forEach(com => {
      const card = document.createElement("div");
      card.className = "comment-card";

      const initials = com.authorAvatar || (com.authorName ? com.authorName.slice(0, 2).toUpperCase() : "US");
      const dateFormatted = new Date(com.createdAt).toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "short"
      });

      card.innerHTML = "<div class=\"user-avatar-large\" style=\"background:#4f46e5; width:32px; height:32px; font-size:11px;\">" + initials + "</div>" +
        "<div class=\"comment-bubble\">" +
        "<div class=\"comment-meta-row\">" +
        "<span class=\"comment-author-name\">" + com.authorName + "</span>" +
        "<div style=\"display:flex; align-items:center; gap:8px;\">" +
        "<span class=\"comment-date\">" + dateFormatted + "</span>" +
        "<button class=\"attachment-action-btn btn-delete-comment\" data-com-id=\"" + com.id + "\" title=\"Eliminar\">✕</button>" +
        "</div></div>" +
        "<div class=\"comment-body-text\">" + com.content + "</div>" +
        "</div>";

      card.querySelector(".btn-delete-comment").addEventListener("click", async () => {
        if (confirm("¿Eliminar este comentario?")) {
          await API.deleteComment(com.id);
          card.remove();
          this.currentTask.comments = this.currentTask.comments.filter(c => c.id !== com.id);
          document.getElementById("tc-badge-comments-count").textContent = String(this.currentTask.comments.length);
        }
      });

      this.commentsStream.appendChild(card);
    });
  }

  async postComment() {
    const text = this.commentText.value.trim();
    if (!text || !this.currentTask) return;

    try {
      const com = await API.addComment(this.currentTask.id, {
        authorName: window.syncSocket.userName || "Colaborador",
        content: text
      });
      if (!this.currentTask.comments) this.currentTask.comments = [];
      this.currentTask.comments.push(com);
      this.renderComments(this.currentTask.comments);
      this.commentText.value = "";
      if (window.App) window.App.showToast("Comentario publicado", "success");
    } catch (err) {
      console.error("Error posting comment:", err);
    }
  }

  appendComment(comment) {
    if (!this.currentTask) return;
    if (!this.currentTask.comments) this.currentTask.comments = [];
    if (!this.currentTask.comments.some(c => c.id === comment.id)) {
      this.currentTask.comments.push(comment);
      this.renderComments(this.currentTask.comments);
    }
  }

  renderDependencies(task) {
    this.predecessorsList.innerHTML = "";
    this.successorsList.innerHTML = "";
    this.depTargetSelect.innerHTML = "";

    const allTasks = window.App?.currentProject?.tasks || [];
    allTasks.forEach(t => {
      if (t.id !== task.id && !t.isPhase) {
        const opt = document.createElement("option");
        opt.value = String(t.id);
        opt.textContent = "#" + (t.orderIndex || t.id) + " - " + t.name;
        this.depTargetSelect.appendChild(opt);
      }
    });

    (task.predecessors || []).forEach(dep => {
      const predName = dep.predecessor?.name || ("Tarea #" + dep.predecessorId);
      const chip = document.createElement("div");
      chip.className = "dep-item-chip";
      chip.innerHTML = "<span>Predecesora: <strong>" + predName + "</strong> (" + dep.type + ")</span>" +
        "<button class=\"attachment-action-btn btn-delete-dep\" data-dep-id=\"" + dep.id + "\">✕</button>";
      chip.querySelector(".btn-delete-dep").addEventListener("click", async () => {
        await API.deleteDependency(dep.id);
        chip.remove();
        if (window.App) window.App.refreshData();
      });
      this.predecessorsList.appendChild(chip);
    });

    (task.successors || []).forEach(dep => {
      const succName = dep.successor?.name || ("Tarea #" + dep.successorId);
      const chip = document.createElement("div");
      chip.className = "dep-item-chip";
      chip.innerHTML = "<span>Sucesora: <strong>" + succName + "</strong> (" + dep.type + ")</span>" +
        "<button class=\"attachment-action-btn btn-delete-dep\" data-dep-id=\"" + dep.id + "\">✕</button>";
      chip.querySelector(".btn-delete-dep").addEventListener("click", async () => {
        await API.deleteDependency(dep.id);
        chip.remove();
        if (window.App) window.App.refreshData();
      });
      this.successorsList.appendChild(chip);
    });
  }

  async addDependency() {
    if (!this.currentTask) return;
    const targetId = parseInt(this.depTargetSelect.value);
    const type = this.depTypeSelect.value;
    if (!targetId) return;

    try {
      await API.addDependency(targetId, this.currentTask.id, type);
      if (window.App) {
        window.App.showToast("Dependencia agregada", "success");
        await window.App.refreshData();
        const updated = await API.getTask(this.currentTask.id);
        this.renderDependencies(updated);
      }
    } catch (err) {
      alert("Error al agregar dependencia. Puede que ya exista o sea cíclica.");
    }
  }

  async save() {
    if (!this.currentTask) return;

    const activeColorDot = this.colorPicker.querySelector(".color-swatch-dot.active");
    const color = activeColorDot ? activeColorDot.dataset.color : (this.currentTask.isPhase ? "#334155" : "#0284c7");

    const parentPhaseVal = document.getElementById("tc-parent-phase-select")?.value;
    const parentId = (!this.currentTask.isPhase && parentPhaseVal) ? parseInt(parentPhaseVal) : null;

    const updateData = {
      name: this.titleInput.value.trim() || "Tarea sin título",
      startDate: this.startDateInput.value,
      endDate: this.endDateInput.value,
      progress: parseInt(this.progressSlider.value) || 0,
      assignedTo: this.assigneeInput.value.trim(),
      color,
      tags: this.tagsList.join(","),
      parentId,
      description: this.richEditor ? this.richEditor.getHTML() : ""
    };

    try {
      await API.updateTask(this.currentTask.id, updateData);
      if (window.App) {
        window.App.showToast("Cambios guardados con éxito", "success");
        await window.App.refreshData();
      }
      this.close();
    } catch (err) {
      console.error("Error saving task card:", err);
      if (window.App) window.App.showToast("Error al guardar tarea", "error");
    }
  }

  async delete() {
    if (!this.currentTask) return;
    if (confirm("¿Estás seguro de eliminar la tarea " + this.currentTask.name + "?")) {
      try {
        await API.deleteTask(this.currentTask.id);
        if (window.App) {
          window.App.showToast("Tarea eliminada", "success");
          await window.App.refreshData();
        }
        this.close();
      } catch (err) {
        console.error("Error deleting task:", err);
      }
    }
  }
}

window.TaskModal = new TaskModalManager();