import { getDb } from "../database/connection.js";
import { extractMetadata } from "../services/metadata.service.js";
import { segmentAudio } from "../services/ffmpeg.service.js";
import { uploadFile, getSecureFileUrl, deleteFolder } from "../services/scaleway.service.js";
import { v4 as uuidv4 } from "uuid";
import { promises as fs } from "fs";
import path from "path";

export const uploadAndExtract = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No se ha subido ningún archivo de audio." });
  }
  const tempFilePath = req.file.path;
  try {
    const metadata = await extractMetadata(tempFilePath);
    const coverBase64 = metadata.cover ? metadata.cover.toString("base64") : null;
    res.status(200).json({
      message: "Metadatos extraídos. Por favor, confirma la información.",
      tempFilename: req.file.filename,
      metadata: { ...metadata, cover: coverBase64 },
    });
  } catch (error) {
    await fs.unlink(tempFilePath);
    res.status(500).json({ message: error.message });
  }
};

export const processAndSave = async (req, res) => {
  const { tempFilename, titulo, artista, album } = req.body;
  if (!tempFilename || !titulo || !artista) {
    return res.status(400).json({ message: "Falta información para procesar la canción." });
  }
  const songUUID = uuidv4();
  const inputPath = path.join("temp", tempFilename);
  const outputDir = path.join("temp", songUUID);
  try {
    const { duracion, lyrics, cover, coverMimeType } = await extractMetadata(inputPath);
    if (!duracion) {
      throw new Error("No se pudo determinar la duración del archivo.");
    }
    await segmentAudio(inputPath, outputDir, duracion);
    const createdFiles = await fs.readdir(outputDir);

    // --- CAMBIO: Buscar archivos .webm en lugar de .mp3 ---
    const fragmentFiles = createdFiles.filter((file) => file.endsWith(".webm"));
    const actualFragmentCount = fragmentFiles.length;

    if (actualFragmentCount === 0) {
      throw new Error("FFmpeg no generó fragmentos de audio.");
    }
    const uploadPromises = [];
    const s3Folder = `songs/${songUUID}`;
    for (const fragmentFilename of fragmentFiles) {
      const fragmentPath = path.join(outputDir, fragmentFilename);
      const fragmentBuffer = await fs.readFile(fragmentPath);
      // --- CAMBIO: ContentType a audio/webm ---
      uploadPromises.push(uploadFile(`${s3Folder}/${fragmentFilename}`, fragmentBuffer, "audio/webm"));
    }
    if (cover) {
      uploadPromises.push(uploadFile(`${s3Folder}/cover.webp`, cover, coverMimeType || "image/webp"));
    }
    if (lyrics) {
      const lyricsBuffer = Buffer.from(lyrics, "utf-8");
      uploadPromises.push(uploadFile(`${s3Folder}/lyrics.lrc`, lyricsBuffer, "text/plain"));
    }
    await Promise.all(uploadPromises);
    const db = await getDb();
    await db.execute({
      sql: "INSERT INTO Canciones (uuid, titulo, artista, album, duracion, fragmentos) VALUES (?, ?, ?, ?, ?, ?)",
      args: [songUUID, titulo, artista, album || null, duracion, actualFragmentCount],
    });
    res.status(201).json({ message: "¡Canción procesada y guardada exitosamente!", uuid: songUUID });
  } catch (error) {
    await deleteFolder(`songs/${songUUID}/`);
    res.status(500).json({ message: `Error en el procesamiento: ${error.message}` });
  } finally {
    await fs.rm(inputPath, { force: true });
    await fs.rm(outputDir, { recursive: true, force: true });
  }
};

export const getCancionInfo = async (req, res) => {
  const { uuid } = req.params;
  try {
    const db = await getDb();
    const { rows: songs } = await db.execute({
      sql: "SELECT id, uuid, titulo, artista, album, duracion, fragmentos FROM Canciones WHERE uuid = ? AND activo = 1",
      args: [uuid],
    });
    if (songs.length === 0) {
      return res.status(404).json({ message: "Canción no encontrada." });
    }
    const song = songs[0];
    const coverUrl = await getSecureFileUrl(`songs/${uuid}/cover.webp`);
    const lyricsUrl = await getSecureFileUrl(`songs/${uuid}/lyrics.lrc`);
    res.status(200).json({ ...song, coverUrl, lyricsUrl });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export const getFragmentSecureUrl = async (req, res) => {
  const { uuid, fragmentNum } = req.params;
  const num = parseInt(fragmentNum, 10);
  try {
    const db = await getDb();
    const { rows: songs } = await db.execute({
      sql: "SELECT fragmentos FROM Canciones WHERE uuid = ? AND activo = 1",
      args: [uuid],
    });
    if (songs.length === 0) {
      return res.status(404).json({ message: "Canción no encontrada." });
    }
    const song = songs[0];
    if (isNaN(num) || num < 1 || num > song.fragmentos) {
      return res.status(400).json({ message: "Número de fragmento inválido." });
    }
    // --- CAMBIO: Pedir la URL para el archivo .webm ---
    const fragmentKey = `songs/${uuid}/${num}.webm`;
    const secureUrl = await getSecureFileUrl(fragmentKey, 600);
    res.status(200).json({ url: secureUrl });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export const getFragmentSecureUrlsBatch = async (req, res) => {
  const { uuid } = req.params;
  const { start, count } = req.query;

  const startIndex = parseInt(start, 10);
  const numFragments = parseInt(count, 10);

  if (isNaN(startIndex) || isNaN(numFragments) || startIndex < 1 || numFragments <= 0) {
    return res.status(400).json({ message: "Parámetros 'start' y 'count' inválidos." });
  }

  try {
    const db = await getDb();
    const { rows: songs } = await db.execute({
      sql: "SELECT fragmentos FROM Canciones WHERE uuid = ? AND activo = 1",
      args: [uuid],
    });

    if (songs.length === 0) {
      return res.status(404).json({ message: "Canción no encontrada." });
    }
    const song = songs[0];

    const urlPromises = [];
    const endIndex = Math.min(startIndex + numFragments - 1, song.fragmentos);

    for (let i = startIndex; i <= endIndex; i++) {
      // --- CAMBIO: Pedir la URL para el archivo .webm ---
      const fragmentKey = `songs/${uuid}/${i}.webm`;
      urlPromises.push(getSecureFileUrl(fragmentKey, 600).then((url) => ({ index: i, url })));
    }

    const urls = await Promise.all(urlPromises);
    res.status(200).json(urls);
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export const getAllCancionesAdmin = async (req, res) => {
  try {
    const db = await getDb();
    const { rows } = await db.execute(
      "SELECT id, uuid, titulo, artista, album, duracion, fragmentos, activo, fecha_subida FROM Canciones ORDER BY fecha_subida DESC"
    );
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export const updateCancion = async (req, res) => {
  const { id } = req.params;
  const { titulo, artista, album, activo } = req.body;
  if (!titulo || !artista) {
    return res.status(400).json({ message: "Título y artista son obligatorios." });
  }
  try {
    const db = await getDb();
    await db.execute({
      sql: "UPDATE Canciones SET titulo = ?, artista = ?, album = ?, activo = ? WHERE id = ?",
      args: [titulo, artista, album || null, activo ? 1 : 0, id],
    });
    res.status(200).json({ message: "Canción actualizada exitosamente." });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export const deleteCancion = async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const {
      rows: [song],
    } = await db.execute({
      sql: "SELECT uuid FROM Canciones WHERE id = ?",
      args: [id],
    });
    if (song) {
      await deleteFolder(`songs/${song.uuid}/`);
    }
    await db.execute({
      sql: "DELETE FROM Canciones WHERE id = ?",
      args: [id],
    });
    res.status(200).json({ message: "Canción eliminada exitosamente (incluyendo archivos)." });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};
