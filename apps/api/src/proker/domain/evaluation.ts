/** The checklist item that saving an evaluation ticks (every template has it, checklist-templates.ts). */
export const EVALUATION_ITEM_KEY = 'evaluation';

/**
 * US-3.10 AC3: an evaluation looks back on the event, so it opens on the event day (00:00 WIB). Proyek
 * Menengah evaluates on H itself, which is why the day counts and not only the days after it.
 */
export function evaluationTooEarly(eventDate: Date | null, now: Date): boolean {
  return !eventDate || now < eventDate;
}
