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

export function calculateCandidateMatchScore(input: ScoreInput): number {
  const tags = parseTags(input.tags);
  const haystack = [
    input.name,
    input.title,
    input.company,
    input.location,
    input.email,
    input.linkedin,
    input.notes,
    input.skillsets,
    ...tags,
  ].filter(Boolean).join(" ").toLowerCase();

  let score = 62;

  if (/\b(cfo|chief financial|chief accounting|cao|controller|vp finance|finance)\b/.test(haystack)) score += 10;
  if (/\b(ceo|president|coo|cto|chief|vp|vice president|director|head of)\b/.test(haystack)) score += 8;
  if (/\b(pe|private equity|portfolio|backed|sponsor|value creation|turnaround|carve-out|exit|ebitda)\b/.test(haystack)) score += 9;
  if (/\b(healthcare|manufacturing|industrial|energy|fintech|software|saas|technology|accounting|sec reporting)\b/.test(haystack)) score += 5;
  if (/\b(ipo|m&a|acquisition|integration|restructuring|transformation|audit|tax|treasury|capital)\b/.test(haystack)) score += 5;
  if (input.linkedin) score += 3;
  if (input.email) score += 2;
  if (input.location) score += 2;
  if (tags.length >= 3) score += 4;

  // Add deterministic variance so imported Loxo records do not all collapse to the default.
  score += stableHash([input.name, input.title, input.company].filter(Boolean).join("|")) % 11;

  return Math.max(55, Math.min(98, score));
}
