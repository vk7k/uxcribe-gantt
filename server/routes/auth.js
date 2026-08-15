const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../db");
const { JWT_SECRET, authRequired, authOptional } = require("../middleware/auth");

function generateAvatar(name) {
  const initials = (name || "U")
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const colors = ["#0284c7", "#0d9488", "#16a34a", "#ca8a04", "#ea580c", "#7c3aed", "#db2777"];
  const color = colors[Math.abs(name.charCodeAt(0)) % colors.length];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="32" fill="${color}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="24" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// 1. Register User & process pending invitations
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nombre, correo y contraseña son obligatorios." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existing) {
      return res.status(400).json({ error: "El correo electrónico ya está registrado." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const avatarUrl = generateAvatar(name);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        avatarUrl,
        role: role || "MEMBER"
      },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, createdAt: true }
    });

    // Check and fulfill any pending invitations for this email
    const pendingInvites = await prisma.invitation.findMany({
      where: { email: cleanEmail, status: "PENDING" }
    });

    for (const inv of pendingInvites) {
      if (inv.projectId) {
        try {
          await prisma.projectMember.create({
            data: {
              projectId: inv.projectId,
              userId: user.id,
              role: inv.role
            }
          });
        } catch (e) {}
      }
      if (inv.workspaceId) {
        try {
          await prisma.workspaceMember.create({
            data: {
              workspaceId: inv.workspaceId,
              userId: user.id,
              role: inv.role
            }
          });
        } catch (e) {}
      }
      await prisma.invitation.update({
        where: { id: inv.id },
        data: { status: "ACCEPTED" }
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });

    res.status(201).json({
      success: true,
      user,
      token,
      acceptedInvitesCount: pendingInvites.length
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Error al registrar usuario." });
  }
});

// 2. Login User
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Por favor ingresa correo y contraseña." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (!user) {
      return res.status(400).json({ error: "Credenciales incorrectas." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Credenciales incorrectas." });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Error al iniciar sesión." });
  }
});

// 3. Current User Profile (/me)
router.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

// 4. List All Users
router.get("/users", authRequired, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true
      },
      orderBy: { name: "asc" }
    });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Error al obtener lista de usuarios." });
  }
});

// 5. Update Profile
router.put("/profile", authRequired, async (req, res) => {
  try {
    const { name, avatarUrl, password } = req.body;
    const updateData = {};

    if (name) updateData.name = name.trim();
    if (avatarUrl) updateData.avatarUrl = avatarUrl;
    if (password && password.length >= 6) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: { id: true, name: true, email: true, avatarUrl: true, role: true }
    });

    res.json({ success: true, user: updated });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Error al actualizar perfil." });
  }
});

module.exports = router;
