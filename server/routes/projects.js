const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const AdmZip = require("adm-zip");
const crypto = require("crypto");
const prisma = require("../db");
const { broadcastToProject } = require("../socket");
const config = require("../config");
const emailService = require("../services/email");

// Multer in-memory upload for project import packages
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

// Helper: Check if user has access to a project
async function checkProjectAccess(projectId, userId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      members: true,
      workspace: {
        include: { members: true }
      }
    }
  });

  if (!project) return { allowed: false, notFound: true };

  const isOwner = project.ownerId === userId;
  const isDirectMember = project.members.some(m => m.userId === userId);
  const isWorkspaceOwner = project.workspace && project.workspace.ownerId === userId;
  const isWorkspaceMember = project.workspace && project.workspace.members.some(m => m.userId === userId);

  const allowed = isOwner || isDirectMember || isWorkspaceOwner || isWorkspaceMember;

  // Determine user role
  let role = "VIEWER";
  if (isOwner || isWorkspaceOwner) {
    role = "ADMIN";
  } else if (isDirectMember) {
    role = project.members.find(m => m.userId === userId).role;
  } else if (isWorkspaceMember) {
    role = project.workspace.members.find(m => m.userId === userId).role;
  }

  return { allowed, role, project };
}

// 1. List Projects accessible to current user (filtered by user & workspace)
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.query;

    const whereClause = {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
        { workspace: { members: { some: { userId } } } },
        { workspace: { ownerId: userId } }
      ]
    };

    if (workspaceId) {
      whereClause.workspaceId = parseInt(workspaceId);
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        workspace: { select: { id: true, name: true, color: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } }
          }
        },
        _count: {
          select: { tasks: true, members: true }
        }
      }
    });

    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Error al obtener proyectos" });
  }
});

// 2. Get single project with tasks & relations
router.get("/:id", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { allowed, role, notFound } = await checkProjectAccess(projectId, req.user.id);

    if (notFound) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }
    if (!allowed) {
      return res.status(403).json({ error: "No tienes permiso para acceder a este proyecto" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        workspace: { select: { id: true, name: true, color: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } }
          }
        },
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

    res.json({ ...project, currentUserRole: role });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Error al obtener detalles del proyecto" });
  }
});

// 3. Create project
router.post("/", async (req, res) => {
  try {
    const { name, description, color, workspaceId } = req.body;
    if (!name) {
      return res.status(400).json({ error: "El nombre del proyecto es obligatorio" });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description || "",
        color: color || "#3b82f6",
        ownerId: req.user.id,
        workspaceId: workspaceId ? parseInt(workspaceId) : null
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        workspace: true
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
        color: "#334155",
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
        assignedTo: req.user.name,
        assigneeId: req.user.id,
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

// 4. Share Project by Email
router.post("/:id/share", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { email, role = "EDITOR" } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: "El correo electrónico es requerido." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const { allowed, role: userRole, project } = await checkProjectAccess(projectId, req.user.id);

    if (!allowed || (userRole !== "ADMIN" && project.ownerId !== req.user.id)) {
      return res.status(403).json({ error: "Solo los administradores o el dueño pueden compartir este proyecto." });
    }

    const targetUser = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    const host = req.get("host");
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    if (targetUser) {
      if (targetUser.id === project.ownerId) {
        return res.status(400).json({ error: "El usuario ya es el dueño del proyecto." });
      }

      const existingMember = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: { projectId, userId: targetUser.id }
        }
      });

      if (existingMember) {
        await prisma.projectMember.update({
          where: { id: existingMember.id },
          data: { role }
        });
        return res.json({ success: true, message: `Rol de ${targetUser.name} actualizado a ${role}.` });
      }

      const member = await prisma.projectMember.create({
        data: {
          projectId,
          userId: targetUser.id,
          role
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } }
        }
      });

      await emailService.sendProjectInvitation({
        toEmail: cleanEmail,
        inviterName: req.user.name,
        projectName: project.name,
        role,
        inviteUrl: `${baseUrl}/#${projectId}`,
        isNewUser: false
      });

      return res.status(201).json({
        success: true,
        member,
        message: `Proyecto compartido con ${targetUser.name}. Se le notificó por correo.`
      });
    } else {
      // Pending invitation for unregistered user
      const token = crypto.randomBytes(24).toString("hex");

      await prisma.invitation.create({
        data: {
          email: cleanEmail,
          projectId,
          role,
          token,
          invitedById: req.user.id
        }
      });

      const inviteUrl = `${baseUrl}/?invite=${token}`;

      await emailService.sendProjectInvitation({
        toEmail: cleanEmail,
        inviterName: req.user.name,
        projectName: project.name,
        role,
        inviteUrl,
        isNewUser: true
      });

      return res.status(201).json({
        success: true,
        pending: true,
        message: `Invitación enviada por correo electrónico a ${cleanEmail}.`
      });
    }
  } catch (error) {
    console.error("Error sharing project:", error);
    res.status(500).json({ error: "Error al compartir proyecto" });
  }
});

// 5. List Project Members & Pending Invitations
router.get("/:id/members", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { allowed, project } = await checkProjectAccess(projectId, req.user.id);

    if (!allowed) {
      return res.status(403).json({ error: "No tienes acceso a este proyecto" });
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    });

    const invitations = await prisma.invitation.findMany({
      where: { projectId, status: "PENDING" }
    });

    res.json({
      owner: project.owner,
      members,
      invitations,
      workspace: project.workspace
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener miembros del proyecto" });
  }
});

// 6. Remove member from project
router.delete("/:id/members/:userId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });

    if (project.ownerId !== req.user.id && req.user.id !== targetUserId) {
      return res.status(403).json({ error: "No tienes permiso para remover este miembro" });
    }

    await prisma.projectMember.deleteMany({
      where: { projectId, userId: targetUserId }
    });

    res.json({ success: true, message: "Miembro removido del proyecto" });
  } catch (error) {
    res.status(500).json({ error: "Error al remover miembro" });
  }
});

// 7. Update project
router.put("/:id", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { name, description, color, isArchived, workspaceId } = req.body;

    const { allowed, role } = await checkProjectAccess(projectId, req.user.id);
    if (!allowed || role === "VIEWER") {
      return res.status(403).json({ error: "No tienes permiso para editar este proyecto" });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(color && { color }),
        ...(isArchived !== undefined && { isArchived }),
        ...(workspaceId !== undefined && { workspaceId: workspaceId ? parseInt(workspaceId) : null })
      }
    });

    broadcastToProject(projectId, "project-updated", updated);
    res.json(updated);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Error al actualizar proyecto" });
  }
});

// 8. Delete project
router.delete("/:id", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: "Proyecto no encontrado" });

    if (project.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Solo el dueño puede eliminar el proyecto" });
    }

    await prisma.project.delete({
      where: { id: projectId }
    });

    res.json({ success: true, message: "Proyecto eliminado exitosamente" });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Error al eliminar proyecto" });
  }
});

// 9. Project stats
router.get("/:id/stats", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { allowed } = await checkProjectAccess(projectId, req.user.id);
    if (!allowed) {
      return res.status(403).json({ error: "No tienes acceso a este proyecto" });
    }

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

// 10. Export .uxgantt package
router.get("/:id/export", async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { allowed, project } = await checkProjectAccess(projectId, req.user.id);
    if (!allowed) {
      return res.status(403).json({ error: "No tienes acceso a este proyecto" });
    }

    const fullProject = await prisma.project.findUnique({
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

    const zip = new AdmZip();
    const manifest = {
      fileFormat: "uxcribe-gantt-package",
      formatVersion: "1.0",
      generator: "uxcribe-gantt v1.0",
      exportedAt: new Date().toISOString(),
      project: {
        name: fullProject.name,
        description: fullProject.description || "",
        color: fullProject.color || "#0284c7"
      },
      tasks: []
    };

    for (const t of fullProject.tasks) {
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
        if (att.fileData) {
          const zipAttachmentPath = `attachments/task_${t.id}_${att.fileName}`;
          zip.addFile(zipAttachmentPath, att.fileData);

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

    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));
    const zipBuffer = zip.toBuffer();
    const safeName = fullProject.name.replace(/[^a-zA-Z0-9_\-]/g, "_").toLowerCase();

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.uxgantt"`);
    res.send(zipBuffer);
  } catch (error) {
    console.error("Error exporting project package:", error);
    res.status(500).json({ error: "Error al exportar el paquete de proyecto" });
  }
});

// 11. Import .uxgantt Package or JSON
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    let manifest = null;
    let zipInstance = null;

    if (req.file) {
      const buffer = req.file.buffer;
      const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;

      if (isZip) {
        try {
          zipInstance = new AdmZip(buffer);
          const manifestEntry = zipInstance.getEntry("manifest.json");
          if (!manifestEntry) {
            return res.status(400).json({ error: "Archivo .uxgantt inválido: falta 'manifest.json'." });
          }
          manifest = JSON.parse(zipInstance.readAsText(manifestEntry));
        } catch (zipErr) {
          return res.status(400).json({ error: "El archivo .uxgantt está corrupto o no es un zip válido." });
        }
      } else {
        try {
          manifest = JSON.parse(buffer.toString("utf8"));
        } catch (jsonErr) {
          return res.status(400).json({ error: "El archivo importado está corrupto o contiene JSON inválido." });
        }
      }
    } else if (req.body && (req.body.name || req.body.project)) {
      manifest = req.body;
    } else {
      return res.status(400).json({ error: "No se enviaron datos para la importación." });
    }

    const validation = validateProjectManifest(manifest);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const { projectData, tasksData } = validation;

    const newProject = await prisma.project.create({
      data: {
        name: projectData.name.endsWith("(Importado)") ? projectData.name : `${projectData.name} (Importado)`,
        description: projectData.description || "",
        color: projectData.color || "#0284c7",
        ownerId: req.user.id
      }
    });

    const idMap = new Map();

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

      if (Array.isArray(t.attachments) && zipInstance) {
        for (const att of t.attachments) {
          if (att.archivePath) {
            const entry = zipInstance.getEntry(att.archivePath);
            if (entry) {
              const fileData = entry.getData();
              const fileExt = path.extname(att.originalName || att.fileName || ".bin");
              const uniqueFileName = `file-${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;

              await prisma.attachment.create({
                data: {
                  taskId: createdTask.id,
                  userId: req.user.id,
                  fileName: uniqueFileName,
                  originalName: att.originalName || "archivo_adjunto",
                  fileSize: att.fileSize || fileData.length,
                  mimeType: att.mimeType || "application/octet-stream",
                  filePath: `/uploads/${uniqueFileName}`,
                  fileData,
                  storageProvider: "db"
                }
              });
            }
          }
        }
      }
    }

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
          orderBy: { orderIndex: "asc" }
        }
      }
    });

    res.status(201).json(fullProject);
  } catch (error) {
    console.error("Error during project import:", error);
    res.status(500).json({ error: "Error al importar el proyecto." });
  }
});

function validateProjectManifest(data) {
  if (!data || typeof data !== "object") {
    return { valid: false, message: "El contenido no es un objeto JSON válido." };
  }

  let projectName = data.project?.name || data.name;
  let projectDesc = data.project?.description ?? data.description ?? "";
  let projectColor = data.project?.color || data.color || "#0284c7";
  let tasks = Array.isArray(data.tasks) ? data.tasks : [];

  if (!projectName || typeof projectName !== "string" || projectName.trim().length === 0) {
    return { valid: false, message: "El proyecto no contiene un nombre válido ('name')." };
  }

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t || !t.name || typeof t.name !== "string") {
      return { valid: false, message: `La tarea en posición ${i + 1} no tiene un nombre válido.` };
    }
    if (!t.startDate || isNaN(new Date(t.startDate).getTime())) {
      return { valid: false, message: `La tarea "${t.name}" tiene una fecha de inicio inválida.` };
    }
    if (!t.endDate || isNaN(new Date(t.endDate).getTime())) {
      return { valid: false, message: `La tarea "${t.name}" tiene una fecha de fin inválida.` };
    }
    t.progress = Math.min(100, Math.max(0, parseInt(t.progress) || 0));
  }

  return {
    valid: true,
    projectData: { name: projectName.trim(), description: projectDesc, color: projectColor },
    tasksData: tasks
  };
}

async function updateParentPhase(phaseId) {
  try {
    const children = await prisma.task.findMany({ where: { parentId: phaseId } });
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
      data: { startDate: minStart, endDate: maxEnd, progress: avgProg }
    });
  } catch (err) {
    console.error("Error updating parent phase:", err);
  }
}

module.exports = router;
