/**
 * Gamification légère : série de jours actifs et objectif hebdomadaire.
 */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Calcule la série courante de jours consécutifs avec au moins une activité (jusqu'à aujourd'hui ou hier). */
export function computeStreak(activityDates: Date[], now = new Date()): { current: number; longest: number; activeToday: boolean } {
  const days = new Set(activityDates.map(dayKey));
  const today = dayKey(now);
  const activeToday = days.has(today);

  // Série courante : on part d'aujourd'hui (ou d'hier si rien aujourd'hui)
  let cursor = new Date(now);
  if (!activeToday) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let current = 0;
  while (days.has(dayKey(cursor))) {
    current++;
    cursor = new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // Plus longue série
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of sorted) {
    if (prev) {
      const p = new Date(prev);
      p.setUTCDate(p.getUTCDate() + 1);
      run = dayKey(p) === key ? run + 1 : 1;
    } else run = 1;
    longest = Math.max(longest, run);
    prev = key;
  }
  return { current, longest: Math.max(longest, current), activeToday };
}

/** Début de la semaine (lundi 00:00 UTC). */
export function startOfWeek(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

export function weeklyProgress(done: number, goal: number): { done: number; goal: number; percent: number; remaining: number; message: string } {
  const percent = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  const remaining = Math.max(0, goal - done);
  let message: string;
  if (percent >= 100) message = "Objectif atteint. Tu peux lever le pied ou viser plus haut.";
  else if (percent >= 70) message = `Plus que ${remaining} pour atteindre ton objectif.`;
  else if (percent >= 30) message = "Bon rythme. Garde le cap cette semaine.";
  else message = "La semaine démarre : chaque candidature compte.";
  return { done, goal, percent, remaining, message };
}
