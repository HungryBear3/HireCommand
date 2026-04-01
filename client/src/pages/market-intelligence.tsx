import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, TrendingUp, Network, Building2, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Shared Types ──────────────────────────────────

interface SankeyNode {
  id: string;
  label: string;
  value: number;
  side: "left" | "right";
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

// ─── Talent Flow Datasets by Function ──────────────────────────────────

const flowDataSets: Record<string, { title: string; nodes: SankeyNode[]; links: SankeyLink[]; insights: { stat: string; text: string }[] }> = {
  all: {
    title: "Executive Talent Movement Patterns",
    nodes: [
      { id: "big4", label: "Big 4 / Advisory", value: 28, side: "left" },
      { id: "tech", label: "Tech Companies", value: 25, side: "left" },
      { id: "consulting", label: "Management Consulting", value: 22, side: "left" },
      { id: "peportco", label: "PE Portfolio Cos", value: 35, side: "left" },
      { id: "f500", label: "Fortune 500", value: 20, side: "left" },
      { id: "finserv", label: "Financial Services", value: 15, side: "left" },
      { id: "pebacked", label: "PE-Backed Companies", value: 52, side: "right" },
      { id: "public", label: "Public Companies", value: 25, side: "right" },
      { id: "growth", label: "Growth Startups", value: 20, side: "right" },
      { id: "advisory", label: "Advisory / Board", value: 15, side: "right" },
      { id: "vcpe", label: "VC / PE Funds", value: 18, side: "right" },
      { id: "consult_out", label: "Consulting", value: 10, side: "right" },
    ],
    links: [
      { source: "big4", target: "pebacked", value: 14 }, { source: "big4", target: "public", value: 8 }, { source: "big4", target: "growth", value: 4 }, { source: "big4", target: "consult_out", value: 2 },
      { source: "tech", target: "pebacked", value: 8 }, { source: "tech", target: "growth", value: 8 }, { source: "tech", target: "public", value: 5 }, { source: "tech", target: "vcpe", value: 4 },
      { source: "consulting", target: "pebacked", value: 10 }, { source: "consulting", target: "vcpe", value: 5 }, { source: "consulting", target: "growth", value: 4 }, { source: "consulting", target: "advisory", value: 3 },
      { source: "peportco", target: "pebacked", value: 15 }, { source: "peportco", target: "public", value: 8 }, { source: "peportco", target: "advisory", value: 6 }, { source: "peportco", target: "vcpe", value: 4 }, { source: "peportco", target: "growth", value: 2 },
      { source: "f500", target: "pebacked", value: 5 }, { source: "f500", target: "public", value: 4 }, { source: "f500", target: "advisory", value: 5 }, { source: "f500", target: "growth", value: 3 }, { source: "f500", target: "vcpe", value: 3 },
      { source: "finserv", target: "pebacked", value: 4 }, { source: "finserv", target: "vcpe", value: 4 }, { source: "finserv", target: "consult_out", value: 3 }, { source: "finserv", target: "advisory", value: 2 }, { source: "finserv", target: "growth", value: 2 },
    ],
    insights: [
      { stat: "36%", text: "PE-backed companies are the #1 destination for executive talent" },
      { stat: "+22%", text: "Cross-functional executive moves increasing year over year" },
      { stat: "3.8 yrs", text: "Average tenure before a C-suite level move" },
    ],
  },
  cfo: {
    title: "CFO / VP Finance Talent Movement Patterns",
    nodes: [
      { id: "big4", label: "Big 4 Accounting", value: 28, side: "left" },
      { id: "ib", label: "Investment Banking", value: 22, side: "left" },
      { id: "peportco", label: "PE Portfolio Cos", value: 35, side: "left" },
      { id: "f500", label: "Fortune 500 Finance", value: 18, side: "left" },
      { id: "tech", label: "Tech Companies", value: 12, side: "left" },
      { id: "consulting", label: "Consulting (MBB)", value: 8, side: "left" },
      { id: "pebacked", label: "PE-Backed Companies", value: 45, side: "right" },
      { id: "public", label: "Public Companies", value: 22, side: "right" },
      { id: "growth", label: "Growth-Stage Startups", value: 15, side: "right" },
      { id: "largePE", label: "Larger PE Funds", value: 12, side: "right" },
      { id: "advisory", label: "Advisory / Board", value: 10, side: "right" },
      { id: "consult_out", label: "Consulting", value: 8, side: "right" },
    ],
    links: [
      { source: "big4", target: "pebacked", value: 14 }, { source: "big4", target: "public", value: 8 }, { source: "big4", target: "growth", value: 4 }, { source: "big4", target: "consult_out", value: 2 },
      { source: "ib", target: "pebacked", value: 10 }, { source: "ib", target: "largePE", value: 6 }, { source: "ib", target: "growth", value: 4 }, { source: "ib", target: "advisory", value: 2 },
      { source: "peportco", target: "pebacked", value: 15 }, { source: "peportco", target: "public", value: 8 }, { source: "peportco", target: "advisory", value: 5 }, { source: "peportco", target: "largePE", value: 4 }, { source: "peportco", target: "growth", value: 3 },
      { source: "f500", target: "pebacked", value: 4 }, { source: "f500", target: "public", value: 6 }, { source: "f500", target: "growth", value: 4 }, { source: "f500", target: "advisory", value: 3 }, { source: "f500", target: "consult_out", value: 1 },
      { source: "tech", target: "growth", value: 5 }, { source: "tech", target: "pebacked", value: 2 }, { source: "tech", target: "public", value: 3 }, { source: "tech", target: "largePE", value: 2 },
      { source: "consulting", target: "pebacked", value: 3 }, { source: "consulting", target: "consult_out", value: 2 }, { source: "consulting", target: "advisory", value: 1 }, { source: "consulting", target: "growth", value: 1 }, { source: "consulting", target: "public", value: 1 },
    ],
    insights: [
      { stat: "28%", text: "PE Portfolio Companies are the #1 source of CFO talent" },
      { stat: "+15%", text: "Big 4-to-PE pipeline is strengthening year over year" },
      { stat: "4.2 yrs", text: "Average tenure before a CFO-level move" },
    ],
  },
  cto: {
    title: "CTO / VP Engineering Talent Movement Patterns",
    nodes: [
      { id: "faang", label: "FAANG / Big Tech", value: 32, side: "left" },
      { id: "scaleup", label: "Scale-ups (Series C+)", value: 24, side: "left" },
      { id: "enterprise", label: "Enterprise Software", value: 18, side: "left" },
      { id: "consulting", label: "McKinsey Digital / BCG", value: 10, side: "left" },
      { id: "cloud", label: "Cloud Providers", value: 14, side: "left" },
      { id: "academic", label: "Academic / Research", value: 6, side: "left" },
      { id: "pebacked", label: "PE-Backed Tech Cos", value: 38, side: "right" },
      { id: "growth", label: "Growth Startups", value: 22, side: "right" },
      { id: "public", label: "Public Tech Companies", value: 18, side: "right" },
      { id: "vc", label: "Venture Capital", value: 10, side: "right" },
      { id: "advisory", label: "Advisory / Board", value: 8, side: "right" },
      { id: "founder", label: "Founding Own Co", value: 8, side: "right" },
    ],
    links: [
      { source: "faang", target: "pebacked", value: 10 }, { source: "faang", target: "growth", value: 10 }, { source: "faang", target: "public", value: 6 }, { source: "faang", target: "founder", value: 4 }, { source: "faang", target: "vc", value: 2 },
      { source: "scaleup", target: "pebacked", value: 10 }, { source: "scaleup", target: "growth", value: 6 }, { source: "scaleup", target: "public", value: 4 }, { source: "scaleup", target: "founder", value: 2 }, { source: "scaleup", target: "vc", value: 2 },
      { source: "enterprise", target: "pebacked", value: 8 }, { source: "enterprise", target: "public", value: 5 }, { source: "enterprise", target: "growth", value: 3 }, { source: "enterprise", target: "advisory", value: 2 },
      { source: "consulting", target: "pebacked", value: 5 }, { source: "consulting", target: "vc", value: 3 }, { source: "consulting", target: "growth", value: 2 },
      { source: "cloud", target: "pebacked", value: 5 }, { source: "cloud", target: "public", value: 3 }, { source: "cloud", target: "growth", value: 3 }, { source: "cloud", target: "advisory", value: 2 }, { source: "cloud", target: "founder", value: 1 },
      { source: "academic", target: "growth", value: 2 }, { source: "academic", target: "pebacked", value: 2 }, { source: "academic", target: "advisory", value: 1 }, { source: "academic", target: "founder", value: 1 },
    ],
    insights: [
      { stat: "45%", text: "CTO hires come from FAANG or top-tier scale-ups" },
      { stat: "+30%", text: "PE-backed tech companies hiring more CTOs year over year" },
      { stat: "3.2 yrs", text: "Average tenure before a CTO-level move" },
    ],
  },
  coo: {
    title: "COO / VP Operations Talent Movement Patterns",
    nodes: [
      { id: "mbb", label: "Management Consulting", value: 26, side: "left" },
      { id: "peportco", label: "PE Portfolio Cos", value: 30, side: "left" },
      { id: "f500", label: "Fortune 500 Ops", value: 22, side: "left" },
      { id: "military", label: "Military / Government", value: 10, side: "left" },
      { id: "supply", label: "Supply Chain Cos", value: 14, side: "left" },
      { id: "healthcare", label: "Healthcare Systems", value: 12, side: "left" },
      { id: "pebacked", label: "PE-Backed Companies", value: 42, side: "right" },
      { id: "public", label: "Public Companies", value: 18, side: "right" },
      { id: "growth", label: "Growth Startups", value: 12, side: "right" },
      { id: "peops", label: "PE Operating Partners", value: 16, side: "right" },
      { id: "advisory", label: "Advisory / Board", value: 14, side: "right" },
      { id: "own", label: "Own Businesses", value: 6, side: "right" },
    ],
    links: [
      { source: "mbb", target: "pebacked", value: 12 }, { source: "mbb", target: "peops", value: 6 }, { source: "mbb", target: "growth", value: 4 }, { source: "mbb", target: "advisory", value: 4 },
      { source: "peportco", target: "pebacked", value: 14 }, { source: "peportco", target: "peops", value: 6 }, { source: "peportco", target: "public", value: 5 }, { source: "peportco", target: "advisory", value: 3 }, { source: "peportco", target: "own", value: 2 },
      { source: "f500", target: "pebacked", value: 8 }, { source: "f500", target: "public", value: 6 }, { source: "f500", target: "advisory", value: 4 }, { source: "f500", target: "growth", value: 2 }, { source: "f500", target: "peops", value: 2 },
      { source: "military", target: "pebacked", value: 4 }, { source: "military", target: "public", value: 3 }, { source: "military", target: "growth", value: 2 }, { source: "military", target: "own", value: 1 },
      { source: "supply", target: "pebacked", value: 6 }, { source: "supply", target: "public", value: 4 }, { source: "supply", target: "growth", value: 2 }, { source: "supply", target: "advisory", value: 2 },
      { source: "healthcare", target: "pebacked", value: 6 }, { source: "healthcare", target: "advisory", value: 3 }, { source: "healthcare", target: "peops", value: 2 }, { source: "healthcare", target: "growth", value: 1 },
    ],
    insights: [
      { stat: "38%", text: "COOs most frequently come from management consulting backgrounds" },
      { stat: "+25%", text: "PE operating partner roles growing as a COO destination" },
      { stat: "3.5 yrs", text: "Average tenure before a COO-level move" },
    ],
  },
  chro: {
    title: "CHRO / VP People Talent Movement Patterns",
    nodes: [
      { id: "bigtech", label: "Big Tech HR", value: 22, side: "left" },
      { id: "consulting", label: "HR Consulting", value: 18, side: "left" },
      { id: "peportco", label: "PE Portfolio Cos", value: 16, side: "left" },
      { id: "f500", label: "Fortune 500 HR", value: 20, side: "left" },
      { id: "scaleup", label: "Scale-up People Ops", value: 14, side: "left" },
      { id: "law", label: "Employment Law", value: 6, side: "left" },
      { id: "pebacked", label: "PE-Backed Companies", value: 34, side: "right" },
      { id: "public", label: "Public Companies", value: 20, side: "right" },
      { id: "growth", label: "Growth Startups", value: 16, side: "right" },
      { id: "advisory", label: "HR Advisory/Board", value: 12, side: "right" },
      { id: "petalent", label: "PE Talent Teams", value: 10, side: "right" },
      { id: "consult_out", label: "HR Consulting", value: 6, side: "right" },
    ],
    links: [
      { source: "bigtech", target: "pebacked", value: 8 }, { source: "bigtech", target: "growth", value: 6 }, { source: "bigtech", target: "public", value: 5 }, { source: "bigtech", target: "advisory", value: 3 },
      { source: "consulting", target: "pebacked", value: 8 }, { source: "consulting", target: "petalent", value: 4 }, { source: "consulting", target: "consult_out", value: 3 }, { source: "consulting", target: "advisory", value: 3 },
      { source: "peportco", target: "pebacked", value: 7 }, { source: "peportco", target: "petalent", value: 4 }, { source: "peportco", target: "public", value: 3 }, { source: "peportco", target: "advisory", value: 2 },
      { source: "f500", target: "pebacked", value: 7 }, { source: "f500", target: "public", value: 6 }, { source: "f500", target: "growth", value: 4 }, { source: "f500", target: "advisory", value: 3 },
      { source: "scaleup", target: "pebacked", value: 5 }, { source: "scaleup", target: "growth", value: 4 }, { source: "scaleup", target: "public", value: 3 }, { source: "scaleup", target: "petalent", value: 2 },
      { source: "law", target: "pebacked", value: 2 }, { source: "law", target: "public", value: 2 }, { source: "law", target: "consult_out", value: 1 }, { source: "law", target: "advisory", value: 1 },
    ],
    insights: [
      { stat: "35%", text: "CHROs increasingly sourced from big tech people operations" },
      { stat: "+40%", text: "PE-backed companies investing more in dedicated CHRO hires" },
      { stat: "3.0 yrs", text: "Average tenure before a CHRO-level move" },
    ],
  },
  cmo: {
    title: "CMO / VP Marketing Talent Movement Patterns",
    nodes: [
      { id: "dtc", label: "DTC Brands", value: 24, side: "left" },
      { id: "bigtech", label: "Big Tech Marketing", value: 20, side: "left" },
      { id: "cpg", label: "CPG / FMCG", value: 18, side: "left" },
      { id: "agency", label: "Agencies / Consulting", value: 16, side: "left" },
      { id: "saas", label: "SaaS / B2B Tech", value: 14, side: "left" },
      { id: "media", label: "Media Companies", value: 8, side: "left" },
      { id: "pebacked", label: "PE-Backed Brands", value: 36, side: "right" },
      { id: "public", label: "Public Companies", value: 18, side: "right" },
      { id: "growth", label: "Growth Startups", value: 16, side: "right" },
      { id: "advisory", label: "Advisory / Board", value: 10, side: "right" },
      { id: "founder", label: "Founding Own Brand", value: 12, side: "right" },
      { id: "vc", label: "VC / Growth Equity", value: 6, side: "right" },
    ],
    links: [
      { source: "dtc", target: "pebacked", value: 10 }, { source: "dtc", target: "founder", value: 6 }, { source: "dtc", target: "growth", value: 4 }, { source: "dtc", target: "public", value: 4 },
      { source: "bigtech", target: "pebacked", value: 6 }, { source: "bigtech", target: "growth", value: 6 }, { source: "bigtech", target: "public", value: 4 }, { source: "bigtech", target: "vc", value: 2 }, { source: "bigtech", target: "founder", value: 2 },
      { source: "cpg", target: "pebacked", value: 8 }, { source: "cpg", target: "public", value: 5 }, { source: "cpg", target: "advisory", value: 3 }, { source: "cpg", target: "growth", value: 2 },
      { source: "agency", target: "pebacked", value: 6 }, { source: "agency", target: "growth", value: 4 }, { source: "agency", target: "advisory", value: 3 }, { source: "agency", target: "founder", value: 3 },
      { source: "saas", target: "pebacked", value: 5 }, { source: "saas", target: "public", value: 3 }, { source: "saas", target: "growth", value: 3 }, { source: "saas", target: "vc", value: 2 }, { source: "saas", target: "advisory", value: 1 },
      { source: "media", target: "pebacked", value: 3 }, { source: "media", target: "public", value: 2 }, { source: "media", target: "advisory", value: 2 }, { source: "media", target: "founder", value: 1 },
    ],
    insights: [
      { stat: "42%", text: "CMO hires come from DTC brands or CPG companies" },
      { stat: "+35%", text: "PE-backed brands investing heavily in marketing leadership" },
      { stat: "2.8 yrs", text: "Average tenure before a CMO-level move — shortest among C-suite" },
    ],
  },
};

const functionOptions = [
  { value: "all", label: "All Functions" },
  { value: "cfo", label: "CFO / Finance" },
  { value: "cto", label: "CTO / Technology" },
  { value: "coo", label: "COO / Operations" },
  { value: "chro", label: "CHRO / People" },
  { value: "cmo", label: "CMO / Marketing" },
];

// ─── Tab 1: Talent Flows (Sankey) ──────────────────────────────────

function TalentFlowsSankey({ nodes, links }: { nodes: SankeyNode[]; links: SankeyLink[] }) {
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);

  const leftNodes = nodes.filter(n => n.side === "left");
  const rightNodes = nodes.filter(n => n.side === "right");

  const svgWidth = 800;
  const svgHeight = 420;
  const nodeWidth = 16;
  const leftX = 0;
  const rightX = svgWidth - nodeWidth;
  const leftLabelWidth = 145;
  const rightLabelWidth = 150;

  const totalLeft = leftNodes.reduce((s, n) => s + n.value, 0);
  const totalRight = rightNodes.reduce((s, n) => s + n.value, 0);

  const usableHeight = svgHeight - 40;
  const nodeGap = 10;
  const leftTotalGaps = (leftNodes.length - 1) * nodeGap;
  const leftScale = (usableHeight - leftTotalGaps) / totalLeft;
  const rightTotalGaps = (rightNodes.length - 1) * nodeGap;
  const rightScale = (usableHeight - rightTotalGaps) / totalRight;

  const leftPositions: Record<string, { y: number; h: number; usedOut: number }> = {};
  let ly = 20;
  for (const n of leftNodes) {
    const h = n.value * leftScale;
    leftPositions[n.id] = { y: ly, h, usedOut: 0 };
    ly += h + nodeGap;
  }

  const rightPositions: Record<string, { y: number; h: number; usedIn: number }> = {};
  let ry = 20;
  for (const n of rightNodes) {
    const h = n.value * rightScale;
    rightPositions[n.id] = { y: ry, h, usedIn: 0 };
    ry += h + nodeGap;
  }

  const paths = links.map((link, i) => {
    const left = leftPositions[link.source];
    const right = rightPositions[link.target];
    if (!left || !right) return null;

    const thickness = Math.max(2, link.value * Math.min(leftScale, rightScale) * 0.8);
    const y1 = left.y + left.usedOut + thickness / 2;
    const y2 = right.y + right.usedIn + thickness / 2;
    left.usedOut += thickness + 1;
    right.usedIn += thickness + 1;

    const x1 = leftX + nodeWidth + leftLabelWidth + 10;
    const x2 = rightX - rightLabelWidth - 10;
    const cx1 = x1 + (x2 - x1) * 0.4;
    const cx2 = x1 + (x2 - x1) * 0.6;

    return {
      path: `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`,
      thickness,
      link,
      index: i,
    };
  }).filter(Boolean) as { path: string; thickness: number; link: SankeyLink; index: number }[];

  return (
    <div className="overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} className="mx-auto" style={{ minWidth: svgWidth }}>
        <defs>
          <linearGradient id="sankeyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(217, 91%, 60%)" />
            <stop offset="50%" stopColor="hsl(199, 89%, 48%)" />
            <stop offset="100%" stopColor="hsl(168, 76%, 42%)" />
          </linearGradient>
        </defs>

        {paths.map(({ path, thickness, link, index }) => (
          <g key={index}>
            <path
              d={path}
              fill="none"
              stroke="url(#sankeyGrad)"
              strokeWidth={thickness}
              opacity={hoveredLink !== null ? (hoveredLink === index ? 0.8 : 0.15) : 0.4}
              className="transition-opacity duration-200"
              onMouseEnter={() => setHoveredLink(index)}
              onMouseLeave={() => setHoveredLink(null)}
              style={{ cursor: "pointer" }}
            />
            {hoveredLink === index && (
              <title>{`${leftNodes.find(n => n.id === link.source)?.label} → ${rightNodes.find(n => n.id === link.target)?.label}: ${link.value} executives`}</title>
            )}
          </g>
        ))}

        {leftNodes.map((node) => {
          const pos = leftPositions[node.id];
          return (
            <g key={node.id}>
              <rect x={leftLabelWidth + 5} y={pos.y} width={nodeWidth} height={pos.h} rx={3} fill="hsl(217, 91%, 60%)" opacity={0.9} />
              <text x={leftLabelWidth} y={pos.y + pos.h / 2} textAnchor="end" dominantBaseline="central" className="fill-foreground text-[11px]">{node.label}</text>
              <text x={leftLabelWidth - 2} y={pos.y + pos.h / 2 + 13} textAnchor="end" dominantBaseline="central" className="fill-muted-foreground text-[10px] font-medium">{node.value}</text>
            </g>
          );
        })}

        {rightNodes.map((node) => {
          const pos = rightPositions[node.id];
          return (
            <g key={node.id}>
              <rect x={rightX - rightLabelWidth - 10} y={pos.y} width={nodeWidth} height={pos.h} rx={3} fill="hsl(168, 76%, 42%)" opacity={0.9} />
              <text x={rightX - rightLabelWidth + 12} y={pos.y + pos.h / 2} textAnchor="start" dominantBaseline="central" className="fill-foreground text-[11px]">{node.label}</text>
              <text x={rightX - rightLabelWidth + 12} y={pos.y + pos.h / 2 + 13} textAnchor="start" dominantBaseline="central" className="fill-muted-foreground text-[10px] font-medium">{node.value}</text>
            </g>
          );
        })}

        <text x={leftLabelWidth / 2 + 20} y={12} textAnchor="middle" className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Where They Come From</text>
        <text x={rightX - rightLabelWidth / 2 + 10} y={12} textAnchor="middle" className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Where They Go</text>
      </svg>
    </div>
  );
}

// ─── Tab 2: Network Map ──────────────────────────────────

interface NetworkNode {
  id: string;
  label: string;
  type: "center" | "pe" | "candidate" | "client" | "referral";
  ring: 0 | 1 | 2;
}

interface NetworkEdge {
  from: string;
  to: string;
  strength: number;
}

const networkNodes: NetworkNode[] = [
  { id: "tha", label: "The Hiring Advisors", type: "center", ring: 0 },
  { id: "blackstone", label: "Blackstone Growth", type: "pe", ring: 1 },
  { id: "silverlake", label: "Silver Lake", type: "pe", ring: 1 },
  { id: "vista", label: "Vista Equity", type: "pe", ring: 1 },
  { id: "warburg", label: "Warburg Pincus", type: "pe", ring: 1 },
  { id: "kkr", label: "KKR", type: "pe", ring: 1 },
  { id: "thomabravo", label: "Thoma Bravo", type: "pe", ring: 1 },
  // Candidates - multi-function
  { id: "chen", label: "Sarah Chen (CFO)", type: "candidate", ring: 2 },
  { id: "rivera", label: "Alex Rivera (CTO)", type: "candidate", ring: 2 },
  { id: "park", label: "Jennifer Park (CFO)", type: "candidate", ring: 2 },
  { id: "williams", label: "Marcus Williams (COO)", type: "candidate", ring: 2 },
  { id: "foster", label: "Diana Foster (CHRO)", type: "candidate", ring: 2 },
  { id: "blake", label: "Jordan Blake (CMO)", type: "candidate", ring: 2 },
  { id: "novak", label: "Katherine Novak (CEO)", type: "candidate", ring: 2 },
  { id: "morrison", label: "Rachel Morrison (CFO)", type: "candidate", ring: 2 },
  // Clients
  { id: "sullivan", label: "Mark Sullivan", type: "client", ring: 2 },
  { id: "wu", label: "Diana Wu", type: "client", ring: 2 },
  { id: "crowley", label: "James Crowley", type: "client", ring: 2 },
  { id: "sharma", label: "Priya Sharma", type: "client", ring: 2 },
  { id: "chen_r", label: "Robert Chen", type: "client", ring: 2 },
  // Referrals
  { id: "ref1", label: "PE Talent Network", type: "referral", ring: 2 },
  { id: "ref2", label: "ACG Conference", type: "referral", ring: 2 },
  { id: "ref3", label: "Executive Network", type: "referral", ring: 2 },
];

const networkEdges: NetworkEdge[] = [
  { from: "tha", to: "blackstone", strength: 3 }, { from: "tha", to: "silverlake", strength: 2 }, { from: "tha", to: "vista", strength: 3 }, { from: "tha", to: "warburg", strength: 3 }, { from: "tha", to: "kkr", strength: 2 }, { from: "tha", to: "thomabravo", strength: 2 },
  { from: "thomabravo", to: "chen", strength: 2 }, { from: "silverlake", to: "rivera", strength: 2 }, { from: "blackstone", to: "park", strength: 1 }, { from: "kkr", to: "williams", strength: 2 }, { from: "vista", to: "foster", strength: 2 }, { from: "warburg", to: "morrison", strength: 3 }, { from: "blackstone", to: "blake", strength: 1 }, { from: "kkr", to: "novak", strength: 3 },
  { from: "blackstone", to: "sullivan", strength: 3 }, { from: "silverlake", to: "wu", strength: 2 }, { from: "warburg", to: "chen_r", strength: 3 }, { from: "kkr", to: "crowley", strength: 1 },
  { from: "tha", to: "ref1", strength: 2 }, { from: "tha", to: "ref2", strength: 2 }, { from: "tha", to: "ref3", strength: 1 },
  { from: "ref1", to: "williams", strength: 2 }, { from: "ref2", to: "sharma", strength: 1 }, { from: "ref3", to: "foster", strength: 1 },
];

const typeColors: Record<string, { fill: string; stroke: string; label: string }> = {
  center: { fill: "#2563eb", stroke: "#1d4ed8", label: "Your Firm" },
  pe: { fill: "#7c3aed", stroke: "#6d28d9", label: "PE Firms" },
  candidate: { fill: "#16a34a", stroke: "#15803d", label: "Candidates" },
  client: { fill: "#2563eb", stroke: "#1d4ed8", label: "Client Contacts" },
  referral: { fill: "#ea580c", stroke: "#c2410c", label: "Referral Partners" },
};

function NetworkMap() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const svgWidth = 760;
  const svgHeight = 520;
  const cx = svgWidth / 2;
  const cy = svgHeight / 2;
  const ringRadii = [0, 130, 260];

  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    pos["tha"] = { x: cx, y: cy };

    const peNodes = networkNodes.filter(n => n.type === "pe");
    peNodes.forEach((n, i) => {
      const angle = (i / peNodes.length) * Math.PI * 2 - Math.PI / 2;
      pos[n.id] = { x: cx + Math.cos(angle) * ringRadii[1], y: cy + Math.sin(angle) * ringRadii[1] };
    });

    const outerNodes = networkNodes.filter(n => n.ring === 2);
    outerNodes.forEach((n, i) => {
      const angle = (i / outerNodes.length) * Math.PI * 2 - Math.PI / 2 + 0.15;
      pos[n.id] = { x: cx + Math.cos(angle) * ringRadii[2], y: cy + Math.sin(angle) * ringRadii[2] };
    });

    return pos;
  }, []);

  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const connected = new Set<string>();
    connected.add(hoveredNode);
    networkEdges.forEach(e => {
      if (e.from === hoveredNode) connected.add(e.to);
      if (e.to === hoveredNode) connected.add(e.from);
    });
    return connected;
  }, [hoveredNode]);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} className="mx-auto" style={{ minWidth: 600 }}>
          {networkEdges.map((edge, i) => {
            const from = positions[edge.from];
            const to = positions[edge.to];
            if (!from || !to) return null;
            const isHighlighted = hoveredNode && (connectedNodes.has(edge.from) && connectedNodes.has(edge.to));
            const isDimmed = hoveredNode && !isHighlighted;
            const mx = (from.x + to.x) / 2 + (from.y - to.y) * 0.1;
            const my = (from.y + to.y) / 2 + (to.x - from.x) * 0.1;
            return (
              <path key={i} d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`} fill="none" stroke="hsl(217, 91%, 60%)" strokeWidth={edge.strength} opacity={isDimmed ? 0.06 : isHighlighted ? 0.6 : 0.15} className="transition-opacity duration-200" />
            );
          })}

          {networkNodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) return null;
            const color = typeColors[node.type];
            const radius = node.type === "center" ? 24 : node.ring === 1 ? 16 : 12;
            const isDimmed = hoveredNode && !connectedNodes.has(node.id);
            return (
              <g key={node.id} onMouseEnter={() => setHoveredNode(node.id)} onMouseLeave={() => setHoveredNode(null)} style={{ cursor: "pointer" }} opacity={isDimmed ? 0.2 : 1} className="transition-opacity duration-200">
                <circle cx={pos.x} cy={pos.y} r={radius} fill={color.fill} stroke={color.stroke} strokeWidth={2} opacity={0.9} />
                {node.type === "center" && (
                  <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" className="fill-white text-[8px] font-bold">THA</text>
                )}
                <text x={pos.x} y={pos.y + radius + 12} textAnchor="middle" dominantBaseline="central" className="fill-foreground text-[9px]">{node.label}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-center gap-6 flex-wrap">
        {Object.entries(typeColors).filter(([k]) => k !== "center").map(([type, { fill, label }]) => (
          <div key={type} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: fill }} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 3: Company Intel ──────────────────────────────────

const compDataByRole: Record<string, { title: string; benchmarks: { label: string; base: number; bonus: number; equity: number; total: string }[] }> = {
  cfo: {
    title: "CFO by Company Size",
    benchmarks: [
      { label: "$50-100M Revenue", base: 250, bonus: 50, equity: 50, total: "$250K–$350K" },
      { label: "$100-250M Revenue", base: 325, bonus: 62, equity: 63, total: "$325K–$450K" },
      { label: "$250-500M Revenue", base: 400, bonus: 75, equity: 75, total: "$400K–$550K" },
      { label: "$500M+ Revenue", base: 500, bonus: 125, equity: 125, total: "$500K–$750K" },
    ],
  },
  cto: {
    title: "CTO by Company Size",
    benchmarks: [
      { label: "$50-100M Revenue", base: 275, bonus: 55, equity: 70, total: "$275K–$400K" },
      { label: "$100-250M Revenue", base: 350, bonus: 70, equity: 100, total: "$350K–$520K" },
      { label: "$250-500M Revenue", base: 425, bonus: 85, equity: 140, total: "$425K–$650K" },
      { label: "$500M+ Revenue", base: 500, bonus: 100, equity: 200, total: "$500K–$800K" },
    ],
  },
  coo: {
    title: "COO by Company Size",
    benchmarks: [
      { label: "$50-100M Revenue", base: 240, bonus: 48, equity: 42, total: "$240K–$330K" },
      { label: "$100-250M Revenue", base: 310, bonus: 62, equity: 58, total: "$310K–$430K" },
      { label: "$250-500M Revenue", base: 380, bonus: 76, equity: 74, total: "$380K–$530K" },
      { label: "$500M+ Revenue", base: 475, bonus: 120, equity: 105, total: "$475K–$700K" },
    ],
  },
  chro: {
    title: "CHRO by Company Size",
    benchmarks: [
      { label: "$50-100M Revenue", base: 220, bonus: 44, equity: 36, total: "$220K–$300K" },
      { label: "$100-250M Revenue", base: 280, bonus: 56, equity: 54, total: "$280K–$390K" },
      { label: "$250-500M Revenue", base: 340, bonus: 68, equity: 72, total: "$340K–$480K" },
      { label: "$500M+ Revenue", base: 420, bonus: 105, equity: 95, total: "$420K–$620K" },
    ],
  },
  cmo: {
    title: "CMO by Company Size",
    benchmarks: [
      { label: "$50-100M Revenue", base: 230, bonus: 46, equity: 44, total: "$230K–$320K" },
      { label: "$100-250M Revenue", base: 290, bonus: 58, equity: 62, total: "$290K–$410K" },
      { label: "$250-500M Revenue", base: 360, bonus: 72, equity: 78, total: "$360K–$510K" },
      { label: "$500M+ Revenue", base: 440, bonus: 110, equity: 100, total: "$440K–$650K" },
    ],
  },
  gc: {
    title: "General Counsel by Company Size",
    benchmarks: [
      { label: "$50-100M Revenue", base: 230, bonus: 40, equity: 30, total: "$230K–$300K" },
      { label: "$100-250M Revenue", base: 290, bonus: 55, equity: 55, total: "$290K–$400K" },
      { label: "$250-500M Revenue", base: 370, bonus: 70, equity: 70, total: "$370K–$510K" },
      { label: "$500M+ Revenue", base: 450, bonus: 110, equity: 90, total: "$450K–$650K" },
    ],
  },
};

function CompanyIntel() {
  const [compRole, setCompRole] = useState("cfo");

  const hotspots = [
    { sector: "Healthcare PE", searches: 42, yoy: 35, trend: "hot" as const },
    { sector: "Technology PE", searches: 38, yoy: 28, trend: "hot" as const },
    { sector: "Industrial PE", searches: 24, yoy: 10, trend: "warm" as const },
    { sector: "Consumer PE", searches: 18, yoy: -3, trend: "stable" as const },
  ];

  const compData = compDataByRole[compRole];
  const maxComp = 800;

  const competitors = [
    { firm: "Heidrick & Struggles", placements: 22, avgFee: "$180K", focus: "Large PE" },
    { firm: "Spencer Stuart", placements: 18, avgFee: "$200K", focus: "Fortune 500" },
    { firm: "Korn Ferry", placements: 28, avgFee: "$150K", focus: "Mid-market PE" },
    { firm: "Russell Reynolds", placements: 14, avgFee: "$210K", focus: "Mega-cap PE" },
    { firm: "The Hiring Advisors (You)", placements: 5, avgFee: "$125K", focus: "Growth PE" },
  ];

  const trendColors: Record<string, string> = {
    hot: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    warm: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    stable: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };

  return (
    <div className="space-y-6">
      {/* Hiring Hotspots */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-primary" />
          Hiring Hotspots
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {hotspots.map((h) => (
            <Card key={h.sector} className="border border-card-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">{h.sector}</p>
                  <Badge className={cn("text-[10px] capitalize border-0", trendColors[h.trend])}>{h.trend}</Badge>
                </div>
                <p className="text-2xl font-bold">{h.searches}</p>
                <p className="text-xs text-muted-foreground mb-2">Active executive searches</p>
                <div className="flex items-center gap-1">
                  {h.yoy > 0 ? <ArrowUpRight size={12} className="text-green-500" /> : h.yoy < 0 ? <ArrowDownRight size={12} className="text-red-500" /> : <Minus size={12} className="text-muted-foreground" />}
                  <span className={cn("text-xs font-medium", h.yoy > 0 ? "text-green-500" : h.yoy < 0 ? "text-red-500" : "text-muted-foreground")}>
                    {h.yoy > 0 ? "+" : ""}{h.yoy}% YoY
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Compensation Benchmarks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Building2 size={14} className="text-primary" />
            Compensation Benchmarks — {compData.title}
          </h3>
          <Select value={compRole} onValueChange={setCompRole}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cfo">CFO</SelectItem>
              <SelectItem value="cto">CTO</SelectItem>
              <SelectItem value="coo">COO</SelectItem>
              <SelectItem value="chro">CHRO</SelectItem>
              <SelectItem value="cmo">CMO</SelectItem>
              <SelectItem value="gc">General Counsel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Card className="border border-card-border">
          <CardContent className="p-4 space-y-4">
            {compData.benchmarks.map((row) => {
              const baseW = (row.base / maxComp) * 100;
              const bonusW = (row.bonus / maxComp) * 100;
              const equityW = (row.equity / maxComp) * 100;
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{row.label}</span>
                    <span className="text-xs text-muted-foreground">{row.total}</span>
                  </div>
                  <div className="flex h-5 rounded-md overflow-hidden bg-muted/40">
                    <div className="bg-blue-500 flex items-center justify-center" style={{ width: `${baseW}%` }} title={`Base: $${row.base}K`}>
                      <span className="text-[9px] text-white font-medium truncate px-1">Base</span>
                    </div>
                    <div className="bg-cyan-500 flex items-center justify-center" style={{ width: `${bonusW}%` }} title={`Bonus: $${row.bonus}K`}>
                      <span className="text-[9px] text-white font-medium truncate px-1">Bonus</span>
                    </div>
                    <div className="bg-teal-500 flex items-center justify-center" style={{ width: `${equityW}%` }} title={`Equity: $${row.equity}K`}>
                      <span className="text-[9px] text-white font-medium truncate px-1">Equity</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-4 pt-2 border-t border-border">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-500" /><span className="text-[10px] text-muted-foreground">Base Salary</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-cyan-500" /><span className="text-[10px] text-muted-foreground">Annual Bonus</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-teal-500" /><span className="text-[10px] text-muted-foreground">Equity / LTI</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Competitor Activity */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Globe size={14} className="text-primary" />
          Competitor Activity
        </h3>
        <Card className="border border-card-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Search Firm</th>
                  <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Executive Placements</th>
                  <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Avg Fee</th>
                  <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Focus</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((c) => {
                  const isYou = c.firm.includes("You");
                  return (
                    <tr key={c.firm} className={cn("border-b border-border", isYou && "bg-primary/5")}>
                      <td className="px-4 py-2.5"><span className={cn("font-medium", isYou && "text-primary")}>{c.firm}</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.placements}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.avgFee}</td>
                      <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[10px]">{c.focus}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────

export default function MarketIntelligence() {
  const [selectedFunction, setSelectedFunction] = useState("all");
  const flowData = flowDataSets[selectedFunction] || flowDataSets.all;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-bold text-xl flex items-center gap-2">
          <Globe size={18} className="text-primary" />
          Market Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Talent flows, network connections, and competitive landscape
        </p>
      </div>

      <Tabs defaultValue="talent-flows">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="talent-flows" data-testid="tab-talent-flows" className="text-xs">Talent Flows</TabsTrigger>
          <TabsTrigger value="network-map" data-testid="tab-network-map" className="text-xs">Network Map</TabsTrigger>
          <TabsTrigger value="company-intel" data-testid="tab-company-intel" className="text-xs">Company Intel</TabsTrigger>
        </TabsList>

        <TabsContent value="talent-flows" className="mt-4">
          <Card className="border border-card-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">{flowData.title}</h2>
                <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                  <SelectTrigger className="h-7 w-[160px] text-xs" data-testid="select-function-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {functionOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TalentFlowsSankey nodes={flowData.nodes} links={flowData.links} />
              {/* Key Insights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                {flowData.insights.map((insight, i) => (
                  <Card key={i} className="border border-card-border">
                    <CardContent className="p-4">
                      <p className="text-lg font-bold text-primary mb-1">{insight.stat}</p>
                      <p className="text-xs text-muted-foreground">{insight.text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network-map" className="mt-4">
          <Card className="border border-card-border">
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold mb-4">Relationship Network — Hover to explore connections</h2>
              <NetworkMap />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company-intel" className="mt-4">
          <CompanyIntel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
