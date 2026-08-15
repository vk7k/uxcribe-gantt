
const fs = require("fs");
let content = fs.readFileSync("public/js/task-modal.js", "utf8");

const oldPhaseBadge = content.indexOf("// Phase badge");
const endPhaseBadge = content.indexOf("this.titleInput.value = task.name");

if (oldPhaseBadge !== -1 && endPhaseBadge !== -1) {
  const replacement = `// Phase badge & parent phase selector
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

    // Populate Parent Phase Select
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
          opt.value = p.id;
          opt.textContent = p.name;
          if (task.parentId === p.id) opt.selected = true;
          phaseSelect.appendChild(opt);
        });
      }
    }

    `;
  content = content.slice(0, oldPhaseBadge) + replacement + content.slice(endPhaseBadge);
}

// Update save() function to include parentId
const oldSave = content.indexOf("const updateData = {");
const endSave = content.indexOf("description: this.richEditor ? this.richEditor.getHTML() : """);

if (oldSave !== -1 && endSave !== -1) {
  const replacementSave = `const parentPhaseVal = document.getElementById("tc-parent-phase-select")?.value;
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
      `;
  content = content.slice(0, oldSave) + replacementSave + content.slice(endSave);
}

fs.writeFileSync("public/js/task-modal.js", content);
console.log("public/js/task-modal.js patched cleanly");
