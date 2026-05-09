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

  // Serve static assets (JS, CSS, images, etc.) — never touches /api/ paths
  // because those files don't exist in distPath
  app.use(express.static(distPath));

  // SPA fallback: serve index.html for any non-API route so client-side
  // routing works. Explicitly guard /api/ so a missing API route returns
  // a proper 404 JSON instead of the HTML shell (Express 5 wildcard catch-alls
  // can match before specific route handlers in some configurations).
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      // Let Express return its default 404 — don't swallow API 404s as HTML
      return res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
