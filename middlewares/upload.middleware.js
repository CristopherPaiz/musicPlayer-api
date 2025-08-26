import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { uploadFile } from "../services/scaleway.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, "..", "temp");

fs.mkdir(tempDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const audioFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("audio/")) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos de audio."), false);
  }
};

export const uploadTemp = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: audioFilter,
});

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos de imagen."), false);
  }
};

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const handleScalewayImageUpload = (fieldName, folder) => {
  return (req, res, next) => {
    memoryUpload.single(fieldName)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      if (!req.file) {
        return next();
      }
      try {
        const playlistId = req.params.id;
        const timestamp = Date.now();
        const extension = path.extname(req.file.originalname) || ".webp";
        const s3Key = `${folder}/${playlistId}-${timestamp}${extension}`;

        await uploadFile(s3Key, req.file.buffer, req.file.mimetype);

        req.s3Key = s3Key;
        next();
      } catch (uploadError) {
        console.error("Error al subir a Scaleway S3:", uploadError);
        return res.status(500).json({ message: "Error interno al subir la imagen." });
      }
    });
  };
};
