import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  Network,
  Building2,
  TrendingUp,
  ArrowRightLeft,
  Zap,
  Search,
  Send,
  Filter,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Clock,
  MapPin,
  Briefcase,
  Target,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  User,
  Link2,
  Mail,
  Calendar,
  Globe,
  BarChart3,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

// ═══════════════════════════════════════════════════════════════
// DATA LAYER — All intelligence data used across tabs
// ═══════════════════════════════════════════════════════════════

// ─── Talent Flow Data ──────────────────────────────────────

interface FlowNode { id: string; label: string; value: number; side: "left" | "right"; color: string }
interface FlowLink { source: string; target: string; value: number }

const talentFlowData: Record<string, { nodes: FlowNode[]; links: FlowLink[]; insights: string[] }> = {
  cfo: {
    nodes: [
      { id: "big4", label: "Big 4 Advisory", value: 32, side: "left", color: "#3b82f6" },
      { id: "ibank", label: "Investment Banking", value: 24, side: "left", color: "#6366f1" },
      { id: "peportco", label: "PE Portfolio Cos", value: 28, side: "left", color: "#8b5cf6" },
      { id: "f500", label: "Fortune 500 Finance", value: 18, side: "left", color: "#0ea5e9" },
      { id: "fpa", label: "FP&A / Controller", value: 14, side: "left", color: "#14b8a6" },
      { id: "pe_backed", label: "PE-Backed CFO", value: 48, side: "right", color: "#2563eb" },
      { id: "public_cfo", label: "Public Co CFO", value: 18, side: "right", color: "#0891b2" },
      { id: "cfo_consult", label: "CFO Advisory", value: 12, side: "right", color: "#7c3aed" },
      { id: "board", label: "Board / Operating Partner", value: 10, side: "right", color: "#059669" },
      { id: "ceo_coo", label: "CEO / COO Promotion", value: 8, side: "right", color: "#d97706" },
    ],
    links: [
      { source: "big4", target: "pe_backed", value: 18 }, { source: "big4", target: "public_cfo", value: 8 }, { source: "big4", target: "cfo_consult", value: 6 },
      { source: "ibank", target: "pe_backed", value: 14 }, { source: "ibank", target: "ceo_coo", value: 4 }, { source: "ibank", target: "board", value: 6 },
      { source: "peportco", target: "pe_backed", value: 12 }, { source: "peportco", target: "public_cfo", value: 8 }, { source: "peportco", target: "board", value: 4 }, { source: "peportco", target: "ceo_coo", value: 4 },
      { source: "f500", target: "pe_backed", value: 4 }, { source: "f500", target: "public_cfo", value: 2 }, { source: "f500", target: "cfo_consult", value: 6 }, { source: "f500", target: "ceo_coo", value: 0 },
      { source: "fpa", target: "pe_backed", value: 0 }, { source: "fpa", target: "cfo_consult", value: 0 },
    ].filter(l => l.value > 0),
    insights: [
      "56% of PE-backed CFOs come from Big 4 Advisory or Investment Banking backgrounds",
      "PE portfolio-to-portfolio lateral moves account for 25% of all CFO placements",
      "Board/Operating Partner exits are the fastest-growing destination (+34% YoY)",
      "Average time from VP Finance to PE-backed CFO: 4.2 years",
    ],
  },
  cto: {
    nodes: [
      { id: "faang", label: "FAANG / Big Tech", value: 35, side: "left", color: "#3b82f6" },
      { id: "startup", label: "VC-Backed Startups", value: 28, side: "left", color: "#6366f1" },
      { id: "enterprise", label: "Enterprise Software", value: 20, side: "left", color: "#8b5cf6" },
      { id: "consulting_t", label: "Tech Consulting", value: 12, side: "left", color: "#0ea5e9" },
      { id: "academic", label: "PhD / Research", value: 10, side: "left", color: "#14b8a6" },
      { id: "pe_cto", label: "PE-Backed CTO", value: 42, side: "right", color: "#2563eb" },
      { id: "startup_cto", label: "Startup CTO/VP Eng", value: 22, side: "right", color: "#7c3aed" },
      { id: "cpo", label: "CPO / Product", value: 14, side: "right", color: "#0891b2" },
      { id: "founder", label: "Founded Own Co", value: 12, side: "right", color: "#d97706" },
      { id: "board_t", label: "Tech Advisory / Board", value: 8, side: "right", color: "#059669" },
    ],
    links: [
      { source: "faang", target: "pe_cto", value: 16 }, { source: "faang", target: "startup_cto", value: 10 }, { source: "faang", target: "founder", value: 6 }, { source: "faang", target: "board_t", value: 3 },
      { source: "startup", target: "pe_cto", value: 14 }, { source: "startup", target: "startup_cto", value: 8 }, { source: "startup", target: "founder", value: 6 },
      { source: "enterprise", target: "pe_cto", value: 10 }, { source: "enterprise", target: "cpo", value: 6 }, { source: "enterprise", target: "startup_cto", value: 4 },
      { source: "consulting_t", target: "pe_cto", value: 2 }, { source: "consulting_t", target: "cpo", value: 8 }, { source: "consulting_t", target: "board_t", value: 2 },
      { source: "academic", target: "pe_cto", value: 0 }, { source: "academic", target: "startup_cto", value: 0 }, { source: "academic", target: "founder", value: 0 }, { source: "academic", target: "board_t", value: 3 },
    ].filter(l => l.value > 0),
    insights: [
      "46% of PE-backed CTOs have FAANG or Big Tech pedigree",
      "Startup-to-PE lateral moves are the #1 pipeline for CTO placements",
      "Technical founders who fail to scale often transition to PE-backed CTO roles",
      "Average tenure in PE-backed CTO role: 3.1 years before next move",
    ],
  },
  coo: {
    nodes: [
      { id: "mbb", label: "McKinsey / BCG / Bain", value: 30, side: "left", color: "#3b82f6" },
      { id: "ops", label: "Operations Exec", value: 26, side: "left", color: "#6366f1" },
      { id: "military", label: "Military / Gov", value: 10, side: "left", color: "#8b5cf6" },
      { id: "pe_ops", label: "PE Operating Team", value: 18, side: "left", color: "#0ea5e9" },
      { id: "supply", label: "Supply Chain / Mfg", value: 14, side: "left", color: "#14b8a6" },
      { id: "pe_coo", label: "PE-Backed COO", value: 40, side: "right", color: "#2563eb" },
      { id: "ceo_p", label: "CEO Promotion", value: 18, side: "right", color: "#d97706" },
      { id: "president", label: "Division President", value: 16, side: "right", color: "#7c3aed" },
      { id: "op_partner", label: "Operating Partner", value: 12, side: "right", color: "#059669" },
      { id: "board_ops", label: "Board Director", value: 8, side: "right", color: "#0891b2" },
    ],
    links: [
      { source: "mbb", target: "pe_coo", value: 14 }, { source: "mbb", target: "ceo_p", value: 8 }, { source: "mbb", target: "op_partner", value: 6 }, { source: "mbb", target: "board_ops", value: 2 },
      { source: "ops", target: "pe_coo", value: 12 }, { source: "ops", target: "president", value: 8 }, { source: "ops", target: "ceo_p", value: 6 },
      { source: "military", target: "pe_coo", value: 4 }, { source: "military", target: "president", value: 4 }, { source: "military", target: "board_ops", value: 2 },
      { source: "pe_ops", target: "pe_coo", value: 8 }, { source: "pe_ops", target: "op_partner", value: 6 }, { source: "pe_ops", target: "ceo_p", value: 4 },
      { source: "supply", target: "pe_coo", value: 2 }, { source: "supply", target: "president", value: 4 }, { source: "supply", target: "board_ops", value: 4 },
    ].filter(l => l.value > 0),
    insights: [
      "47% of PE-backed COOs have MBB consulting background",
      "COO-to-CEO promotion rate in PE portfolio cos: 32% within 3 years",
      "Military/government backgrounds are underrepresented but show highest CEO promotion rates",
      "PE Operating Team members increasingly move directly into portfolio COO roles",
    ],
  },
};

// ─── Company Intelligence Data ──────────────────────────────────────

interface CompanyIntel {
  id: string;
  name: string;
  sector: string;
  peSponsor: string;
  revenue: string;
  headcount: number;
  headcountChange: number;
  leadershipGaps: string[];
  recentHires: { name: string; title: string; from: string; date: string }[];
  recentDepartures: { name: string; title: string; to: string; date: string }[];
  fundingStage: string;
  lastFunding: string;
  signals: ("hiring" | "leadership_change" | "funding" | "growth" | "risk")[];
  momentum: "accelerating" | "stable" | "decelerating";
  location: string;
}

const companies: CompanyIntel[] = [
  {
    id: "1", name: "Meridian Health Partners", sector: "Healthcare Services", peSponsor: "Warburg Pincus",
    revenue: "$420M", headcount: 1240, headcountChange: 12,
    leadershipGaps: ["CFO (Active Search)", "VP Supply Chain"],
    recentHires: [
      { name: "Sarah Chen", title: "CFO", from: "Optum Health", date: "2024-11" },
      { name: "David Park", title: "VP Revenue Cycle", from: "HCA Healthcare", date: "2024-09" },
    ],
    recentDepartures: [
      { name: "James Wilson", title: "CFO", to: "Summit Capital", date: "2024-10" },
    ],
    fundingStage: "PE Growth", lastFunding: "$180M Series D (2023)",
    signals: ["hiring", "leadership_change"], momentum: "accelerating", location: "New York, NY",
  },
  {
    id: "2", name: "DataPulse Analytics", sector: "Enterprise Software", peSponsor: "Insight Partners",
    revenue: "$85M ARR", headcount: 340, headcountChange: 28,
    leadershipGaps: ["VP Engineering", "CISO"],
    recentHires: [
      { name: "Alex Rivera", title: "CTO", from: "Google Cloud", date: "2024-08" },
      { name: "Nina Patel", title: "VP Product", from: "Datadog", date: "2024-10" },
    ],
    recentDepartures: [
      { name: "Mark Stevens", title: "VP Engineering", to: "Stripe", date: "2024-12" },
    ],
    fundingStage: "Series C", lastFunding: "$120M Series C (2024)",
    signals: ["hiring", "growth", "funding"], momentum: "accelerating", location: "San Francisco, CA",
  },
  {
    id: "3", name: "HealthBridge Solutions", sector: "Healthcare Operations", peSponsor: "Bain Capital",
    revenue: "$210M", headcount: 680, headcountChange: -3,
    leadershipGaps: ["COO (Confidential)", "Chief Digital Officer"],
    recentHires: [
      { name: "Marcus Williams", title: "COO", from: "McKinsey & Company", date: "2024-07" },
    ],
    recentDepartures: [
      { name: "Lisa Morgan", title: "COO", to: "Optum", date: "2024-06" },
      { name: "Robert Kim", title: "CDO", to: "Accenture", date: "2024-08" },
    ],
    fundingStage: "PE Buyout", lastFunding: "$340M LBO (2022)",
    signals: ["leadership_change", "risk"], momentum: "stable", location: "Boston, MA",
  },
  {
    id: "4", name: "NovaBrands Consumer", sector: "Consumer / DTC", peSponsor: "L Catterton",
    revenue: "$180M", headcount: 420, headcountChange: 8,
    leadershipGaps: ["CMO", "VP E-Commerce"],
    recentHires: [
      { name: "Jordan Blake", title: "CMO", from: "Glossier", date: "2024-06" },
    ],
    recentDepartures: [
      { name: "Amy Richards", title: "CMO", to: "Warby Parker", date: "2024-05" },
    ],
    fundingStage: "PE Growth", lastFunding: "$95M Growth (2023)",
    signals: ["hiring", "leadership_change"], momentum: "accelerating", location: "Los Angeles, CA",
  },
  {
    id: "5", name: "Granite Peak Energy", sector: "Energy Infrastructure", peSponsor: "Warburg Pincus",
    revenue: "$890M", headcount: 2100, headcountChange: 5,
    leadershipGaps: ["VP Investor Relations"],
    recentHires: [
      { name: "Rachel Morrison", title: "CFO", from: "NextEra Energy", date: "2024-03" },
    ],
    recentDepartures: [],
    fundingStage: "PE Infrastructure", lastFunding: "$1.2B Capital Raise (2023)",
    signals: ["growth"], momentum: "stable", location: "Dallas, TX",
  },
  {
    id: "6", name: "TalentForge HR Tech", sector: "HR Technology", peSponsor: "Vista Equity",
    revenue: "$65M ARR", headcount: 280, headcountChange: 22,
    leadershipGaps: ["VP Sales", "General Counsel"],
    recentHires: [
      { name: "Diana Foster", title: "CHRO", from: "Workday", date: "2024-04" },
      { name: "Sam Torres", title: "VP Product", from: "Lattice", date: "2024-09" },
    ],
    recentDepartures: [],
    fundingStage: "PE Growth", lastFunding: "$75M Growth (2024)",
    signals: ["hiring", "growth", "funding"], momentum: "accelerating", location: "Chicago, IL",
  },
  {
    id: "7", name: "Summit Capital Portfolio Co", sector: "Financial Services", peSponsor: "KKR",
    revenue: "$320M", headcount: 560, headcountChange: -5,
    leadershipGaps: ["CTO", "CFO (Succession)"],
    recentHires: [
      { name: "Jennifer Park", title: "CFO", from: "Emerson Electric", date: "2024-01" },
    ],
    recentDepartures: [
      { name: "Tom Harris", title: "CTO", to: "Stripe", date: "2024-11" },
    ],
    fundingStage: "PE Buyout", lastFunding: "$500M LBO (2021)",
    signals: ["leadership_change", "risk"], momentum: "decelerating", location: "Chicago, IL",
  },
  {
    id: "8", name: "VitalWell Consumer Health", sector: "Consumer Health", peSponsor: "General Atlantic",
    revenue: "$150M", headcount: 380, headcountChange: 15,
    leadershipGaps: ["VP Marketing"],
    recentHires: [
      { name: "Karen Lee", title: "CEO", from: "J&J Consumer", date: "2024-02" },
    ],
    recentDepartures: [],
    fundingStage: "PE Growth", lastFunding: "$200M Growth (2023)",
    signals: ["growth", "hiring"], momentum: "accelerating", location: "New York, NY",
  },
];

// ─── Connection Map Data ──────────────────────────────────────

interface TeamMember {
  name: string;
  role: string;
  connections: { entity: string; type: "candidate" | "company" | "pe_firm" | "exec"; strength: "strong" | "warm" | "cold"; lastContact: string; notes: string }[];
}

const teamConnections: TeamMember[] = [
  {
    name: "Andrew",
    role: "Managing Partner",
    connections: [
      { entity: "Sarah Chen", type: "candidate", strength: "strong", lastContact: "2 days ago", notes: "Multiple conversations, strong rapport" },
      { entity: "Jennifer Park", type: "candidate", strength: "strong", lastContact: "1 week ago", notes: "Placed at Summit Capital" },
      { entity: "Warburg Pincus", type: "pe_firm", strength: "strong", lastContact: "3 days ago", notes: "Direct LP relationship with 3 partners" },
      { entity: "KKR", type: "pe_firm", strength: "warm", lastContact: "2 weeks ago", notes: "Introduced via Meridian deal" },
      { entity: "Bain Capital", type: "pe_firm", strength: "warm", lastContact: "1 month ago", notes: "HealthBridge mandate source" },
      { entity: "Marcus Williams", type: "candidate", strength: "warm", lastContact: "5 days ago", notes: "COO candidate, McKinsey background" },
      { entity: "Meridian Health Partners", type: "company", strength: "strong", lastContact: "1 day ago", notes: "Active CFO search" },
      { entity: "HealthBridge Solutions", type: "company", strength: "warm", lastContact: "1 week ago", notes: "COO mandate" },
      { entity: "Katherine Novak", type: "candidate", strength: "strong", lastContact: "4 days ago", notes: "CEO candidate, KKR portfolio" },
      { entity: "DataPulse Analytics", type: "company", strength: "warm", lastContact: "2 weeks ago", notes: "CTO search" },
      { entity: "General Atlantic", type: "pe_firm", strength: "cold", lastContact: "2 months ago", notes: "Initial introduction" },
      { entity: "Vista Equity", type: "pe_firm", strength: "warm", lastContact: "3 weeks ago", notes: "TalentForge relationship" },
    ],
  },
  {
    name: "Ryan",
    role: "Partner, Executive Search",
    connections: [
      { entity: "Alex Rivera", type: "candidate", strength: "strong", lastContact: "3 days ago", notes: "CTO candidate, Google pedigree" },
      { entity: "James Liu", type: "candidate", strength: "warm", lastContact: "1 week ago", notes: "CTO candidate, FinEdge" },
      { entity: "Priya Nair", type: "candidate", strength: "warm", lastContact: "2 weeks ago", notes: "VP Eng candidate" },
      { entity: "Insight Partners", type: "pe_firm", strength: "strong", lastContact: "4 days ago", notes: "DataPulse CTO mandate" },
      { entity: "DataPulse Analytics", type: "company", strength: "strong", lastContact: "2 days ago", notes: "Active CTO search lead" },
      { entity: "Summit Capital", type: "company", strength: "warm", lastContact: "1 week ago", notes: "CTO backfill need" },
      { entity: "L Catterton", type: "pe_firm", strength: "warm", lastContact: "3 weeks ago", notes: "NovaBrands relationship" },
      { entity: "Diana Foster", type: "candidate", strength: "strong", lastContact: "5 days ago", notes: "CHRO candidate, Workday" },
      { entity: "TalentForge HR Tech", type: "company", strength: "warm", lastContact: "2 weeks ago", notes: "GC search" },
    ],
  },
  {
    name: "Aileen",
    role: "Research & Intelligence Lead",
    connections: [
      { entity: "Patricia Huang", type: "candidate", strength: "strong", lastContact: "2 days ago", notes: "CFO candidate, 3 PE exits" },
      { entity: "Rachel Morrison", type: "candidate", strength: "warm", lastContact: "1 week ago", notes: "CFO candidate, Granite Peak" },
      { entity: "Jordan Blake", type: "candidate", strength: "warm", lastContact: "3 days ago", notes: "CMO candidate, DTC expert" },
      { entity: "NovaBrands Consumer", type: "company", strength: "strong", lastContact: "3 days ago", notes: "CMO search research" },
      { entity: "Granite Peak Energy", type: "company", strength: "warm", lastContact: "2 weeks ago", notes: "IR search mapping" },
      { entity: "VitalWell Consumer Health", type: "company", strength: "warm", lastContact: "1 week ago", notes: "VP Marketing mapping" },
      { entity: "Elena Vasquez", type: "candidate", strength: "warm", lastContact: "10 days ago", notes: "VP Ops candidate" },
      { entity: "Derek Thompson", type: "candidate", strength: "cold", lastContact: "3 weeks ago", notes: "COO candidate, initial outreach" },
      { entity: "General Atlantic", type: "pe_firm", strength: "warm", lastContact: "1 week ago", notes: "VitalWell mandate research" },
    ],
  },
];

// ─── Signal Feed Data ──────────────────────────────────────

interface Signal {
  id: string;
  type: "leadership_move" | "funding" | "hiring_surge" | "departure" | "acquisition" | "ipo_signal";
  headline: string;
  detail: string;
  company: string;
  timestamp: string;
  relevance: "high" | "medium" | "low";
  actionable: boolean;
  suggestedAction?: string;
}

const signals: Signal[] = [
  { id: "1", type: "leadership_move", headline: "CFO departure at Meridian Health Partners", detail: "James Wilson resigned as CFO to join Summit Capital. Active search initiated — Warburg Pincus mandating replacement within 60 days.", company: "Meridian Health Partners", timestamp: "2 hours ago", relevance: "high", actionable: true, suggestedAction: "Submit Sarah Chen and Patricia Huang as candidates" },
  { id: "2", type: "funding", headline: "DataPulse closes $120M Series C", detail: "Led by Insight Partners with participation from Accel. Company now valued at $1.2B. Headcount expected to grow 40% over 12 months.", company: "DataPulse Analytics", timestamp: "6 hours ago", relevance: "high", actionable: true, suggestedAction: "Reach out about VP Engineering backfill and CISO need" },
  { id: "3", type: "hiring_surge", headline: "TalentForge engineering headcount up 22% in 90 days", detail: "Vista Equity portfolio company adding aggressively across product and engineering. 14 new engineering roles posted this week.", company: "TalentForge HR Tech", timestamp: "1 day ago", relevance: "medium", actionable: true, suggestedAction: "Pitch VP Sales and General Counsel search services" },
  { id: "4", type: "departure", headline: "Tom Harris (CTO) leaves Summit Capital Portfolio Co", detail: "Departing for Stripe after 3 years. KKR-backed company now has dual C-suite gaps (CTO + CFO succession). Critical talent risk.", company: "Summit Capital Portfolio Co", timestamp: "1 day ago", relevance: "high", actionable: true, suggestedAction: "Contact KKR operating team about CTO search mandate" },
  { id: "5", type: "leadership_move", headline: "Marcus Williams joins HealthBridge as COO", detail: "Former McKinsey Engagement Manager tapped to replace Lisa Morgan. Expected to drive EBITDA improvement across 40 clinic locations.", company: "HealthBridge Solutions", timestamp: "2 days ago", relevance: "medium", actionable: false },
  { id: "6", type: "acquisition", headline: "VitalWell exploring tuck-in acquisition", detail: "Sources indicate General Atlantic is backing VitalWell's acquisition of a $30M DTC supplement brand. Integration leadership needed.", company: "VitalWell Consumer Health", timestamp: "3 days ago", relevance: "medium", actionable: true, suggestedAction: "Offer integration leadership and VP Marketing search" },
  { id: "7", type: "hiring_surge", headline: "NovaBrands doubling e-commerce team", detail: "L Catterton pushing digital transformation. New VP E-Commerce role created, along with Director of Digital Marketing and Head of Analytics.", company: "NovaBrands Consumer", timestamp: "3 days ago", relevance: "medium", actionable: true, suggestedAction: "Submit candidates for VP E-Commerce role" },
  { id: "8", type: "ipo_signal", headline: "Granite Peak Energy considering IPO timeline", detail: "Warburg Pincus evaluating 2025 IPO. VP Investor Relations hire is priority to prepare S-1 and roadshow. Revenue at $890M positions well.", company: "Granite Peak Energy", timestamp: "5 days ago", relevance: "high", actionable: true, suggestedAction: "Pitch VP Investor Relations search — IPO-experienced candidates" },
  { id: "9", type: "leadership_move", headline: "Jordan Blake named CMO at NovaBrands", detail: "Former Glossier VP Marketing tapped by L Catterton to lead digital brand strategy. Replaces Amy Richards who left for Warby Parker.", company: "NovaBrands Consumer", timestamp: "1 week ago", relevance: "low", actionable: false },
  { id: "10", type: "funding", headline: "TalentForge raises $75M from Vista Equity", detail: "Growth round to fund product expansion and enterprise go-to-market. Valuation estimated at $400M. Hiring across all functions.", company: "TalentForge HR Tech", timestamp: "1 week ago", relevance: "medium", actionable: false },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT: Sankey Diagram (SVG-based Talent Flow)
// ═══════════════════════════════════════════════════════════════

function SankeyDiagram({ nodes, links }: { nodes: FlowNode[]; links: FlowLink[] }) {
  const width = 900;
  const height = 420;
  const nodeWidth = 18;
  const padding = 40;
  const leftX = padding;
  const rightX = width - padding - nodeWidth;

  const leftNodes = nodes.filter((n) => n.side === "left");
  const rightNodes = nodes.filter((n) => n.side === "right");

  const totalLeft = leftNodes.reduce((s, n) => s + n.value, 0);
  const totalRight = rightNodes.reduce((s, n) => s + n.value, 0);

  const usableHeight = height - 40;
  const nodeGap = 8;

  function layoutNodes(list: FlowNode[], total: number): (FlowNode & { y: number; h: number })[] {
    const totalGap = (list.length - 1) * nodeGap;
    const scale = (usableHeight - totalGap) / total;
    let y = 20;
    return list.map((n) => {
      const h = Math.max(n.value * scale, 4);
      const result = { ...n, y, h };
      y += h + nodeGap;
      return result;
    });
  }

  const leftLayout = layoutNodes(leftNodes, totalLeft);
  const rightLayout = layoutNodes(rightNodes, totalRight);

  // Track cumulative offsets for link positioning
  const leftOffsets: Record<string, number> = {};
  const rightOffsets: Record<string, number> = {};
  leftLayout.forEach((n) => (leftOffsets[n.id] = 0));
  rightLayout.forEach((n) => (rightOffsets[n.id] = 0));

  const maxLinkVal = Math.max(...links.map(l => l.value));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 420 }}>
      {/* Links */}
      {links.map((link, i) => {
        const src = leftLayout.find((n) => n.id === link.source);
        const tgt = rightLayout.find((n) => n.id === link.target);
        if (!src || !tgt) return null;

        const srcScale = src.h / src.value;
        const tgtScale = tgt.h / tgt.value;
        const linkH_src = link.value * srcScale;
        const linkH_tgt = link.value * tgtScale;

        const sy = src.y + leftOffsets[link.source];
        const ty = tgt.y + rightOffsets[link.target];
        leftOffsets[link.source] += linkH_src;
        rightOffsets[link.target] += linkH_tgt;

        const x0 = leftX + nodeWidth;
        const x1 = rightX;
        const mx = (x0 + x1) / 2;

        const opacity = 0.12 + (link.value / maxLinkVal) * 0.22;

        return (
          <path
            key={i}
            d={`M${x0},${sy} C${mx},${sy} ${mx},${ty} ${x1},${ty} L${x1},${ty + linkH_tgt} C${mx},${ty + linkH_tgt} ${mx},${sy + linkH_src} ${x0},${sy + linkH_src} Z`}
            fill={src.color}
            opacity={opacity}
            className="transition-opacity hover:opacity-60"
          />
        );
      })}
      {/* Left nodes */}
      {leftLayout.map((n) => (
        <g key={n.id}>
          <rect x={leftX} y={n.y} width={nodeWidth} height={n.h} rx={3} fill={n.color} />
          <text x={leftX + nodeWidth + 8} y={n.y + n.h / 2} dominantBaseline="middle" className="text-[11px] fill-current" style={{ fill: "var(--foreground, #374151)" }}>
            {n.label}
          </text>
          <text x={leftX - 6} y={n.y + n.h / 2} dominantBaseline="middle" textAnchor="end" className="text-[10px]" style={{ fill: "var(--muted-foreground, #9ca3af)" }}>
            {n.value}
          </text>
        </g>
      ))}
      {/* Right nodes */}
      {rightLayout.map((n) => (
        <g key={n.id}>
          <rect x={rightX} y={n.y} width={nodeWidth} height={n.h} rx={3} fill={n.color} />
          <text x={rightX - 8} y={n.y + n.h / 2} dominantBaseline="middle" textAnchor="end" className="text-[11px] fill-current" style={{ fill: "var(--foreground, #374151)" }}>
            {n.label}
          </text>
          <text x={rightX + nodeWidth + 6} y={n.y + n.h / 2} dominantBaseline="middle" className="text-[10px]" style={{ fill: "var(--muted-foreground, #9ca3af)" }}>
            {n.value}
          </text>
        </g>
      ))}
      {/* Column headers */}
      <text x={leftX + nodeWidth / 2} y={10} textAnchor="middle" className="text-[10px] font-semibold uppercase tracking-wider" style={{ fill: "var(--muted-foreground, #9ca3af)" }}>
        Source
      </text>
      <text x={rightX + nodeWidth / 2} y={10} textAnchor="middle" className="text-[10px] font-semibold uppercase tracking-wider" style={{ fill: "var(--muted-foreground, #9ca3af)" }}>
        Destination
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: TALENT FLOWS
// ═══════════════════════════════════════════════════════════════

function TalentFlowsTab() {
  const [selectedFunction, setSelectedFunction] = useState("cfo");
  const data = talentFlowData[selectedFunction];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Talent Flow Analysis</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Where executive talent comes from and where it goes</p>
        </div>
        <Select value={selectedFunction} onValueChange={setSelectedFunction}>
          <SelectTrigger className="w-[180px] h-9 text-sm" data-testid="select-flow-function">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cfo">CFO / Finance</SelectItem>
            <SelectItem value="cto">CTO / Technology</SelectItem>
            <SelectItem value="coo">COO / Operations</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-border">
        <CardContent className="p-5">
          <SankeyDiagram nodes={data.nodes} links={data.links} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {data.insights.map((insight, i) => (
          <div key={i} className="flex gap-2.5 p-3 rounded-lg border border-border bg-muted/30">
            <Zap size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">{insight}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: COMPANY INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

function CompanyIntelTab() {
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState<CompanyIntel | null>(null);

  const { data: loxoCompanies = [], isLoading } = useQuery<CompanyIntel[]>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const r = await fetch("/api/companies", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load companies");
      return r.json();
    },
  });

  const companyData = loxoCompanies.length > 0 ? loxoCompanies : companies;

  const sectors = useMemo(() => Array.from(new Set(companyData.map(c => c.sector))), [companyData]);

  const filtered = useMemo(() => {
    return companyData.filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.peSponsor.toLowerCase().includes(search.toLowerCase())) return false;
      if (sectorFilter !== "all" && c.sector !== sectorFilter) return false;
      return true;
    });
  }, [companyData, search, sectorFilter]);

  const momentumIcon = (m: string) => {
    if (m === "accelerating") return <ArrowUpRight size={12} className="text-green-500" />;
    if (m === "decelerating") return <ArrowDownRight size={12} className="text-red-500" />;
    return <Minus size={12} className="text-muted-foreground" />;
  };

  const momentumColor = (m: string) => {
    if (m === "accelerating") return "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400";
    if (m === "decelerating") return "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400";
    return "text-muted-foreground bg-muted";
  };

  const signalIcon = (s: string) => {
    switch (s) {
      case "hiring": return <Users size={10} />;
      case "leadership_change": return <User size={10} />;
      case "funding": return <DollarSign size={10} />;
      case "growth": return <TrendingUp size={10} />;
      case "risk": return <AlertTriangle size={10} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search companies or PE sponsors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="input-company-search"
          />
        </div>
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue placeholder="All Sectors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sectors</SelectItem>
            {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {isLoading && (
          <div className="rounded-xl border border-border p-6 text-center text-xs text-muted-foreground">
            <Loader2 size={16} className="mx-auto mb-2 animate-spin" /> Loading companies from Loxo sync data…
          </div>
        )}
        {filtered.map(company => (
          <Card
            key={company.id}
            className={cn(
              "border border-border cursor-pointer transition-all hover:border-primary/30 hover:shadow-sm",
              selectedCompany?.id === company.id && "border-primary/50 shadow-sm"
            )}
            onClick={() => setSelectedCompany(selectedCompany?.id === company.id ? null : company)}
            data-testid={`card-company-${company.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{company.name}</h3>
                    <p className="text-xs text-muted-foreground">{company.sector} · {company.peSponsor}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[10px] gap-1 border-0", momentumColor(company.momentum))}>
                    {momentumIcon(company.momentum)}
                    {company.momentum}
                  </Badge>
                  <ChevronRight size={14} className={cn("text-muted-foreground transition-transform", selectedCompany?.id === company.id && "rotate-90")} />
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><DollarSign size={10} /> {company.revenue}</span>
                <span className="flex items-center gap-1"><Users size={10} /> {company.headcount} employees</span>
                <span className={cn("flex items-center gap-1", company.headcountChange > 0 ? "text-green-600 dark:text-green-400" : company.headcountChange < 0 ? "text-red-600 dark:text-red-400" : "")}>
                  {company.headcountChange > 0 ? "+" : ""}{company.headcountChange}% (90d)
                </span>
                <span className="flex items-center gap-1"><MapPin size={10} /> {company.location}</span>
              </div>

              {company.leadershipGaps.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2.5">
                  <AlertTriangle size={10} className="text-amber-500 flex-shrink-0" />
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Leadership gaps:</span>
                  {company.leadershipGaps.map((gap, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:text-amber-400">
                      {gap}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-1 mt-2">
                {company.signals.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                    {signalIcon(s)} {s.replace("_", " ")}
                  </Badge>
                ))}
              </div>

              {/* Expanded detail */}
              {selectedCompany?.id === company.id && (
                <div className="mt-4 pt-4 border-t border-border space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Hires</p>
                      {company.recentHires.length > 0 ? company.recentHires.map((h, i) => (
                        <div key={i} className="flex items-center gap-2 mb-1.5">
                          <ArrowUpRight size={10} className="text-green-500 flex-shrink-0" />
                          <span className="text-xs"><span className="font-medium">{h.name}</span> as {h.title} <span className="text-muted-foreground">from {h.from}</span></span>
                        </div>
                      )) : <p className="text-xs text-muted-foreground">No recent hires tracked</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Departures</p>
                      {company.recentDepartures.length > 0 ? company.recentDepartures.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 mb-1.5">
                          <ArrowDownRight size={10} className="text-red-500 flex-shrink-0" />
                          <span className="text-xs"><span className="font-medium">{d.name}</span> ({d.title}) <span className="text-muted-foreground">to {d.to}</span></span>
                        </div>
                      )) : <p className="text-xs text-muted-foreground">No recent departures</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span><span className="font-medium text-foreground">Funding:</span> {company.lastFunding}</span>
                    <span><span className="font-medium text-foreground">Stage:</span> {company.fundingStage}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: CONNECTION MAPPING
// ═══════════════════════════════════════════════════════════════

function ConnectionMapTab() {
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const allConnections = useMemo(() => {
    const result: (TeamMember["connections"][0] & { teamMember: string })[] = [];
    const source = selectedMember === "all" ? teamConnections : teamConnections.filter(t => t.name === selectedMember);
    source.forEach(tm => {
      tm.connections.forEach(c => {
        if (typeFilter === "all" || c.type === typeFilter) {
          result.push({ ...c, teamMember: tm.name });
        }
      });
    });
    // Deduplicate by entity — keep strongest
    const map = new Map<string, typeof result[0]>();
    result.forEach(c => {
      const existing = map.get(c.entity);
      const strengthOrder = { strong: 3, warm: 2, cold: 1 };
      if (!existing || strengthOrder[c.strength] > strengthOrder[existing.strength]) {
        map.set(c.entity, c);
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const order = { strong: 0, warm: 1, cold: 2 };
      return order[a.strength] - order[b.strength];
    });
  }, [selectedMember, typeFilter]);

  const strengthColor = (s: string) => {
    if (s === "strong") return "bg-green-500";
    if (s === "warm") return "bg-amber-500";
    return "bg-gray-400";
  };

  const strengthBadge = (s: string) => {
    if (s === "strong") return "text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400";
    if (s === "warm") return "text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400";
    return "text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400";
  };

  const typeIcon = (t: string) => {
    switch (t) {
      case "candidate": return <User size={12} />;
      case "company": return <Building2 size={12} />;
      case "pe_firm": return <DollarSign size={12} />;
      case "exec": return <Briefcase size={12} />;
      default: return null;
    }
  };

  // Summary stats
  const stats = useMemo(() => {
    const all = teamConnections.flatMap(t => t.connections);
    return {
      total: new Set(all.map(c => c.entity)).size,
      strong: all.filter(c => c.strength === "strong").length,
      candidates: new Set(all.filter(c => c.type === "candidate").map(c => c.entity)).size,
      companies: new Set(all.filter(c => c.type === "company").map(c => c.entity)).size,
      peFirms: new Set(all.filter(c => c.type === "pe_firm").map(c => c.entity)).size,
    };
  }, []);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total Connections", value: stats.total, icon: Network },
          { label: "Strong Relationships", value: stats.strong, icon: CheckCircle2 },
          { label: "Candidates", value: stats.candidates, icon: Users },
          { label: "Companies", value: stats.companies, icon: Building2 },
          { label: "PE Firms", value: stats.peFirms, icon: DollarSign },
        ].map((s, i) => (
          <Card key={i} className="border border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <s.icon size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={selectedMember} onValueChange={setSelectedMember}>
          <SelectTrigger className="w-[180px] h-9 text-sm" data-testid="select-team-member">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Team Members</SelectItem>
            {teamConnections.map(t => <SelectItem key={t.name} value={t.name}>{t.name} ({t.role})</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="candidate">Candidates</SelectItem>
            <SelectItem value="company">Companies</SelectItem>
            <SelectItem value="pe_firm">PE Firms</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Visual Connection Map */}
      <Card className="border border-border">
        <CardContent className="p-5">
          <div className="flex items-start gap-8">
            {/* Team center nodes */}
            <div className="flex flex-col items-center gap-3 pt-4 flex-shrink-0" style={{ minWidth: 120 }}>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Team</p>
              {teamConnections.map(tm => {
                const isSelected = selectedMember === "all" || selectedMember === tm.name;
                return (
                  <button
                    key={tm.name}
                    onClick={() => setSelectedMember(selectedMember === tm.name ? "all" : tm.name)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-full",
                      isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
                    )}
                  >
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0", tm.name === "Andrew" ? "bg-blue-600" : tm.name === "Ryan" ? "bg-violet-600" : "bg-emerald-600")}>
                      {tm.name[0]}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium">{tm.name}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{tm.role.split(",")[0]}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Connections list */}
            <div className="flex-1 space-y-1.5 max-h-[400px] overflow-y-auto pr-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">{allConnections.length} Connections</p>
              {allConnections.map((conn, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", strengthColor(conn.strength))} />
                  <div className="w-5 flex-shrink-0 text-muted-foreground">{typeIcon(conn.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium truncate">{conn.entity}</p>
                      <Badge className={cn("text-[9px] border-0 px-1.5", strengthBadge(conn.strength))}>{conn.strength}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{conn.notes}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-muted-foreground">{conn.lastContact}</p>
                    {selectedMember === "all" && (
                      <p className="text-[10px] text-primary font-medium">{conn.teamMember}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warm Path Suggestions */}
      <Card className="border border-border bg-amber-50/30 dark:bg-amber-900/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-amber-500" />
            <p className="text-xs font-semibold">Warm Introduction Paths</p>
          </div>
          <div className="space-y-2">
            {[
              { path: "Andrew → Warburg Pincus → Meridian Health Partners CFO Search", strength: "Direct relationship", urgency: "Active mandate" },
              { path: "Ryan → Insight Partners → DataPulse VP Engineering", strength: "Strong PE relationship", urgency: "Post-funding hire" },
              { path: "Aileen → General Atlantic → VitalWell VP Marketing", strength: "Research relationship", urgency: "Acquisition integration" },
              { path: "Andrew → KKR → Summit Capital CTO Replacement", strength: "Warm introduction", urgency: "Urgent backfill" },
            ].map((suggestion, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-md bg-background border border-border">
                <div className="flex items-center gap-2">
                  <Link2 size={10} className="text-amber-500 flex-shrink-0" />
                  <p className="text-xs">{suggestion.path}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="secondary" className="text-[9px]">{suggestion.strength}</Badge>
                  <Badge className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">{suggestion.urgency}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: SIGNAL FEED
// ═══════════════════════════════════════════════════════════════

function SignalFeedTab() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [relevanceFilter, setRelevanceFilter] = useState("all");

  const filtered = useMemo(() => {
    return signals.filter(s => {
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (relevanceFilter !== "all" && s.relevance !== relevanceFilter) return false;
      return true;
    });
  }, [typeFilter, relevanceFilter]);

  const signalTypeIcon = (t: string) => {
    switch (t) {
      case "leadership_move": return <User size={14} className="text-blue-500" />;
      case "funding": return <DollarSign size={14} className="text-green-500" />;
      case "hiring_surge": return <Users size={14} className="text-violet-500" />;
      case "departure": return <ArrowDownRight size={14} className="text-red-500" />;
      case "acquisition": return <Building2 size={14} className="text-amber-500" />;
      case "ipo_signal": return <TrendingUp size={14} className="text-emerald-500" />;
      default: return <Zap size={14} />;
    }
  };

  const signalTypeBg = (t: string) => {
    switch (t) {
      case "leadership_move": return "bg-blue-100 dark:bg-blue-900/20";
      case "funding": return "bg-green-100 dark:bg-green-900/20";
      case "hiring_surge": return "bg-violet-100 dark:bg-violet-900/20";
      case "departure": return "bg-red-100 dark:bg-red-900/20";
      case "acquisition": return "bg-amber-100 dark:bg-amber-900/20";
      case "ipo_signal": return "bg-emerald-100 dark:bg-emerald-900/20";
      default: return "bg-muted";
    }
  };

  const relevanceBadge = (r: string) => {
    if (r === "high") return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
    if (r === "medium") return "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400";
    return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  };

  // KPI counts
  const actionableCount = signals.filter(s => s.actionable).length;
  const highRelevance = signals.filter(s => s.relevance === "high").length;

  return (
    <div className="space-y-5">
      {/* Signal KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Active Signals", value: signals.length, icon: Zap, color: "text-amber-500" },
          { label: "High Priority", value: highRelevance, icon: AlertTriangle, color: "text-red-500" },
          { label: "Actionable", value: actionableCount, icon: Target, color: "text-green-500" },
          { label: "Companies Tracked", value: companies.length, icon: Building2, color: "text-blue-500" },
        ].map((s, i) => (
          <Card key={i} className="border border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted")}>
                <s.icon size={14} className={s.color} />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="All Signal Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Signal Types</SelectItem>
            <SelectItem value="leadership_move">Leadership Moves</SelectItem>
            <SelectItem value="funding">Funding Events</SelectItem>
            <SelectItem value="hiring_surge">Hiring Surges</SelectItem>
            <SelectItem value="departure">Departures</SelectItem>
            <SelectItem value="acquisition">Acquisitions</SelectItem>
            <SelectItem value="ipo_signal">IPO Signals</SelectItem>
          </SelectContent>
        </Select>
        <Select value={relevanceFilter} onValueChange={setRelevanceFilter}>
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue placeholder="All Relevance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Relevance</SelectItem>
            <SelectItem value="high">High Priority</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Signal Cards */}
      <div className="space-y-2.5">
        {filtered.map(signal => (
          <Card key={signal.id} className={cn("border border-border transition-all", signal.relevance === "high" && "border-l-2 border-l-red-500")}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", signalTypeBg(signal.type))}>
                  {signalTypeIcon(signal.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold truncate">{signal.headline}</h3>
                    <Badge className={cn("text-[9px] border-0 flex-shrink-0", relevanceBadge(signal.relevance))}>
                      {signal.relevance}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{signal.detail}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Building2 size={10} /> {signal.company}</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {signal.timestamp}</span>
                  </div>
                  {signal.actionable && signal.suggestedAction && (
                    <div className="mt-2.5 flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/10">
                      <Target size={12} className="text-primary flex-shrink-0" />
                      <p className="text-xs text-primary font-medium">{signal.suggestedAction}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 5: AI SCOUT
// ═══════════════════════════════════════════════════════════════

function AIScoutTab() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<{ type: "answer"; content: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sampleQueries = [
    "Show me all PE-backed companies with CFO gaps in healthcare",
    "Which candidates have Big 4 Advisory backgrounds and 90%+ match scores?",
    "What are the warm introduction paths to Warburg Pincus portfolio companies?",
    "Compare talent flow patterns between CFO and CTO roles",
    "Which companies had the highest hiring velocity in the last 90 days?",
    "Find all leadership departures that create potential search mandates",
  ];

  function handleSearch(q?: string) {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setIsSearching(true);

    // Simulate AI analysis
    setTimeout(() => {
      const responses: Record<string, string> = {
        "default": `## Analysis Results\n\nBased on scanning **8 portfolio companies**, **18 candidates**, and **30+ team connections** in your intelligence database:\n\n**Key Findings:**\n- **3 active leadership gaps** identified across tracked companies matching your query\n- **Meridian Health Partners** (Warburg Pincus) — CFO search active, Sarah Chen is a 96% match\n- **Summit Capital Portfolio Co** (KKR) — Dual C-suite gaps (CTO + CFO succession) creating urgency\n- **DataPulse Analytics** (Insight Partners) — VP Engineering gap post-funding, growing 28% in 90 days\n\n**Recommended Actions:**\n1. Prioritize Meridian CFO mandate — warm path via Andrew's Warburg relationship\n2. Pitch KKR on CTO search for Summit Capital — Tom Harris departure is 1 day old\n3. Position Ryan for DataPulse VP Eng search given Insight Partners relationship\n\n**Network Advantage:** Your team has direct relationships with 5 of 6 PE sponsors tracked, giving you a warm introduction path to 75% of identified opportunities.`,
      };

      // Find best matching response or use default
      let responseKey = "default";
      const lowerQ = searchQuery.toLowerCase();
      if (lowerQ.includes("cfo") && lowerQ.includes("healthcare")) {
        responseKey = "cfo_healthcare";
      }

      const response = responses[responseKey] || responses["default"];
      setResults({ type: "answer", content: response });
      setIsSearching(false);
    }, 2000);
  }

  return (
    <div className="space-y-5">
      {/* Search */}
      <Card className="border border-border bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">AI Scout</h3>
            <Badge variant="secondary" className="text-[10px]">Natural Language</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Ask anything about your talent pipeline, company intelligence, team connections, or market signals. Scout analyzes across all your data.</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="Ask Scout anything..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                className="pl-9 h-10 text-sm"
                data-testid="input-scout-query"
              />
            </div>
            <Button onClick={() => handleSearch()} disabled={isSearching || !query.trim()} className="gap-1.5" data-testid="button-scout-search">
              {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {isSearching ? "Analyzing..." : "Ask Scout"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sample Queries */}
      {!results && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Try asking:</p>
          <div className="grid grid-cols-2 gap-2">
            {sampleQueries.map((sq, i) => (
              <button
                key={i}
                onClick={() => handleSearch(sq)}
                className="text-left px-3 py-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-all"
                data-testid={`button-sample-query-${i}`}
              >
                <p className="text-xs text-muted-foreground">{sq}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isSearching && (
        <Card className="border border-border">
          <CardContent className="p-6 flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium">Analyzing intelligence data...</p>
              <p className="text-xs text-muted-foreground mt-1">Scanning candidates, companies, connections, and signals</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && !isSearching && (
        <Card className="border border-border">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={14} className="text-primary" />
              <p className="text-xs font-semibold text-primary">Scout Analysis</p>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {results.content.split("\n").map((line, i) => {
                if (line.startsWith("## ")) return <h3 key={i} className="text-sm font-semibold mt-3 mb-2">{line.replace("## ", "")}</h3>;
                if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="text-xs font-semibold mt-2 mb-1">{line.replace(/\*\*/g, "")}</p>;
                if (line.startsWith("- ")) return <div key={i} className="flex gap-2 text-xs text-muted-foreground mb-1"><span className="text-primary">•</span><span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>') }} /></div>;
                if (line.match(/^\d+\./)) return <div key={i} className="flex gap-2 text-xs text-muted-foreground mb-1"><span className="text-primary font-medium">{line.match(/^\d+/)?.[0]}.</span><span dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s*/, "").replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>') }} /></div>;
                if (line.trim() === "") return <div key={i} className="h-2" />;
                return <p key={i} className="text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>') }} />;
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
              <p className="text-[10px] text-muted-foreground">Data sources: 8 companies · 18 candidates · 30 connections · 10 signals</p>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => { setResults(null); setQuery(""); }}>
                New Query
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN: Intelligence Hub Page
// ═══════════════════════════════════════════════════════════════

export default function IntelligenceHub() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-xl">Intelligence Hub</h1>
            <Badge className="text-[10px] bg-primary/10 text-primary border-0">Powered by AI</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Market intelligence, talent flows, connection mapping, and real-time signals
          </p>
        </div>
      </div>

      <Tabs defaultValue="signals" className="space-y-4">
        <TabsList className="bg-muted/50 p-0.5" data-testid="tabs-intelligence">
          <TabsTrigger value="signals" className="gap-1.5 text-xs" data-testid="tab-signals">
            <Zap size={12} /> Signal Feed
          </TabsTrigger>
          <TabsTrigger value="flows" className="gap-1.5 text-xs" data-testid="tab-flows">
            <ArrowRightLeft size={12} /> Talent Flows
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-1.5 text-xs" data-testid="tab-companies">
            <Building2 size={12} /> Company Intel
          </TabsTrigger>
          <TabsTrigger value="connections" className="gap-1.5 text-xs" data-testid="tab-connections">
            <Network size={12} /> Connections
          </TabsTrigger>
          <TabsTrigger value="scout" className="gap-1.5 text-xs" data-testid="tab-scout">
            <Brain size={12} /> AI Scout
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signals"><SignalFeedTab /></TabsContent>
        <TabsContent value="flows"><TalentFlowsTab /></TabsContent>
        <TabsContent value="companies"><CompanyIntelTab /></TabsContent>
        <TabsContent value="connections"><ConnectionMapTab /></TabsContent>
        <TabsContent value="scout"><AIScoutTab /></TabsContent>
      </Tabs>
    </div>
  );
}
