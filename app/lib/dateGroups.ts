export type DateGroupKey = "today" | "week" | "older";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Regroupe une liste déjà triée (desc updatedAt) en groupes "aujourd'hui" /
 * "cette semaine" / "plus ancien", en conservant l'ordre d'origine à
 * l'intérieur de chaque groupe. Les groupes vides sont omis.
 */
export function groupByDate<T extends { updatedAt: number }>(
  items: T[],
  now: number = Date.now(),
): { key: DateGroupKey; items: T[] }[] {
  const today: T[] = [];
  const week: T[] = [];
  const older: T[] = [];

  for (const item of items) {
    const age = now - item.updatedAt;
    if (age < DAY_MS) today.push(item);
    else if (age < WEEK_MS) week.push(item);
    else older.push(item);
  }

  const groups: { key: DateGroupKey; items: T[] }[] = [];
  if (today.length) groups.push({ key: "today", items: today });
  if (week.length) groups.push({ key: "week", items: week });
  if (older.length) groups.push({ key: "older", items: older });
  return groups;
}
