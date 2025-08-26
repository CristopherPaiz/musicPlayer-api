import express from "express";
import {
  uploadAndExtract,
  processAndSave,
  getCancionInfo,
  getFragmentSecureUrl,
  getAllCancionesAdmin,
  updateCancion,
  deleteCancion,
  getFragmentSecureUrlsBatch,
} from "../controllers/canciones.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { uploadTemp } from "../middlewares/upload.middleware.js";

const router = express.Router();

router.post("/admin/upload-extract", authMiddleware, uploadTemp.single("audioFile"), uploadAndExtract);
router.post("/admin/process-save", authMiddleware, processAndSave);
router.get("/admin", authMiddleware, getAllCancionesAdmin);
router.put("/admin/:id", authMiddleware, updateCancion);
router.delete("/admin/:id", authMiddleware, deleteCancion);
router.get("/:uuid/info", getCancionInfo);
router.get("/:uuid/fragments/secure-urls", getFragmentSecureUrlsBatch);
router.get("/:uuid/fragment/:fragmentNum/secure-url", getFragmentSecureUrl);

export default router;
