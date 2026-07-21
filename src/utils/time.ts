/**
 * Computes minutes between two "HH:MM" 24-hour times. Handles the case where
 * end is earlier than start by treating it as crossing midnight (e.g.
 * 23:00–01:00 = 120 minutes) rather than returning a negative/nonsensical
 * value — study windows spanning midnight are unusual but not invalid.
 */
export function computeDurationMinutes(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  if ([startH, startM, endH, endM].some(n => n === undefined || Number.isNaN(n))) return 0;

  const startTotal = startH * 60 + startM;
  let endTotal = endH * 60 + endM;
  if (endTotal <= startTotal) endTotal += 24 * 60; // crossed midnight
  return endTotal - startTotal;
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0 min';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
