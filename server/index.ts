import dns from "dns";
// Force IPv4 DNS resolution before any module creates a DB connection.
// Render.com instances have IPv6 routes that are unreachable (ENETUNREACH).
// setDefaultResultOrder affects dns.lookup() sort order but some packages
// call lookup with {all:true} and may still attempt IPv6. We patch lookup
// to force family:4 for all outbound connections.
dns.setDefaultResultOrder("ipv4first");
const _origLookup = dns.lookup.bind(dns);
(dns as any).lookup = (hostname: string, options: any, callback?: any) => {
  if (typeof options === "function") {
    callback = options;
    options = { family: 4 };
  } else if (typeof options === "number") {
    options = { family: 4 };
  } else {
    options = { ...options, family: 4 };
  }
  return _origLookup(hostname, options, callback);
};

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";

const app = express();
// Render terminates TLS at its proxy. Trusting the first proxy lets Express
// recognize HTTPS requests so secure session cookies are actually emitted.
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User {
      id: number;
      username: string;
      email: string | null;
      role: string;
      recruiterName: string | null;
      password: string;
    }
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  log(`NODE_ENV=${process.env.NODE_ENV}`);
  log(`DATABASE_URL=${process.env.DATABASE_URL ? "SET (" + process.env.DATABASE_URL.split("@")[1] + ")" : "NOT SET"}`);
  log(`PORT=${process.env.PORT || "5000 (default)"}`);

  // Clear any stuck Loxo sync flag from a previous crashed run
  try {
    await storage.setSetting("loxo_sync_running", "false");
  } catch (_) {}

  setupAuth(app);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
