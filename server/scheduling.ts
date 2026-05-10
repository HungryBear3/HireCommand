import type { Express } from "express";
import { db } from "./storage";
import { schedulingSessions, candidates, jobs } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { callClaude } from "./ai";

const INTERVIEW_TYPES: Record<string, string> = {
  phone_screen: "Phone Screen",
  first_round: "First Round Interview",
  second_round: "Second Round Interview",
  technical: "Technical Interview",
  final: "Final Round Interview",
  pe_partner: "PE Partner Meeting",
  reference: "Reference Check",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

function zoomConfig() {
  return {
    accountId: process.env.ZOOM_ACCOUNT_ID,
    clientId: process.env.ZOOM_CLIENT_ID,
    clientSecret: process.env.ZOOM_CLIENT_SECRET,
    userId: process.env.ZOOM_USER_ID || "me",
  };
}

async function createZoomMeeting(input: { topic: string; startTime: string; durationMinutes?: number; agenda?: string }) {
  const cfg = zoomConfig();
  if (!cfg.accountId || !cfg.clientId || !cfg.clientSecret) {
    throw new Error("Zoom is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET for server-to-server OAuth.");
  }

  const auth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const tokenRes = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(cfg.accountId)}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!tokenRes.ok) throw new Error(`Zoom OAuth failed: ${await tokenRes.text()}`);
  const token = await tokenRes.json() as { access_token: string };

  const meetingRes = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(cfg.userId)}/meetings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: input.topic,
      type: 2,
      start_time: new Date(input.startTime).toISOString(),
      duration: input.durationMinutes || 45,
      timezone: "America/Chicago",
      agenda: input.agenda || input.topic,
      settings: {
        join_before_host: true,
        waiting_room: false,
        approval_type: 2,
        meeting_authentication: false,
        participant_video: false,
        host_video: false,
      },
    }),
  });
  if (!meetingRes.ok) throw new Error(`Zoom meeting creation failed: ${await meetingRes.text()}`);
  const meeting = await meetingRes.json() as any;
  return {
    joinUrl: meeting.join_url,
    meetingId: String(meeting.id || ""),
    passcode: meeting.password || meeting.encrypted_password || "",
  };
}

export function registerSchedulingRoutes(app: Express) {
  // List sessions
  app.get("/api/scheduling/sessions", async (_req, res) => {
    try {
      const rows = await db.select().from(schedulingSessions)
        .orderBy(desc(schedulingSessions.id));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // Create an unattended Zoom meeting for an interview.
  app.post("/api/scheduling/zoom-meeting", async (req, res) => {
    try {
      const { topic, startTime, durationMinutes, agenda } = req.body;
      if (!topic || !startTime) return res.status(400).json({ error: "topic and startTime are required" });
      res.json(await createZoomMeeting({ topic, startTime, durationMinutes, agenda }));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Create session
  app.post("/api/scheduling/sessions", async (req, res) => {
    try {
      const now = new Date().toISOString();
      const { zoomJoinUrl, zoomMeetingId, zoomPasscode, ...sessionBody } = req.body;
      const zoomNotes = zoomJoinUrl || zoomMeetingId || zoomPasscode
        ? JSON.stringify({ zoomMeeting: { joinUrl: zoomJoinUrl, meetingId: zoomMeetingId, passcode: zoomPasscode } })
        : sessionBody.notes;
      const [session] = await db.insert(schedulingSessions).values({
        ...sessionBody,
        notes: zoomNotes || "",
        status: "drafting",
        createdAt: now,
        updatedAt: now,
      }).returning();
      res.json(session);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get single session
  app.get("/api/scheduling/sessions/:id", async (req, res) => {
    try {
      const [session] = await db.select().from(schedulingSessions)
        .where(eq(schedulingSessions.id, parseInt(req.params.id)));
      if (!session) return res.status(404).json({ error: "Not found" });
      res.json(session);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update session
  app.patch("/api/scheduling/sessions/:id", async (req, res) => {
    try {
      const [updated] = await db.update(schedulingSessions)
        .set({ ...req.body, updatedAt: new Date().toISOString() })
        .where(eq(schedulingSessions.id, parseInt(req.params.id)))
        .returning();
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete session
  app.delete("/api/scheduling/sessions/:id", async (req, res) => {
    try {
      await db.delete(schedulingSessions)
        .where(eq(schedulingSessions.id, parseInt(req.params.id)));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // AI draft emails for a scheduling session
  app.post("/api/scheduling/draft", async (req, res) => {
    try {
      const {
        candidateName, candidateTitle, candidateCompany, candidateEmail,
        jobTitle, company, contactName, contactEmail,
        interviewType = "first_round", recruiterName = "The Hiring Advisors",
        proposedTimes = [], zoomMeeting,
      } = req.body;

      const typeName = INTERVIEW_TYPES[interviewType] || interviewType;
      const timesBlock = proposedTimes.length > 0
        ? proposedTimes.map((t: string) => `  • ${formatTime(t)}`).join("\n")
        : "  • [Please suggest 3 times that work for you]";

      const zoomBlock = zoomMeeting?.joinUrl
        ? `
- Zoom join URL: ${zoomMeeting.joinUrl}
- Zoom meeting ID: ${zoomMeeting.meetingId}
- Zoom passcode: ${zoomMeeting.passcode}
- Zoom is configured with join-before-host enabled; the admin does not need to attend.`
        : "";

      const [candidateDraft, contactDraft] = await Promise.all([
        // Candidate email
        callClaude(
          `Write a scheduling email FROM ${recruiterName} TO candidate ${candidateName} (${candidateTitle} at ${candidateCompany}).

Context:
- Interview type: ${typeName}
- Role: ${jobTitle} at ${company}
- Interviewer/contact: ${contactName}
- Proposed times:
${timesBlock}${zoomBlock}

Requirements:
- If Zoom details are provided, include the join URL, meeting ID, and passcode clearly.
- Professional yet warm tone
- Reference the candidate's seniority/background
- Clearly state the interview type and what to expect
- Ask them to confirm one of the proposed times or suggest alternatives
- Keep it under 200 words
- First line must be "Subject: [subject line]"
- Do NOT include salutation like "Dear" in the subject line

Return ONLY the email (subject line first, then body). No commentary.`,
          "You are an expert executive recruiter writing professional scheduling emails. Write crisp, effective emails that candidates respond to."
        ),
        // Contact/hiring manager email
        callClaude(
          `Write a scheduling coordination email FROM ${recruiterName} TO hiring manager ${contactName} at ${company}.

Context:
- Candidate: ${candidateName}, ${candidateTitle} at ${candidateCompany}
- Interview type: ${typeName}
- Role: ${jobTitle}
- Proposed times:
${timesBlock}${zoomBlock}

Requirements:
- If Zoom details are provided, include the join URL, meeting ID, and passcode clearly.
- Concise and professional (recruiter to client)
- Brief 1-sentence candidate intro (why they're worth interviewing)
- Ask to confirm one of the proposed times
- Note that you'll coordinate with the candidate once confirmed
- Keep it under 150 words
- First line must be "Subject: [subject line]"

Return ONLY the email. No commentary.`,
          "You are an expert executive recruiter coordinating interview scheduling with client hiring managers."
        ),
      ]);

      res.json({ candidateDraft, contactDraft });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Fetch candidates for the new session picker
  app.get("/api/scheduling/candidates", async (_req, res) => {
    try {
      const rows = await db.select({
        id: candidates.id,
        name: candidates.name,
        title: candidates.title,
        company: candidates.company,
        email: candidates.email,
      }).from(candidates);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Fetch jobs for the picker
  app.get("/api/scheduling/jobs", async (_req, res) => {
    try {
      const rows = await db.select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
      }).from(jobs);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
