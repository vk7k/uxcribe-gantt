const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadDir } = require("../config");
const storageService = require("../services/storage");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen"), false);
    }
  }
});

// Inline image upload for WYSIWYG rich text editor
router.post("/inline-image", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se proporcionó imagen" });
  }

  try {
    const ext = path.extname(req.file.originalname) || ".png";
    const uniqueSuffix = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    // If Cloudinary active
    if (storageService.isCloudStorageEnabled()) {
      const cloudinary = require("cloudinary").v2;
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "uxcribe-gantt/inline", resource_type: "image" },
          (err, result) => {
            if (err) return reject(err);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      return res.json({ url: uploadResult.secure_url, fileName: uniqueSuffix });
    }

    // Default: write to local disk cache & fallback to base64 DataURL if needed
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const diskPath = path.join(uploadDir, uniqueSuffix);
    fs.writeFileSync(diskPath, req.file.buffer);

    const url = `/uploads/${uniqueSuffix}`;
    res.json({ url, fileName: uniqueSuffix, originalName: req.file.originalname });
  } catch (error) {
    console.error("Error uploading inline image:", error);
    res.status(500).json({ error: "Error al procesar la imagen." });
  }
});

module.exports = router;
