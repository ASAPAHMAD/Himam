/**
 * Stable ID generation for the generic model.
 *
 * Replaces the legacy positional scheme (`pl300-s${sectionIndex}-l${lessonIndex}`)
 * described as a data-integrity risk in ARCHITECTURE.md §2: reordering content
 * under a positional scheme silently reassigns IDs and orphans saved progress.
 * IDs generated here are stable for the lifetime of the record — reordering,
 * inserting, or renaming never changes an existing entity's id.
 */
export function generateId(prefix?: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return prefix ? `${prefix}_${time}${rand}` : `${time}${rand}`;
}
