import express from "express";
import {
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
} from "../controllers/playlists.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { handleScalewayImageUpload } from "../middlewares/upload.middleware.js";

const router = express.Router();

router.get("/", getAllPlaylists);
router.get("/admin", authMiddleware, getAllPlaylistsAdmin);
router.post("/", authMiddleware, createPlaylist);
router.put("/admin/order", authMiddleware, updatePlaylistOrder);
router.put("/admin/:id", authMiddleware, updatePlaylist);
router.delete("/admin/:id", authMiddleware, deletePlaylist);
router.post("/admin/:id/cover", authMiddleware, handleScalewayImageUpload("playlistCover", "covers/playlists"), updatePlaylistCover);
router.post("/:playlistId/canciones/:cancionId", authMiddleware, addSongToPlaylist);
router.delete("/:playlistId/canciones/:cancionId", authMiddleware, removeSongFromPlaylist);
router.get("/:id", getPlaylistWithSongs);

export default router;
