// Right Timeline Engine for Gantt Chart with Multi-Item Dragging & 2D Reordering
class GanttTimeline {
  constructor(grid) {
    this.grid = grid;
    this.zoomLevel = "days";
    this.dayWidth = 34;
    this.rowHeight = 38;
    this.minDate = null;
    this.maxDate = null;
    this.totalDays = 0;
    this.tasks = [];
    this.dependencies = [];
    this.activeDragging = null;
    this.bindHeaderScroll();
  }

  setZoom(zoom) {
    this.zoomLevel = zoom;
    if (zoom === "days") this.dayWidth = 34;
    else if (zoom === "weeks") this.dayWidth = 16;
    else if (zoom === "months") this.dayWidth = 8;
    this.calculateBounds();
    this.render();
  }

  setData(tasks, dependencies = []) {
    this.tasks = tasks || [];
    this.dependencies = dependencies || [];
    this.calculateBounds();
    this.render();
  }

  calculateBounds() {
    if (!this.tasks || this.tasks.length === 0) {
      const now = new Date();
      this.minDate = new Date(now.getFullYear(), now.getMonth(), 1);
      this.maxDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    } else {
      let min = new Date(this.tasks[0].startDate);
      let max = new Date(this.tasks[0].endDate);

      this.tasks.forEach(t => {
        const s = new Date(t.startDate);
        const e = new Date(t.endDate);
        if (s < min) min = s;
        if (e > max) max = e;
      });

      const padDaysBefore = this.zoomLevel === "months" ? 14 : 7;
      const padDaysAfter = this.zoomLevel === "months" ? 30 : 20;

      this.minDate = new Date(min.getTime() - padDaysBefore * 24 * 60 * 60 * 1000);
      this.maxDate = new Date(max.getTime() + padDaysAfter * 24 * 60 * 60 * 1000);
    }

    this.minDate.setHours(0, 0, 0, 0);
    this.maxDate.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(this.maxDate - this.minDate);
    this.totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  render() {
    this.renderHeader();
    this.renderGrid();
    this.renderBars();
    this.renderDependencies();
    this.renderTodayLine();
  }

  renderHeader() {
    const primaryHeader = document.getElementById("timeline-header-primary");
    const secondaryHeader = document.getElementById("timeline-header-secondary");
    if (!primaryHeader || !secondaryHeader) return;

    primaryHeader.innerHTML = "";
    secondaryHeader.innerHTML = "";

    const totalWidth = this.totalDays * this.dayWidth;
    primaryHeader.style.width = String(totalWidth) + "px";
    secondaryHeader.style.width = String(totalWidth) + "px";

    const monthsMap = new Map();
    const dayNames = ["D", "L", "M", "M", "J", "V", "S"];
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < this.totalDays; i++) {
      const cur = new Date(this.minDate.getTime() + i * 24 * 60 * 60 * 1000);
      const mKey = cur.getFullYear() + "-" + cur.getMonth();

      if (!monthsMap.has(mKey)) {
        monthsMap.set(mKey, {
          label: monthNames[cur.getMonth()] + " " + cur.getFullYear(),
          days: 0
        });
      }
      monthsMap.get(mKey).days++;

      const secCell = document.createElement("div");
      secCell.className = "timeline-header-cell-secondary";
      secCell.style.width = String(this.dayWidth) + "px";
      secCell.style.flexShrink = "0";

      const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;
      const isToday = cur.getTime() === today.getTime();

      if (isWeekend) secCell.classList.add("is-weekend");
      if (isToday) secCell.classList.add("is-today");

      if (this.zoomLevel === "days") {
        secCell.innerHTML = `<div style="font-size:9px; font-weight:600;">${dayNames[cur.getDay()]}</div><div style="font-size:11px;">${cur.getDate()}</div>`;
      } else if (this.zoomLevel === "weeks") {
        if (cur.getDay() === 1 || i === 0) {
          secCell.innerHTML = `<div style="font-size:10px; font-weight:600;">${cur.getDate()}</div>`;
        }
      }

      secondaryHeader.appendChild(secCell);
    }

    monthsMap.forEach((val) => {
      const primCell = document.createElement("div");
      primCell.className = "timeline-header-cell-primary";
      primCell.style.width = String(val.days * this.dayWidth) + "px";
      primCell.style.flexShrink = "0";
      primCell.textContent = val.label;
      primaryHeader.appendChild(primCell);
    });
  }

  renderGrid() {
    const canvas = document.getElementById("timeline-canvas");
    const gridCols = document.getElementById("timeline-grid-columns");
    const gridRows = document.getElementById("timeline-grid-rows");
    if (!canvas || !gridCols || !gridRows) return;

    const visibleTasks = this.grid.getVisibleTasks();
    const totalWidth = this.totalDays * this.dayWidth;
    const totalHeight = Math.max(visibleTasks.length * this.rowHeight, 400);

    canvas.style.width = String(totalWidth) + "px";
    canvas.style.height = String(totalHeight) + "px";

    gridCols.innerHTML = "";
    for (let i = 0; i < this.totalDays; i++) {
      const cur = new Date(this.minDate.getTime() + i * 24 * 60 * 60 * 1000);
      const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;
      const col = document.createElement("div");
      col.className = "timeline-grid-column" + (isWeekend ? " is-weekend" : "");
      col.style.width = String(this.dayWidth) + "px";
      gridCols.appendChild(col);
    }

    gridRows.innerHTML = "";
    visibleTasks.forEach(() => {
      const row = document.createElement("div");
      row.className = "timeline-grid-row-line";
      gridRows.appendChild(row);
    });

    let dropGuide = document.getElementById("gantt-timeline-drop-guide");
    if (!dropGuide) {
      dropGuide = document.createElement("div");
      dropGuide.id = "gantt-timeline-drop-guide";
      dropGuide.className = "gantt-row-drop-guide";
      canvas.appendChild(dropGuide);
    }
  }

  dateToPx(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diff = (d - this.minDate) / (1000 * 60 * 60 * 24);
    return diff * this.dayWidth;
  }

  pxToDate(px) {
    const days = Math.round(px / this.dayWidth);
    return new Date(this.minDate.getTime() + days * 24 * 60 * 60 * 1000);
  }

  renderBars() {
    const container = document.getElementById("timeline-bars-container") || document.getElementById("timeline-bars-layer");
    if (!container) return;
    container.innerHTML = "";

    const visibleTasks = this.grid.getVisibleTasks();

    visibleTasks.forEach((task, index) => {
      const topPx = index * this.rowHeight;
      const leftPx = this.dateToPx(task.startDate);
      const rightPx = this.dateToPx(task.endDate) + this.dayWidth;
      const widthPx = Math.max(rightPx - leftPx, this.dayWidth);
      const isSelected = this.grid.selectedTaskIds.has(task.id);

      if (task.isMilestone) {
        const diamond = document.createElement("div");
        diamond.className = "gantt-milestone-diamond" +
          ((task.progress || 0) === 100 ? " completed" : "") +
          (isSelected ? " selected" : "");
        diamond.style.top = String(topPx + 11) + "px";
        diamond.style.left = String(leftPx + this.dayWidth / 2 - 8) + "px";
        diamond.style.background = task.color || "#0ea5e9";
        diamond.dataset.taskId = String(task.id);
        diamond.title = task.name + " (" + new Date(task.startDate).toLocaleDateString("es-ES") + ")";

        const label = document.createElement("div");
        label.className = "gantt-bar-label";
        label.dataset.taskId = String(task.id);
        label.style.left = String(leftPx + this.dayWidth / 2 + 14) + "px";
        label.style.top = String(topPx + 9) + "px";
        label.innerHTML = `<span style="font-weight:600; color:${task.color || "#0ea5e9"};">${task.name}</span>`;

        this.attachMilestone2DDragEvents(diamond, label, task, index);

        diamond.addEventListener("dblclick", () => {
          if (window.TaskModal) window.TaskModal.open(task.id);
        });

        container.appendChild(diamond);
        container.appendChild(label);
        return;
      }

      if (task.isPhase) {
        const phaseColor = task.color || "#334155";

        const phaseBar = document.createElement("div");
        phaseBar.className = "gantt-phase-bar" + (isSelected ? " selected" : "");
        phaseBar.style.top = String(topPx + 12) + "px";
        phaseBar.style.left = String(leftPx) + "px";
        phaseBar.style.width = String(widthPx) + "px";
        phaseBar.style.background = phaseColor;
        phaseBar.dataset.taskId = String(task.id);
        phaseBar.title = "Fase: " + task.name + " (" + (task.progress || 0) + "%)";

        const bLeft = document.createElement("div");
        bLeft.className = "gantt-phase-bracket-left";
        bLeft.style.borderTopColor = phaseColor;

        const bRight = document.createElement("div");
        bRight.className = "gantt-phase-bracket-right";
        bRight.style.borderTopColor = phaseColor;

        const prog = document.createElement("div");
        prog.className = "gantt-phase-progress";
        prog.style.width = String(task.progress || 0) + "%";

        phaseBar.appendChild(bLeft);
        phaseBar.appendChild(prog);
        phaseBar.appendChild(bRight);

        this.attachPhaseVerticalDrag(phaseBar, task, index);

        phaseBar.addEventListener("dblclick", () => {
          if (window.TaskModal) window.TaskModal.open(task.id);
        });

        const label = document.createElement("div");
        label.className = "gantt-bar-label";
        label.dataset.taskId = String(task.id);
        label.style.left = String(leftPx + widthPx + 8) + "px";
        label.style.top = String(topPx + 9) + "px";
        label.innerHTML = `<span style="font-weight:700; color:${phaseColor};">${task.name} ${(task.progress || 0)}%</span>`;

        container.appendChild(phaseBar);
        container.appendChild(label);
        return;
      }

      const bar = document.createElement("div");
      bar.className = "gantt-bar-item" + (isSelected ? " selected" : "");
      bar.style.top = String(topPx + 8) + "px";
      bar.style.left = String(leftPx) + "px";
      bar.style.width = String(widthPx) + "px";
      bar.style.background = task.color || "#0284c7";
      bar.dataset.taskId = String(task.id);
      bar.title = task.name + " (" + (task.assignedTo || "Sin asignar") + ") - " + (task.progress || 0) + "%";

      const progFill = document.createElement("div");
      progFill.className = "gantt-bar-progress" + (task.progress === 100 ? " full" : "");
      progFill.style.width = String(task.progress || 0) + "%";
      bar.appendChild(progFill);

      const handleL = document.createElement("div");
      handleL.className = "gantt-bar-handle gantt-bar-handle-left";
      const handleR = document.createElement("div");
      handleR.className = "gantt-bar-handle gantt-bar-handle-right";
      bar.appendChild(handleL);
      bar.appendChild(handleR);

      const label = document.createElement("div");
      label.className = "gantt-bar-label";
      label.dataset.taskId = String(task.id);
      label.style.left = String(leftPx + widthPx + 8) + "px";
      label.style.top = String(topPx + 8) + "px";
      let assigneeText = task.assignedTo ? task.assignedTo + " " : "";
      label.innerHTML = `<span style="font-weight:500; font-size:11px; color:#1e293b;">${assigneeText}${(task.progress || 0)}%</span>`;

      this.attachBar2DDragEvents(bar, label, task, index, handleL, handleR);

      bar.addEventListener("dblclick", () => {
        if (window.TaskModal) window.TaskModal.open(task.id);
      });

      container.appendChild(bar);
      container.appendChild(label);
    });
  }

  attachBar2DDragEvents(bar, label, task, rowIndex, handleL, handleR) {
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let initialWidth = 0;
    let mode = null;
    let targetRowIndex = rowIndex;
    let isMultiDrag = false;
    let multiDragItems = [];
    const dropGuide = document.getElementById("gantt-timeline-drop-guide");

    const onMouseDown = (e, m) => {
      e.stopPropagation();
      mode = m;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseFloat(bar.style.left) || 0;
      initialTop = parseFloat(bar.style.top) || 0;
      initialWidth = parseFloat(bar.style.width) || 0;
      targetRowIndex = rowIndex;

      if (mode === "move") {
        if (!this.grid.selectedTaskIds.has(task.id) && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
          this.grid.selectTask(task.id);
        }
      }

      isMultiDrag = mode === "move" && this.grid.selectedTaskIds.has(task.id) && this.grid.selectedTaskIds.size > 1;
      multiDragItems = [];

      if (isMultiDrag) {
        this.grid.selectedTaskIds.forEach(id => {
          const t = this.tasks.find(x => x.id === id);
          const el = document.querySelector(`.gantt-bar-item[data-task-id="${id}"], .gantt-milestone-diamond[data-task-id="${id}"], .gantt-phase-bar[data-task-id="${id}"]`);
          const lbl = document.querySelector(`.gantt-bar-label[data-task-id="${id}"]`);
          if (t && el) {
            const curLeft = parseFloat(el.style.left) || this.dateToPx(t.startDate);
            const curTop = parseFloat(el.style.top) || 0;
            const lblLeft = lbl ? (parseFloat(lbl.style.left) || 0) : 0;
            multiDragItems.push({
              task: t,
              element: el,
              label: lbl,
              initialLeft: curLeft,
              initialTop: curTop,
              initialLabelLeft: lblLeft,
              initialStart: new Date(t.startDate),
              initialEnd: new Date(t.endDate)
            });
            el.classList.add("dragging");
          }
        });
      } else {
        bar.classList.add("dragging");
      }

      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    bar.addEventListener("mousedown", (e) => {
      if (e.target === handleL) onMouseDown(e, "resize-left");
      else if (e.target === handleR) onMouseDown(e, "resize-right");
      else if (e.button === 0) onMouseDown(e, "move");
    });

    const onMouseMove = (e) => {
      if (!mode) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (mode === "move") {
        if (isMultiDrag) {
          multiDragItems.forEach(item => {
            const newL = Math.max(0, item.initialLeft + deltaX);
            item.element.style.left = String(newL) + "px";
            if (item.label) {
              item.label.style.left = String(item.initialLabelLeft + deltaX) + "px";
            }
          });
        } else {
          const newLeft = Math.max(0, initialLeft + deltaX);
          bar.style.left = String(newLeft) + "px";
          bar.style.top = String(initialTop + deltaY) + "px";

          if (label) {
            label.style.left = String(newLeft + initialWidth + 8) + "px";
            label.style.top = String(initialTop + deltaY) + "px";
          }

          const timelineCanvas = document.getElementById("timeline-canvas");
          if (timelineCanvas) {
            const rect = timelineCanvas.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;
            const visibleTasks = this.grid.getVisibleTasks();
            targetRowIndex = Math.max(0, Math.min(visibleTasks.length - 1, Math.floor(relativeY / this.rowHeight)));

            if (dropGuide) {
              dropGuide.style.display = "block";
              dropGuide.style.top = String(targetRowIndex * this.rowHeight) + "px";
            }
          }
        }
      } else if (mode === "resize-right") {
        const newWidth = Math.max(this.dayWidth, initialWidth + deltaX);
        bar.style.width = String(newWidth) + "px";
      } else if (mode === "resize-left") {
        const newLeft = initialLeft + deltaX;
        const newWidth = initialWidth - deltaX;
        if (newWidth >= this.dayWidth && newLeft >= 0) {
          bar.style.left = String(newLeft) + "px";
          bar.style.width = String(newWidth) + "px";
        }
      }

      this.renderDependencies();
    };

    const onMouseUp = async (e) => {
      if (!mode) return;
      if (isMultiDrag) {
        multiDragItems.forEach(item => item.element.classList.remove("dragging"));
      } else {
        bar.classList.remove("dragging");
      }

      document.body.style.userSelect = "";
      if (dropGuide) dropGuide.style.display = "none";

      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) {
        this.grid.handleRowClick(task.id, e);
        mode = null;
        return;
      }

      if (isMultiDrag) {
        const deltaDays = Math.round(deltaX / this.dayWidth);
        if (deltaDays !== 0) {
          const moves = multiDragItems.map(item => {
            const newS = new Date(item.initialStart.getTime() + deltaDays * 86400000);
            const newE = new Date(item.initialEnd.getTime() + deltaDays * 86400000);
            return {
              id: item.task.id,
              startDate: newS.toISOString(),
              endDate: newE.toISOString()
            };
          });

          try {
            if (window.App && window.App.currentProject) {
              await API.bulkMoveTasks(window.App.currentProject.id, moves);
              window.App.showToast(moves.length + " tareas desplazadas en conjunto", "success");
              await window.App.refreshData();
            }
          } catch (err) {
            console.error("Error bulk moving tasks:", err);
          }
        } else {
          this.render();
        }
      } else {
        const finalLeft = parseFloat(bar.style.left);
        const finalWidth = parseFloat(bar.style.width);
        const newStartDate = this.pxToDate(finalLeft);
        const newEndDate = this.pxToDate(finalLeft + finalWidth - this.dayWidth);

        const visibleTasks = this.grid.getVisibleTasks();
        const movedVertically = targetRowIndex !== rowIndex && visibleTasks[targetRowIndex];

        if (movedVertically) {
          const targetTask = visibleTasks[targetRowIndex];
          await this.handleVerticalReorder(task, targetTask, targetRowIndex > rowIndex, newStartDate, newEndDate);
        } else {
          if (window.App) {
            await window.App.updateTaskDates(task.id, newStartDate, newEndDate);
          }
        }
      }

      mode = null;
    };
  }

  attachMilestone2DDragEvents(diamond, label, task, rowIndex) {
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let targetRowIndex = rowIndex;
    let isMultiDrag = false;
    let multiDragItems = [];
    const dropGuide = document.getElementById("gantt-timeline-drop-guide");

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseFloat(diamond.style.left) || 0;
      initialTop = parseFloat(diamond.style.top) || 0;
      targetRowIndex = rowIndex;

      if (!this.grid.selectedTaskIds.has(task.id) && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        this.grid.selectTask(task.id);
      }

      isMultiDrag = this.grid.selectedTaskIds.has(task.id) && this.grid.selectedTaskIds.size > 1;
      multiDragItems = [];

      if (isMultiDrag) {
        this.grid.selectedTaskIds.forEach(id => {
          const t = this.tasks.find(x => x.id === id);
          const el = document.querySelector(`.gantt-bar-item[data-task-id="${id}"], .gantt-milestone-diamond[data-task-id="${id}"], .gantt-phase-bar[data-task-id="${id}"]`);
          const lbl = document.querySelector(`.gantt-bar-label[data-task-id="${id}"]`);
          if (t && el) {
            const curLeft = parseFloat(el.style.left) || this.dateToPx(t.startDate);
            const lblLeft = lbl ? (parseFloat(lbl.style.left) || 0) : 0;
            multiDragItems.push({
              task: t,
              element: el,
              label: lbl,
              initialLeft: curLeft,
              initialLabelLeft: lblLeft,
              initialStart: new Date(t.startDate),
              initialEnd: new Date(t.endDate)
            });
            el.classList.add("dragging");
          }
        });
      } else {
        diamond.classList.add("dragging");
      }

      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (isMultiDrag) {
        multiDragItems.forEach(item => {
          const newL = Math.max(0, item.initialLeft + deltaX);
          item.element.style.left = String(newL) + "px";
          if (item.label) {
            item.label.style.left = String(item.initialLabelLeft + deltaX) + "px";
          }
        });
      } else {
        const newLeft = Math.max(0, initialLeft + deltaX);
        diamond.style.left = String(newLeft) + "px";
        diamond.style.top = String(initialTop + deltaY) + "px";

        if (label) {
          label.style.left = String(newLeft + 22) + "px";
          label.style.top = String(initialTop + deltaY - 2) + "px";
        }

        const timelineCanvas = document.getElementById("timeline-canvas");
        if (timelineCanvas) {
          const rect = timelineCanvas.getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          const visibleTasks = this.grid.getVisibleTasks();
          targetRowIndex = Math.max(0, Math.min(visibleTasks.length - 1, Math.floor(relativeY / this.rowHeight)));

          if (dropGuide) {
            dropGuide.style.display = "block";
            dropGuide.style.top = String(targetRowIndex * this.rowHeight) + "px";
          }
        }
      }

      this.renderDependencies();
    };

    const onMouseUp = async (e) => {
      if (isMultiDrag) {
        multiDragItems.forEach(item => item.element.classList.remove("dragging"));
      } else {
        diamond.classList.remove("dragging");
      }

      document.body.style.userSelect = "";
      if (dropGuide) dropGuide.style.display = "none";

      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) {
        this.grid.handleRowClick(task.id, e);
        return;
      }

      if (isMultiDrag) {
        const deltaDays = Math.round(deltaX / this.dayWidth);
        if (deltaDays !== 0) {
          const moves = multiDragItems.map(item => {
            const newS = new Date(item.initialStart.getTime() + deltaDays * 86400000);
            const newE = new Date(item.initialEnd.getTime() + deltaDays * 86400000);
            return {
              id: item.task.id,
              startDate: newS.toISOString(),
              endDate: newE.toISOString()
            };
          });

          try {
            if (window.App && window.App.currentProject) {
              await API.bulkMoveTasks(window.App.currentProject.id, moves);
              window.App.showToast(moves.length + " tareas e hitos desplazados en conjunto", "success");
              await window.App.refreshData();
            }
          } catch (err) {
            console.error("Error bulk moving tasks:", err);
          }
        } else {
          this.render();
        }
      } else {
        const finalLeft = parseFloat(diamond.style.left);
        const snappedDate = this.pxToDate(finalLeft);

        const visibleTasks = this.grid.getVisibleTasks();
        const movedVertically = targetRowIndex !== rowIndex && visibleTasks[targetRowIndex];

        if (movedVertically) {
          const targetTask = visibleTasks[targetRowIndex];
          await this.handleVerticalReorder(task, targetTask, targetRowIndex > rowIndex, snappedDate, snappedDate);
        } else {
          if (window.App) {
            await window.App.updateTaskDates(task.id, snappedDate, snappedDate);
          }
        }
      }
    };

    diamond.addEventListener("mousedown", onMouseDown);
  }

  attachPhaseVerticalDrag(phaseBar, task, rowIndex) {
    let startY = 0;
    let initialTop = 0;
    let targetRowIndex = rowIndex;
    const dropGuide = document.getElementById("gantt-timeline-drop-guide");

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      startY = e.clientY;
      initialTop = parseFloat(phaseBar.style.top) || 0;
      targetRowIndex = rowIndex;

      phaseBar.classList.add("dragging");
      document.body.style.userSelect = "none";

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e) => {
      const deltaY = e.clientY - startY;
      phaseBar.style.top = String(initialTop + deltaY) + "px";

      const timelineCanvas = document.getElementById("timeline-canvas");
      if (timelineCanvas) {
        const rect = timelineCanvas.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const visibleTasks = this.grid.getVisibleTasks();
        targetRowIndex = Math.max(0, Math.min(visibleTasks.length - 1, Math.floor(relativeY / this.rowHeight)));

        if (dropGuide) {
          dropGuide.style.display = "block";
          dropGuide.style.top = String(targetRowIndex * this.rowHeight) + "px";
        }
      }
    };

    const onMouseUp = async (e) => {
      phaseBar.classList.remove("dragging");
      document.body.style.userSelect = "";
      if (dropGuide) dropGuide.style.display = "none";

      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      const deltaY = Math.abs(e.clientY - startY);
      if (deltaY < 5) {
        this.grid.handleRowClick(task.id, e);
        return;
      }

      const visibleTasks = this.grid.getVisibleTasks();
      if (targetRowIndex !== rowIndex && visibleTasks[targetRowIndex]) {
        const targetTask = visibleTasks[targetRowIndex];
        await this.handleVerticalReorder(task, targetTask, targetRowIndex > rowIndex, null, null);
      } else {
        this.render();
      }
    };

    phaseBar.addEventListener("mousedown", onMouseDown);
  }

  async handleVerticalReorder(draggedTask, targetTask, isBelow, newStartDate, newEndDate) {
    const allTasks = [...this.tasks];
    const draggedIdx = allTasks.findIndex(t => t.id === draggedTask.id);
    if (draggedIdx === -1) return;

    const [item] = allTasks.splice(draggedIdx, 1);
    const targetIdx = allTasks.findIndex(t => t.id === targetTask.id);
    if (targetIdx === -1) return;

    let insertIdx = isBelow ? targetIdx + 1 : targetIdx;

    let newParentId = null;
    if (item.isPhase) {
      newParentId = null;
    } else {
      const prev = insertIdx > 0 ? allTasks[insertIdx - 1] : null;
      if (prev) {
        if (prev.isPhase) newParentId = prev.id;
        else if (prev.parentId) newParentId = prev.parentId;
        else newParentId = null;
      } else {
        newParentId = null;
      }
    }

    item.parentId = newParentId;
    if (newStartDate) item.startDate = newStartDate;
    if (newEndDate) item.endDate = newEndDate;

    allTasks.splice(insertIdx, 0, item);

    const tasksOrder = allTasks.map((t, index) => ({
      id: t.id,
      orderIndex: index + 1,
      parentId: t.parentId
    }));

    try {
      if (window.App) {
        if (newStartDate && newEndDate && !item.isPhase) {
          await API.updateTask(item.id, {
            startDate: newStartDate,
            endDate: newEndDate,
            parentId: newParentId
          });
        }
        await API.reorderTasks(window.App.currentProject.id, tasksOrder);
        window.App.showToast("Posición y jerarquía actualizadas", "success");
        await window.App.refreshData();
      }
    } catch (err) {
      console.error("Error in handleVerticalReorder:", err);
    }
  }

  renderDependencies() {
    const svg = document.getElementById("timeline-svg-layer");
    if (!svg) return;

    const oldPaths = svg.querySelectorAll("path.dep-line");
    oldPaths.forEach(p => p.remove());

    const visibleTasks = this.grid.getVisibleTasks();
    const taskIndexMap = new Map();
    visibleTasks.forEach((t, i) => taskIndexMap.set(t.id, i));

    this.dependencies.forEach(dep => {
      const predIndex = taskIndexMap.get(dep.predecessorId);
      const succIndex = taskIndexMap.get(dep.successorId);

      if (predIndex === undefined || succIndex === undefined) return;

      const predTask = visibleTasks[predIndex];
      const succTask = visibleTasks[succIndex];

      const predY = predIndex * this.rowHeight + 19;
      const succY = succIndex * this.rowHeight + 19;

      const predX = this.dateToPx(predTask.endDate) + this.dayWidth;
      const succX = this.dateToPx(succTask.startDate);

      let pathD;
      if (succX >= predX + 16) {
        const midX = (predX + succX) / 2;
        pathD = "M " + predX + " " + predY + " L " + midX + " " + predY + " L " + midX + " " + succY + " L " + succX + " " + succY;
      } else {
        const rightX = predX + 10;
        const midY = (predY + succY) / 2;
        const leftX = succX - 10;
        pathD = "M " + predX + " " + predY + " L " + rightX + " " + predY + " L " + rightX + " " + midY + " L " + leftX + " " + midY + " L " + leftX + " " + succY + " L " + succX + " " + succY;
      }

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathD);
      path.setAttribute("class", "dep-line");
      path.setAttribute("marker-end", "url(#dep-arrow)");
      path.dataset.depId = String(dep.id);

      svg.appendChild(path);
    });
  }

  renderTodayLine() {
    const line = document.getElementById("timeline-today-indicator");
    if (!line) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today >= this.minDate && today <= this.maxDate) {
      const leftPx = this.dateToPx(today) + this.dayWidth / 2;
      line.style.display = "block";
      line.style.left = String(leftPx) + "px";
    } else {
      line.style.display = "none";
    }
  }

  highlightBar(taskId) {
    const bars = document.querySelectorAll(".gantt-bar-item, .gantt-milestone-diamond, .gantt-phase-bar");
    bars.forEach(b => {
      if (parseInt(b.dataset.taskId) === taskId) {
        b.classList.add("selected");
      } else {
        b.classList.remove("selected");
      }
    });
  }

  bindHeaderScroll() {
    const timelineBody = document.getElementById("timeline-body");
    const headerScroll = document.getElementById("timeline-header-scroll");
    if (timelineBody && headerScroll) {
      timelineBody.addEventListener("scroll", () => {
        headerScroll.style.transform = "translateX(-" + timelineBody.scrollLeft + "px)";
      });
    }
  }
}

window.GanttTimeline = GanttTimeline;