const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const AdmZip = require("adm-zip");
const prisma = require("../db");
const { broadcastToProject } = require("../socket");
const config = require("../config");

// Multer in-memory upload for project import packages
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

// List all projects
router.get("/", async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: { tasks: true }
        }
      }
    });
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Error al obtener proyectos" });
  }
});

// Get single project with tasks & relations
router.get("/:id", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          orderBy: { orderIndex: "asc" },
          include: {
            checklists: { orderBy: { orderIndex: "asc" } },
            attachments: { orderBy: { createdAt: "desc" } },
            comments: { orderBy: { createdAt: "asc" } },
            links: true,
            predecessors: {
              include: { predecessor: { select: { id: true, name: true } } }
            },
            successors: {
              include: { successor: { select: { id: true, name: true } } }
            }
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }

    res.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Error al obtener detalles del proyecto" });
  }
});

// Create project
router.post("/", async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: "El nombre del proyecto es obligatorio" });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description || "",
        color: color || "#3b82f6"
      }
    });

    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const phase = await prisma.task.create({
      data: {
        projectId: project.id,
        name: "1. Fase Inicial",
        startDate: now,
        endDate: endDate,
        progress: 0,
        color: "#64748b",
        isPhase: true,
        orderIndex: 1
      }
    });

    await prisma.task.create({
      data: {
        projectId: project.id,
        parentId: phase.id,
        name: "Definición del Proyecto",
        startDate: now,
        endDate: endDate,
        progress: 0,
        color: "#0284c7",
        assignedTo: "Líder de Proyecto",
        orderIndex: 2,
        description: "<p>Comenzar planificación y levantamiento de requerimientos.</p>"
      }
    });

    res.status(201).json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Error al crear el proyecto" });
  }
});

// Update project
router.put("/:id", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { name, description, color, isArchived } = req.body;

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(color && { color }),
        ...(isArchived !== undefined && { isArchived })
      }
    });

    broadcastToProject(projectId, "project-updated", updated);
    res.json(updated);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Error al actualizar proyecto" });
  }
});

// Delete project
router.delete("/:id", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    await prisma.project.delete({
      where: { id: projectId }
    });

    res.json({ success: true, message: "Proyecto eliminado exitosamente" });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Error al eliminar proyecto" });
  }
});

// Project stats / dashboard metrics
router.get("/:id/stats", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        checklists: true,
        attachments: true,
        comments: true
      }
    });

    const nonPhaseTasks = tasks.filter(t => !t.isPhase);
    const total = nonPhaseTasks.length;
    const completed = nonPhaseTasks.filter(t => t.progress === 100).length;
    const inProgress = nonPhaseTasks.filter(t => t.progress > 0 && t.progress < 100).length;
    const notStarted = nonPhaseTasks.filter(t => t.progress === 0).length;
    const milestones = nonPhaseTasks.filter(t => t.isMilestone).length;

    const now = new Date();
    const overdue = nonPhaseTasks.filter(t => new Date(t.endDate) < now && t.progress < 100).length;

    const avgProgress = total > 0
      ? Math.round(nonPhaseTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / total)
      : 0;

    const workload = {};
    nonPhaseTasks.forEach(t => {
      const user = t.assignedTo || "Sin Asignar";
      if (!workload[user]) {
        workload[user] = { total: 0, completed: 0, inProgress: 0, pending: 0 };
      }
      workload[user].total++;
      if (t.progress === 100) workload[user].completed++;
      else if (t.progress > 0) workload[user].inProgress++;
      else workload[user].pending++;
    });

    const phases = tasks.filter(t => t.isPhase).map(p => {
      const children = tasks.filter(t => t.parentId === p.id);
      const childCount = children.length;
      const avgChildProg = childCount > 0
        ? Math.round(children.reduce((acc, c) => acc + c.progress, 0) / childCount)
        : p.progress;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        tasksCount: childCount,
        progress: avgChildProg,
        startDate: p.startDate,
        endDate: p.endDate
      };
    });

    res.json({
      total,
      completed,
      inProgress,
      notStarted,
      overdue,
      milestones,
      avgProgress,
      workload,
      phases,
      attachmentsCount: tasks.reduce((acc, t) => acc + t.attachments.length, 0),
      commentsCount: tasks.reduce((acc, t) => acc + t.comments.length, 0)
    });
  } catch (error) {
    console.error("Error computing project stats:", error);
    res.status(500).json({ error: "Error al calcular métricas" });
  }
});

// ==============================================================================
// EXPORT PROJECT (.uxgantt Package with manifest.json + attachments)
// ==============================================================================
router.get("/:id/export", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          orderBy: { orderIndex: "asc" },
          include: {
            checklists: { orderBy: { orderIndex: "asc" } },
            attachments: true,
            comments: { orderBy: { createdAt: "asc" } },
            links: true,
            predecessors: true,
            successors: true
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }

    const zip = new AdmZip();
    const manifest = {
      fileFormat: "uxcribe-gantt-package",
      formatVersion: "1.0",
      generator: "uxcribe-gantt v1.0",
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        description: project.description || "",
        color: project.color || "#0284c7"
      },
      tasks: []
    };

    // Bundle tasks and attachments
    for (const t of project.tasks) {
      const taskEntry = {
        id: t.id,
        parentId: t.parentId,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        progress: t.progress,
        color: t.color,
        tags: t.tags,
        assignedTo: t.assignedTo,
        isMilestone: t.isMilestone,
        isPhase: t.isPhase,
        orderIndex: t.orderIndex,
        description: t.description,
        notes: t.notes,
        checklists: t.checklists.map(c => ({ text: c.text, completed: c.completed, orderIndex: c.orderIndex })),
        comments: t.comments.map(c => ({ authorName: c.authorName, authorAvatar: c.authorAvatar, content: c.content, createdAt: c.createdAt })),
        predecessors: t.predecessors.map(d => ({ predecessorId: d.predecessorId, type: d.type, lagDays: d.lagDays })),
        attachments: []
      };

      for (const att of t.attachments) {
        const filePathOnDisk = path.join(config.uploadDir, att.fileName);
        if (fs.existsSync(filePathOnDisk)) {
          const zipAttachmentPath = `attachments/task_${t.id}_${att.fileName}`;
          zip.addLocalFile(filePathOnDisk, "attachments", `task_${t.id}_${att.fileName}`);

          taskEntry.attachments.push({
            originalName: att.originalName,
            fileName: att.fileName,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
            archivePath: zipAttachmentPath
          });
        }
      }

      manifest.tasks.push(taskEntry);
    }

    // Add manifest.json to zip root
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));

    const zipBuffer = zip.toBuffer();
    const safeName = project.name.replace(/[^a-zA-Z0-9_\-]/g, "_").toLowerCase();

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.uxgantt"`);
    res.send(zipBuffer);
  } catch (error) {
    console.error("Error exporting project package:", error);
    res.status(500).json({ error: "Error al exportar el paquete de proyecto" });
  }
});

// ==============================================================================
// IMPORT PROJECT (.uxgantt Package or JSON with Validation Engine)
// ==============================================================================
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    let manifest = null;
    let zipInstance = null;

    // 1. Check if uploaded as a multipart file or as JSON body
    if (req.file) {
      const buffer = req.file.buffer;
      const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b; // PK zip signature

      if (isZip) {
        try {
          zipInstance = new AdmZip(buffer);
          const manifestEntry = zipInstance.getEntry("manifest.json");
          if (!manifestEntry) {
            return res.status(400).json({
              error: "Archivo .uxgantt inválido: no contiene el archivo de manifiesto 'manifest.json'."
            });
          }
          const manifestText = zipInstance.readAsText(manifestEntry);
          manifest = JSON.parse(manifestText);
        } catch (zipErr) {
          return res.status(400).json({
            error: "El archivo .uxgantt está corrupto o no es un paquete comprimido válido."
          });
        }
      } else {
        // Raw JSON file uploaded
        try {
          const jsonText = buffer.toString("utf8");
          manifest = JSON.parse(jsonText);
        } catch (jsonErr) {
          return res.status(400).json({
            error: "El archivo importado está corrupto o contiene JSON no válido."
          });
        }
      }
    } else if (req.body && (req.body.name || req.body.project || req.body.fileFormat)) {
      manifest = req.body;
    } else {
      return res.status(400).json({
        error: "No se enviaron datos válidos para la importación."
      });
    }

    // 2. Validate & normalize project manifest structure
    const validation = validateProjectManifest(manifest);
    if (!validation.valid) {
      return res.status(400).json({
        error: `Error de validación del proyecto: ${validation.message}`
      });
    }

    const { projectData, tasksData } = validation;

    // 3. Create Project in MySQL
    const newProject = await prisma.project.create({
      data: {
        name: projectData.name.endsWith("(Importado)") ? projectData.name : `${projectData.name} (Importado)`,
        description: projectData.description || "",
        color: projectData.color || "#0284c7"
      }
    });

    const idMap = new Map();

    // 4. First Pass: Create tasks, checklists, comments, and extract attachments
    for (const t of tasksData) {
      const createdTask = await prisma.task.create({
        data: {
          projectId: newProject.id,
          name: t.name,
          startDate: new Date(t.startDate),
          endDate: new Date(t.endDate),
          progress: t.progress,
          color: t.color || (t.isPhase ? "#334155" : "#0284c7"),
          tags: t.tags || "",
          assignedTo: t.assignedTo || "",
          isMilestone: !!t.isMilestone,
          isPhase: !!t.isPhase,
          orderIndex: t.orderIndex || 0,
          description: t.description || "",
          notes: t.notes || ""
        }
      });
      idMap.set(t.id, createdTask.id);

      // Checklists
      if (Array.isArray(t.checklists)) {
        for (const ch of t.checklists) {
          if (ch.text) {
            await prisma.checklistItem.create({
              data: {
                taskId: createdTask.id,
                text: String(ch.text),
                completed: !!ch.completed,
                orderIndex: parseInt(ch.orderIndex) || 0
              }
            });
          }
        }
      }

      // Comments
      if (Array.isArray(t.comments)) {
        for (const com of t.comments) {
          if (com.content) {
            await prisma.comment.create({
              data: {
                taskId: createdTask.id,
                authorName: com.authorName || "Colaborador",
                authorAvatar: com.authorAvatar || null,
                content: String(com.content),
                createdAt: com.createdAt ? new Date(com.createdAt) : new Date()
              }
            });
          }
        }
      }

      // Attachments extraction from .uxgantt ZIP
      if (Array.isArray(t.attachments) && zipInstance) {
        for (const att of t.attachments) {
          if (att.archivePath) {
            const entry = zipInstance.getEntry(att.archivePath);
            if (entry) {
              const fileExt = path.extname(att.originalName || att.fileName || ".bin");
              const uniqueFileName = `file-${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
              const targetDiskPath = path.join(config.uploadDir, uniqueFileName);

              // Write attachment file to uploads directory
              fs.writeFileSync(targetDiskPath, entry.getData());

              await prisma.attachment.create({
                data: {
                  taskId: createdTask.id,
                  fileName: uniqueFileName,
                  originalName: att.originalName || "archivo_adjunto",
                  fileSize: att.fileSize || entry.header.size,
                  mimeType: att.mimeType || "application/octet-stream",
                  filePath: `/uploads/${uniqueFileName}`
                }
              });
            }
          }
        }
      }
    }

    // 5. Second Pass: Rebuild parent-child hierarchy and dependencies
    for (const t of tasksData) {
      const newTaskId = idMap.get(t.id);
      if (!newTaskId) continue;

      if (t.parentId && idMap.has(t.parentId)) {
        await prisma.task.update({
          where: { id: newTaskId },
          data: { parentId: idMap.get(t.parentId) }
        });
      }

      if (Array.isArray(t.predecessors)) {
        for (const dep of t.predecessors) {
          const newPredId = idMap.get(dep.predecessorId);
          if (newPredId) {
            try {
              await prisma.dependency.create({
                data: {
                  predecessorId: newPredId,
                  successorId: newTaskId,
                  type: dep.type || "FS",
                  lagDays: parseInt(dep.lagDays) || 0
                }
              });
            } catch (depErr) {}
          }
        }
      }
    }

    // 6. Recalculate phases rollup
    const allPhases = await prisma.task.findMany({
      where: { projectId: newProject.id, isPhase: true }
    });
    for (const ph of allPhases) {
      await updateParentPhase(ph.id);
    }

    const fullProject = await prisma.project.findUnique({
      where: { id: newProject.id },
      include: {
        tasks: {
          orderBy: { orderIndex: "asc" },
          include: {
            checklists: true,
            attachments: true,
            comments: true,
            links: true,
            predecessors: true,
            successors: true
          }
        }
      }
    });

    res.status(201).json(fullProject);
  } catch (error) {
    console.error("Error during project import:", error);
    res.status(500).json({ error: "Error interno al procesar e importar el proyecto." });
  }
});

// Helper validation engine
function validateProjectManifest(data) {
  if (!data || typeof data !== "object") {
    return { valid: false, message: "El contenido del archivo no es un objeto JSON válido." };
  }

  // Handle both .uxgantt package schema and direct project JSON schema
  let projectName = data.project?.name || data.name;
  let projectDesc = data.project?.description ?? data.description ?? "";
  let projectColor = data.project?.color || data.color || "#0284c7";
  let tasks = Array.isArray(data.tasks) ? data.tasks : [];

  if (!projectName || typeof projectName !== "string" || projectName.trim().length === 0) {
    return { valid: false, message: "El proyecto no contiene un nombre válido ('name')." };
  }

  // Validate tasks array
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t || typeof t !== "object") {
      return { valid: false, message: `La tarea en la posición ${i + 1} no tiene un formato válido.` };
    }
    if (!t.name || typeof t.name !== "string") {
      return { valid: false, message: `La tarea en la posición ${i + 1} no tiene un nombre válido.` };
    }
    if (!t.startDate || isNaN(new Date(t.startDate).getTime())) {
      return { valid: false, message: `La tarea "${t.name}" tiene una fecha de inicio inválida: "${t.startDate}".` };
    }
    if (!t.endDate || isNaN(new Date(t.endDate).getTime())) {
      return { valid: false, message: `La tarea "${t.name}" tiene una fecha de fin inválida: "${t.endDate}".` };
    }

    t.progress = Math.min(100, Math.max(0, parseInt(t.progress) || 0));
  }

  return {
    valid: true,
    projectData: {
      name: projectName.trim(),
      description: projectDesc,
      color: projectColor
    },
    tasksData: tasks
  };
}

// Helper to auto recalculate parent phase
async function updateParentPhase(phaseId) {
  try {
    const children = await prisma.task.findMany({
      where: { parentId: phaseId }
    });
    if (children.length === 0) return;

    let minStart = new Date(children[0].startDate);
    let maxEnd = new Date(children[0].endDate);
    let totalProg = 0;

    children.forEach(c => {
      const s = new Date(c.startDate);
      const e = new Date(c.endDate);
      if (s < minStart) minStart = s;
      if (e > maxEnd) maxEnd = e;
      totalProg += (c.progress || 0);
    });

    const avgProg = Math.round(totalProg / children.length);

    await prisma.task.update({
      where: { id: phaseId },
      data: {
        startDate: minStart,
        endDate: maxEnd,
        progress: avgProg
      }
    });
  } catch (err) {
    console.error("Error updating parent phase:", err);
  }
}

module.exports = router;
