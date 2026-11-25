import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "./entities";

export interface AuthUser {
  sub: string;
  name: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** requireAuth() -> any logged-in user. requireAuth(Role.MANAGER) -> managers only. */
export function requireAuth(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing token" });
    }
    try {
      const user = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as AuthUser;
      if (roles.length && !roles.includes(user.role)) {
        return res.status(403).json({ message: "Your role cannot perform this action" });
      }
      req.user = user;
      next();
    } catch {
      res.status(401).json({ message: "Invalid or expired token" });
    }
  };
}
