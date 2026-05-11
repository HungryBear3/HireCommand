type ScoreInput = {
  name?: string;
  title?: string;
  company?: string;
  location?: string;
  email?: string;
  linkedin?: string;
  tags?: string | string[];
  notes?: string;
  skillsets?: string;
  timeline?: string;
  linkedinSnapshot?: string;
  linkedinChanges?: string;
  rawJson?: string;
  loxoRaw?: unknown;
};

function parseTags(tags: ScoreInput["tags"]): string[] {
  if (Array.isArray(tags)) return tags;
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
}

function stableHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

function stringifyUnknown(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function scoreSignals(text: string, signals: Array<[RegExp, number]>): number {
  return signals.reduce((score, [pattern, points]) => score + (pattern.test(text) ? points : 0), 0);
}

function yearsCovered(text: string): number {
  const years = Array.from(text.matchAll(/\b(19|20)\d{2}\b/g))
    .map((match) => Number(match[0]))
    .filter((year) => year >= 1980 && year <= new Date().getFullYear() + 1);
  if (years.length < 2) return 0;
  return Math.max(...years) - Math.min(...years);
}

function uniqueNumbers(text: string): number {
  return new Set(Array.from(text.matchAll(/\b\$?\d+(?:\.\d+)?\s?(?:m|mm|million|b|bn|billion|k|%|x)?\b/gi)).map((m) => m[0].toLowerCase())).size;
}

/**
 * Executive candidate fit score.
 *
 * This intentionally rewards evidence over title keywords. Resume text, Loxo raw fields,
 * LinkedIn snapshots, and profile-change history are folded into the scoring haystack so
 * the match field reflects track record, leadership scope, stage/problem fit, behavioral
 * signals, and post-2024 market fluency instead of a flat generic seniority score.
 */
export function calculateCandidateMatchScore(input: ScoreInput): number {
  const tags = parseTags(input.tags);
  const evidenceText = [
    input.name,
    input.title,
    input.company,
    input.location,
    input.email,
    input.linkedin,
    input.notes,
    input.skillsets,
    input.timeline,
    input.linkedinSnapshot,
    input.linkedinChanges,
    input.rawJson,
    stringifyUnknown(input.loxoRaw),
    ...tags,
  ].filter(Boolean).join(" ");

  const haystack = evidenceText.toLowerCase();
  const senioritySignals = countMatches(haystack, [
    /\b(cxo|ceo|cfo|coo|cto|chro|cmo|cao|chief|president|general manager|gm)\b/,
    /\b(vp|svp|evp|vice president|director|head of|controller|partner|principal)\b/,
  ]);

  let score = 46;

  // Baseline executive relevance and data completeness.
  score += Math.min(10, senioritySignals * 5);
  if (input.linkedin) score += 2;
  if (input.email) score += 1;
  if (input.location) score += 1;
  if (tags.length >= 3) score += 2;
  if (input.notes && input.notes.length > 500) score += 2;
  if (input.linkedinSnapshot || input.rawJson || input.loxoRaw) score += 2;

  // Performance & track record: quantified outcomes beat vague claims.
  const quantCount = uniqueNumbers(haystack);
  score += Math.min(8, Math.floor(quantCount / 2));
  score += scoreSignals(haystack, [
    [/\b(revenue|arr|sales|booking|pipeline|quota|growth|grew|scaled)\b/, 3],
    [/\b(p&l|profit and loss|budget|managed \$|ebitda|margin|gross margin)\b/, 4],
    [/\b(cost savings|reduced costs|cost reduction|working capital|cash flow|capital efficiency|burn|runway)\b/, 4],
    [/\b(headcount|team from|scaled (?:a )?team|hired|built .*team|grew .*team)\b/, 3],
    [/\b(turnaround|restructur|downturn|recession|crisis|distressed|bankruptcy|carve-?out)\b/, 4],
    [/\b(promoted|promotion|advanced to|rose to|progressed to)\b/, 3],
  ]);

  // Leadership quality: scope, retention, people development, and reference pattern signals.
  score += scoreSignals(haystack, [
    [/\b(retention|retained|low attrition|engagement score|employee engagement)\b/, 4],
    [/\b(promoted .*direct report|developed .*leader|succession|mentored|coached|built leaders)\b/, 4],
    [/\b(360|reference|peer|direct reports|manager feedback|cross-functional partner)\b/, 3],
    [/\b(span of control|org(?:anization)? of|led \d+|managed \d+|global team|distributed team|multi-site)\b/, 4],
  ]);

  // Strategic fit: stage, problem pattern, investor/board fluency.
  score += scoreSignals(haystack, [
    [/\b(startup|early[- ]stage|zero to one|0 to 1|founding|builder)\b/, 3],
    [/\b(scale[- ]?up|growth stage|hypergrowth|series [abcde]|scaled)\b/, 3],
    [/\b(turnaround|transformation|integration|m&a|merger|acquisition|roll[- ]?up|ipo|exit)\b/, 5],
    [/\b(board|investor|private equity|pe-backed|sponsor|portfolio company|operating partner|value creation)\b/, 5],
    [/\b(solved|built|launched|implemented|led .*through|owned|accountable)\b/, 3],
  ]);

  // Cultural / behavioral indicators: interview notes and resumes that reveal how they operate.
  score += scoreSignals(haystack, [
    [/\b(decisive|decision velocity|ambiguity|ambiguous|bias for action|rapid decision)\b/, 4],
    [/\b(consensus|collaborative|stakeholder alignment|influenced|cross-functional)\b/, 3],
    [/\b(failure|setback|learned|postmortem|lessons learned|recovered|pivoted)\b/, 4],
    [/\b(new domain|pivoted into|learned .*from|adapted|learning agility)\b/, 3],
    [/\b(values|integrity|customer[- ]first|ownership|accountability)\b/, 2],
  ]);

  // Market signal metrics: career demand, network, and employer brand pattern.
  score += scoreSignals(haystack, [
    [/\b(recruited|headhunted|referred|warm intro|selected by|poached)\b/, 4],
    [/\b(network|advisor|board member|investor network|portfolio network|alumni)\b/, 3],
    [/\b(pre[- ]breakout|category leader|top[- ]tier|google|amazon|microsoft|stripe|mckinsey|bain|bcg|deloitte|kkr|vista|thoma bravo|warburg|a16z|general atlantic)\b/, 3],
  ]);

  // Increasingly important post-2024 leadership signals.
  score += scoreSignals(haystack, [
    [/\b(ai|artificial intelligence|machine learning|ml|data|analytics|automation|genai|llm)\b/, 5],
    [/\b(remote|distributed|hybrid|global team|async)\b/, 3],
    [/\b(cross-functional|gtm|product|engineering|finance|operations|sales|marketing)\b/, 3],
    [/\b(capital efficiency|profitable growth|efficient growth|post[- ]?zirp|runway|burn multiple|do more with less)\b/, 5],
  ]);

  // Tenure-to-impact proxy: long enough history plus quantified outcomes suggests repeatable impact.
  const careerYears = yearsCovered(haystack);
  if (careerYears >= 6 && quantCount >= 3) score += 4;
  if (careerYears >= 10 && /\b(downturn|recession|covid|2008|2020|2022|market volatility)\b/.test(haystack)) score += 3;

  // Penalize thin/vague profiles and negative behavioral signals.
  if (evidenceText.length < 300) score -= 7;
  if (quantCount === 0 && !/\b(revenue|ebitda|p&l|budget|team|scaled|grew|reduced|saved)\b/.test(haystack)) score -= 5;
  if (/\b(job hopper|short tenure|left after|performance issue|terminated|toxic|high attrition)\b/.test(haystack)) score -= 8;

  // Deterministic tie-break only; avoids identical imported records without overpowering evidence.
  score += stableHash([input.name, input.title, input.company, evidenceText.slice(0, 200)].filter(Boolean).join("|")) % 5;

  return Math.max(45, Math.min(99, Math.round(score)));
}
