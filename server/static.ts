import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static assets (JS, CSS, images)
  app.use(express.static(distPath));

  // SPA fallback — explicitly guard /api/ routes so they return 404 JSON
  // instead of index.html. Express 5's wildcard app.use catches API routes
  // before specific route handlers fire, breaking all API endpoints.
  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
