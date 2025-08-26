import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, BUCKET_NAME } from "../config/scaleway.config.js";

/**
 * Sube un buffer de archivo a Scaleway S3.
 * @param {string} key - La ruta completa del archivo en el bucket (ej. 'songs/uuid/1.mp3').
 * @param {Buffer} body - El contenido del archivo como un Buffer.
 * @param {string} contentType - El tipo MIME del archivo (ej. 'audio/mpeg').
 * @returns {Promise<void>}
 */
export const uploadFile = async (key, body, contentType) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await s3Client.send(command);
};

/**
 * Genera una URL pre-firmada y segura para acceder a un archivo por un tiempo limitado.
 * @param {string} key - La ruta completa del archivo en el bucket.
 * @param {number} expiresIn - Duración de la URL en segundos (por defecto 1 hora).
 * @returns {Promise<string>} La URL segura.
 */
export const getSecureFileUrl = async (key, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
};

/**
 * Borra una carpeta completa y su contenido del bucket.
 * @param {string} folderKey - La ruta de la carpeta (ej. 'songs/uuid/').
 * @returns {Promise<void>}
 */
export const deleteFolder = async (folderKey) => {
  // 1. Listar todos los objetos en la carpeta
  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: folderKey,
  });
  const listedObjects = await s3Client.send(listCommand);

  if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
    return; // La carpeta está vacía o no existe
  }

  // 2. Crear un array de promesas de borrado
  const deletePromises = listedObjects.Contents.map((obj) => {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: obj.Key,
    });
    return s3Client.send(deleteCommand);
  });

  // 3. Ejecutar todas las promesas de borrado
  await Promise.all(deletePromises);
};
