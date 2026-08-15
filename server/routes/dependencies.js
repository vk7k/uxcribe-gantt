const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { broadcastToProject } = require("../socket");

// Create dependency
router.post("/", async (req, res) => {
  try {
    const { predecessorId, successorId, type } = req.body;
    const pId = parseInt(predecessorId);
    const sId = parseInt(successorId);

    if (pId === sId) {
      return res.status(400).json({ error: "Una tarea no puede depender de sí misma" });
    }

    const predTask = await prisma.task.findUnique({ where: { id: pId } });
    const succTask = await prisma.task.findUnique({ where: { id: sId } });

    if (!predTask || !succTask) {
      return res.status(404).json({ error: "Una o ambas tareas no existen" });
    }

    // Check existing
    const existing = await prisma.dependency.findUnique({
      where: {
        predecessorId_successorId: {
          predecessorId: pId,
          successorId: sId
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: "Esta dependencia ya existe" });
    }

    const dep = await prisma.dependency.create({
      data: {
        predecessorId: pId,
        successorId: sId,
        type: type || "FS"
      },
      include: {
        predecessor: { select: { id: true, name: true } },
        successor: { select: { id: true, name: true } }
      }
    });

    broadcastToProject(predTask.projectId, "dependency-created", dep);
    res.status(201).json(dep);
  } catch (error) {
    console.error("Error creating dependency:", error);
    res.status(500).json({ error: "Error al crear dependencia" });
  }
});

// Delete dependency
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const dep = await prisma.dependency.findUnique({
      where: { id },
      include: { predecessor: { select: { projectId: true } } }
    });

    if (!dep) {
      return res.status(404).json({ error: "Dependencia no encontrada" });
    }

    const projectId = dep.predecessor.projectId;
    await prisma.dependency.delete({ where: { id } });

    broadcastToProject(projectId, "dependency-deleted", { id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar dependencia" });
  }
});

module.exports = router;
