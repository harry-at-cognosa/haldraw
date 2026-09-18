/**
 * Subsequence fuzzy match (0.9.15, ⌘K palette). Every query character must
 * appear in order; the score rewards a plain substring, matches at the start
 * of a word, and runs of consecutive matches, and penalises gaps. Returns
 * null when the query is not a subsequence. Case-insensitive.
 */
export function fuzzyScore(query: string, text: string): { score: number; positions: number[] } | null {
  const q = query.toLowerCase().replace(/\s+/g, '');
  const t = text.toLowerCase();
  if (!q) return { score: 0, positions: [] };
  const sub = t.indexOf(q);
  if (sub >= 0) {
    const positions = Array.from({ length: q.length }, (_, i) => sub + i);
    return { score: 1000 - sub * 2 + (isWordStart(t, sub) ? 50 : 0) + q.length * 5, positions };
  }
  const positions: number[] = [];
  let score = 0;
  let ti = 0;
  let prev = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti);
    if (idx < 0) return null;
    positions.push(idx);
    if (idx === prev + 1) score += 15;
    else score -= Math.min(20, idx - ti);
    if (isWordStart(t, idx)) score += 25;
    prev = idx;
    ti = idx + 1;
  }
  return { score: score + q.length * 5, positions };
}

function isWordStart(t: string, i: number): boolean {
  if (i === 0) return true;
  const c = t[i - 1];
  return c === ' ' || c === '_' || c === '-' || c === '/' || c === '›' || c === '.' || c === '(';
}
