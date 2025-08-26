import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config();

let tursoClientInstance = null;
let isConnected = false;
let retryCount = 0;
const maxRetries = 5;
let connectionPromise = null;

const connectWithRetry = async () => {
  if (isConnected && tursoClientInstance) {
    return tursoClientInstance;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
        // Dejamos esta línea por si acaso, aunque la nueva versión debería manejarlo mejor
        syncUrl: undefined,
      });

      await client.execute("SELECT 1");

      tursoClientInstance = client;
      isConnected = true;
      retryCount = 0;
      console.log("Base de datos Turso conectada con éxito");
      return client;
    } catch (err) {
      retryCount++;
      console.error(`Falló al conectar a la BD (Intento ${retryCount} de ${maxRetries}):`, err.message);

      if (retryCount < maxRetries) {
        console.log(`Reintentando conexión en 5 segundos...`);
        return new Promise((resolve) => {
          setTimeout(() => {
            connectionPromise = null;
            resolve(connectWithRetry());
          }, 5000);
        });
      } else {
        console.error("Se alcanzó el número máximo de intentos de conexión.");
        connectionPromise = null;
        return null;
      }
    }
  })();

  return connectionPromise;
};

export async function getDb() {
  if (isConnected && tursoClientInstance) {
    return tursoClientInstance;
  }
  return connectWithRetry();
}
