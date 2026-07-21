/**
 * Verification for src/utils/time.ts, used by the study-window schedule step
 * to auto-calculate duration from start/end clock times.
 * Run with: npx tsx scripts/verifyTimeUtils.ts
 */
import { computeDurationMinutes, formatMinutes } from '../src/utils/time';

let failures = 0;
function check(label: string, pass: boolean) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label}`);
  if (!pass) failures++;
}

check('same-day window: 07:00-07:45 = 45 minutes', computeDurationMinutes('07:00', '07:45') === 45);
check('same-day window: 12:00-13:30 = 90 minutes', computeDurationMinutes('12:00', '13:30') === 90);
check('zero-length window: 09:00-09:00 = 0 minutes (treated as crossing midnight, i.e. 24h, per current rule)', computeDurationMinutes('09:00', '09:00') === 24 * 60);
check('midnight-crossing window: 23:00-01:00 = 120 minutes', computeDurationMinutes('23:00', '01:00') === 120);
check('invalid input does not throw, returns 0', computeDurationMinutes('', '') === 0 && computeDurationMinutes('bad', '07:00') === 0);

check('formatMinutes: 45 -> "45 min"', formatMinutes(45) === '45 min');
check('formatMinutes: 90 -> "1h 30m"', formatMinutes(90) === '1h 30m');
check('formatMinutes: 60 -> "1h"', formatMinutes(60) === '1h');
check('formatMinutes: 0 -> "0 min"', formatMinutes(0) === '0 min');

console.log(failures === 0 ? `\nAll checks passed.` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
