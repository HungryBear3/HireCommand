import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Building2,
  Users,
  Calendar,
  Clock,
  Mail,
  Phone,
  FileText,
  Share2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Briefcase,
  MessageSquare,
  Send,
  Activity,
  TrendingUp,
  UserCheck,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type HealthStatus = "Healthy" | "At Risk" | "Stalled";

type PipelineStage =
  | "Sourcing"
  | "Screening"
  | "Interview"
  | "Offer"
  | "Placed";

interface Candidate {
  id: string;
  name: string;
  title: string;
  company: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  searchId: string;
  stage: PipelineStage;
  lastAction: string;
  lastActionDate: string;
  health: HealthStatus;
}

interface Search {
  id: string;
  title: string;
  openDate: string;
  daysOpen: number;
  owner: string;
  health: HealthStatus;
  atRiskReason?: string;
  stageCounts: Record<PipelineStage, number>;
}

interface ActivityItem {
  id: string;
  date: string;
  type: "email" | "call" | "submittal" | "interview" | "note";
  description: string;
  person: string;
}

interface ClientNote {
  id: string;
  date: string;
  author: string;
  text: string;
}

interface Client {
  id: string;
  name: string;
  sponsor: string;
  slug: string;
  lastActivity: string;
  searches: Search[];
  candidates: Candidate[];
  contacts?: ApiClientContact[];
  activity: ActivityItem[];
  notes: ClientNote[];
}

interface ApiJob {
  id: number;
  loxoId?: number | null;
  title: string;
  company: string;
  location: string;
  stage: string;
  candidateCount: number;
  daysOpen: number;
  description?: string;
  requirements?: string;
}

interface ApiCandidate {
  id: number;
  name: string;
  title: string;
  company: string;
  location: string;
  email: string;
  phone: string;
  linkedin: string;
  status: string;
  lastContact: string;
  notes: string;
  timeline: string;
}

interface ApiClientContact {
  id: number;
  loxoId?: number | null;
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  location: string;
}

type ShareOptionKey =
  | "searchSummary"
  | "candidateNames"
  | "candidateTitles"
  | "candidateCompanies"
  | "candidateContactInfo"
  | "activityTimeline"
  | "internalNotes";

const SHARE_OPTIONS: Array<{ key: ShareOptionKey; label: string; description: string }> = [
  { key: "searchSummary", label: "Search summary", description: "Open roles, owners, health, and stage counts" },
  { key: "candidateNames", label: "Candidate names", description: "Full candidate names in the portal" },
  { key: "candidateTitles", label: "Candidate titles", description: "Current/most recent title" },
  { key: "candidateCompanies", label: "Candidate companies", description: "Current/most recent employer" },
  { key: "candidateContactInfo", label: "Candidate contact info", description: "Email, phone, and LinkedIn links" },
  { key: "activityTimeline", label: "Activity timeline", description: "Recent outreach, submittals, and interview activity" },
  { key: "internalNotes", label: "Internal notes", description: "Recruiter notes and client feedback" },
];

// ─── Sample Data ──────────────────────────────────────────────────────────────

const CLIENTS: Client[] = [
  {
    id: "1",
    name: "Meridian Health Partners",
    sponsor: "Warburg Pincus",
    slug: "meridian-health",
    lastActivity: "2 days ago",
    searches: [
      {
        id: "s1a",
        title: "Chief Financial Officer",
        openDate: "Nov 12, 2024",
        daysOpen: 64,
        owner: "Andrew",
        health: "At Risk",
        atRiskReason: "No candidate movement in 12 days",
        stageCounts: {
          Sourcing: 0,
          Screening: 4,
          Interview: 2,
          Offer: 0,
          Placed: 0,
        },
      },
      {
        id: "s1b",
        title: "VP Operations",
        openDate: "Dec 3, 2024",
        daysOpen: 43,
        owner: "Ryan",
        health: "Healthy",
        stageCounts: {
          Sourcing: 6,
          Screening: 3,
          Interview: 1,
          Offer: 1,
          Placed: 0,
        },
      },
    ],
    candidates: [
      {
        id: "c1",
        name: "Sandra Kowalski",
        title: "CFO",
        company: "Archway Medical",
        searchId: "s1a",
        stage: "Screening",
        lastAction: "Reference check initiated",
        lastActionDate: "Jan 3, 2025",
        health: "At Risk",
      },
      {
        id: "c2",
        name: "James Thornton",
        title: "SVP Finance",
        company: "BlueCross Health",
        searchId: "s1a",
        stage: "Interview",
        lastAction: "Second interview scheduled",
        lastActionDate: "Jan 7, 2025",
        health: "Healthy",
      },
      {
        id: "c3",
        name: "Priya Mehta",
        title: "VP Finance",
        company: "Aetna",
        searchId: "s1a",
        stage: "Screening",
        lastAction: "Submitted to client",
        lastActionDate: "Dec 28, 2024",
        health: "At Risk",
      },
      {
        id: "c4",
        name: "Marcus Webb",
        title: "COO",
        company: "HealthSpring",
        searchId: "s1b",
        stage: "Interview",
        lastAction: "PE partner interview completed",
        lastActionDate: "Jan 10, 2025",
        health: "Healthy",
      },
      {
        id: "c5",
        name: "Lisa Nakamura",
        title: "VP Ops",
        company: "Optum",
        searchId: "s1b",
        stage: "Offer",
        lastAction: "Offer extended",
        lastActionDate: "Jan 13, 2025",
        health: "Healthy",
      },
    ],
    activity: [
      {
        id: "a1",
        date: "Jan 13, 2025",
        type: "email",
        description: "Sent offer package to Lisa Nakamura — VP Operations",
        person: "Andrew",
      },
      {
        id: "a2",
        date: "Jan 10, 2025",
        type: "interview",
        description: "Marcus Webb completed PE partner interview with Warburg team",
        person: "Ryan",
      },
      {
        id: "a3",
        date: "Jan 7, 2025",
        type: "interview",
        description: "James Thornton second interview confirmed for Jan 14",
        person: "Andrew",
      },
      {
        id: "a4",
        date: "Jan 3, 2025",
        type: "submittal",
        description: "Sandra Kowalski profile submitted to CEO for CFO review",
        person: "Andrew",
      },
      {
        id: "a5",
        date: "Dec 28, 2024",
        type: "submittal",
        description: "Priya Mehta submitted — awaiting client feedback",
        person: "Ryan",
      },
      {
        id: "a6",
        date: "Dec 20, 2024",
        type: "call",
        description: "Weekly status call with CFO search committee — alignment on ideal profile",
        person: "Andrew",
      },
    ],
    notes: [
      {
        id: "n1",
        date: "Jan 7, 2025",
        author: "Andrew",
        text: "Client expressed urgency on CFO role — Q1 board meeting requires financial leadership in place. Need to push for feedback on Kowalski and Mehta by Jan 15.",
      },
      {
        id: "n2",
        date: "Dec 20, 2024",
        author: "Ryan",
        text: "VP Operations search trending well. Lisa Nakamura is the frontrunner — strong cultural fit confirmed by operating partner.",
      },
    ],
  },
  {
    id: "2",
    name: "DataPulse Analytics",
    sponsor: "Insight Partners",
    slug: "datapulse-analytics",
    lastActivity: "1 day ago",
    searches: [
      {
        id: "s2a",
        title: "Chief Technology Officer",
        openDate: "Dec 1, 2024",
        daysOpen: 45,
        owner: "Aileen",
        health: "Healthy",
        stageCounts: {
          Sourcing: 3,
          Screening: 5,
          Interview: 3,
          Offer: 0,
          Placed: 0,
        },
      },
    ],
    candidates: [
      {
        id: "c6",
        name: "Derek Chang",
        title: "CTO",
        company: "Palantir Technologies",
        searchId: "s2a",
        stage: "Interview",
        lastAction: "Technical deep-dive completed",
        lastActionDate: "Jan 12, 2025",
        health: "Healthy",
      },
      {
        id: "c7",
        name: "Anita Russo",
        title: "VP Engineering",
        company: "Snowflake",
        searchId: "s2a",
        stage: "Interview",
        lastAction: "First interview scheduled Jan 16",
        lastActionDate: "Jan 9, 2025",
        health: "Healthy",
      },
      {
        id: "c8",
        name: "Kevin O'Brien",
        title: "SVP Technology",
        company: "Domo Inc.",
        searchId: "s2a",
        stage: "Screening",
        lastAction: "Video screen completed",
        lastActionDate: "Jan 8, 2025",
        health: "Healthy",
      },
    ],
    activity: [
      {
        id: "a7",
        date: "Jan 12, 2025",
        type: "interview",
        description: "Derek Chang technical deep-dive — strong performance, proceeding to partner interview",
        person: "Aileen",
      },
      {
        id: "a8",
        date: "Jan 9, 2025",
        type: "email",
        description: "Confirmed Anita Russo first interview for Jan 16 with founding team",
        person: "Aileen",
      },
      {
        id: "a9",
        date: "Jan 8, 2025",
        type: "submittal",
        description: "Kevin O'Brien submitted to client — awaiting interview slot",
        person: "Aileen",
      },
    ],
    notes: [
      {
        id: "n3",
        date: "Jan 12, 2025",
        author: "Aileen",
        text: "Derek Chang is the clear frontrunner. Client very excited post technical screen. Recommend moving to offer stage if partner interview goes well.",
      },
    ],
  },
  {
    id: "3",
    name: "Summit Capital Portfolio Co",
    sponsor: "KKR",
    slug: "summit-capital",
    lastActivity: "5 days ago",
    searches: [
      {
        id: "s3a",
        title: "Chief Technology Officer",
        openDate: "Oct 28, 2024",
        daysOpen: 79,
        owner: "Ryan",
        health: "Stalled",
        atRiskReason: "Tom Harris departure disrupted search process",
        stageCounts: {
          Sourcing: 2,
          Screening: 1,
          Interview: 0,
          Offer: 0,
          Placed: 0,
        },
      },
      {
        id: "s3b",
        title: "Chief Financial Officer",
        openDate: "Nov 5, 2024",
        daysOpen: 71,
        owner: "Andrew",
        health: "Stalled",
        atRiskReason: "Dual leadership gap — client internal realignment in progress",
        stageCounts: {
          Sourcing: 4,
          Screening: 0,
          Interview: 0,
          Offer: 0,
          Placed: 0,
        },
      },
    ],
    candidates: [
      {
        id: "c9",
        name: "Thomas Grayson",
        title: "VP Engineering",
        company: "Insight Infosystems",
        searchId: "s3a",
        stage: "Screening",
        lastAction: "Initial screen pending",
        lastActionDate: "Dec 30, 2024",
        health: "Stalled",
      },
      {
        id: "c10",
        name: "Rachel Bauer",
        title: "CFO",
        company: "Meridian Group",
        searchId: "s3b",
        stage: "Sourcing",
        lastAction: "Outreach sent",
        lastActionDate: "Dec 18, 2024",
        health: "Stalled",
      },
    ],
    activity: [
      {
        id: "a10",
        date: "Jan 9, 2025",
        type: "call",
        description: "Check-in call with KKR operating partner — awaiting new search committee appointment",
        person: "Andrew",
      },
      {
        id: "a11",
        date: "Dec 30, 2024",
        type: "note",
        description: "Tom Harris (interim CTO) departure confirmed — search committee temporarily suspended",
        person: "Ryan",
      },
    ],
    notes: [
      {
        id: "n4",
        date: "Jan 9, 2025",
        author: "Andrew",
        text: "Both searches on hold pending board-level decision on org structure. KKR expects clarity by Jan 20. Resume sourcing immediately after.",
      },
    ],
  },
  {
    id: "4",
    name: "VitalWell Consumer",
    sponsor: "General Atlantic",
    slug: "vitalwell-consumer",
    lastActivity: "Today",
    searches: [
      {
        id: "s4a",
        title: "VP Marketing",
        openDate: "Dec 10, 2024",
        daysOpen: 36,
        owner: "Aileen",
        health: "Healthy",
        stageCounts: {
          Sourcing: 2,
          Screening: 4,
          Interview: 2,
          Offer: 0,
          Placed: 0,
        },
      },
    ],
    candidates: [
      {
        id: "c11",
        name: "Jordan Blake",
        title: "VP Brand",
        company: "Unilever",
        searchId: "s4a",
        stage: "Interview",
        lastAction: "First interview — very positive",
        lastActionDate: "Jan 13, 2025",
        health: "Healthy",
      },
      {
        id: "c12",
        name: "Sofia Reyes",
        title: "CMO",
        company: "Hims & Hers",
        searchId: "s4a",
        stage: "Screening",
        lastAction: "Video screen scheduled Jan 16",
        lastActionDate: "Jan 13, 2025",
        health: "Healthy",
      },
      {
        id: "c13",
        name: "Nathan Kowalczyk",
        title: "VP Growth",
        company: "Ritual",
        searchId: "s4a",
        stage: "Screening",
        lastAction: "Profile submitted to hiring team",
        lastActionDate: "Jan 10, 2025",
        health: "Healthy",
      },
    ],
    activity: [
      {
        id: "a12",
        date: "Jan 13, 2025",
        type: "interview",
        description: "Jordan Blake first interview — General Atlantic team gave strong positive feedback",
        person: "Aileen",
      },
      {
        id: "a13",
        date: "Jan 13, 2025",
        type: "email",
        description: "Sofia Reyes video screen booked for Jan 16 — strong DTC brand background",
        person: "Aileen",
      },
      {
        id: "a14",
        date: "Jan 10, 2025",
        type: "submittal",
        description: "Nathan Kowalczyk submitted — growth marketing focus aligns with Q1 launch strategy",
        person: "Aileen",
      },
    ],
    notes: [
      {
        id: "n5",
        date: "Jan 13, 2025",
        author: "Aileen",
        text: "Client is very engaged. Jordan Blake second interview likely this week. Need to also prepare reference dossier in advance.",
      },
    ],
  },
  {
    id: "5",
    name: "TalentForge HR Tech",
    sponsor: "Vista Equity",
    slug: "talentforge-hrtech",
    lastActivity: "3 days ago",
    searches: [
      {
        id: "s5a",
        title: "VP Sales",
        openDate: "Nov 25, 2024",
        daysOpen: 51,
        owner: "Ryan",
        health: "At Risk",
        atRiskReason: "Client feedback pending 8 days on submitted candidates",
        stageCounts: {
          Sourcing: 0,
          Screening: 2,
          Interview: 3,
          Offer: 0,
          Placed: 0,
        },
      },
    ],
    candidates: [
      {
        id: "c14",
        name: "Michelle Tran",
        title: "RVP Sales",
        company: "Workday",
        searchId: "s5a",
        stage: "Interview",
        lastAction: "Awaiting client scorecard",
        lastActionDate: "Jan 5, 2025",
        health: "At Risk",
      },
      {
        id: "c15",
        name: "Carlos Fuentes",
        title: "VP Enterprise Sales",
        company: "Lattice",
        searchId: "s5a",
        stage: "Interview",
        lastAction: "Awaiting client scorecard",
        lastActionDate: "Jan 5, 2025",
        health: "At Risk",
      },
      {
        id: "c16",
        name: "Heather Dunning",
        title: "Director of Sales",
        company: "Rippling",
        searchId: "s5a",
        stage: "Screening",
        lastAction: "Phone screen completed",
        lastActionDate: "Jan 8, 2025",
        health: "Healthy",
      },
    ],
    activity: [
      {
        id: "a15",
        date: "Jan 10, 2025",
        type: "email",
        description: "Followed up with CEO on feedback for Michelle Tran and Carlos Fuentes — no response",
        person: "Ryan",
      },
      {
        id: "a16",
        date: "Jan 8, 2025",
        type: "call",
        description: "Heather Dunning phone screen — strong SaaS quota attainment track record",
        person: "Ryan",
      },
      {
        id: "a17",
        date: "Jan 5, 2025",
        type: "interview",
        description: "Michelle Tran and Carlos Fuentes completed first interviews with Vista portfolio CEO",
        person: "Ryan",
      },
    ],
    notes: [
      {
        id: "n6",
        date: "Jan 10, 2025",
        author: "Ryan",
        text: "Escalation needed — 8 days with no feedback on two interviewed candidates. Will call Vista operating partner directly if no response by Jan 15.",
      },
    ],
  },
  {
    id: "6",
    name: "BrightPath Health",
    sponsor: "Bain Capital",
    slug: "brightpath-health",
    lastActivity: "1 day ago",
    searches: [
      {
        id: "s6a",
        title: "Chief Marketing Officer",
        openDate: "Dec 5, 2024",
        daysOpen: 41,
        owner: "Aileen",
        health: "Healthy",
        stageCounts: {
          Sourcing: 1,
          Screening: 3,
          Interview: 2,
          Offer: 1,
          Placed: 0,
        },
      },
    ],
    candidates: [
      {
        id: "c17",
        name: "Alex Rivera",
        title: "CMO",
        company: "Ro Health",
        searchId: "s6a",
        stage: "Offer",
        lastAction: "Offer letter under negotiation",
        lastActionDate: "Jan 12, 2025",
        health: "Healthy",
      },
      {
        id: "c18",
        name: "Danielle Osei",
        title: "VP Marketing",
        company: "Noom",
        searchId: "s6a",
        stage: "Interview",
        lastAction: "Second interview confirmed",
        lastActionDate: "Jan 11, 2025",
        health: "Healthy",
      },
      {
        id: "c19",
        name: "Ryan Park",
        title: "VP Brand",
        company: "Hinge Health",
        searchId: "s6a",
        stage: "Screening",
        lastAction: "Submitted to client",
        lastActionDate: "Jan 9, 2025",
        health: "Healthy",
      },
    ],
    activity: [
      {
        id: "a18",
        date: "Jan 12, 2025",
        type: "email",
        description: "Offer details sent to Alex Rivera — compensation package under discussion",
        person: "Aileen",
      },
      {
        id: "a19",
        date: "Jan 11, 2025",
        type: "interview",
        description: "Danielle Osei second interview with Bain operating partner confirmed for Jan 17",
        person: "Aileen",
      },
      {
        id: "a20",
        date: "Jan 9, 2025",
        type: "submittal",
        description: "Ryan Park submitted — strong DTC consumer health background",
        person: "Aileen",
      },
    ],
    notes: [
      {
        id: "n7",
        date: "Jan 12, 2025",
        author: "Aileen",
        text: "Alex Rivera is very close to accepting — main sticking point is LTI vesting schedule. Bain is flexible, expect resolution by EOW.",
      },
    ],
  },
  {
    id: "7",
    name: "CarePoint Health",
    sponsor: "Carlyle Group",
    slug: "carepoint-health",
    lastActivity: "2 days ago",
    searches: [
      {
        id: "s7a",
        title: "Chief Operating Officer",
        openDate: "Nov 18, 2024",
        daysOpen: 58,
        owner: "Andrew",
        health: "At Risk",
        atRiskReason: "Interview process stalled — no decision after finalist round",
        stageCounts: {
          Sourcing: 0,
          Screening: 1,
          Interview: 2,
          Offer: 0,
          Placed: 0,
        },
      },
      {
        id: "s7b",
        title: "Chief Human Resources Officer",
        openDate: "Dec 8, 2024",
        daysOpen: 38,
        owner: "Aileen",
        health: "Healthy",
        stageCounts: {
          Sourcing: 4,
          Screening: 3,
          Interview: 1,
          Offer: 0,
          Placed: 0,
        },
      },
    ],
    candidates: [
      {
        id: "c20",
        name: "Marcus Williams",
        title: "COO",
        company: "Envision Healthcare",
        searchId: "s7a",
        stage: "Interview",
        lastAction: "Finalist — decision pending",
        lastActionDate: "Dec 30, 2024",
        health: "At Risk",
      },
      {
        id: "c21",
        name: "Patricia Simmons",
        title: "SVP Operations",
        company: "Kindred Health",
        searchId: "s7a",
        stage: "Interview",
        lastAction: "Finalist — decision pending",
        lastActionDate: "Dec 30, 2024",
        health: "At Risk",
      },
      {
        id: "c22",
        name: "Gloria Chen",
        title: "CHRO",
        company: "DaVita",
        searchId: "s7b",
        stage: "Interview",
        lastAction: "First interview completed",
        lastActionDate: "Jan 11, 2025",
        health: "Healthy",
      },
      {
        id: "c23",
        name: "Tobias Ward",
        title: "VP HR",
        company: "Acadia Healthcare",
        searchId: "s7b",
        stage: "Screening",
        lastAction: "Submitted to client",
        lastActionDate: "Jan 9, 2025",
        health: "Healthy",
      },
    ],
    activity: [
      {
        id: "a21",
        date: "Jan 11, 2025",
        type: "interview",
        description: "Gloria Chen first interview with Carlyle operating partner — strong performance",
        person: "Aileen",
      },
      {
        id: "a22",
        date: "Jan 10, 2025",
        type: "call",
        description: "Escalation call with Carlyle on COO finalist decision — board review pending",
        person: "Andrew",
      },
      {
        id: "a23",
        date: "Jan 9, 2025",
        type: "submittal",
        description: "Tobias Ward submitted for CHRO — strong healthcare HR transformation background",
        person: "Aileen",
      },
      {
        id: "a24",
        date: "Dec 30, 2024",
        type: "interview",
        description: "Marcus Williams and Patricia Simmons completed COO finalist rounds",
        person: "Andrew",
      },
    ],
    notes: [
      {
        id: "n8",
        date: "Jan 10, 2025",
        author: "Andrew",
        text: "COO decision delayed by Carlyle board — both finalists excellent, internal alignment needed. Will follow up Jan 17 if still no movement.",
      },
    ],
  },
  {
    id: "8",
    name: "Acme Health",
    sponsor: "BC Partners",
    slug: "acme-health",
    lastActivity: "6 days ago",
    searches: [
      {
        id: "s8a",
        title: "Chief Executive Officer",
        openDate: "Oct 15, 2024",
        daysOpen: 92,
        owner: "Andrew",
        health: "Stalled",
        atRiskReason: "Search paused — awaiting BC Partners board approval on comp framework",
        stageCounts: {
          Sourcing: 5,
          Screening: 2,
          Interview: 0,
          Offer: 0,
          Placed: 0,
        },
      },
    ],
    candidates: [
      {
        id: "c24",
        name: "Sarah Chen",
        title: "President & CEO",
        company: "Amedisys",
        searchId: "s8a",
        stage: "Screening",
        lastAction: "On hold pending board approval",
        lastActionDate: "Dec 10, 2024",
        health: "Stalled",
      },
      {
        id: "c25",
        name: "Richard Fowler",
        title: "CEO",
        company: "Encompass Health",
        searchId: "s8a",
        stage: "Sourcing",
        lastAction: "Initial outreach sent",
        lastActionDate: "Dec 5, 2024",
        health: "Stalled",
      },
    ],
    activity: [
      {
        id: "a25",
        date: "Jan 8, 2025",
        type: "call",
        description: "Status call with BC Partners — board comp committee meeting scheduled Jan 22",
        person: "Andrew",
      },
      {
        id: "a26",
        date: "Dec 10, 2024",
        type: "note",
        description: "Search formally paused — board has not approved executive compensation framework",
        person: "Andrew",
      },
      {
        id: "a27",
        date: "Dec 5, 2024",
        type: "email",
        description: "Richard Fowler initial outreach — no response expected until search resumes",
        person: "Andrew",
      },
    ],
    notes: [
      {
        id: "n9",
        date: "Jan 8, 2025",
        author: "Andrew",
        text: "CEO search effectively paused. BC Partners board comp committee meets Jan 22 — expect green light to resume. Keep candidate pipeline warm with light outreach.",
      },
    ],
  },
];

function parseTimeline(raw: string | undefined): Array<{ date?: string; event?: string; note?: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function titleCaseStage(stage: string | undefined): PipelineStage {
  const normalized = (stage || "sourcing").toLowerCase();
  if (normalized.includes("screen")) return "Screening";
  if (normalized.includes("interview")) return "Interview";
  if (normalized.includes("offer")) return "Offer";
  if (normalized.includes("placed")) return "Placed";
  return "Sourcing";
}

function formatActivityDate(value: string | undefined): string {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function companySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
}

function buildClientsFromRealData(
  jobs: ApiJob[],
  candidates: ApiCandidate[],
  contacts: ApiClientContact[]
): Client[] {
  const byCompany = new Map<string, Client>();
  const normalize = (name: string) => name.trim().replace(/\s+/g, " ");
  const ensureClient = (companyName: string): Client | null => {
    const name = normalize(companyName);
    if (!name || name.toLowerCase() === "unknown" || name.toLowerCase() === "unknown company") return null;
    const key = name.toLowerCase();
    if (!byCompany.has(key)) {
      byCompany.set(key, {
        id: companySlug(name),
        name,
        sponsor: "Loxo CRM",
        slug: companySlug(name),
        lastActivity: "Synced from Loxo",
        searches: [],
        candidates: [],
        activity: [],
        notes: [],
      });
    }
    return byCompany.get(key) ?? null;
  };

  for (const contact of contacts) {
    const client = ensureClient(contact.company || contact.name);
    if (!client) continue;
    if (contact.company) client.sponsor = `Contact: ${contact.name}${contact.title ? `, ${contact.title}` : ""}`;
  }

  for (const job of jobs) {
    if (job.stage === "closed") continue;
    const client = ensureClient(job.company);
    if (!client) continue;
    const stage = titleCaseStage(job.stage);
    const stageCounts: Record<PipelineStage, number> = {
      Sourcing: 0,
      Screening: 0,
      Interview: 0,
      Offer: 0,
      Placed: 0,
    };
    stageCounts[stage] = Math.max(1, job.candidateCount || 1);
    client.searches.push({
      id: String(job.id),
      title: job.title,
      openDate: `${job.daysOpen || 0} days open`,
      daysOpen: job.daysOpen || 0,
      owner: "THA",
      health: job.daysOpen > 60 ? "At Risk" : "Healthy",
      atRiskReason: job.daysOpen > 60 ? `Open ${job.daysOpen} days` : undefined,
      stageCounts,
    });
  }

  for (const candidate of candidates) {
    const matchingJob = jobs.find((job) => job.company.toLowerCase() === candidate.company.toLowerCase() && job.stage !== "closed");
    const client = matchingJob ? ensureClient(matchingJob.company) : ensureClient(candidate.company);
    if (!client) continue;
    const stage = titleCaseStage(candidate.status);
    const searchId = matchingJob ? String(matchingJob.id) : client.searches[0]?.id || "unassigned";
    if (searchId === "unassigned") {
      client.searches.push({
        id: "unassigned",
        title: "Candidate Pipeline",
        openDate: "Synced from Loxo",
        daysOpen: 0,
        owner: "THA",
        health: "Healthy",
        stageCounts: { Sourcing: 0, Screening: 0, Interview: 0, Offer: 0, Placed: 0 },
      });
    }
    client.candidates.push({
      id: String(candidate.id),
      name: candidate.name,
      title: candidate.title,
      company: candidate.company,
      email: candidate.email,
      phone: candidate.phone,
      linkedin: candidate.linkedin,
      searchId,
      stage,
      lastAction: candidate.notes?.slice(0, 80) || "Synced from Loxo",
      lastActionDate: formatActivityDate(candidate.lastContact),
      health: candidate.status?.toLowerCase().includes("stalled") ? "Stalled" : "Healthy",
    });
    const timeline = parseTimeline(candidate.timeline);
    const latest = timeline[0];
    client.activity.push({
      id: `candidate-${candidate.id}`,
      date: formatActivityDate(latest?.date || candidate.lastContact),
      type: stage === "Interview" ? "interview" : stage === "Screening" ? "call" : "note",
      description: latest?.note || latest?.event || `${candidate.name} updated in ${stage}`,
      person: "THA",
    });
  }

  for (const client of Array.from(byCompany.values())) {
    if (client.searches.length === 0 && client.candidates.length === 0) continue;
    const latestCandidate = client.candidates[0];
    client.lastActivity = latestCandidate?.lastActionDate || client.activity[0]?.date || "Synced from Loxo";
    for (const search of client.searches) {
      const related: Candidate[] = client.candidates.filter((candidate: Candidate) => candidate.searchId === search.id);
      if (related.length > 0) {
        search.stageCounts = {
          Sourcing: related.filter((candidate: Candidate) => candidate.stage === "Sourcing").length,
          Screening: related.filter((candidate: Candidate) => candidate.stage === "Screening").length,
          Interview: related.filter((candidate: Candidate) => candidate.stage === "Interview").length,
          Offer: related.filter((candidate: Candidate) => candidate.stage === "Offer").length,
          Placed: related.filter((candidate: Candidate) => candidate.stage === "Placed").length,
        };
      }
    }
  }

  return Array.from(byCompany.values())
    .filter((client) => client.searches.length > 0 || client.candidates.length > 0)
    .sort((a, b) => b.searches.length - a.searches.length || a.name.localeCompare(b.name));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOverallHealth(searches: Search[]): HealthStatus {
  if (searches.every((s) => s.health === "Stalled")) return "Stalled";
  if (searches.some((s) => s.health === "Stalled" || s.health === "At Risk")) return "At Risk";
  return "Healthy";
}

function healthDot(health: HealthStatus) {
  if (health === "Healthy") return "bg-emerald-500";
  if (health === "At Risk") return "bg-amber-400";
  return "bg-red-500";
}

function healthBadgeClasses(health: HealthStatus) {
  if (health === "Healthy")
    return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
  if (health === "At Risk")
    return "bg-amber-400/15 text-amber-600 border-amber-400/30";
  return "bg-red-500/15 text-red-600 border-red-500/30";
}

function HealthIcon({ health }: { health: HealthStatus }) {
  if (health === "Healthy")
    return <CheckCircle2 size={14} className="text-emerald-500" />;
  if (health === "At Risk")
    return <AlertTriangle size={14} className="text-amber-500" />;
  return <XCircle size={14} className="text-red-500" />;
}

const STAGES: PipelineStage[] = [
  "Sourcing",
  "Screening",
  "Interview",
  "Offer",
  "Placed",
];

const STAGE_COLORS: Record<PipelineStage, string> = {
  Sourcing: "bg-slate-400",
  Screening: "bg-blue-400",
  Interview: "bg-violet-500",
  Offer: "bg-amber-400",
  Placed: "bg-emerald-500",
};

function stageProgress(stageCounts: Record<PipelineStage, number>): number {
  const total = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const weighted =
    stageCounts.Sourcing * 10 +
    stageCounts.Screening * 30 +
    stageCounts.Interview * 60 +
    stageCounts.Offer * 85 +
    stageCounts.Placed * 100;
  return Math.round(weighted / total);
}

const ACTIVITY_ICONS: Record<ActivityItem["type"], typeof Mail> = {
  email: Mail,
  call: Phone,
  submittal: FileText,
  interview: Calendar,
  note: MessageSquare,
};

const ACTIVITY_COLORS: Record<ActivityItem["type"], string> = {
  email: "bg-blue-500/15 text-blue-600",
  call: "bg-violet-500/15 text-violet-600",
  submittal: "bg-teal-500/15 text-teal-600",
  interview: "bg-amber-400/15 text-amber-600",
  note: "bg-slate-400/15 text-slate-600",
};

function ownerInitials(name: string) {
  return name.substring(0, 2).toUpperCase();
}

const OWNER_COLORS: Record<string, string> = {
  Andrew: "bg-blue-600",
  Ryan: "bg-violet-600",
  Aileen: "bg-teal-600",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StagePipeline({
  stageCounts,
}: {
  stageCounts: Record<PipelineStage, number>;
}) {
  const total = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 h-2 rounded-full overflow-hidden">
        {STAGES.map((stage) => {
          const count = stageCounts[stage];
          const pct = total > 0 ? (count / total) * 100 : 0;
          return pct > 0 ? (
            <div
              key={stage}
              className={`${STAGE_COLORS[stage]} rounded-full transition-all`}
              style={{ width: `${pct}%` }}
              title={`${stage}: ${count}`}
            />
          ) : null;
        })}
        {total === 0 && <div className="bg-muted rounded-full w-full" />}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {STAGES.map((stage) => (
          <span key={stage} className="text-[10px] text-muted-foreground">
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${STAGE_COLORS[stage]}`} />
            {stage} {stageCounts[stage]}
          </span>
        ))}
      </div>
    </div>
  );
}

function SearchCard({ search }: { search: Search }) {
  return (
    <Card className="border border-card-border" data-testid={`search-card-${search.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">{search.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Opened {search.openDate} · <span className="font-medium text-foreground">{search.daysOpen} days open</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge
              variant="outline"
              className={`text-[11px] h-5 px-2 border ${healthBadgeClasses(search.health)}`}
              data-testid={`health-badge-${search.id}`}
            >
              <HealthIcon health={search.health} />
              <span className="ml-1">{search.health}</span>
            </Badge>
          </div>
        </div>

        {search.atRiskReason && (
          <div className="flex items-start gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1.5">
            <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">{search.atRiskReason}</p>
          </div>
        )}

        <StagePipeline stageCounts={search.stageCounts} />

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarFallback
                className={`text-[9px] text-white ${OWNER_COLORS[search.owner] ?? "bg-slate-500"}`}
              >
                {ownerInitials(search.owner)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{search.owner}</span>
          </div>
          <Progress value={stageProgress(search.stageCounts)} className="h-1 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientPortal() {
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [shareOptions, setShareOptions] = useState<Record<ShareOptionKey, boolean>>({
    searchSummary: true,
    candidateNames: true,
    candidateTitles: true,
    candidateCompanies: false,
    candidateContactInfo: false,
    activityTimeline: true,
    internalNotes: false,
  });
  const [clientSearch, setClientSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [newNote, setNewNote] = useState("");

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/client-portal"] });
  const activeClientId = selectedClientId || clients[0]?.id || "";

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.sponsor.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const emptyClient: Client = {
    id: "empty",
    name: "No client data yet",
    sponsor: "Run Loxo sync to populate real client portal data",
    slug: "empty",
    lastActivity: "—",
    searches: [],
    candidates: [],
    contacts: [],
    activity: [],
    notes: [],
  };
  const client = clients.find((c) => c.id === activeClientId) ?? clients[0] ?? emptyClient;
  const companyContacts = client.contacts ?? [];
  const selectedContact = companyContacts.find((contact) => String(contact.id) === selectedContactId) ?? companyContacts[0];
  const overallHealth = getOverallHealth(client.searches);

  const totalCandidates = client.candidates.length;
  const interviewsScheduled = client.candidates.filter(
    (c) => c.stage === "Interview"
  ).length;
  const healthCounts = {
    Healthy: client.searches.filter((s) => s.health === "Healthy").length,
    "At Risk": client.searches.filter((s) => s.health === "At Risk").length,
    Stalled: client.searches.filter((s) => s.health === "Stalled").length,
  };

  function handleSharePortal() {
    const url = `portal.hirecommand.app/client/${client.slug}`;
    const sharedSections = SHARE_OPTIONS.filter((option) => shareOptions[option.key]).map((option) => option.label);
    toast({
      title: "Client portal link copied",
      description: `${selectedContact?.name ? `For ${selectedContact.name}: ` : ""}${url} · Sharing ${sharedSections.length} section${sharedSections.length === 1 ? "" : "s"}`,
    });
  }

  function handleSendUpdate() {
    const recipient = selectedContact?.name || `${client.name} contacts`;
    toast({
      title: "Update sent",
      description: `Weekly status update dispatched to ${recipient}.`,
    });
  }

  function handleAddNote() {
    if (!newNote.trim()) return;
    toast({
      title: "Note saved",
      description: "Your note has been added to the client record.",
    });
    setNewNote("");
  }

  function handleSelectClient(id: string) {
    setSelectedClientId(id);
    setSelectedContactId("");
    setActiveTab("overview");
  }

  function toggleShareOption(key: ShareOptionKey, checked: boolean | "indeterminate") {
    setShareOptions((current) => ({ ...current, [key]: checked === true }));
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden -m-6">
      {/* ── LEFT SIDEBAR ── */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border space-y-3">
          <h2 className="font-display font-semibold text-sm text-foreground">
            Client Portal
          </h2>
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              data-testid="input-client-search"
              placeholder="Search clients or sponsors…"
              className="pl-8 h-8 text-xs"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredClients.map((c) => {
              const health = getOverallHealth(c.searches);
              const isSelected = c.id === selectedClientId;
              return (
                <button
                  key={c.id}
                  data-testid={`client-item-${c.id}`}
                  onClick={() => handleSelectClient(c.id)}
                  className={`w-full text-left rounded-lg p-3 transition-colors ${
                    isSelected
                      ? "bg-primary/10 border border-primary/25"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${healthDot(health)}`}
                        />
                        <p className="text-xs font-semibold text-foreground truncate">
                          {c.name}
                        </p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 ml-3.5">
                        {c.sponsor}
                      </p>
                    </div>
                    <ChevronRight
                      size={12}
                      className={`flex-shrink-0 mt-0.5 transition-colors ${
                        isSelected ? "text-primary" : "text-muted-foreground/40"
                      }`}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-2 ml-3.5">
                    <span className="text-[10px] text-muted-foreground">
                      <Briefcase size={9} className="inline mr-0.5" />
                      {c.searches.length} search{c.searches.length !== 1 ? "es" : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      <Clock size={9} className="inline mr-0.5" />
                      {c.lastActivity}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredClients.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                No clients found
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 size={18} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="font-display font-bold text-base text-foreground"
                  data-testid="text-client-name"
                >
                  {client.name}
                </h1>
                <Badge
                  variant="outline"
                  className={`text-[11px] h-5 px-2 border ${healthBadgeClasses(overallHealth)}`}
                  data-testid="badge-overall-health"
                >
                  <HealthIcon health={overallHealth} />
                  <span className="ml-1">{overallHealth}</span>
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {client.sponsor} · {client.searches.length} active{" "}
                {client.searches.length === 1 ? "search" : "searches"}
                {clients.length > 0 ? " · Live Loxo data" : " · No synced client data"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              data-testid="btn-share-portal"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleSharePortal}
            >
              <Share2 size={13} />
              Share Portal
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-6 border-b border-border bg-card flex-shrink-0">
            <TabsList className="h-9 bg-transparent p-0 gap-0 rounded-none">
              {(["overview", "searches", "candidates", "activity"] as const).map(
                (tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    data-testid={`tab-${tab}`}
                    className="rounded-none h-9 px-4 text-xs capitalize border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </TabsTrigger>
                )
              )}
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            {/* ── OVERVIEW TAB ── */}
            <TabsContent value="overview" className="m-0 p-6 space-y-5">
              {/* KPI Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="border border-card-border" data-testid="kpi-active-searches">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Briefcase size={15} className="text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold font-display">
                      {client.searches.length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Active Searches
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-card-border" data-testid="kpi-total-candidates">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Users size={15} className="text-violet-500" />
                    </div>
                    <div className="text-2xl font-bold font-display">
                      {totalCandidates}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Candidates in Pipeline
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-card-border" data-testid="kpi-interviews">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Calendar size={15} className="text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold font-display">
                      {interviewsScheduled}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Interviews Scheduled
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-card-border" data-testid="kpi-last-update">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Clock size={15} className="text-teal-500" />
                    </div>
                    <div className="text-2xl font-bold font-display">
                      {client.lastActivity}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Last Activity
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-card-border" data-testid="card-share-settings">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Share2 size={14} className="text-muted-foreground" />
                    Portal Sharing Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-4">
                  <div className="grid lg:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Share with company contact</Label>
                      <Select
                        value={selectedContact ? String(selectedContact.id) : "none"}
                        onValueChange={(value) => setSelectedContactId(value === "none" ? "" : value)}
                      >
                        <SelectTrigger className="h-9 text-xs" data-testid="select-portal-contact">
                          <SelectValue placeholder="Select a contact" />
                        </SelectTrigger>
                        <SelectContent>
                          {companyContacts.length === 0 && (
                            <SelectItem value="none">No Loxo contact found</SelectItem>
                          )}
                          {companyContacts.map((contact) => (
                            <SelectItem key={contact.id} value={String(contact.id)}>
                              {contact.name}{contact.title ? ` — ${contact.title}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedContact?.email || selectedContact?.phone || "Pulled from synced Loxo clients/contacts."}
                      </p>
                    </div>
                    <div className="lg:col-span-2 grid sm:grid-cols-2 gap-3">
                      {SHARE_OPTIONS.map((option) => (
                        <div key={option.key} className="flex items-start gap-2 rounded-lg border border-border/70 p-2.5">
                          <Checkbox
                            id={`share-${option.key}`}
                            checked={shareOptions[option.key]}
                            onCheckedChange={(checked) => toggleShareOption(option.key, checked)}
                            data-testid={`checkbox-share-${option.key}`}
                          />
                          <div className="grid gap-0.5 leading-none">
                            <Label htmlFor={`share-${option.key}`} className="text-xs font-medium cursor-pointer">
                              {option.label}
                            </Label>
                            <p className="text-[10px] leading-snug text-muted-foreground">{option.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid lg:grid-cols-3 gap-4">
                {/* Deal Health Summary */}
                <Card className="border border-card-border" data-testid="card-deal-health">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-muted-foreground" />
                      Deal Health Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2.5">
                    {(["Healthy", "At Risk", "Stalled"] as HealthStatus[]).map(
                      (h) => (
                        <div key={h} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${healthDot(h)}`} />
                            <span className="text-sm">{h}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-1.5 rounded-full ${healthDot(h)} opacity-30`}
                              style={{
                                width: `${
                                  client.searches.length > 0
                                    ? (healthCounts[h] / client.searches.length) * 80
                                    : 0
                                }px`,
                                minWidth: "4px",
                              }}
                            />
                            <span className="text-sm font-semibold w-4 text-right">
                              {healthCounts[h]}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </CardContent>
                </Card>

                {/* Recent Activity Feed */}
                <Card className="lg:col-span-2 border border-card-border" data-testid="card-recent-activity">
                  <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Activity size={14} className="text-muted-foreground" />
                      Recent Activity
                    </CardTitle>
                    <Button
                      data-testid="btn-send-update"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={handleSendUpdate}
                    >
                      <Send size={11} />
                      Send Update to Client
                    </Button>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-0">
                    {!shareOptions.activityTimeline && (
                      <p className="text-xs text-muted-foreground py-3">Activity timeline is hidden from this portal share.</p>
                    )}
                    {shareOptions.activityTimeline && client.activity.slice(0, 5).map((item, idx) => {
                      const Icon = ACTIVITY_ICONS[item.type];
                      return (
                        <div key={item.id}>
                          <div className="flex items-start gap-3 py-2.5">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${ACTIVITY_COLORS[item.type]}`}
                            >
                              <Icon size={12} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs leading-relaxed">
                                {item.description}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground">
                                  {item.date}
                                </span>
                                <span className="text-[10px] text-muted-foreground">·</span>
                                <Avatar className="h-3.5 w-3.5">
                                  <AvatarFallback
                                    className={`text-[7px] text-white ${OWNER_COLORS[item.person] ?? "bg-slate-500"}`}
                                  >
                                    {ownerInitials(item.person)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-[10px] text-muted-foreground">
                                  {item.person}
                                </span>
                              </div>
                            </div>
                          </div>
                          {idx < Math.min(client.activity.length, 5) - 1 && (
                            <Separator />
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* Client Notes */}
              <Card className="border border-card-border" data-testid="card-notes">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <FileText size={14} className="text-muted-foreground" />
                    Notes & Client Feedback
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {client.notes.map((note) => (
                    shareOptions.internalNotes ? (
                    <div
                      key={note.id}
                      className="bg-muted/40 rounded-lg p-3 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback
                            className={`text-[9px] text-white ${OWNER_COLORS[note.author] ?? "bg-slate-500"}`}
                          >
                            {ownerInitials(note.author)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{note.author}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {note.date}
                        </span>
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">
                        {note.text}
                      </p>
                    </div>
                    ) : null
                  ))}
                  {!shareOptions.internalNotes && (
                    <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                      Internal notes are hidden from this portal share.
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Input
                      data-testid="input-new-note"
                      placeholder="Add a note or client feedback…"
                      className="h-8 text-xs"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddNote();
                      }}
                    />
                    <Button
                      data-testid="btn-add-note"
                      size="sm"
                      className="h-8 text-xs px-3"
                      onClick={handleAddNote}
                    >
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── SEARCHES TAB ── */}
            <TabsContent value="searches" className="m-0 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Active Searches ({client.searches.length})
                </h2>
              </div>
              <div className="space-y-4">
                {!shareOptions.searchSummary && (
                  <Card className="border border-card-border"><CardContent className="p-4 text-xs text-muted-foreground">Search summaries are hidden from this portal share.</CardContent></Card>
                )}
                {shareOptions.searchSummary && client.searches.map((search) => (
                  <SearchCard key={search.id} search={search} />
                ))}
              </div>
            </TabsContent>

            {/* ── CANDIDATES TAB ── */}
            <TabsContent value="candidates" className="m-0 p-6 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">
                All Candidates ({client.candidates.length})
              </h2>
              <Card className="border border-card-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" data-testid="table-candidates">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                          Candidate
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                          Current Company
                        </th>
                        {shareOptions.candidateContactInfo && (
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                            Contact Info
                          </th>
                        )}
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                          Search
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                          Stage
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                          Last Action
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                          Health
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.candidates.map((candidate, idx) => {
                        const search = client.searches.find(
                          (s) => s.id === candidate.searchId
                        );
                        return (
                          <tr
                            key={candidate.id}
                            data-testid={`candidate-row-${candidate.id}`}
                            className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${
                              idx % 2 === 0 ? "" : "bg-muted/10"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                    {candidate.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .substring(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">
                                    {shareOptions.candidateNames ? candidate.name : `Candidate ${idx + 1}`}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {shareOptions.candidateTitles ? candidate.title : "Title hidden"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {shareOptions.candidateCompanies ? candidate.company : "Hidden"}
                            </td>
                            {shareOptions.candidateContactInfo && (
                              <td className="px-4 py-3 text-muted-foreground">
                                <div className="space-y-0.5">
                                  {candidate.email && <div>{candidate.email}</div>}
                                  {candidate.phone && <div>{candidate.phone}</div>}
                                  {candidate.linkedin && <div className="truncate max-w-40">{candidate.linkedin}</div>}
                                  {!candidate.email && !candidate.phone && !candidate.linkedin && <div>—</div>}
                                </div>
                              </td>
                            )}
                            <td className="px-4 py-3 text-muted-foreground">
                              {search?.title ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-5 px-2"
                              >
                                {candidate.stage}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <p>{candidate.lastAction}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {candidate.lastActionDate}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`w-2 h-2 rounded-full ${healthDot(candidate.health)}`}
                                  data-testid={`health-dot-${candidate.id}`}
                                />
                                <span className="text-[10px] text-muted-foreground">
                                  {candidate.health}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>

            {/* ── ACTIVITY TAB ── */}
            <TabsContent value="activity" className="m-0 p-6 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">
                Activity Timeline ({client.activity.length} items)
              </h2>
              {!shareOptions.activityTimeline && (
                <Card className="border border-card-border"><CardContent className="p-4 text-xs text-muted-foreground">Activity timeline is hidden from this portal share.</CardContent></Card>
              )}
              {shareOptions.activityTimeline && (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
                <div className="space-y-0">
                  {client.activity.map((item, idx) => {
                    const Icon = ACTIVITY_ICONS[item.type];
                    return (
                      <div
                        key={item.id}
                        data-testid={`activity-item-${item.id}`}
                        className="relative flex items-start gap-4 pb-5 last:pb-0"
                      >
                        <div
                          className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-background ${ACTIVITY_COLORS[item.type]}`}
                        >
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm leading-relaxed">
                                {item.description}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] h-4 px-1.5 capitalize"
                                >
                                  {item.type}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {item.date}
                                </span>
                                <span className="text-[10px] text-muted-foreground">·</span>
                                <div className="flex items-center gap-1">
                                  <Avatar className="h-3.5 w-3.5">
                                    <AvatarFallback
                                      className={`text-[7px] text-white ${OWNER_COLORS[item.person] ?? "bg-slate-500"}`}
                                    >
                                      {ownerInitials(item.person)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-[10px] text-muted-foreground">
                                    {item.person}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {client.activity.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <UserCheck size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No activity recorded yet</p>
                    </div>
                  )}
                </div>
              </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}
