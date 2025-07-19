import { ENV } from "../utils/env/env.js";
import jwt from "jsonwebtoken";

export const isAuthenticated = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }
  const token = authHeader.split(" ")[1];
  //   console.log(token, "token");

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET);
    // console.log("decoded", decoded);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};
