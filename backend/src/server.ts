import "reflect-metadata";
import "dotenv/config";
import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { AppDataSource } from "./data-source";
import { api } from "./routes";
import { BusinessError } from "./errors";
import { ensureDefaultUsers } from "./bootstrap";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:4200" }));
// Logos are sent inside JSON as data URLs, so the default 100 kB limit is too small.
app.use(express.json({ limit: "3mb" }));
app.use("/api", api);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof BusinessError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ message: "Validation failed", issues: err.issues });
  }
  console.error(err);
  res.status(500).json({ message: "Server error" });
};
app.use(errorHandler);

AppDataSource.initialize()
  .then(async () => {
    // Development convenience: make sure the default accounts (including admin) exist.
    if (process.env.NODE_ENV !== "production") {
      const created = await ensureDefaultUsers();
      if (created.length) console.log(`Created default users: ${created.join(", ")}`);
    }
    app.listen(3000, () => console.log("Gold Monitor API running on http://localhost:3000"));
  })
  .catch((err) => console.error("Database connection failed", err));
