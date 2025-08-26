import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { getDb } from "./database/connection.js";

// --- IMPORTACIÓN DE RUTAS ---
import authRoutes from "./routes/auth.routes.js";
import cancionesRoutes from "./routes/canciones.routes.js";
import playlistsRoutes from "./routes/playlists.routes.js"; // <-- NUEVA LÍNEA

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Servidor funcionando correctamente." });
});

// --- USO DE RUTAS ---
app.use("/api/auth", authRoutes);
app.use("/api/canciones", cancionesRoutes);
app.use("/api/playlists", playlistsRoutes); // <-- NUEVA LÍNEA

const startServer = async () => {
  try {
    await getDb();
    app.listen(port, () => {
      console.log(`Servidor corriendo en http://localhost:${port}`);
    });
  } catch (err) {
    console.error("Error fatal al iniciar el servidor:", err.message);
    process.exit(1);
  }
};

startServer();
