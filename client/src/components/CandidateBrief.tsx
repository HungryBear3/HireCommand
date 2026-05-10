import { useState } from "react";
import type { Candidate } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, Share2, User, Briefcase, Target, DollarSign, Clock } from "lucide-react";

interface CandidateBriefData {
  summary: string[];
  careerTrajectory: { title: string; company: string; years: string }[];
  competencies: string[];
  currentComp: string;
  marketRange: string;
  compMethodology: string;
  compSources: string[];
  availability: "Available" | "Notice Period" | "Not Looking";
  availabilityDetail: string;
  whyThisCandidate: string;
}

function formatMoney(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  return `$${Math.round(value / 1000)}K`;
}

function formatRange(low: number, high: number) {
  return `${formatMoney(low)}–${formatMoney(high)}`;
}

function inferCompBenchmark(c: Candidate, tags: string[]) {
  const title = c.title.toLowerCase();
  const notes = c.notes.toLowerCase();
  const tagText = tags.join(" ").toLowerCase();
  const all = `${title} ${notes} ${tagText}`;

  const benchmarks = [
    { match: ["chief executive", "ceo", "president"], role: "CEO / President", base: [450000, 850000], bonus: [75, 125], equity: "1.0%–5.0%" },
    { match: ["chief financial", "cfo", "finance"], role: "CFO / senior finance executive", base: [300000, 550000], bonus: [50, 100], equity: "0.5%–2.0%" },
    { match: ["chief operating", "coo", "operations"], role: "COO / senior operations executive", base: [300000, 550000], bonus: [50, 100], equity: "0.5%–2.0%" },
    { match: ["chief technology", "cto", "engineering", "technology", "software", "data"], role: "CTO / senior technology executive", base: [275000, 525000], bonus: [40, 85], equity: "0.5%–2.5%" },
    { match: ["chief marketing", "cmo", "marketing", "brand", "growth"], role: "CMO / senior marketing executive", base: [250000, 475000], bonus: [40, 80], equity: "0.25%–1.5%" },
    { match: ["chief human", "chro", "people", "human resources", "hr"], role: "CHRO / senior people executive", base: [240000, 425000], bonus: [35, 70], equity: "0.25%–1.25%" },
    { match: ["vp", "vice president", "director"], role: "VP / director-level executive", base: [180000, 325000], bonus: [25, 60], equity: "0.1%–0.75%" },
  ];

  const benchmark = benchmarks.find(b => b.match.some(term => all.includes(term))) || { role: "senior executive", base: [200000, 375000], bonus: [30, 70], equity: "0.1%–1.0%" };

  const location = c.location.toLowerCase();
  const locationMultiplier =
    /san francisco|bay area|new york|nyc/.test(location) ? 1.18 :
    /boston|los angeles|seattle|washington|dc/.test(location) ? 1.12 :
    /chicago|dallas|austin|denver|atlanta/.test(location) ? 1.06 :
    1.0;
  const peMultiplier = /pe|private equity|portfolio|sponsor|backed|vista|kkr|warburg|bain|insight/.test(all) ? 1.12 : 1.0;
  const scaleMultiplier = /public|fortune|f500|billion|\$[0-9.]+b|arr|capital project|exit/.test(all) ? 1.08 : 1.0;
  const seniorityMultiplier = /chief|cfo|cto|coo|ceo|cmo|chro|president/.test(title) ? 1.08 : 1.0;
  const matchMultiplier = c.matchScore >= 95 ? 1.06 : c.matchScore >= 90 ? 1.03 : 1.0;
  const multiplier = locationMultiplier * peMultiplier * scaleMultiplier * seniorityMultiplier * matchMultiplier;

  const baseLow = Math.round((benchmark.base[0] * multiplier) / 10000) * 10000;
  const baseHigh = Math.round((benchmark.base[1] * multiplier) / 10000) * 10000;
  const bonusLow = Math.round((baseLow * benchmark.bonus[0] / 100) / 10000) * 10000;
  const bonusHigh = Math.round((baseHigh * benchmark.bonus[1] / 100) / 10000) * 10000;
  const cashLow = baseLow + bonusLow;
  const cashHigh = baseHigh + bonusHigh;
  const currentLow = Math.round((cashLow * 0.88) / 10000) * 10000;
  const currentHigh = Math.round((cashHigh * 0.92) / 10000) * 10000;

  return {
    currentComp: `${formatRange(currentLow, currentHigh)} est. current total cash`,
    marketRange: `${formatRange(cashLow, cashHigh)} target cash + ${benchmark.equity} equity/LTI`,
    methodology: `${benchmark.role}; adjusted for ${c.location || "national market"}, PE/portfolio context, company scale indicators, seniority, and candidate match strength.`,
    sources: [
      "BLS OEWS public wage tables for executives and functional managers",
      "Public company proxy statements / SEC DEF 14A executive compensation disclosures",
      "Public executive-search and salary-guide ranges used as directional private-market benchmarks",
    ],
  };
}

function generateBriefData(c: Candidate): CandidateBriefData {
  const tags: string[] = (() => { try { return JSON.parse(c.tags || "[]"); } catch { return []; } })();
  const nameHash = c.name.split("").reduce((a, b) => a + b.charCodeAt(0), 0);

  const summaries: Record<string, string[]> = {
    "Sarah Chen": [
      "Led $200M debt refinancing at PE-backed healthcare company — direct parallel to target role requirements",
      "Deloitte advisory background provides strong foundation in financial controls and audit readiness",
      "Currently in active interview process — high intent and availability for immediate transition"
    ],
    "Michael Torres": [
      "Built FP&A function from scratch at a high-growth SaaS company — $0 to $120M ARR scale experience",
      "Goldman Sachs investment banking pedigree brings institutional rigor to fast-moving environments",
      "Deep B2B SaaS metrics expertise with proven ability to communicate with sophisticated PE investors"
    ],
    "Jennifer Park": [
      "Successfully managed PE exit at $800M valuation — rare operational exit experience at this level",
      "Turnaround specialist with documented cost optimization of 23% across manufacturing operations",
      "Offer stage candidate demonstrating strong market demand and caliber validation"
    ],
    "David Okafor": [
      "Operating role experience within KKR portfolio gives first-hand understanding of PE value creation playbook",
      "Strategic planning + finance dual competency — can serve as both CFO and CSO in lean PE structures",
      "Growth equity focus aligns with firms seeking build-and-scale rather than cost-cut finance leaders"
    ],
    "Amanda Richter": [
      "Led $180M Series C raise at Beacon Therapeutics — exceptional capital markets relationship depth",
      "Deep biotech-specific regulatory and SEC reporting expertise in complex compliance environment",
      "Pre-IPO finance leadership experience positions her for the most demanding CFO mandates"
    ],
    "Patricia Huang": [
      "Led 3 successful PE exits in manufacturing — among the most prolific exit-experienced CFOs in our pipeline",
      "Exceptional carve-out expertise in complex industrial environments with cross-border operations",
      "Board member interview stage indicates strong executive presence and stakeholder management"
    ],
    "Rachel Morrison": [
      "Led $1.2B capital project at Granite Peak Energy — scale of capital allocation rarely seen in candidates",
      "Warburg Pincus endorsement (partner referral) validates PE-level trust and performance caliber",
      "Energy infrastructure background with transferable skills to any capital-intensive PE portfolio"
    ],
    "Alex Rivera": [
      "Built DataPulse platform from 0 to 50M MAU — exceptional product-engineering leadership at scale",
      "Ex-Google Staff Engineer with deep AI/ML expertise directly applicable to PE portfolio tech transformation",
      "Insight Partners-backed company experience means fluent in PE reporting and value creation frameworks"
    ],
    "Marcus Williams": [
      "Drove 35% EBITDA improvement across 40 clinic locations — proven PE value creation playbook",
      "McKinsey pedigree brings strategic rigor to operational execution in complex multi-site environments",
      "Deep healthcare operations expertise with demonstrated ability to standardize and scale"
    ],
    "Diana Foster": [
      "Redesigned compensation and equity structure across Vista Equity's entire portfolio — systematic talent approach",
      "SHRM board member with deep expertise in culture transformation during PE transitions",
      "M&A talent integration specialist — has onboarded 15+ acquired leadership teams"
    ],
    "Jordan Blake": [
      "Grew NovaBrands portfolio from $40M to $180M revenue through digital-first brand strategy",
      "Deep DTC and retail omnichannel expertise with proven attribution and analytics frameworks",
      "L Catterton PE experience means understanding of investor expectations and value creation timelines"
    ],
    "Katherine Novak": [
      "Grew Meridian Industries from $120M to $450M revenue — exceptional P&L leadership at PE scale",
      "KKR-backed company President with direct board management and PE sponsor collaboration experience",
      "Proven ability to drive both organic growth and M&A integration simultaneously"
    ],
  };

  const defaultSummary = [
    `${c.matchScore}% match score driven by strong alignment with PE-backed company requirements`,
    `Current ${c.title} role at ${c.company} demonstrates relevant sector and leadership experience`,
    `${tags.slice(0, 2).join(" and ")} expertise positions this candidate for targeted finance leadership roles`
  ];

  const careers: Record<string, { title: string; company: string; years: string }[]> = {
    "Sarah Chen": [
      { title: "CFO", company: "Meridian Health Partners", years: "2022 — Present" },
      { title: "VP Finance", company: "Optum Health", years: "2018 — 2022" },
      { title: "Senior Manager, Advisory", company: "Deloitte", years: "2014 — 2018" },
    ],
    "Michael Torres": [
      { title: "VP Finance", company: "Apex Software Group", years: "2021 — Present" },
      { title: "Director, FP&A", company: "Salesforce", years: "2018 — 2021" },
      { title: "Associate", company: "Goldman Sachs", years: "2015 — 2018" },
    ],
    "Jennifer Park": [
      { title: "CFO", company: "Summit Capital Portfolio Co", years: "2020 — Present" },
      { title: "VP Finance", company: "Emerson Electric", years: "2016 — 2020" },
      { title: "Manager", company: "PwC Transaction Services", years: "2012 — 2016" },
    ],
    "Patricia Huang": [
      { title: "CFO", company: "Vanguard Industrial Solutions", years: "2021 — Present" },
      { title: "VP Finance", company: "Dover Corporation", years: "2017 — 2021" },
      { title: "Director, Finance", company: "Honeywell", years: "2013 — 2017" },
    ],
    "Rachel Morrison": [
      { title: "CFO", company: "Granite Peak Energy", years: "2021 — Present" },
      { title: "VP Finance & Treasury", company: "NextEra Energy", years: "2017 — 2021" },
      { title: "Senior Associate", company: "Morgan Stanley", years: "2014 — 2017" },
    ],
    "Alex Rivera": [
      { title: "CTO", company: "DataPulse Analytics", years: "2022 — Present" },
      { title: "Staff Engineer", company: "Google Cloud", years: "2018 — 2022" },
      { title: "Senior Engineer", company: "Stripe", years: "2015 — 2018" },
    ],
    "Marcus Williams": [
      { title: "COO", company: "HealthBridge Solutions", years: "2021 — Present" },
      { title: "Engagement Manager", company: "McKinsey & Company", years: "2017 — 2021" },
      { title: "Operations Director", company: "HCA Healthcare", years: "2014 — 2017" },
    ],
    "Diana Foster": [
      { title: "CHRO", company: "TalentForge", years: "2022 — Present" },
      { title: "VP People", company: "Workday", years: "2018 — 2022" },
      { title: "Director, HR", company: "Bain & Company", years: "2015 — 2018" },
    ],
    "Jordan Blake": [
      { title: "CMO", company: "NovaBrands Consumer", years: "2021 — Present" },
      { title: "VP Marketing", company: "Glossier", years: "2018 — 2021" },
      { title: "Brand Director", company: "Unilever", years: "2014 — 2018" },
    ],
    "Katherine Novak": [
      { title: "President & COO", company: "Meridian Industries", years: "2021 — Present" },
      { title: "SVP Operations", company: "Illinois Tool Works", years: "2017 — 2021" },
      { title: "Principal", company: "Boston Consulting Group", years: "2013 — 2017" },
    ],
  };

  const defaultCareer = [
    { title: c.title, company: c.company, years: "2021 — Present" },
    { title: "Senior Finance Director", company: "Fortune 500 Company", years: "2017 — 2021" },
    { title: "Finance Manager", company: "Big 4 / Advisory", years: "2013 — 2017" },
  ];

  const comp = inferCompBenchmark(c, tags);

  const availabilityOptions: ("Available" | "Notice Period" | "Not Looking")[] = ["Available", "Notice Period", "Available"];
  const availDetails = ["Open to conversations, 2-week transition", "60-day notice period, negotiable with PE sponsor approval", "Actively exploring — available for immediate start"];
  const availIdx = nameHash % availabilityOptions.length;

  const allCompetencies = [
    "Strategic Leadership", "P&L Management", "PE Value Creation",
    "Board Reporting", "M&A Integration", "Digital Transformation",
    "Team Building", "Change Management", "Data-Driven Decision Making",
    "Stakeholder Management", "Cross-functional Leadership", "Operational Excellence",
    "Financial Planning & Analysis", "Capital Allocation", "Cost Optimization",
    "Platform Architecture", "Talent Strategy", "Brand Strategy",
    ...tags
  ];
  const competencies = Array.from(new Set(allCompetencies.slice(0, 8).concat(tags.slice(0, 3)))).slice(0, 10);

  const whyNarratives: Record<string, string> = {
    "Sarah Chen": "Sarah represents the rare combination of Big 4 advisory rigor and PE-backed operational leadership. Her $200M refinancing at Meridian directly mirrors the capital structure complexity our clients face. She's currently in active process, signaling readiness — but also meaning she won't be available long. Her healthcare specialization and Deloitte foundation make her ideally suited for any PE-backed healthcare platform CFO mandate.",
    "Jennifer Park": "Jennifer's documented $800M PE exit makes her one of the most accomplished exit-experienced CFOs in our network. Her manufacturing turnaround track record — 23% cost optimization — demonstrates the operational finance acumen PE firms prize. Currently at offer stage with another firm, she's a proven commodity who commands market validation.",
    "Patricia Huang": "With three successful PE exits under her belt, Patricia brings a repeatable playbook for value creation in industrial environments. Her carve-out expertise is a differentiator — few CFOs have led complex separations at this scale. The Warburg partner endorsement from her current board relationship adds significant trust currency.",
    "Rachel Morrison": "Rachel's management of a $1.2B capital project places her in rarefied air for capital allocation experience. The direct warm referral from a Warburg Pincus partner speaks volumes about her reputation within the PE ecosystem. Her energy infrastructure background translates naturally to any asset-heavy portfolio company CFO seat.",
    "Alex Rivera": "Alex represents the gold standard for PE-backed CTO candidates. His Google pedigree combined with startup-to-scale experience at DataPulse (0 to 50M MAU) demonstrates both technical depth and business acumen. His familiarity with PE reporting cadences from Insight Partners' portfolio makes him immediately effective in a PE-backed environment.",
    "Marcus Williams": "Marcus brings the rare combination of McKinsey strategic rigor and hands-on operational execution. His 35% EBITDA improvement across 40 locations is the kind of measurable impact PE sponsors seek. His healthcare operations specialization is highly transferable across the PE healthcare services ecosystem.",
    "Katherine Novak": "Katherine is a generational CEO talent. Growing Meridian from $120M to $450M under KKR's ownership demonstrates the full spectrum of PE value creation. Her BCG strategy foundation combined with operational P&L leadership makes her equally credible in boardrooms and on factory floors. She is the strongest CEO candidate in our pipeline.",
  };

  const defaultWhy = `${c.name} brings a distinctive blend of ${tags.slice(0, 2).join(" and ").toLowerCase()} experience that aligns with the demands of PE-backed executive leadership. With a ${c.matchScore}% match score driven by sector relevance and executive caliber, this candidate merits priority consideration for your active searches. Their current role at ${c.company} provides direct operational parallels to our client mandates.`;

  return {
    summary: summaries[c.name] || defaultSummary,
    careerTrajectory: careers[c.name] || defaultCareer,
    competencies,
    currentComp: comp.currentComp,
    marketRange: comp.marketRange,
    compMethodology: comp.methodology,
    compSources: comp.sources,
    availability: availabilityOptions[availIdx],
    availabilityDetail: availDetails[availIdx],
    whyThisCandidate: whyNarratives[c.name] || defaultWhy,
  };
}

function handleDownloadPDF(candidate: Candidate, brief: CandidateBriefData) {
  const availColor = brief.availability === "Available"
    ? "#166534"
    : brief.availability === "Notice Period"
    ? "#92400e"
    : "#991b1b";

  const availBg = brief.availability === "Available"
    ? "#dcfce7"
    : brief.availability === "Notice Period"
    ? "#fef3c7"
    : "#fee2e2";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Candidate Brief — ${candidate.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #1a1a2e;
      background: #ffffff;
      padding: 0;
    }
    .page {
      max-width: 760px;
      margin: 0 auto;
      padding: 40px 48px 48px;
    }
    /* Header */
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
      color: white;
      padding: 28px 32px;
      border-radius: 8px 8px 0 0;
      margin-bottom: 0;
    }
    .header-brand {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.7);
      margin-bottom: 12px;
    }
    .header-subtitle {
      font-size: 11px;
      color: rgba(255,255,255,0.6);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .candidate-name {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.3px;
      margin-bottom: 4px;
    }
    .candidate-title {
      font-size: 13px;
      color: rgba(255,255,255,0.85);
      margin-bottom: 2px;
    }
    .candidate-company {
      font-size: 12px;
      color: rgba(255,255,255,0.65);
      margin-bottom: 16px;
    }
    .badges {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-match {
      background: rgba(255,255,255,0.2);
      color: white;
    }
    .badge-avail {
      background: ${availBg};
      color: ${availColor};
    }
    /* Content */
    .content {
      border: 1px solid #e2e8f0;
      border-top: none;
      border-radius: 0 0 8px 8px;
      padding: 28px 32px;
    }
    .section {
      margin-bottom: 24px;
    }
    .section:last-child {
      margin-bottom: 0;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #2563eb;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    /* Summary bullets */
    .summary-list {
      list-style: none;
    }
    .summary-list li {
      display: flex;
      gap: 10px;
      margin-bottom: 8px;
      color: #374151;
      line-height: 1.55;
    }
    .bullet {
      color: #2563eb;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 1px;
    }
    /* Career */
    .career-item {
      display: flex;
      gap: 14px;
      margin-bottom: 12px;
      align-items: flex-start;
    }
    .career-dot-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 4px;
    }
    .career-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .career-dot-primary { background: #2563eb; }
    .career-dot-secondary { background: #cbd5e1; }
    .career-line {
      width: 1px;
      height: 20px;
      background: #e2e8f0;
      margin-top: 2px;
    }
    .career-title {
      font-weight: 600;
      font-size: 13px;
      color: #111827;
    }
    .career-company {
      font-size: 11px;
      color: #6b7280;
      margin-top: 1px;
    }
    .career-years {
      font-size: 11px;
      color: #9ca3af;
      margin-left: auto;
      white-space: nowrap;
    }
    .career-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      flex: 1;
    }
    /* Competencies */
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tag {
      background: #f1f5f9;
      color: #374151;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 500;
      border: 1px solid #e2e8f0;
    }
    /* Comp grid */
    .comp-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .comp-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .comp-label {
      font-size: 10px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 4px;
    }
    .comp-value {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
    }
    /* Why narrative */
    .narrative {
      color: #374151;
      line-height: 1.65;
    }
    /* Divider */
    .divider {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 20px 0;
    }
    /* Footer */
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 10px;
      color: #9ca3af;
      letter-spacing: 0.04em;
    }
    @media print {
      body { padding: 0; }
      .page { padding: 24px 32px 32px; }
      @page { margin: 0.5in; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-brand">THE HIRING ADVISORS</div>
    <div class="header-subtitle">Executive Candidate Brief</div>
    <div class="candidate-name">${candidate.name}</div>
    <div class="candidate-title">${candidate.title}</div>
    <div class="candidate-company">${candidate.company}</div>
    <div class="badges">
      <span class="badge badge-match">${candidate.matchScore}% Match Score</span>
      <span class="badge badge-avail">${brief.availability}</span>
    </div>
  </div>

  <div class="content">
    <div class="section">
      <div class="section-title">Executive Summary</div>
      <ul class="summary-list">
        ${brief.summary.map(point => `
        <li>
          <span class="bullet">•</span>
          <span>${point}</span>
        </li>`).join("")}
      </ul>
    </div>

    <div class="section">
      <div class="section-title">Career Trajectory</div>
      ${brief.careerTrajectory.map((role, i) => `
      <div class="career-item">
        <div class="career-dot-col">
          <div class="career-dot ${i === 0 ? "career-dot-primary" : "career-dot-secondary"}"></div>
          ${i < brief.careerTrajectory.length - 1 ? '<div class="career-line"></div>' : ""}
        </div>
        <div class="career-row">
          <div>
            <div class="career-title">${role.title}</div>
            <div class="career-company">${role.company}</div>
          </div>
          <div class="career-years">${role.years}</div>
        </div>
      </div>`).join("")}
    </div>

    <div class="section">
      <div class="section-title">Core Competencies</div>
      <div class="tags">
        ${brief.competencies.map(comp => `<span class="tag">${comp}</span>`).join("")}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Compensation Intelligence</div>
      <div class="comp-grid">
        <div class="comp-box">
          <div class="comp-label">Current Est. Comp</div>
          <div class="comp-value">${brief.currentComp}</div>
        </div>
        <div class="comp-box">
          <div class="comp-label">Market Rate Range</div>
          <div class="comp-value">${brief.marketRange}</div>
        </div>
      </div>
      <p class="narrative" style="margin-top:10px;font-size:11px;"><strong>Methodology:</strong> ${brief.compMethodology}</p>
      <p class="narrative" style="margin-top:6px;font-size:10px;"><strong>Public sources:</strong> ${brief.compSources.join("; ")}</p>
    </div>

    <div class="section">
      <div class="section-title">Why This Candidate</div>
      <p class="narrative">${brief.whyThisCandidate}</p>
    </div>

    <div class="footer">
      Confidential — Prepared by The Hiring Advisors &nbsp;|&nbsp; www.thehiringadvisors.com
    </div>
  </div>
</div>
<script>
  window.onload = function() { window.print(); };
</script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

export default function CandidateBrief({ candidate, open, onClose }: { candidate: Candidate; open: boolean; onClose: () => void }) {
  const brief = generateBriefData(candidate);

  const availColor = brief.availability === "Available"
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : brief.availability === "Notice Period"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5 text-white">
          <DialogTitle className="text-white text-base font-bold mb-1">{candidate.name}</DialogTitle>
          <p className="text-blue-100 text-sm">{candidate.title}</p>
          <p className="text-blue-200 text-xs mt-0.5">{candidate.company}</p>
          <div className="flex items-center gap-3 mt-3">
            <Badge className="bg-white/20 text-white border-0 text-xs">{candidate.matchScore}% Match</Badge>
            <Badge className={`border-0 text-xs ${availColor}`}>
              <Clock size={10} className="mr-1" />
              {brief.availability}
            </Badge>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Executive Summary */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Target size={14} className="text-primary" />
              Executive Summary
            </h3>
            <ul className="space-y-2">
              {brief.summary.map((point, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                  <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Career Trajectory */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Briefcase size={14} className="text-primary" />
              Career Trajectory
            </h3>
            <div className="space-y-2.5">
              {brief.careerTrajectory.map((role, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-2 h-2 rounded-full ${i === 0 ? "bg-primary" : "bg-border"}`} />
                    {i < brief.careerTrajectory.length - 1 && <div className="w-px h-6 bg-border mt-0.5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-medium">{role.title}</p>
                      <span className="text-xs text-muted-foreground ml-2">{role.years}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{role.company}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Core Competencies */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <User size={14} className="text-primary" />
              Core Competencies
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {brief.competencies.map((comp) => (
                <Badge key={comp} variant="secondary" className="text-xs">
                  {comp}
                </Badge>
              ))}
            </div>
          </section>

          {/* Compensation Intelligence */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <DollarSign size={14} className="text-primary" />
              Compensation Intelligence
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">Current Est. Comp</p>
                <p className="text-sm font-semibold">{brief.currentComp}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">Market Rate Range</p>
                <p className="text-sm font-semibold">{brief.marketRange}</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground leading-relaxed"><span className="font-medium text-foreground">Methodology:</span> {brief.compMethodology}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-2"><span className="font-medium text-foreground">Public sources:</span> {brief.compSources.join("; ")}</p>
            </div>
          </section>

          {/* Availability */}
          <section>
            <div className="rounded-lg border border-border p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Availability</p>
                <p className="text-sm font-medium">{brief.availability}</p>
              </div>
              <p className="text-xs text-muted-foreground max-w-[60%] text-right">{brief.availabilityDetail}</p>
            </div>
          </section>

          {/* Why This Candidate */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Why This Candidate</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{brief.whyThisCandidate}</p>
          </section>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" data-testid="button-brief-copy">
              <Copy size={12} /> Copy
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs flex-1"
              data-testid="button-brief-download-pdf"
              onClick={() => handleDownloadPDF(candidate, brief)}
            >
              <Download size={12} /> Download PDF
            </Button>
            <Button size="sm" className="gap-1.5 text-xs flex-1" data-testid="button-brief-share">
              <Share2 size={12} /> Share with Client
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
