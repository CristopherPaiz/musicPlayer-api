import { getDb } from "../database/connection.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const saltRounds = 10; // Número de rondas de sal para el hash
const jwtSecretKey = process.env.JWT_SECRET_KEY;
const jwtExpirationTime = "7d"; // El token durará 7 días

export const register = async (req, res) => {
  const { username, password, nombre } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Nombre de usuario y contraseña son obligatorios" });
  }

  try {
    const db = await getDb();
    const { rows: existingUsers } = await db.execute({
      sql: "SELECT id FROM Usuarios WHERE username = ?",
      args: [username],
    });

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: "El nombre de usuario ya existe." });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await db.execute({
      sql: "INSERT INTO Usuarios (username, password, nombre) VALUES (?, ?, ?)",
      args: [username, hashedPassword, nombre || null],
    });

    const userId = result?.lastInsertRowid ? Number(result.lastInsertRowid) : null;

    return res.status(201).json({
      message: "Usuario registrado exitosamente.",
      user: { id: userId, username, nombre: nombre || null },
    });
  } catch (error) {
    console.error("Error registrando usuario:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};

export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Nombre de usuario y contraseña son obligatorios." });
  }

  try {
    const db = await getDb();
    const { rows: users } = await db.execute({
      sql: "SELECT * FROM Usuarios WHERE username = ? AND activo = 1",
      args: [username],
    });

    if (users.length === 0) {
      return res.status(401).json({ message: "Credenciales inválidas o usuario inactivo." });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    await db.execute({
      sql: "UPDATE Usuarios SET ultimo_login = STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW') WHERE id = ?",
      args: [user.id],
    });

    const token = jwt.sign({ userId: user.id, username: user.username }, jwtSecretKey, { expiresIn: jwtExpirationTime });

    res.cookie("token", token, {
      httpOnly: true, // El frontend no puede acceder a la cookie con JS
      secure: process.env.NODE_ENV === "production", // Solo enviar por HTTPS en producción
      sameSite: "lax", // O 'strict' para mayor seguridad
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días en milisegundos
    });

    return res.status(200).json({
      message: "Inicio de sesión exitoso.",
      user: { id: user.id, username: user.username, nombre: user.nombre },
    });
  } catch (error) {
    console.error("Error en inicio de sesión:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};

export const logout = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0), // Expira la cookie inmediatamente
  });
  return res.status(200).json({ message: "Sesión cerrada exitosamente." });
};

export const getMe = async (req, res) => {
  // Esta función se ejecuta DESPUÉS del middleware de autenticación
  try {
    const db = await getDb();
    const { rows: users } = await db.execute({
      sql: "SELECT id, username, nombre FROM Usuarios WHERE id = ? AND activo = 1",
      args: [req.user.userId],
    });

    if (users.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado o inactivo." });
    }

    return res.status(200).json({ user: users[0] });
  } catch (error) {
    console.error("Error en getMe:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};
