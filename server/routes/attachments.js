const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const prisma = require("../db");
const { uploadDir } = require("../config");
const { broadcastToProject } = require("../socket");

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `att-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// Upload attachment to task
router.post("/task/:taskId", upload.single("file"), async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    if (!req.file) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo" });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true }
    });

    if (!task) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        filePath: `/uploads/${req.file.filename}`
      }
    });

    broadcastToProject(task.projectId, "attachment-uploaded", { taskId, attachment });
    res.status(201).json(attachment);
  } catch (error) {
    console.error("Error uploading attachment:", error);
    res.status(500).json({ error: "Error al subir archivo adjunto" });
  }
});

// Download attachment
router.get("/:id/download", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }

    const fullPath = path.join(uploadDir, attachment.fileName);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "El archivo físico no existe en el disco" });
    }

    res.download(fullPath, attachment.originalName);
  } catch (error) {
    res.status(500).json({ error: "Error al descargar archivo" });
  }
});

// Delete attachment
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: { task: { select: { projectId: true } } }
    });

    if (!attachment) {
      return res.status(404).json({ error: "Archivo no encontrado" });
    }

    const fullPath = path.join(uploadDir, attachment.fileName);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch(e) {}
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
