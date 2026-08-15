const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { broadcastToProject } = require("../socket");

// Add checklist item
router.post("/task/:taskId", async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "El texto del item es obligatorio" });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true }
    });

    if (!task) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    const count = await prisma.checklistItem.count({ where: { taskId } });

    const item = await prisma.checklistItem.create({
      data: {
        taskId,
        text: text.trim(),
        completed: false,
        orderIndex: count + 1
      }
    });

    broadcastToProject(task.projectId, "checklist-added", { taskId, item });
    res.status(201).json(item);
  } catch (error) {
    console.error("Error creating checklist item:", error);
    res.status(500).json({ error: "Error al crear item de checklist" });
  }
});

// Toggle checklist item
router.patch("/:id/toggle", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const current = await prisma.checklistItem.findUnique({
      where: { id },
      include: { task: { select: { projectId: true } } }
    });

    if (!current) {
      return res.status(404).json({ error: "Item no encontrado" });
    }

    const updated = await prisma.checklistItem.update({
      where: { id },
      data: { completed: !current.completed }
    });

    broadcastToProject(current.task.projectId, "checklist-updated", {
      taskId: current.taskId,
      item: updated
    });

    res.json(updated);
  } catch (error) {
    console.error("Error toggling checklist item:", error);
    res.status(500).json({ error: "Error al actualizar item" });
  }
});

// Update checklist item text
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { text } = req.body;

    const current = await prisma.checklistItem.findUnique({
      where: { id },
      include: { task: { select: { projectId: true } } }
    });

    if (!current) {
      return res.status(404).json({ error: "Item no encontrado" });
    }

    const updated = await prisma.checklistItem.update({
      where: { id },
      data: { text: text.trim() }
    });

    broadcastToProject(current.task.projectId, "checklist-updated", {
      taskId: current.taskId,
      item: updated
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar texto del item" });
  }
});

// Delete checklist item
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const item = await prisma.checklistItem.findUnique({
      where: { id },
      include: { task: { select: { projectId: true } } }
    });

    if (!item) {
      return res.status(404).json({ error: "Item no encontrado" });
    }

    const projectId = item.task.projectId;
    const taskId = item.taskId;

    await prisma.checklistItem.delete({ where: { id } });

    broadcastToProject(projectId, "checklist-deleted", { taskId, itemId: id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar item" });
  }
});

module.exports = router;
