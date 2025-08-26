import * as mm from "music-metadata";
import { promises as fs } from "fs";

/**
 * Extrae los metadatos de un archivo de audio.
 * @param {string} filePath - La ruta al archivo de audio temporal.
 * @returns {Promise<object>} Un objeto con los metadatos extraídos.
 */
export const extractMetadata = async (filePath) => {
  try {
    const metadata = await mm.parseFile(filePath, { duration: true });
    const { common, format } = metadata;

    // Extraer letras (lyrics)
    const lyrics = common.lyrics ? common.lyrics.join("\n") : null;

    // Extraer la carátula (cover)
    const cover =
      common.picture && common.picture.length > 0
        ? common.picture[0].data // Devolvemos el buffer de la imagen
        : null;

    const coverMimeType = common.picture && common.picture.length > 0 ? common.picture[0].format : null;

    return {
      titulo: common.title || "Título Desconocido",
      artista: common.artist || "Artista Desconocido",
      album: common.album || "Álbum Desconocido",
      duracion: format.duration, // en segundos
      lyrics,
      cover,
      coverMimeType,
    };
  } catch (error) {
    console.error("Error al extraer metadatos:", error.message);
    throw new Error("No se pudieron leer los metadatos del archivo de audio.");
  }
};
