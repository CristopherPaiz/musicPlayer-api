import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const requiredEnv = ["SCALEWAY_ENDPOINT", "SCALEWAY_REGION", "SCALEWAY_ACCESS_KEY_ID", "SCALEWAY_SECRET_ACCESS_KEY"];

const missingEnv = requiredEnv.filter((envVar) => !process.env[envVar]);

if (missingEnv.length > 0) {
  throw new Error(`Faltan variables de entorno de Scaleway: ${missingEnv.join(", ")}`);
}

export const s3Client = new S3Client({
  endpoint: process.env.SCALEWAY_ENDPOINT,
  region: process.env.SCALEWAY_REGION,
  credentials: {
    accessKeyId: process.env.SCALEWAY_ACCESS_KEY_ID,
    secretAccessKey: process.env.SCALEWAY_SECRET_ACCESS_KEY,
  },
});

export const BUCKET_NAME = process.env.SCALEWAY_BUCKET_NAME;
