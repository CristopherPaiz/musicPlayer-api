import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import ffmpegPath from "ffmpeg-static";

const FRAGMENT_DURATION = 10;

export const segmentAudio = (inputPath, outputDir, totalDuration) => {
  return new Promise(async (resolve, reject) => {
    try {
      await fs.mkdir(outputDir, { recursive: true });

      const outputPathPattern = path.join(outputDir, "%d.webm");

      // --- COMANDO FFmpeg DIRECTO Y EXPLÍCITO ---
      // Usamos comillas para proteger las rutas de archivos con espacios
      // y nos aseguramos de que cada argumento esté separado.
      const command = `"${ffmpegPath}" -i "${inputPath}" \
        -c:a libopus \
        -b:a 96k \
        -vn \
        -map_metadata -1 \
        -f segment \
        -segment_time ${FRAGMENT_DURATION} \
        -segment_start_number 1 \
        -reset_timestamps 1 \
        "${outputPathPattern}"`;

      console.log("--- EJECUTANDO COMANDO FFmpeg DIRECTO ---");
      console.log(command);
      console.log("------------------------------------");

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error("ERROR AL EJECUTAR FFmpeg:", error.message);
          console.error("FFmpeg STDERR:", stderr);
          return reject(new Error(`FFmpeg falló con el código de error: ${error.code}`));
        }

        console.log("FFmpeg STDOUT:", stdout);
        console.log("FFmpeg STDERR (puede contener información útil):", stderr);
        console.log("Segmentación completada exitosamente.");

        const fragmentCount = Math.ceil(totalDuration / FRAGMENT_DURATION);
        resolve({ fragmentCount });
      });
    } catch (e) {
      reject(e);
    }
  });
};
