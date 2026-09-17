import cors from "cors";
import express, { Express } from "express";
import { createRouter, RouterDeps } from "./routes";
import { errorHandler } from "./errorHandler";

export function createServer(deps: RouterDeps): Express {
  const app = express();
  // Permissive CORS is acceptable here for the same reason there's no auth
  // layer (D-17, R6): bound to localhost/the Docker internal network only,
  // never deployed beyond that.
  app.use(cors());
  app.use(express.json());
  app.use(createRouter(deps));
  app.use(errorHandler);
  return app;
}
