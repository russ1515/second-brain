import type { PronunciationWord } from '@second-brain/shared';

/**
 * Word-level alignment between a target phrase and what the recogniser heard,
 * via Levenshtein edit distance with backtrace.
 *
 * This is deliberately deterministic and testable — the accuracy figure must not
 * be an LLM's opinion. It measures INTELLIGIBILITY (was the speech recognised as
 * the target?), not phoneme quality; see PronunciationAssessment for why.
 */

/** Case/punctuation/whitespace only. Diacritics are preserved on purpose: in
 *  most languages they mark a real distinction, and silently folding them would
 *  score a wrong word as right. */
export function normalizeWords(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .replace(/[.,!?;:¡¿"'`()[\]{}…—–-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

type Op = 'match' | 'sub' | 'del' | 'ins';

interface Cell {
  cost: number;
  op: Op | null;
}

export interface Alignment {
  words: PronunciationWord[];
  /** Edit distance between the two word sequences. */
  distance: number;
  /** 0..1 — 1 - (distance / target length), clamped. */
  accuracy: number;
}

export function alignWords(target: string, heard: string): Alignment {
  const t = normalizeWords(target);
  const h = normalizeWords(heard);

  if (t.length === 0) {
    return { words: [], distance: 0, accuracy: 0 };
  }

  // grid[i][j] = best cost to turn t[0..i) into h[0..j)
  const grid: Cell[][] = Array.from({ length: t.length + 1 }, () =>
    Array.from({ length: h.length + 1 }, () => ({ cost: 0, op: null as Op | null })),
  );
  for (let i = 1; i <= t.length; i++) grid[i][0] = { cost: i, op: 'del' };
  for (let j = 1; j <= h.length; j++) grid[0][j] = { cost: j, op: 'ins' };

  for (let i = 1; i <= t.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      const same = t[i - 1] === h[j - 1];
      const diagonal = grid[i - 1][j - 1].cost + (same ? 0 : 1);
      const deletion = grid[i - 1][j].cost + 1; // target word not heard
      const insertion = grid[i][j - 1].cost + 1; // extra word heard
      const best = Math.min(diagonal, deletion, insertion);
      grid[i][j] = {
        cost: best,
        op: best === diagonal ? (same ? 'match' : 'sub') : best === deletion ? 'del' : 'ins',
      };
    }
  }

  // Walk back to build the per-word report, target-aligned.
  const words: PronunciationWord[] = [];
  let i = t.length;
  let j = h.length;
  while (i > 0 || j > 0) {
    const op = i === 0 ? 'ins' : j === 0 ? 'del' : grid[i][j].op;
    if (op === 'match' || op === 'sub') {
      words.push({
        expected: t[i - 1],
        heard: h[j - 1],
        correct: op === 'match',
      });
      i--;
      j--;
    } else if (op === 'del') {
      // A target word that never showed up in the transcript.
      words.push({ expected: t[i - 1], heard: null, correct: false });
      i--;
    } else {
      // An extra word the learner said; it has no target slot, so it only costs
      // distance rather than appearing in the target-aligned report.
      j--;
    }
  }
  words.reverse();

  const distance = grid[t.length][h.length].cost;
  const accuracy = Math.max(0, Math.min(1, 1 - distance / t.length));
  return { words, distance, accuracy };
}
