const express = require("express");
const router = express.Router();
const multer = require("multer");
const prisma = require("../db");
const storageService = require("../services/storage");
const { authOptional } = require("../middleware/auth");
const { broadcastToProject } = require("../socket");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Upload attachment to task
router.post("/task/:taskId", authOptional, upload.single("file"), async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    if (!req.file) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo." });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true }
    });

    if (!task) {
      return res.status(404).json({ error: "Tarea no encontrada." });
    }

    const userId = req.user ? req.user.id : null;

    const attachment = await storageService.saveTaskAttachment({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      taskId,
      userId
    });

    // Don't send large buffer over JSON
    const { fileData, ...cleanAttachment } = attachment;

    broadcastToProject(task.projectId, "attachment-uploaded", { taskId, attachment: cleanAttachment });
    res.status(201).json(cleanAttachment);
  } catch (error) {
    console.error("Error uploading attachment:", error);
    res.status(400).json({ error: error.message || "Error al subir archivo adjunto" });
  }
});

// Download / View attachment
router.get("/:id/download", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const content = await storageService.getAttachmentContent(id);

    if (content.type === "redirect") {
      return res.redirect(content.url);
    }

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(content.originalName)}"`);
    res.setHeader("Content-Type", content.mimeType || "application/octet-stream");

    if (content.type === "file") {
      return res.sendFile(content.filePath);
    } else if (content.type === "buffer") {
      return res.send(content.buffer);
    }
  } catch (error) {
    console.error("Error downloading attachment:", error);
    res.status(404).json({ error: error.message || "Error al descargar archivo" });
  }
});

// View inline / preview
router.get("/:id/view", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const content = await storageService.getAttachmentContent(id);

    if (content.type === "redirect") {
      return res.redirect(content.url);
    }

    res.setHeader("Content-Type", content.mimeType || "application/octet-stream");

    if (content.type === "file") {
      return res.sendFile(content.filePath);
    } else if (content.type === "buffer") {
      return res.send(content.buffer);
    }
  } catch (error) {
    res.status(404).json({ error: error.message || "Error al visualizar archivo" });
  }
});

// Delete attachment
router.delete("/:id", authOptional, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: { task: { select: { projectId: true } } }
    });

    if (!attachment) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }

    const projectId = attachment.task.projectId;
    const taskId = attachment.taskId;

    await prisma.attachment.delete({ where: { id } });

    broadcastToProject(projectId, "attachment-deleted", { taskId, attachmentId: id });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    res.status(500).json({ error: "Error al eliminar archivo" });
  }
});

module.exports = router;
