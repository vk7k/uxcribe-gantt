const jwt = require("jsonwebtoken");
const prisma = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "uxcribe_gantt_jwt_secret_key_2026";

async function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No autorizado. Token de sesión no proporcionado." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true }
    });

    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado o sesión expirada." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Sesión inválida o expirada." });
  }
}

async function authOptional(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, email: true, avatarUrl: true, role: true }
      });
      if (user) req.user = user;
    }
  } catch (e) {}
  next();
}

module.exports = {
  JWT_SECRET,
  authRequired,
  authOptional
};
