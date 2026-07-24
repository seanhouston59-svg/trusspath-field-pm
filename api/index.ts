import express from "express";
import { registerRoutes } from "../server/routes";
import { createServer } from "node:http";

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: false }));

const httpServer = createServer(app);
// Wire all API routes onto this Express instance.
registerRoutes(httpServer, app);

// Vercel expects a default export of an Express app / request handler.
export default app;
