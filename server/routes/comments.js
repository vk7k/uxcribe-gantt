const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { authOptional } = require("../middleware/auth");
const { broadcastToProject } = require("../socket");

// Add comment to task
router.post("/task/:taskId", authOptional, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { authorName, authorAvatar, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "El contenido del comentario no puede estar vacío" });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true }
    });

    if (!task) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    let finalAuthorName = authorName || "Colaborador";
    let finalAuthorAvatar = authorAvatar || null;
    let userId = null;

    if (req.user) {
      finalAuthorName = req.user.name;
      finalAuthorAvatar = req.user.avatarUrl;
      userId = req.user.id;
    }

    const comment = await prisma.comment.create({
      data: {
        taskId,
        userId,
        authorName: finalAuthorName,
        authorAvatar: finalAuthorAvatar,
        content: content.trim()
      }
    });

    broadcastToProject(task.projectId, "comment-added", { taskId, comment });
    res.status(201).json(comment);
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: "Error al agregar comentario" });
  }
});

// Delete comment
router.delete("/:id", authOptional, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: { task: { select: { projectId: true } } }
    });

    if (!comment) {
      return res.status(404).json({ error: "Comentario no encontrado" });
    }

    const projectId = comment.task.projectId;
    const taskId = comment.taskId;

    await prisma.comment.delete({ where: { id } });

    broadcastToProject(projectId, "comment-deleted", { taskId, commentId: id });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Error al eliminar comentario" });
  }
});

module.exports = router;
