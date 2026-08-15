const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { broadcastToProject } = require("../socket");

// Get task details with all relations
router.get("/:id", async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: true,
        parent: { select: { id: true, name: true, color: true } },
        children: { orderBy: { orderIndex: "asc" } },
        checklists: { orderBy: { orderIndex: "asc" } },
        attachments: { orderBy: { createdAt: "desc" } },
        comments: { orderBy: { createdAt: "asc" } },
        links: true,
        predecessors: {
          include: { predecessor: { select: { id: true, name: true, startDate: true, endDate: true } } }
        },
        successors: {
          include: { successor: { select: { id: true, name: true, startDate: true, endDate: true } } }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    res.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({ error: "Error al obtener detalles de la tarea" });
  }
});

// Create task
router.post("/", async (req, res) => {
  try {
    const {
      projectId,
      parentId,
      name,
      startDate,
      endDate,
      progress,
      color,
      tags,
      assignedTo,
      isMilestone,
      isPhase,
      description,
      notes
    } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: "projectId y name son requeridos" });
    }

    const lastTask = await prisma.task.findFirst({
      where: { projectId: parseInt(projectId) },
      orderBy: { orderIndex: "desc" }
    });
    const orderIndex = (lastTask?.orderIndex || 0) + 1;

    const start = startDate ? new Date(startDate) : new Date();
    const end = isMilestone ? start : (endDate ? new Date(endDate) : new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000));

    const task = await prisma.task.create({
      data: {
        projectId: parseInt(projectId),
        parentId: parentId ? parseInt(parentId) : null,
        name,
        startDate: start,
        endDate: end,
        progress: parseInt(progress) || 0,
        color: color || (isPhase ? "#334155" : "#0284c7"),
        tags: tags || "",
        assignedTo: assignedTo || "",
        isMilestone: !!isMilestone,
        isPhase: !!isPhase,
        orderIndex,
        description: description || "",
        notes: notes || ""
      },
      include: {
        checklists: true,
        attachments: true,
        comments: true,
        links: true,
        predecessors: true,
        successors: true
      }
    });

    if (task.parentId) {
      await updateParentPhase(task.parentId);
    }

    broadcastToProject(task.projectId, "task-created", task);
    res.status(201).json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Error al crear tarea" });
  }
});

// Update task
router.put("/:id", async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const {
      name,
      startDate,
      endDate,
      progress,
      color,
      tags,
      assignedTo,
      isMilestone,
      isPhase,
      parentId,
      description,
      notes,
      coverImage
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (progress !== undefined) updateData.progress = Math.min(100, Math.max(0, parseInt(progress)));
    if (color !== undefined) updateData.color = color;
    if (tags !== undefined) updateData.tags = tags;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (isMilestone !== undefined) updateData.isMilestone = !!isMilestone;
    if (isPhase !== undefined) updateData.isPhase = !!isPhase;
    if (parentId !== undefined) updateData.parentId = parentId ? parseInt(parentId) : null;
    if (description !== undefined) updateData.description = description;
    if (notes !== undefined) updateData.notes = notes;
    if (coverImage !== undefined) updateData.coverImage = coverImage;

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
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
    });

    if (updated.parentId) {
      await updateParentPhase(updated.parentId);
    }

    broadcastToProject(updated.projectId, "task-updated", updated);
    res.json(updated);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Error al actualizar tarea" });
  }
});

// Quick move/resize for tasks & milestones on Gantt chart
router.patch("/:id/move", async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { startDate, endDate, progress } = req.body;

    const current = await prisma.task.findUnique({ where: { id: taskId } });
    if (!current) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    // If it is a phase, its dates are strictly derived from child tasks
    if (current.isPhase) {
      return res.json(current);
    }

    const updateData = {};
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (progress !== undefined) updateData.progress = Math.min(100, Math.max(0, parseInt(progress)));

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: updateData
    });

    if (updated.parentId) {
      await updateParentPhase(updated.parentId);
    }

    broadcastToProject(updated.projectId, "task-moved", updated);
    res.json(updated);
  } catch (error) {
    console.error("Error moving task:", error);
    res.status(500).json({ error: "Error al desplazar tarea" });
  }
});

// Delete task
router.delete("/:id", async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await prisma.task.findUnique({ where: { id: taskId } });

    if (!task) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    const projectId = task.projectId;
    const parentId = task.parentId;

    await prisma.task.delete({ where: { id: taskId } });

    if (parentId) {
      await updateParentPhase(parentId);
    }

    broadcastToProject(projectId, "task-deleted", { id: taskId, projectId });
    res.json({ success: true, message: "Tarea eliminada exitosamente" });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Error al eliminar tarea" });
  }
});

// Strict automatic rollup calculation: parent phase dates and progress defined by children
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

    const updatedPhase = await prisma.task.update({
      where: { id: phaseId },
      data: {
        startDate: minStart,
        endDate: maxEnd,
        progress: avgProg
      }
    });

    broadcastToProject(updatedPhase.projectId, "task-updated", updatedPhase);
  } catch (err) {
    console.error("Error updating parent phase:", err);
  }
}


// Reorder tasks and update hierarchy
router.post("/reorder", async (req, res) => {
  try {
    const { projectId, tasksOrder } = req.body;
    if (!projectId || !Array.isArray(tasksOrder)) {
      return res.status(400).json({ error: "projectId y tasksOrder son requeridos" });
    }

    const pId = parseInt(projectId);

    // Update all tasks in transaction
    const affectedPhaseIds = new Set();

    await prisma.$transaction(
      tasksOrder.map(item => {
        const tId = parseInt(item.id);
        const parentId = item.parentId ? parseInt(item.parentId) : null;
        if (parentId) affectedPhaseIds.add(parentId);

        return prisma.task.update({
          where: { id: tId },
          data: {
            orderIndex: parseInt(item.orderIndex),
            parentId
          }
        });
      })
    );

    // Update parent phase bounds for all phases
    const allPhases = await prisma.task.findMany({
      where: { projectId: pId, isPhase: true }
    });

    for (const phase of allPhases) {
      await updateParentPhase(phase.id);
    }

    const updatedProject = await prisma.project.findUnique({
      where: { id: pId },
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

    broadcastToProject(pId, "project-updated", updatedProject);
    res.json({ success: true, project: updatedProject });
  } catch (error) {
    console.error("Error reordering tasks:", error);
    res.status(500).json({ error: "Error al reordenar tareas" });
  }
});


// Bulk delete tasks / phases / milestones
router.post("/bulk-delete", async (req, res) => {
  try {
    const { projectId, taskIds } = req.body;
    if (!projectId || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: "projectId y taskIds son requeridos" });
    }

    const pId = parseInt(projectId);
    const parsedIds = taskIds.map(id => parseInt(id)).filter(Boolean);

    // Delete tasks in bulk
    const deleteResult = await prisma.task.deleteMany({
      where: {
        id: { in: parsedIds },
        projectId: pId
      }
    });

    // Recalculate remaining parent phases
    const remainingPhases = await prisma.task.findMany({
      where: { projectId: pId, isPhase: true }
    });
    for (const ph of remainingPhases) {
      await updateParentPhase(ph.id);
    }

    broadcastToProject(pId, "tasks-bulk-deleted", { projectId: pId, taskIds: parsedIds });
    res.json({ success: true, count: deleteResult.count, deletedIds: parsedIds });
  } catch (error) {
    console.error("Error bulk deleting tasks:", error);
    res.status(500).json({ error: "Error al eliminar tareas de forma masiva" });
  }
});


// Bulk move / shift dates for multiple tasks in lockstep
router.post("/bulk-move", async (req, res) => {
  try {
    const { projectId, moves } = req.body;
    if (!projectId || !Array.isArray(moves) || moves.length === 0) {
      return res.status(400).json({ error: "projectId y moves son requeridos" });
    }

    const pId = parseInt(projectId);
    const parsedIds = moves.map(m => parseInt(m.id)).filter(Boolean);

    const validTasks = await prisma.task.findMany({
      where: { id: { in: parsedIds }, projectId: pId }
    });
    const validIds = new Set(validTasks.map(t => t.id));

    for (const m of moves) {
      const tId = parseInt(m.id);
      if (!validIds.has(tId)) continue;
      const updateData = {};
      if (m.startDate) updateData.startDate = new Date(m.startDate);
      if (m.endDate) updateData.endDate = new Date(m.endDate);
      await prisma.task.update({
        where: { id: tId },
        data: updateData
      });
    }

    // Recalculate parent phases
    const allPhases = await prisma.task.findMany({
      where: { projectId: pId, isPhase: true }
    });
    for (const ph of allPhases) {
      await updateParentPhase(ph.id);
    }

    const updatedProject = await prisma.project.findUnique({
      where: { id: pId },
      include: {
        tasks: {
          orderBy: { orderIndex: "asc" }
        }
      }
    });

    broadcastToProject(pId, "project-updated", updatedProject);
    res.json({ success: true, count: validTasks.length });
  } catch (error) {
    console.error("Error bulk moving tasks:", error);
    res.status(500).json({ error: "Error al mover tareas en bloque" });
  }
});

module.exports = router;
