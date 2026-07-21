# Product Spec — Study Plan

This is the product definition: what Study Plan is, who it's for, and what it does — independent
of how it's implemented. `ARCHITECTURE.md` is the technical companion and is written to match this
document; if the two ever disagree, this document wins.

Status: **draft, pending approval.** No implementation begins until this is approved.

---

## Vision

Most people preparing for a certification, exam, or structured learning goal end up managing it
across scattered tools: a course platform's own progress bar, a notes app, a calendar they built
by hand, a spreadsheet of topics, sticky notes for what they got wrong. None of these talk to each
other, none of them adapt when life happens, and none of them tell you whether you're actually on
pace to finish before the exam.

**Study Plan is a single place to plan, study, and track progress toward any certification, course,
or learning goal** — generated automatically from what you're studying and how much time you have,
or built by hand if you'd rather control it yourself. It turns "I need to learn X before date Y"
into a day-by-day plan, keeps that plan honest when a day gets missed, and shows you — clearly,
without guesswork — whether you're ahead, on track, or behind.

The problem it solves is not "track my study time." It's: **planning a multi-week or multi-month
learning goal is its own skill, and most learners don't have it or don't have time to do it well.**
Study Plan does that planning work so the learner's only job is to open the app and do the next
thing.

---

## Target Users

- **Professionals** pursuing a job-relevant certification (e.g. a Power BI or PM certification)
  around a full-time work schedule.
- **University students** managing coursework, exams, and study sessions across multiple classes.
- **Certification candidates** for standardized, high-stakes exams (cloud, security, PM, finance,
  language) with a fixed exam date and a large, structured body of content to cover.
- **Corporate employees** working through mandated or recommended training as part of a role or
  career path.
- **Self-learners** working through a book, a YouTube playlist, or a self-directed curriculum
  with no institutional structure at all.

What these have in common, and what the product is designed around: a **defined body of content**,
a **real-world time constraint** (a job, a semester, a family, a deadline), and a need to know
**whether they're going to make it in time** — not just a log of what they've done.

---

## Core Features

### Dashboard
The daily entry point. Shows today's planned sessions, current streak, hours studied, overall
progress across all active courses, upcoming revision, and a short set of coaching signals (pace
status, flagged difficulties, recurring mistakes) generated from the user's own activity — not
generic tips.

### Study Plan
The day-by-day and week-by-week view of what's scheduled: which lessons, in which study window,
for how long. This is the operational surface — check something off, jump into a lesson, see
what's next.

### Calendar
Month/week view of the full plan: study days, revision days, exam date, vacation, holidays, and
missed vs. completed sessions, distinguished visually. Answers "what does the next 6 weeks look
like," not just "what's today."

### Statistics
Trends over time: hours studied, lessons completed, streak history, per-course completion,
difficulty distribution, average session length. Answers "am I actually improving my pace," not
just a single snapshot.

### Wrong Answers
A running journal of missed practice/quiz questions, with the question, why it was missed, the
correct answer, and the topic — searchable and reviewable on its own, and feeding back into
Dashboard coaching signals (repeated misses on the same topic get surfaced).

### Achievements
Milestones and recognition for consistency and completion (streaks, course milestones, XP/level
progression). Exists to sustain motivation over a multi-week or multi-month plan, not as a
separate gamified product.

### Career Roadmap
The bigger-picture view connecting the current course(s) to the user's stated career goal —
where this certification sits in a longer sequence, and what typically comes next. Personal to
the user's stated goals, not a fixed template.

### Settings
Profile editing, data export/import (backup), and preferences. No hidden global config; anything
that affects planning is visible and editable here.

---

## AI Features

Two planning modes, switchable at any time without losing existing course data:

1. **AI-Generated Study Plan** — the user provides a certification name, a course URL, a pasted
   topic list, or similar source material. The system extracts topics, builds sections and
   lessons, estimates duration and difficulty per lesson, and schedules everything against the
   user's profile (working days, vacation, study windows, exam date).
2. **Manual Study Plan** — the user builds courses, sections, and lessons by hand, with full
   control over content, ordering, and scheduling.

A course created in one mode is not locked to it: a manually-built course can have AI fill in
additional sections later; an AI-generated course can be hand-edited freely afterward. The mode
is a starting point, not a permanent constraint.

Beyond plan generation, AI assists at the lesson level: explaining a concept, summarizing notes,
and generating a short practice quiz — available per-lesson, on demand, not automatically applied
to every lesson (to control cost and avoid noise).

The existing lightweight coaching commentary on the Dashboard (pace status, flagged difficulty,
recurring mistakes) stays and evolves as part of V1. A persistent, multi-turn conversational **AI
Coach** you chat with over time is a **Future SaaS Feature** (see below), not V1 — V1's AI features
are single-purpose and on-demand, not an open-ended assistant.

---

## Course System

The application supports **unlimited** courses, sections, lessons, resources, notes, videos,
practice exams, flashcards, and attachments. There is no fixed list of supported certifications —
PL-300 and PMI-PBA become two examples among an open set, not special-cased in the product.

A course is a container (a certification, a class, a book, a language, a custom path). A course
has sections; a section has lessons; a lesson has resources, notes, and optional practice content.
This nesting is the same regardless of subject matter — a language-learning course and a cloud
certification use the identical structure.

---

## Lesson Structure

Each lesson supports:

- Title
- Description
- Course (via its section)
- Section
- Duration
- Difficulty
- Status (not started / in progress / completed / skipped)
- Priority
- Bookmark
- Notes
- Revision (a scheduled follow-up, engine-suggested after completion, user-adjustable)
- Resources (see Resource Types)
- Attachments
- Practice Questions
- AI Summary (on demand)
- AI Explanation (on demand)

---

## Resource Types

A lesson can contain multiple resources, of any of these types:

- YouTube
- Microsoft Learn
- Udemy
- Coursera
- PDFs
- Books
- Articles
- GitHub
- Labs
- Custom URLs

Resources are references (title + link, or title alone for non-linkable items like a physical
book), not embedded/hosted content — Study Plan organizes and schedules learning, it does not
replace the source platform.

---

## Scheduling Engine

Fully generic — no fixed dates, no fixed course pair, no fixed session split. It supports:

- Working days (user-defined, not fixed to any specific week pattern)
- Weekends (derived from working days, not separately configured)
- Holidays (discrete non-working dates)
- Vacation (date ranges)
- Exam dates (per course, drives urgency/prioritization)
- Daily study hours (per study window — e.g. morning/lunch/evening/weekend, each with its own
  time budget)
- Multiple study sessions per day
- Missed sessions (detected automatically, not manually flagged)
- Automatic rescheduling (missed lessons roll forward into the next available window)
- Revision sessions (proposed automatically after a lesson is completed, at a spaced interval)

The engine works identically for one course or many, and for any date range — it has no knowledge
of any specific certification, employer, or calendar year.

---

## User Profile

Configured once at onboarding, editable anytime in Settings:

- Name
- Country
- Timezone
- Career Goal
- Current Job
- Target Job
- Current Salary
- Target Salary
- Certifications (the courses/certifications this profile is actively working toward)
- Working Days
- Vacation
- Preferred Study Hours
- Learning Style

Salary fields are optional context used only to frame the Career Roadmap view — never required to
use the rest of the app, and never sent anywhere except an AI prompt the user explicitly triggers.

---

## Future SaaS Features

The architecture is being built so these can be added later **without a rewrite** — none are
built in V1:

- User accounts
- Cloud synchronization
- Multiple devices
- Team workspaces
- Shared study plans
- Persistent, conversational AI Coach
- Mobile applications
- Offline mode
- Notifications

---

## Non-Goals (V1)

Explicitly **not** built in Version 1, so scope stays clear:

- **User accounts / authentication.** V1 is local-first, single browser/device, no login. (Listed
  under Future SaaS Features above — this is the same item, stated here as a hard V1 boundary.)
- **Cloud sync / multi-device.** No backend data store in V1; everything lives in the browser.
- **Team workspaces / shared plans.** V1 is single-user only; no sharing, no collaboration, no
  visibility into anyone else's plan.
- **Native mobile apps.** V1 is a responsive web app; no iOS/Android build.
- **Offline mode / PWA install.** Not addressed in V1 beyond whatever the browser does by default.
- **Push notifications / reminders.** No notification system in V1 — the Dashboard is the
  reminder.
- **Billing, subscriptions, or paid tiers.** No payment integration in V1; monetization is a
  separate, later decision.
- **File upload / hosted attachments.** Attachments in V1 are external URLs only — no file storage
  service.
- **Automatic import from Udemy/Coursera/YouTube via their APIs.** AI-generated plans work from a
  name, URL, or pasted list the user provides and interprets with AI — not a live integration that
  reads a real course platform's structure automatically.
- **Persistent conversational AI Coach.** V1's AI features are on-demand and single-purpose
  (generate plan, explain, summarize, quiz) — not an ongoing chat relationship.
- **Custom branding / white-labeling.** One product, one visual identity (black/gold), not
  configurable per user in V1.

---

## Changelog of this document

- **Phase 0** — initial draft, written to define product scope prior to the Phase 1 architecture
  refactor. Pending approval.
