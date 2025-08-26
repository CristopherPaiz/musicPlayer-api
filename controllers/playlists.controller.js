import { getDb } from "../database/connection.js";
import { getSecureFileUrl } from "../services/scaleway.service.js";

const addSecureCoverUrlsToPlaylists = async (playlists) => {
  return Promise.all(
    playlists.map(async (p) => {
      if (p.cover_url) {
        const secureUrl = await getSecureFileUrl(p.cover_url);
        return { ...p, cover_url: secureUrl };
      }
      return { ...p, cover_url: "https://cdn-icons-png.flaticon.com/512/14793/14793826.png" };
    })
  );
};

const getAllPlaylists = async (req, res) => {
  try {
    const db = await getDb();
    const { rows } = await db.execute("SELECT id, nombre, descripcion, cover_url, orden FROM Playlists ORDER BY orden ASC, nombre ASC");
    const playlistsWithUrls = await addSecureCoverUrlsToPlaylists(rows);
    res.status(200).json(playlistsWithUrls);
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const getPlaylistWithSongs = async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const { rows: playlistResult } = await db.execute({
      sql: "SELECT id, nombre, descripcion, cover_url FROM Playlists WHERE id = ?",
      args: [id],
    });

    if (playlistResult.length === 0) {
      return res.status(404).json({ message: "Playlist no encontrada." });
    }
    const playlist = (await addSecureCoverUrlsToPlaylists(playlistResult))[0];

    const { rows: songs } = await db.execute({
      sql: `
        SELECT c.id, c.uuid, c.titulo, c.artista, c.album, c.duracion, c.fragmentos
        FROM Canciones c
        JOIN PlaylistCanciones pc ON c.id = pc.id_cancion
        WHERE pc.id_playlist = ? AND c.activo = 1
      `,
      args: [id],
    });

    const songsWithUrls = await Promise.all(
      songs.map(async (song) => {
        const [coverUrl, lyricsUrl] = await Promise.all([
          getSecureFileUrl(`songs/${song.uuid}/cover.webp`),
          getSecureFileUrl(`songs/${song.uuid}/lyrics.lrc`),
        ]);
        return { ...song, coverUrl, lyricsUrl };
      })
    );

    playlist.canciones = songsWithUrls;
    res.status(200).json(playlist);
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const createPlaylist = async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre) return res.status(400).json({ message: "El nombre es obligatorio." });
  try {
    const db = await getDb();
    const result = await db.execute({
      sql: "INSERT INTO Playlists (nombre, descripcion) VALUES (?, ?)",
      args: [nombre, descripcion || null],
    });
    const newId = result.lastInsertRowid ? Number(result.lastInsertRowid) : null;
    res.status(201).json({ message: "Playlist creada exitosamente.", id: newId, nombre });
  } catch (error) {
    if (error.message?.includes("UNIQUE constraint failed")) {
      return res.status(409).json({ message: "Ya existe una playlist con ese nombre." });
    }
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const addSongToPlaylist = async (req, res) => {
  const { playlistId, cancionId } = req.params;
  try {
    const db = await getDb();
    await db.execute({
      sql: "INSERT OR IGNORE INTO PlaylistCanciones (id_playlist, id_cancion) VALUES (?, ?)",
      args: [playlistId, cancionId],
    });
    res.status(200).json({ message: "Canción añadida a la playlist." });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const removeSongFromPlaylist = async (req, res) => {
  const { playlistId, cancionId } = req.params;
  try {
    const db = await getDb();
    await db.execute({
      sql: "DELETE FROM PlaylistCanciones WHERE id_playlist = ? AND id_cancion = ?",
      args: [playlistId, cancionId],
    });
    res.status(200).json({ message: "Canción eliminada de la playlist." });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const getAllPlaylistsAdmin = async (req, res) => {
  try {
    const db = await getDb();
    const { rows } = await db.execute("SELECT * FROM Playlists ORDER BY orden ASC, fecha_creacion DESC");
    const playlistsWithData = await Promise.all(
      rows.map(async (playlist) => {
        const { rows: songs } = await db.execute({
          sql: "SELECT id_cancion FROM PlaylistCanciones WHERE id_playlist = ?",
          args: [playlist.id],
        });
        const cover_url = playlist.cover_url ? await getSecureFileUrl(playlist.cover_url) : null;
        return { ...playlist, canciones_ids: songs.map((s) => s.id_cancion), cover_url };
      })
    );
    res.status(200).json(playlistsWithData);
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const updatePlaylistOrder = async (req, res) => {
  const { playlists } = req.body;
  if (!Array.isArray(playlists)) return res.status(400).json({ message: "Se esperaba un array de playlists." });
  try {
    const db = await getDb();
    const statements = playlists.map((p) => ({ sql: "UPDATE Playlists SET orden = ? WHERE id = ?", args: [p.orden, p.id] }));
    await db.batch(statements, "write");
    res.status(200).json({ message: "Orden de las playlists actualizado." });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const updatePlaylistCover = async (req, res) => {
  const { id } = req.params;
  const s3Key = req.s3Key;
  if (!s3Key) return res.status(400).json({ message: "No se subió ninguna imagen." });
  try {
    const db = await getDb();
    await db.execute({ sql: "UPDATE Playlists SET cover_url = ? WHERE id = ?", args: [s3Key, id] });
    const secureUrl = await getSecureFileUrl(s3Key);
    res.status(200).json({ message: "Carátula actualizada.", cover_url: secureUrl });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const updatePlaylist = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;
  if (!nombre) return res.status(400).json({ message: "El nombre es obligatorio." });
  try {
    const db = await getDb();
    await db.execute({ sql: "UPDATE Playlists SET nombre = ?, descripcion = ? WHERE id = ?", args: [nombre, descripcion || null, id] });
    res.status(200).json({ message: "Playlist actualizada." });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const deletePlaylist = async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    await db.execute({ sql: "DELETE FROM Playlists WHERE id = ?", args: [id] });
    res.status(200).json({ message: "Playlist eliminada." });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

export {
  getAllPlaylists,
  getPlaylistWithSongs,
  createPlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  getAllPlaylistsAdmin,
  updatePlaylistOrder,
  updatePlaylistCover,
  updatePlaylist,
  deletePlaylist,
};
