import type { Express } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { storage } from "./storage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function extractText(buf: Buffer, mime: string): Promise<string> {
  if (mime === "application/pdf" || mime === "application/octet-stream") {
    try {
      const data = await pdfParse(buf);
      return data.text;
    } catch {
      // fall through to raw string
    }
  }
  if (mime.includes("word") || mime.includes("openxmlformats")) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value;
  }
  return buf.toString("utf8");
}

function parseCV(text: string) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  const phoneMatch = text.match(/(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);

  // Heuristic: first non-empty line is often the name
  const name = lines[0] || "Unknown";

  // Look for a title / headline — first line after name that looks like a job title
  const titleLine = lines.slice(1, 6).find(l =>
    /\b(director|manager|vp|vice president|president|cfo|ceo|cto|coo|officer|head|lead|analyst|engineer|consultant|advisor)\b/i.test(l)
  ) || lines[1] || "";

  // Company: look for "at <Company>" or lines near title
  const companyMatch = text.match(/\bat\s+([A-Z][^,\n]{2,40})/);
  const company = companyMatch?.[1]?.trim() || "";

  // Location: look for common location patterns (City, ST)
  const locationMatch = text.match(/\b([A-Z][a-zA-Z\s]+,\s*[A-Z]{2})\b/);
  const location = locationMatch?.[1]?.trim() || "";

  return {
    name,
    title: titleLine,
    company,
    location,
    email: emailMatch?.[0] || "",
    phone: phoneMatch?.[0] || "",
    linkedin: linkedinMatch ? `https://www.${linkedinMatch[0]}` : "",
    notes: text.slice(0, 1000),
    status: "sourced" as const,
    matchScore: 75,
    tags: "[]",
    lastContact: new Date().toISOString().split("T")[0],
    timeline: "[]",
  };
}

export function registerCandidateImportRoutes(app: Express) {
  app.post(
    "/api/candidates/import/cv",
    upload.single("cv"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }
        const text = await extractText(req.file.buffer, req.file.mimetype);
        const parsed = parseCV(text);
        const candidate = await storage.createCandidate(parsed);
        res.status(201).json(candidate);
      } catch (err: unknown) {
        console.error("[CV Import]", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "Import failed" });
      }
    }
  );
}
