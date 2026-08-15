const fs = require("fs");
const path = require("path");
const config = require("../config");
const prisma = require("../db");

// Optional Cloudinary integration
let cloudinary = null;
if (process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)) {
  try {
    cloudinary = require("cloudinary").v2;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
    }
    console.log("☁️ Cloudinary cloud storage initialized.");
  } catch (e) {
    console.warn("Could not initialize Cloudinary:", e.message);
  }
}

// Configurable DB storage limit (default 10 MB)
const MAX_DB_FILE_SIZE_MB = parseInt(process.env.MAX_DB_FILE_SIZE_MB || "10", 10);
const MAX_DB_FILE_SIZE_BYTES = MAX_DB_FILE_SIZE_MB * 1024 * 1024;

class StorageService {
  isCloudStorageEnabled() {
    return !!cloudinary;
  }

  getMaxDbFileSizeMB() {
    return MAX_DB_FILE_SIZE_MB;
  }

  async saveTaskAttachment({ buffer, originalName, mimeType, taskId, userId = null }) {
    const fileSize = buffer.length;
    const fileExt = path.extname(originalName) || ".bin";
    const uniqueFileName = `file-${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;

    let storageProvider = "db";
    let filePath = `/uploads/${uniqueFileName}`;
    let fileData = buffer;

    // 1. Cloudinary storage (if configured)
    if (cloudinary) {
      storageProvider = "cloudinary";
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "uxcribe-gantt",
              resource_type: "auto",
              public_id: path.parse(uniqueFileName).name
            },
            (err, result) => {
              if (err) return reject(err);
              resolve(result);
            }
          );
          uploadStream.end(buffer);
        });

        filePath = uploadResult.secure_url;
        fileData = null; // No need to store BLOB in DB if in Cloudinary
      } catch (cloudErr) {
        console.error("Cloudinary upload failed, falling back to DB storage:", cloudErr.message);
        storageProvider = "db";
        fileData = buffer;
      }
    }

    // 2. Database BLOB storage size check
    if (storageProvider === "db") {
      if (fileSize > MAX_DB_FILE_SIZE_BYTES) {
        throw new Error(
          `El archivo (${(fileSize / (1024 * 1024)).toFixed(1)} MB) supera el límite de ${MAX_DB_FILE_SIZE_MB} MB para almacenamiento directo en base de datos. Para archivos mayores, configura Cloudinary o almacenamiento S3.`
        );
      }
    }

    // 3. Local disk cache (ephemeral cache for quick serving)
    try {
      const diskPath = path.join(config.uploadDir, uniqueFileName);
      fs.writeFileSync(diskPath, buffer);
    } catch (diskErr) {
      console.warn("Could not write to local disk cache:", diskErr.message);
    }

    // 4. Save metadata and BLOB to database
    const attachment = await prisma.attachment.create({
      data: {
        taskId: parseInt(taskId),
        userId: userId ? parseInt(userId) : null,
        fileName: uniqueFileName,
        originalName,
        fileSize,
        mimeType,
        filePath,
        fileData,
        storageProvider
      }
    });

    return attachment;
  }

  async getAttachmentContent(attachmentId) {
    const attachment = await prisma.attachment.findUnique({
      where: { id: parseInt(attachmentId) }
    });

    if (!attachment) {
      throw new Error("Archivo adjunto no encontrado");
    }

    // If Cloudinary / external URL
    if (attachment.storageProvider === "cloudinary" && attachment.filePath.startsWith("http")) {
      return {
        type: "redirect",
        url: attachment.filePath,
        mimeType: attachment.mimeType,
        originalName: attachment.originalName
      };
    }

    // If local file exists in disk cache
    const diskPath = path.join(config.uploadDir, attachment.fileName);
    if (fs.existsSync(diskPath)) {
      return {
        type: "file",
        filePath: diskPath,
        mimeType: attachment.mimeType,
        originalName: attachment.originalName
      };
    }

    // If disk cache is missing (e.g. after container redeploy), restore from MySQL LONGBLOB!
    if (attachment.fileData) {
      // Recreate disk cache
      try {
        fs.writeFileSync(diskPath, attachment.fileData);
      } catch (e) {}

      return {
        type: "buffer",
        buffer: attachment.fileData,
        mimeType: attachment.mimeType,
        originalName: attachment.originalName
      };
    }

    throw new Error("El contenido del archivo no está disponible.");
  }
}

module.exports = new StorageService();
