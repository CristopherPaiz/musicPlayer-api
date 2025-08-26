import express from "express";
import { register, login, logout, getMe } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Ruta para registrar un nuevo administrador (podrías querer protegerla después)
router.post("/register", register);

// Ruta para el inicio de sesión
router.post("/login", login);

// Ruta para el cierre de sesión
router.post("/logout", logout);

// Ruta protegida para verificar quién es el usuario actual
// Se usa el middleware ANTES de llegar al controlador
router.get("/me", authMiddleware, getMe);

export default router;
