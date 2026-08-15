const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const prisma = require("../db");
const emailService = require("../services/email");

// 1. List Workspaces accessible to current user (owned or member)
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;

    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } }
          }
        },
        _count: {
          select: { projects: true, members: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    res.json(workspaces);
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    res.status(500).json({ error: "Error al obtener espacios de trabajo" });
  }
});

// 2. Create Workspace
router.post("/", async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "El nombre del espacio de trabajo es obligatorio" });
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: name.trim(),
        description: description || "",
        color: color || "#0284c7",
        ownerId: req.user.id
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: true
      }
    });

    res.status(201).json(workspace);
  } catch (error) {
    console.error("Error creating workspace:", error);
    res.status(500).json({ error: "Error al crear espacio de trabajo" });
  }
});

// 3. Share / Invite Member to Workspace by Email
router.post("/:id/share", async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const { email, role = "EDITOR" } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: "El correo electrónico es requerido." });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check workspace permission (must be owner or ADMIN member)
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: true,
        members: { where: { userId: req.user.id } }
      }
    });

    if (!workspace) {
      return res.status(404).json({ error: "Espacio de trabajo no encontrado." });
    }

    const isOwner = workspace.ownerId === req.user.id;
    const isAdmin = workspace.members[0]?.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Solo el dueño o administradores pueden invitar miembros." });
    }

    // Check if target user exists in database
    const targetUser = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    const host = req.get("host");
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    if (targetUser) {
      if (targetUser.id === workspace.ownerId) {
        return res.status(400).json({ error: "El usuario ya es el dueño del espacio de trabajo." });
      }

      // Check if already a member
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: targetUser.id }
        }
      });

      if (existingMember) {
        // Update role if changed
        await prisma.workspaceMember.update({
          where: { id: existingMember.id },
          data: { role }
        });
        return res.json({ success: true, message: `Rol de ${targetUser.name} actualizado a ${role}.` });
      }

      // Add member directly
      const newMember = await prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: targetUser.id,
          role
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } }
        }
      });

      // Send email notification
      await emailService.sendWorkspaceInvitation({
        toEmail: cleanEmail,
        inviterName: req.user.name,
        workspaceName: workspace.name,
        role,
        inviteUrl: `${baseUrl}/#workspace-${workspaceId}`,
        isNewUser: false
      });

      return res.status(201).json({
        success: true,
        member: newMember,
        message: `Se añadió a ${targetUser.name} y se le notificó por correo.`
      });
    } else {
      // User is not registered: create Invitation token
      const token = crypto.randomBytes(24).toString("hex");

      await prisma.invitation.create({
        data: {
          email: cleanEmail,
          workspaceId,
          role,
          token,
          invitedById: req.user.id
        }
      });

      const inviteUrl = `${baseUrl}/?invite=${token}`;

      await emailService.sendWorkspaceInvitation({
        toEmail: cleanEmail,
        inviterName: req.user.name,
        workspaceName: workspace.name,
        role,
        inviteUrl,
        isNewUser: true
      });

      return res.status(201).json({
        success: true,
        pending: true,
        message: `Invitación enviada por correo a ${cleanEmail}.`
      });
    }
  } catch (error) {
    console.error("Error sharing workspace:", error);
    res.status(500).json({ error: "Error al compartir espacio de trabajo" });
  }
});

// 4. Remove member from workspace
router.delete("/:id/members/:userId", async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    });

    if (!workspace) return res.status(404).json({ error: "Espacio de trabajo no encontrado" });
    if (workspace.ownerId !== req.user.id && req.user.id !== targetUserId) {
      return res.status(403).json({ error: "No tienes permiso para remover este miembro" });
    }

    await prisma.workspaceMember.deleteMany({
      where: { workspaceId, userId: targetUserId }
    });

    res.json({ success: true, message: "Miembro removido exitosamente" });
  } catch (error) {
    console.error("Error removing workspace member:", error);
    res.status(500).json({ error: "Error al remover miembro" });
  }
});

// 5. Update Workspace
router.put("/:id", async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const { name, description, color } = req.body;

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Solo el dueño puede editar este espacio de trabajo" });
    }

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(color && { color })
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar espacio de trabajo" });
  }
});

// 6. Delete Workspace
router.delete("/:id", async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Solo el dueño puede eliminar este espacio de trabajo" });
    }

    await prisma.workspace.delete({ where: { id: workspaceId } });
    res.json({ success: true, message: "Espacio de trabajo eliminado" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar espacio de trabajo" });
  }
});

module.exports = router;
