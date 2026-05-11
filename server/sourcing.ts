/**
 * AI Sourcing Engine — HireCommand
 *
 * Architecture:
 *  1. NL brief → structured search intent (AI parsing, no external API needed)
 *  2. X-ray search  → Google Custom Search API  (site:linkedin.com/in + open web)
 *  3. GitHub API    → engineers via public REST API
 *  4. People Data Labs → enrichment (optional key, graceful fallback)
 *  5. Result normalisation → unified SourcingCandidate shape
 *
 * TOS-safe design:
 *  - All LinkedIn results come through Google's index of PUBLIC profiles (no login)
 *  - GitHub results use the official unauthenticated REST API
 *  - PDL is a licensed data provider (they handle all compliance)
 *  - We never log into any platform on behalf of the user
 */

import type { Express, Request, Response } from "express";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SourcingBrief {
  query: string;               // raw NL input from user
  titles?: string[];           // parsed titles
  skills?: string[];
  industries?: string[];
  locations?: string[];
  companySizes?: string[];     // e.g. "50-250"
  seniorityLevel?: string;     // "VP" | "C-Suite" | "Director" | "Manager"
  yearsExperience?: string;
  excludeCompanies?: string[];
  sources: SourceType[];       // which sources to hit
  limit: number;
}

export type SourceType = "linkedin_xray" | "github" | "web" | "pdl" | "perplexity";

export interface SourcingCandidate {
  id: string;
  name: string;
  currentTitle: string;
  currentCompany: string;
  location: string;
  headline: string;
  summary: string;             // AI-generated quick summary
  skills: string[];
  source: SourceType;
  sourceUrl: string;           // canonical profile URL
  linkedinUrl?: string;
  githubUrl?: string;
  email?: string;
  fitScore: number;            // 0-100, computed locally
  fitReasons: string[];
  addedToPipeline: boolean;
}

export interface SourcingResult {
  briefParsed: Partial<SourcingBrief>;
  booleanString: string;       // generated Boolean query shown to user
  candidates: SourcingCandidate[];
  totalFound: number;
  sources: Record<SourceType, number>;
  searchedAt: string;
  perplexityCitations?: string[];
}

// ─── NL → Structured Brief ────────────────────────────────────────────────────

/**
 * Parse a natural-language sourcing brief into structured intent.
 * Runs entirely server-side with pattern matching + keyword extraction.
 * No external AI API needed — keeps it fast and free.
 */
function parseBrief(query: string): Partial<SourcingBrief> {
  const q = query.toLowerCase();

  // Title extraction
  const titleKeywords: Record<string, string[]> = {
    "Chief Financial Officer": ["cfo", "chief financial officer", "vp finance", "vp of finance", "vice president finance", "head of finance", "finance leader"],
    "Chief Accounting Officer": ["cao", "chief accounting officer", "chief accountant", "vp accounting", "vp of accounting", "vice president accounting", "head of accounting", "accounting leader", "technical accounting", "sec reporting"],
    "Chief Technology Officer": ["cto", "chief technology officer", "vp engineering", "vp of engineering", "head of engineering", "tech lead"],
    "Chief Operating Officer": ["coo", "chief operating officer", "vp operations", "head of operations"],
    "Chief Marketing Officer": ["cmo", "chief marketing officer", "vp marketing", "head of marketing"],
    "Chief Human Resources Officer": ["chro", "chief hr officer", "vp hr", "vp people", "head of hr", "head of people"],
    "Chief Revenue Officer": ["cro", "chief revenue officer", "vp sales", "head of sales", "vp revenue"],
    "Chief Executive Officer": ["ceo", "chief executive officer", "president", "founder"],
    "General Counsel": ["gc", "general counsel", "chief legal officer", "clo", "vp legal", "head of legal"],
    "Software Engineer": ["software engineer", "developer", "programmer", "swe", "full stack", "backend", "frontend"],
    "Data Scientist": ["data scientist", "ml engineer", "machine learning", "ai engineer", "data analyst"],
    "Product Manager": ["product manager", "pm ", "head of product", "vp product", "director of product"],
    "Controller": ["controller", "vp controller", "corporate controller", "divisional controller"],
  };

  const titles: string[] = [];
  for (const [title, keywords] of Object.entries(titleKeywords)) {
    if (keywords.some(k => q.includes(k))) titles.push(title);
  }

  // Industry extraction
  const industryMap: Record<string, string[]> = {
    "Healthcare": ["healthcare", "health care", "medical", "hospital", "pharma", "biotech", "life sciences", "health system"],
    "Technology": ["technology", "tech", "software", "saas", "fintech", "edtech", "cybersecurity"],
    "Private Equity": ["pe-backed", "pe backed", "private equity", "portfolio company", "pe portfolio"],
    "Financial Services": ["financial services", "banking", "insurance", "asset management", "investment"],
    "Manufacturing": ["manufacturing", "industrial", "supply chain", "logistics"],
    "Consumer": ["consumer", "retail", "ecommerce", "e-commerce", "cpg"],
    "Real Estate": ["real estate", "reit", "property"],
    "Energy": ["energy", "oil", "gas", "renewable", "utilities"],
  };

  const industries: string[] = [];
  for (const [industry, keywords] of Object.entries(industryMap)) {
    if (keywords.some(k => q.includes(k))) industries.push(industry);
  }

  // Location extraction
  const locationPatterns = [
    /\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    /\b(new york|chicago|los angeles|san francisco|boston|dallas|houston|atlanta|miami|seattle|denver|austin|nashville|charlotte|philadelphia|phoenix|minneapolis)/gi,
    /\b\d{5}(?:-\d{4})?\b/g, // ZIP/postal codes
    /\b([A-Z]{2})\b/g, // state abbreviations
    /\b(remote|hybrid|on-site|onsite)\b/gi,
  ];

  const locations: string[] = [];
  for (const pattern of locationPatterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(query)) !== null) {
      const loc = (match[1] || match[0]).trim();
      if (loc.length > 1 && !locations.includes(loc)) locations.push(loc);
    }
  }

  // Company size
  const sizeMatch = query.match(/(\d+)\s*[-–to]+\s*(\d+)\s*(?:employees?|people|headcount|staff)/i);
  const companySizes = sizeMatch ? [`${sizeMatch[1]}-${sizeMatch[2]}`] : [];

  // Seniority
  let seniorityLevel = "Senior";
  if (/\bc[\-\s]?suite|executive|c-level\b/i.test(query)) seniorityLevel = "C-Suite";
  else if (/\bvp\b|vice president/i.test(query)) seniorityLevel = "VP";
  else if (/\bdirector\b/i.test(query)) seniorityLevel = "Director";
  else if (/\bmanager\b/i.test(query)) seniorityLevel = "Manager";

  // Years of experience
  const yoeMatch = query.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/i);
  const yearsExperience = yoeMatch ? `${yoeMatch[1]}+` : undefined;

  // Skills extraction (common ones)
  const skillMap = ["python", "sql", "excel", "gaap", "sox", "m&a", "fundraising", "aws", "react", "typescript",
    "leadership", "p&l", "budgeting", "forecasting", "erp", "salesforce", "tableau", "powerbi",
    "kubernetes", "terraform", "java", "go", "rust", "pytorch", "tensorflow"];
  const skills = skillMap.filter(s => q.includes(s));

  return { titles, industries, locations, companySizes, seniorityLevel, yearsExperience, skills };
}

// ─── Boolean String Generator ─────────────────────────────────────────────────

function buildBooleanString(brief: Partial<SourcingBrief>, query: string): string {
  const parts: string[] = [];

  if (brief.titles && brief.titles.length > 0) {
    const titleStr = brief.titles.length === 1
      ? `"${brief.titles[0]}"`
      : `(${brief.titles.map(t => `"${t}"`).join(" OR ")})`;
    parts.push(titleStr);
  }

  if (brief.industries && brief.industries.length > 0) {
    const indStr = brief.industries.length === 1
      ? `"${brief.industries[0]}"`
      : `(${brief.industries.map(i => `"${i}"`).join(" OR ")})`;
    parts.push(indStr);
  }

  if (brief.skills && brief.skills.length > 0) {
    parts.push(brief.skills.map(s => `"${s}"`).join(" AND "));
  }

  if (brief.locations && brief.locations.length > 0) {
    const locStr = `(${brief.locations.map(l => `"${l}"`).join(" OR ")})`;
    parts.push(locStr);
  }

  if (parts.length === 0) {
    // Fall back to quoted words from original query
    const words = query.split(/\s+/).filter(w => w.length > 3).slice(0, 6);
    return words.map(w => `"${w}"`).join(" AND ");
  }

  return parts.join(" AND ");
}

// ─── X-Ray Search (Google CSE) ────────────────────────────────────────────────

interface GoogleCSEItem {
  title: string;
  link: string;
  snippet: string;
  pagemap?: {
    person?: Array<{ name?: string; title?: string; org?: string }>;
    metatags?: Array<Record<string, string>>;
  };
}

async function xrayLinkedIn(
  booleanQuery: string,
  locations: string[],
  apiKey: string,
  cx: string,
  limit: number
): Promise<SourcingCandidate[]> {
  const locStr = locations.length > 0 ? ` (${locations.join(" OR ")})` : "";
  const searchQuery = `site:linkedin.com/in ${booleanQuery}${locStr}`;

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("num", String(Math.min(limit, 10)));

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Google CSE error: ${resp.status} — ${err}`);
  }

  const data = await resp.json() as { items?: GoogleCSEItem[] };
  if (!data.items) return [];

  return data.items.map((item, i) => {
    const { name, title, company, location } = extractProfileFromCSE(item);
    return {
      id: `li_${Date.now()}_${i}`,
      name,
      currentTitle: title,
      currentCompany: company,
      location,
      headline: item.snippet?.split(".")[0] || title,
      summary: generateQuickSummary(name, title, company, location, item.snippet || ""),
      skills: extractSkillsFromSnippet(item.snippet || ""),
      source: "linkedin_xray" as SourceType,
      sourceUrl: item.link,
      linkedinUrl: item.link,
      fitScore: 0,   // computed after collection
      fitReasons: [],
      addedToPipeline: false,
    };
  });
}

async function xrayOpenWeb(
  booleanQuery: string,
  apiKey: string,
  cx: string,
  limit: number
): Promise<SourcingCandidate[]> {
  // Search the open web (personal sites, conference bios, company about pages)
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", `${booleanQuery} -site:linkedin.com`);
  url.searchParams.set("num", String(Math.min(limit, 10)));

  const resp = await fetch(url.toString());
  if (!resp.ok) return [];

  const data = await resp.json() as { items?: GoogleCSEItem[] };
  if (!data.items) return [];

  return data.items
    .filter(item => {
      // Filter to profile-like pages
      const url = item.link.toLowerCase();
      return url.includes("about") || url.includes("team") || url.includes("speaker") ||
             url.includes("author") || url.includes("bio") || url.includes("profile") ||
             url.includes("github.com") || url.includes("medium.com") ||
             url.includes("twitter.com") || url.includes("x.com");
    })
    .map((item, i) => {
      const { name, title, company, location } = extractProfileFromCSE(item);
      return {
        id: `web_${Date.now()}_${i}`,
        name,
        currentTitle: title,
        currentCompany: company,
        location,
        headline: item.snippet?.split(".")[0] || title,
        summary: generateQuickSummary(name, title, company, location, item.snippet || ""),
        skills: extractSkillsFromSnippet(item.snippet || ""),
        source: "web" as SourceType,
        sourceUrl: item.link,
        fitScore: 0,
        fitReasons: [],
        addedToPipeline: false,
      };
    });
}

// ─── GitHub Search ────────────────────────────────────────────────────────────

interface GitHubUser {
  login: string;
  id: number;
  html_url: string;
  avatar_url: string;
  name?: string;
  company?: string;
  blog?: string;
  location?: string;
  email?: string;
  bio?: string;
  public_repos: number;
  followers: number;
}

async function searchGitHub(
  keywords: string[],
  locations: string[],
  limit: number
): Promise<SourcingCandidate[]> {
  const parts = keywords.filter(Boolean).slice(0, 4).join("+");
  const locQuery = locations.length > 0 ? `+location:${locations[0].replace(/\s+/g, "+")}` : "";
  const searchUrl = `https://api.github.com/search/users?q=${encodeURIComponent(parts)}+type:user${locQuery}&per_page=${Math.min(limit, 30)}&sort=followers`;

  const resp = await fetch(searchUrl, {
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": "HireCommand-Sourcing/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
    }
  });

  if (!resp.ok) return [];

  const data = await resp.json() as { items?: GitHubUser[] };
  if (!data.items) return [];

  // Enrich first 5 with full profile (rate limit conscious)
  const enriched: SourcingCandidate[] = [];
  for (const user of data.items.slice(0, Math.min(limit, 5))) {
    try {
      const profileResp = await fetch(`https://api.github.com/users/${user.login}`, {
        headers: {
          "Accept": "application/vnd.github+json",
          "User-Agent": "HireCommand-Sourcing/1.0",
        }
      });
      const profile: GitHubUser = profileResp.ok ? await profileResp.json() : user;

      const name = profile.name || profile.login;
      const title = profile.bio?.split(".")[0] || "Software Engineer";
      const company = profile.company?.replace("@", "") || "Independent";
      const location = profile.location || "Unknown";

      enriched.push({
        id: `gh_${profile.id}`,
        name,
        currentTitle: title,
        currentCompany: company,
        location,
        headline: profile.bio || `Developer with ${profile.public_repos} public repos · ${profile.followers} followers`,
        summary: generateQuickSummary(name, title, company, location, profile.bio || ""),
        skills: keywords.slice(0, 5),
        source: "github" as SourceType,
        sourceUrl: profile.html_url,
        githubUrl: profile.html_url,
        email: profile.email || undefined,
        fitScore: 0,
        fitReasons: [],
        addedToPipeline: false,
      });
    } catch {
      // skip failed enrichment
    }
  }

  return enriched;
}

// ─── People Data Labs (optional enrichment) ────────────────────────────────────

async function searchPDL(
  brief: Partial<SourcingBrief>,
  apiKey: string,
  limit: number
): Promise<SourcingCandidate[]> {
  const esQuery: Record<string, unknown> = {
    bool: {
      must: [] as unknown[],
      should: [],
    }
  };

  const must = esQuery.bool as { must: unknown[]; should: unknown[] };

  if (brief.titles && brief.titles.length > 0) {
    must.must.push({ terms: { "job_title": brief.titles.map(t => t.toLowerCase()) } });
  }

  if (brief.locations && brief.locations.length > 0) {
    must.should.push(...brief.locations.map(l => ({
      match: { "location_locality": l }
    })));
  }

  const body = {
    query: esQuery,
    size: Math.min(limit, 10),
    pretty: false,
  };

  const resp = await fetch("https://api.peopledatalabs.com/v5/person/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) return [];

  const data = await resp.json() as {
    data?: Array<{
      id: string;
      full_name?: string;
      job_title?: string;
      job_company_name?: string;
      location_name?: string;
      linkedin_url?: string;
      skills?: string[];
      summary?: string;
      emails?: Array<{ address: string }>;
    }>
  };

  if (!data.data) return [];

  return data.data.map((p) => {
    const name = p.full_name || "Unknown";
    const title = p.job_title || "Professional";
    const company = p.job_company_name || "";
    const location = p.location_name || "";

    return {
      id: `pdl_${p.id}`,
      name,
      currentTitle: title,
      currentCompany: company,
      location,
      headline: `${title} at ${company}`,
      summary: generateQuickSummary(name, title, company, location, p.summary || ""),
      skills: p.skills?.slice(0, 8) || [],
      source: "pdl" as SourceType,
      sourceUrl: p.linkedin_url || "",
      linkedinUrl: p.linkedin_url || undefined,
      email: p.emails?.[0]?.address,
      fitScore: 0,
      fitReasons: [],
      addedToPipeline: false,
    };
  });
}

// ─── Fit Scoring ──────────────────────────────────────────────────────────────

function scoreCandidates(
  candidates: SourcingCandidate[],
  brief: Partial<SourcingBrief>
): SourcingCandidate[] {
  return candidates.map(c => {
    let score = 50; // base
    const reasons: string[] = [];
    const textToScore = `${c.currentTitle} ${c.currentCompany} ${c.headline} ${c.skills.join(" ")} ${c.location}`.toLowerCase();

    // Title match
    if (brief.titles?.some(t => textToScore.includes(t.toLowerCase()))) {
      score += 20;
      reasons.push("Title match");
    }

    // Industry match
    if (brief.industries?.some(i => textToScore.includes(i.toLowerCase()))) {
      score += 15;
      reasons.push("Industry match");
    }

    // Location match
    if (brief.locations?.some(l => textToScore.includes(l.toLowerCase()))) {
      score += 10;
      reasons.push("Location match");
    }

    // Skills match
    const matchedSkills = brief.skills?.filter(s => textToScore.includes(s.toLowerCase())) || [];
    if (matchedSkills.length > 0) {
      score += Math.min(matchedSkills.length * 3, 15);
      reasons.push(`${matchedSkills.length} skill match${matchedSkills.length > 1 ? "es" : ""}`);
    }

    // PE-backed signal
    if (brief.industries?.includes("Private Equity") && textToScore.includes("pe")) {
      score += 10;
      reasons.push("PE background");
    }

    // Seniority
    if (brief.seniorityLevel === "C-Suite") {
      const csuiteTerms = ["cfo", "cto", "coo", "cmo", "ceo", "cro", "chro", "chief"];
      if (csuiteTerms.some(t => textToScore.includes(t))) {
        score += 10;
        reasons.push("C-suite level");
      }
    }

    return {
      ...c,
      fitScore: Math.min(score, 99),
      fitReasons: reasons,
    };
  }).sort((a, b) => b.fitScore - a.fitScore);
}

// ─── Utility: Profile extraction from CSE snippet ─────────────────────────────

function extractProfileFromCSE(item: GoogleCSEItem): {
  name: string; title: string; company: string; location: string
} {
  // Try pagemap person data first
  if (item.pagemap?.person?.[0]) {
    const p = item.pagemap.person[0];
    return {
      name: p.name || extractNameFromTitle(item.title),
      title: p.title || extractTitleFromSnippet(item.snippet || ""),
      company: p.org || extractCompanyFromSnippet(item.snippet || ""),
      location: extractLocationFromSnippet(item.snippet || ""),
    };
  }

  return {
    name: extractNameFromTitle(item.title),
    title: extractTitleFromSnippet(item.snippet || ""),
    company: extractCompanyFromSnippet(item.snippet || ""),
    location: extractLocationFromSnippet(item.snippet || ""),
  };
}

function extractNameFromTitle(title: string): string {
  // LinkedIn title format: "First Last - Title | LinkedIn"
  const match = title.match(/^([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  return match ? match[1] : title.split(" - ")[0].split("|")[0].trim();
}

function extractTitleFromSnippet(snippet: string): string {
  const patterns = [
    /(?:is a|as a|works as|serving as|currently)\s+([A-Z][^.]+?)(?:\s+at|\s+for|\.|,)/i,
    /^([A-Z][^.]+?)\s+at\s+/,
    /((?:Chief|VP|Vice President|Director|Head of|Manager)[^.]+)/i,
  ];
  for (const p of patterns) {
    const m = snippet.match(p);
    if (m) return m[1].trim().slice(0, 60);
  }
  return snippet.split(".")[0].slice(0, 60) || "Professional";
}

function extractCompanyFromSnippet(snippet: string): string {
  const m = snippet.match(/at\s+([A-Z][A-Za-z0-9\s&]+?)(?:\s*[|·,.]|$)/);
  return m ? m[1].trim().slice(0, 40) : "";
}

function extractLocationFromSnippet(snippet: string): string {
  const cities = ["New York", "Chicago", "Los Angeles", "San Francisco", "Boston",
    "Dallas", "Houston", "Atlanta", "Miami", "Seattle", "Denver", "Austin",
    "Nashville", "Charlotte", "Philadelphia", "Phoenix", "Minneapolis", "Remote"];
  for (const city of cities) {
    if (snippet.includes(city)) return city;
  }
  return "";
}

function extractSkillsFromSnippet(snippet: string): string[] {
  const skillList = ["GAAP", "M&A", "SQL", "Python", "AWS", "Kubernetes", "React",
    "Salesforce", "Excel", "PowerBI", "Tableau", "SOX", "FP&A", "ERP", "PE-backed",
    "Leadership", "P&L", "Forecasting", "Budgeting", "IPO", "SaaS"];
  return skillList.filter(s => snippet.toLowerCase().includes(s.toLowerCase())).slice(0, 6);
}

// ─── AI Quick Summary Generator ───────────────────────────────────────────────

function generateQuickSummary(
  name: string,
  title: string,
  company: string,
  location: string,
  context: string
): string {
  const firstName = name.split(" ")[0];
  const companyStr = company ? ` at ${company}` : "";
  const locationStr = location ? ` based in ${location}` : "";

  // Extract meaningful context
  const contextClean = context
    .replace(/\s+/g, " ")
    .replace(/[•·|]/g, "—")
    .trim()
    .slice(0, 120);

  if (contextClean.length > 20) {
    return `${firstName} is a ${title}${companyStr}${locationStr}. ${contextClean}`;
  }

  return `${firstName} is a ${title}${companyStr}${locationStr}.`;
}

// ─── Perplexity Sonar Search ─────────────────────────────────────────────────

async function searchPerplexity(
  brief: Partial<SourcingBrief>,
  query: string,
  apiKey: string,
  limit: number
): Promise<{ candidates: SourcingCandidate[]; citations: string[] }> {
  const titlesStr = brief.titles?.join(", ") || "senior executive";
  const locStr = brief.locations?.join(", ") || "";
  const indStr = brief.industries?.join(", ") || "";
  const skillStr = brief.skills?.join(", ") || "";

  const systemPrompt = `You are a professional executive recruiter. Search the web for real people matching the candidate criteria.
Return ONLY a valid JSON object — no markdown, no explanation, just the raw JSON.`;

  const userPrompt = `Find ${Math.min(limit, 12)} real professionals matching this search: "${query}"

Target profile:
- Titles: ${titlesStr}
${locStr ? `- Locations: ${locStr}` : ""}
${indStr ? `- Industries: ${indStr}` : ""}
${skillStr ? `- Skills: ${skillStr}` : ""}

Search LinkedIn, company websites, conference speaker pages, professional bios, and news articles.

Return a JSON object in exactly this shape:
{
  "candidates": [
    {
      "name": "Full Name",
      "currentTitle": "Their exact current title",
      "currentCompany": "Company name",
      "location": "City, State",
      "linkedinUrl": "https://linkedin.com/in/... or empty string",
      "sourceUrl": "URL where you found them",
      "summary": "2-3 sentence background summary highlighting relevant experience",
      "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
      "fitScore": 85,
      "fitReasons": ["Reason 1", "Reason 2", "Reason 3"]
    }
  ]
}`;

  const resp = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Perplexity API error ${resp.status}: ${err.slice(0, 200)}`);
  }

  const data = await resp.json() as {
    choices: Array<{ message: { content: string } }>;
    citations?: string[];
  };

  const content = data.choices?.[0]?.message?.content || "";
  const citations = data.citations || [];

  // Extract JSON from response (may be wrapped in markdown)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn("[Perplexity] No JSON in response:", content.slice(0, 300));
    return { candidates: [], citations };
  }

  let parsed: { candidates: Array<{
    name: string;
    currentTitle: string;
    currentCompany: string;
    location: string;
    linkedinUrl?: string;
    sourceUrl?: string;
    summary: string;
    skills: string[];
    fitScore: number;
    fitReasons: string[];
  }> };

  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.warn("[Perplexity] Failed to parse JSON");
    return { candidates: [], citations };
  }

  const candidates: SourcingCandidate[] = (parsed.candidates || []).map((c, i) => ({
    id: `plx_${Date.now()}_${i}`,
    name: c.name || "Unknown",
    currentTitle: c.currentTitle || "",
    currentCompany: c.currentCompany || "",
    location: c.location || "",
    headline: `${c.currentTitle} at ${c.currentCompany}`,
    summary: c.summary || "",
    skills: Array.isArray(c.skills) ? c.skills.slice(0, 8) : [],
    source: "perplexity" as SourceType,
    sourceUrl: c.sourceUrl || c.linkedinUrl || "",
    linkedinUrl: c.linkedinUrl || undefined,
    fitScore: Math.min(Math.max(Number(c.fitScore) || 70, 0), 99),
    fitReasons: Array.isArray(c.fitReasons) ? c.fitReasons : [],
    addedToPipeline: false,
  }));

  return { candidates, citations };
}

// ─── DB-backed key resolution ─────────────────────────────────────────────────

async function resolveKeys() {
  const { storage } = await import("./storage");
  const [dbGoogleKey, dbGoogleCx, dbPerplexityKey] = await Promise.all([
    storage.getSetting("sourcing_google_cse_key"),
    storage.getSetting("sourcing_google_cse_cx"),
    storage.getSetting("sourcing_perplexity_key"),
  ]);
  return {
    googleApiKey: dbGoogleKey || process.env.GOOGLE_CSE_API_KEY || "",
    googleCx: dbGoogleCx || process.env.GOOGLE_CSE_CX || "",
    pdlApiKey: process.env.PDL_API_KEY || "",
    perplexityKey: dbPerplexityKey || process.env.PERPLEXITY_API_KEY || "",
  };
}

// ─── Main route handler ───────────────────────────────────────────────────────

export function registerSourcingRoutes(app: Express) {

  /**
   * POST /api/sourcing/search
   * Body: { query, sources, limit }
   */
  app.post("/api/sourcing/search", async (req: Request, res: Response) => {
    try {
      const {
        query,
        sources = ["linkedin_xray", "web"],
        limit = 20,
      } = req.body as {
        query: string;
        sources: SourceType[];
        limit: number;
      };

      if (!query || query.trim().length < 3) {
        return res.status(400).json({ error: "Query must be at least 3 characters" });
      }

      // Step 1: Parse brief
      const briefParsed = parseBrief(query);
      const booleanString = buildBooleanString(briefParsed, query);

      // Step 2: Resolve API keys (DB first, then env vars)
      const { googleApiKey, googleCx, pdlApiKey, perplexityKey } = await resolveKeys();

      const allCandidates: SourcingCandidate[] = [];
      const sourceCounts: Record<string, number> = {
        linkedin_xray: 0, github: 0, web: 0, pdl: 0, perplexity: 0
      };
      let perplexityCitations: string[] = [];

      const hasGoogleKeys = googleApiKey.length > 0 && googleCx.length > 0;
      const hasPerplexity = perplexityKey.length > 0;
      const hasAnySources = hasGoogleKeys || hasPerplexity;

      if (hasAnySources) {
        const tasks: Promise<void>[] = [];

        if (hasGoogleKeys) {
          if (sources.includes("linkedin_xray")) {
            tasks.push(
              xrayLinkedIn(booleanString, briefParsed.locations || [], googleApiKey, googleCx, Math.ceil(limit * 0.5))
                .then(results => { allCandidates.push(...results); results.forEach(c => { sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1; }); })
                .catch(err => console.warn("[X-Ray LinkedIn]", err.message))
            );
          }
          if (sources.includes("web")) {
            tasks.push(
              xrayOpenWeb(booleanString, googleApiKey, googleCx, Math.ceil(limit * 0.2))
                .then(results => { allCandidates.push(...results); results.forEach(c => { sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1; }); })
                .catch(err => console.warn("[X-Ray Web]", err.message))
            );
          }
        }

        if (sources.includes("github") && briefParsed.skills && briefParsed.skills.length > 0) {
          tasks.push(
            searchGitHub(briefParsed.skills, briefParsed.locations || [], Math.ceil(limit * 0.2))
              .then(results => { allCandidates.push(...results); results.forEach(c => { sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1; }); })
              .catch(err => console.warn("[GitHub]", err.message))
          );
        }

        if (sources.includes("pdl") && pdlApiKey.length > 0) {
          tasks.push(
            searchPDL(briefParsed, pdlApiKey, Math.ceil(limit * 0.3))
              .then(results => { allCandidates.push(...results); results.forEach(c => { sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1; }); })
              .catch(err => console.warn("[PDL]", err.message))
          );
        }

        if (sources.includes("perplexity") && hasPerplexity) {
          tasks.push(
            searchPerplexity(briefParsed, query, perplexityKey, Math.min(limit, 12))
              .then(({ candidates, citations }) => {
                allCandidates.push(...candidates);
                sourceCounts.perplexity = candidates.length;
                perplexityCitations = citations;
              })
              .catch(err => console.warn("[Perplexity]", err.message))
          );
        }

        await Promise.all(tasks);
      }

      // Do not synthesize demo candidates here. Empty live-source results must stay empty
      // so recruiters can distinguish a real search miss from sample data.

      // Step 3: Score non-Perplexity candidates (Perplexity scores its own)
      const toScore = allCandidates.filter(c => c.source !== "perplexity");
      const preScored = allCandidates.filter(c => c.source === "perplexity");
      const scored = [...scoreCandidates(toScore, briefParsed), ...preScored]
        .sort((a, b) => b.fitScore - a.fitScore);

      // Step 4: Deduplicate by name+company
      const seen = new Set<string>();
      const deduped = scored.filter(c => {
        const key = `${c.name.toLowerCase()}|${c.currentCompany.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const response: SourcingResult = {
        briefParsed,
        booleanString,
        candidates: deduped.slice(0, limit),
        totalFound: deduped.length,
        sources: sourceCounts as Record<SourceType, number>,
        searchedAt: new Date().toISOString(),
        perplexityCitations: perplexityCitations.length > 0 ? perplexityCitations : undefined,
      };

      res.json(response);
    } catch (err: unknown) {
      console.error("[Sourcing] Error:", err);
      res.status(500).json({ error: "Sourcing search failed", details: String(err) });
    }
  });

  /**
   * POST /api/sourcing/add-to-pipeline
   * Adds a sourced candidate to the main candidates table
   */
  app.post("/api/sourcing/add-to-pipeline", async (req: Request, res: Response) => {
    try {
      const { candidate } = req.body as { candidate: SourcingCandidate };

      const { storage } = await import("./storage");

      const today = new Date().toISOString().split("T")[0];
      const newCandidate = await storage.createCandidate({
        name: candidate.name,
        title: candidate.currentTitle,
        company: candidate.currentCompany,
        location: candidate.location,
        email: candidate.email || "",
        phone: "",
        linkedin: candidate.linkedinUrl || candidate.sourceUrl || "",
        matchScore: candidate.fitScore,
        status: "sourced",
        lastContact: today,
        tags: JSON.stringify(["AI Sourced", ...candidate.skills.slice(0, 3)]),
        notes: `Sourced via HireCommand AI Sourcing.\n\nProfile: ${candidate.sourceUrl}\n\nAI Summary: ${candidate.summary}\n\nFit Score: ${candidate.fitScore}/100\nFit Reasons: ${candidate.fitReasons.join(", ")}`,
        timeline: JSON.stringify([{
          date: today,
          event: "Sourced",
          note: `Added via AI Source — ${candidate.source === "linkedin_xray" ? "LinkedIn X-Ray" : candidate.source}`,
        }]),
      });

      res.status(201).json(newCandidate);
    } catch (err) {
      console.error("[Sourcing] Add to pipeline error:", err);
      res.status(500).json({ error: "Failed to add candidate to pipeline" });
    }
  });

  /**
   * GET /api/sourcing/config
   * Returns which APIs are configured (no key values)
   */
  app.get("/api/sourcing/config", async (_req: Request, res: Response) => {
    const { googleApiKey, googleCx, perplexityKey, pdlApiKey } = await resolveKeys();
    const hasGoogle = !!(googleApiKey && googleCx);
    const hasPerplexity = !!perplexityKey;
    res.json({
      googleCse: hasGoogle,
      pdl: !!pdlApiKey,
      perplexity: hasPerplexity,
      githubPublic: true,
      demoMode: !hasGoogle && !hasPerplexity,
    });
  });

  /**
   * POST /api/sourcing/settings
   * Save API keys to DB (admin only)
   */
  app.post("/api/sourcing/settings", async (req: Request, res: Response) => {
    try {
      const { storage } = await import("./storage");
      const { googleCseKey, googleCseCx, perplexityKey } = req.body as {
        googleCseKey?: string;
        googleCseCx?: string;
        perplexityKey?: string;
      };
      if (googleCseKey !== undefined) {
        if (googleCseKey) await storage.setSetting("sourcing_google_cse_key", googleCseKey);
        else await storage.deleteSetting("sourcing_google_cse_key");
      }
      if (googleCseCx !== undefined) {
        if (googleCseCx) await storage.setSetting("sourcing_google_cse_cx", googleCseCx);
        else await storage.deleteSetting("sourcing_google_cse_cx");
      }
      if (perplexityKey !== undefined) {
        if (perplexityKey) await storage.setSetting("sourcing_perplexity_key", perplexityKey);
        else await storage.deleteSetting("sourcing_perplexity_key");
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  /**
   * GET /api/sourcing/settings
   * Returns masked current key values
   */
  app.get("/api/sourcing/settings", async (_req: Request, res: Response) => {
    const { storage } = await import("./storage");
    const [googleKey, googleCx, perplexityKey] = await Promise.all([
      storage.getSetting("sourcing_google_cse_key"),
      storage.getSetting("sourcing_google_cse_cx"),
      storage.getSetting("sourcing_perplexity_key"),
    ]);
    const mask = (v: string | undefined) => v ? `${v.slice(0, 6)}${"•".repeat(Math.max(0, v.length - 6))}` : "";
    res.json({
      googleCseKey: mask(googleKey),
      googleCseCx: mask(googleCx),
      perplexityKey: mask(perplexityKey),
      googleCseKeySet: !!googleKey,
      googleCseCxSet: !!googleCx,
      perplexityKeySet: !!perplexityKey,
    });
  });
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function detectFunction(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("financial") || t.includes("cfo") || t.includes("controller") || t.includes("finance")) return "Finance";
  if (t.includes("technology") || t.includes("cto") || t.includes("engineer") || t.includes("software")) return "Technology";
  if (t.includes("operating") || t.includes("coo") || t.includes("operations")) return "Operations";
  if (t.includes("marketing") || t.includes("cmo")) return "Marketing";
  if (t.includes("hr") || t.includes("human resources") || t.includes("chro") || t.includes("people")) return "HR";
  if (t.includes("legal") || t.includes("counsel") || t.includes("compliance")) return "Legal";
  if (t.includes("revenue") || t.includes("sales") || t.includes("cro")) return "Sales";
  if (t.includes("ceo") || t.includes("chief executive") || t.includes("president")) return "Executive";
  return "General Management";
}
