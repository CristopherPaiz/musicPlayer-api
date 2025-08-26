import jwt from "jsonwebtoken";

const jwtSecretKey = process.env.JWT_SECRET_KEY;

export const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Acceso denegado. Se requiere autenticación." });
  }

  try {
    const decoded = jwt.verify(token, jwtSecretKey);
    req.user = decoded; // Añadimos la info del usuario (payload del token) a la request
    next(); // El token es válido, continuamos
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      res.clearCookie("token");
      return res.status(401).json({ message: "Sesión expirada. Por favor inicie sesión nuevamente." });
    }
    return res.status(403).json({ message: "Token inválido." });
  }
};
