/**
 * One-time content seed: pushes the generic Course/Section/Lesson model
 * (src/models/migrateLegacy.ts — same data src/models/legacyBridge.ts already
 * uses for the local-only experience) into Supabase's shared content tables.
 *
 * Run once per environment, after applying supabase/migrations/0001_identity_persistence.sql:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seedSupabaseContent.ts
 *
 * Uses the service-role key deliberately — this bypasses RLS, which is correct
 * here: content tables have no client-side write policy (see the migration
 * file's comments), so seeding them is an admin operation, not something the
 * app itself ever does.
 */
import { createClient } from '@supabase/supabase-js';
import { buildCoursesFromLegacyData } from '../src/models/migrateLegacy';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

async function main() {
  const courses = buildCoursesFromLegacyData();

  for (const course of courses) {
    const { sections, ...courseRow } = course;
    // owner_id intentionally omitted here — defaults to NULL, meaning "shared
    // platform content" (see ARCHITECTURE.md §8.2). This seed script only
    // ever creates shared content; user-owned courses get their owner_id set
    // by whatever Phase 4 Course CRUD / AI-generation code eventually writes them.
    const { error: courseError } = await supabase.from('courses').upsert({
      id: courseRow.id,
      name: courseRow.name,
      mode: courseRow.mode,
      color: courseRow.color,
      exam_date: courseRow.examDate,
      created_at: courseRow.createdAt,
    });
    if (courseError) throw courseError;
    console.log(`PASS — upserted course ${course.id} (${course.name})`);

    for (const section of sections) {
      const { lessons, ...sectionRow } = section;
      const { error: sectionError } = await supabase.from('sections').upsert({
        id: sectionRow.id,
        course_id: sectionRow.courseId,
        name: sectionRow.name,
        order: sectionRow.order,
      });
      if (sectionError) throw sectionError;

      const lessonRows = lessons.map(l => ({
        id: l.id,
        section_id: l.sectionId,
        title: l.title,
        description: l.description,
        type: l.type,
        duration: l.duration,
        difficulty: l.difficulty,
        scheduled_date: l.scheduledDate,
        resources: l.resources,
        attachments: l.attachments,
        practice_questions: l.practiceQuestions,
        ai_summary: l.aiSummary ?? null,
        ai_explanation: l.aiExplanation ?? null,
      }));
      const { error: lessonError } = await supabase.from('lessons').upsert(lessonRows);
      if (lessonError) throw lessonError;
      console.log(`PASS — upserted section ${section.id} (${lessons.length} lessons)`);
    }
  }

  console.log('\nSeed complete.');
}

main().catch(err => {
  console.error('FAIL —', err);
  process.exit(1);
});
