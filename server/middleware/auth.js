const jwt = require("jsonwebtoken");
const prisma = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "uxcribe_gantt_jwt_secret_key_2026";

async function authRequired(req, res, next) {
  try {
    let token = null;

    // Check Authorization Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query && req.query.token) {
      // Allow token via query param for direct browser file downloads/previews
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: "No autorizado. Debes iniciar sesión para continuar." });
    }

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
    return res.status(401).json({ error: "Sesión inválida o expirada. Por favor inicia sesión nuevamente." });
  }
}

async function authOptional(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (token) {
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
