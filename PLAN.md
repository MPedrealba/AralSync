# AralSync — Project Plan Tracker

> **Last updated:** 2026-09-12
> Living status file. When a phase or item is done, mark it `[x]` here. When asked "what's next", read this file.

## Status: ALL 7 PHASES IMPLEMENTED ✅ / finishing list below

---

## ✔ ACCOMPLISHED PHASES

### Phase 1 — Foundations ✅
- [x] Shared auth helpers: `src/lib/auth.ts`, `src/lib/api.ts`
- [x] Model extensions: `Assessment`, `LearnerRecord`
- [x] New models: `Recommendation.js`, `AnswerKey.js`, `ReadingPassage.js`, `Question.js`
- [x] Richer seed (`database/seedUsers.js`) — students, sections, risk/mastery, spread-out assessment dates, interventions, catalog

### Phase 2 — Teacher Dashboard + Learners ✅
- [x] `GET /api/teacher/dashboard` — live weekly aggregation + recent OMR scans
- [x] `GET /api/teacher/learners`, `GET /api/teacher/learners/[id]`
- [x] Wired: dashboard, learners list, learner detail

### Phase 3 — Teacher Analytics & Interventions ✅
- [x] skill-gap, learning-recovery, progress-monitoring, interventions (GET/POST/PATCH), recommendations (GET/assign)
- [x] Wired: all 5 pages, Complete/Assign buttons live

### Phase 4 — Teacher Assessments ✅
- [x] OMR Results history + Answer Keys (GET/POST) — "Start Scanning" dead button fixed
- [x] **Reading Fluency: real Groq Whisper speech-to-text + full Phil-IRI** (Independent/Instructional/Frustration/Non-Reader, miscue formula, comprehension SRT) — beyond original plan
- [x] Comprehension with real passages (ReadingPassage.questions)

### Phase 5 — Principal sub-pages ✅
- [x] at-risk-learners, progress-trends, reading-levels, subject-analysis, learner-records, user-management, reports
- [x] Wired: all 7 pages

### Phase 6 — Student role + Reports ✅
- [x] Student APIs (assessments, interventions) + all 5 student pages wired
- [x] Teacher reports page + client-side print/PDF

### Phase 7 — Polish & UI ✅
- [x] Loading/error/empty states standardized across pages
- [x] Royal-blue theme standardized (commit `9624877`)
- [x] Logout fixed in all 3 sidebars + `POST /api/auth/logout` (clears HttpOnly cookie)

---

## Recent extensions (2026-09-12)
- [x] **Phil-IRI combined reading level + comprehension realignment.** New `combinedReadingLevel(accuracy, comprehension)` in `src/lib/reading.ts` (official joint table; stricter measure wins — both must clear to be promoted); persisted as `Assessment.combinedLevel` on the COMPREHENSION assessment by both teacher/student analyze routes; shown as a "Phil-IRI Combined Level" badge in the teacher reading-fluency result and a "Combined (IRI)" column in coordinator learner-records.
- [x] **Comprehension now belongs to Reading (Science comprehension removed).** Seed + DB: comprehension is always `subject:'Reading'`, competency `'Reading Comprehension'` (was `subject:'Science'` / Life/Physical Science — removed). One-off migration: `node database/migrateSciToReading.js`. Skill-gap now shows **Reading Comprehension** as its own card in Reading competencies; fluency de-duplicated (stored + competency-less fluency rows merge via a `$project`-normalized `competency` before grouping, so "Oral Reading Fluency" no longer appears twice).

## Recent extensions (2026-09-09)
- [x] **FR2 — Teacher Excel bulk learner import (DONE).** `xlsx` (SheetJS). Teacher → Learners → **Import from Excel**: choose .xlsx/.xls/.csv → **preview** (auto-detected columns, per-row status New / Already-in-system / Invalid, counts) → **commit**. Creates a student `User` (username **and** password = LRN) + `LearnerRecord` per new row. Duplicates skipped + reported (never overwritten); invalid rows reported. New `GET /api/teacher/learners/import/template` downloads a template. **Manual correction** now works too: new `PATCH /api/teacher/learners/[id]` + wired `EditLearnerModal` (risk select fixed to DB enums). End-to-end verified (preview counts, commit, PATCH persist, student login with LRN, template xlsx).

## Recent extensions (2026-09-06)
- [x] **Comprehension check as an OMR exam** — Reading Passage mode added to OMR Generate Questionnaire. Teacher picks a passage/module → `POST /api/teacher/questionnaire/generate-reading` builds a Reading-Comprehension questionnaire (uses the passage's embedded comprehension questions when present, else auto-generates cloze MCQs grounded in the text), saves the answer key (subject `Reading`), and reuses the existing Print-Questionnaire / Print-Bubble-Sheet pipeline so students can bubble their comprehension check and it can be scanned/OMR-scored like any exam.

## Phase A — OMR core (new 2026-09 vision) 
New vision: 50-item OMR exams (auto-generated from bank OR teacher-uploaded), **hybrid MC + written scoring**, reading-exam results → Phil-IRI, mobile-first student side, Reports & Analytics (teacher+principal).

- [x] **OMR scanner fixes** — scan now sends the correct subject (derived from competency) and grades against the real, teacher-selected AnswerKey (fallback: most-recent key for that subject) instead of a hardcoded 20-item key.
- [x] **50-item auto generator** — `POST /api/teacher/questionnaire/generate` clamps count to [1,50], guards with a clear 400 when the bank is too small, difficulty-balanced sampling (easy/mid/hard round-robin), `writtenCount` support, saves AnswerKey with `modes[]` + `writtenItems[]`.
- [x] **Question bank expanded** — `database/seedUsers.js` seeds 51–63 questions per subject×grade combo (Math + Science, G7–G10) so 50-item exams generate everywhere.
- [x] **Teacher upload exam** — `CustomExam` model + `POST/GET /api/teacher/exams`; teacher builds a custom exam (MC + written items) in the UI; auto-creates an AnswerKey so uploaded exams scan/OMR-score; full print pipeline (questionnaire + bubble sheet) handles written items.
- [x] **Hybrid grading (backend)** — `GET /api/teacher/assessments` enriched with `mcTotal/scoredItems/writtenMax/writtenScore/gradingStatus/writtenItems`; new `PATCH /api/teacher/assessments/[id]/written` recomputes `(mcCorrect + writtenScore)/totalItems`, flips `gradingStatus`→`complete`, refreshes mastery, audits.
- [x] **Hybrid grading (teacher UI)** — OMR Results tab shows MC-vs-written breakdown for `partial` rows + "Grade Written (N)" button opening a per-item scoring modal → PATCH. Auto-generate panel has a "Written Items (teacher-graded)" control (≤ item count) so teachers can request hybrid exams; MC items auto-grade on scan, written items show a fill-in line and surface in the grading modal.
- [x] **Fix modes/answers misalignment (bug)** — `generate` route stored AnswerKey `modes` in pick-order but `answers` in display-order (difficulty sort permutes them). Now stored as `displayModes` so `modes[i]` ↔ `answers[i]` ↔ `writtenItems[].index` agree; OMR scan classifies MC/written correctly.
- [ ] **Phase B** — reading-exam results → Phil-IRI metrics (LearnerRecord fields + approval side-effect).
- [ ] **Phase C** — Reports & Analytics page (teacher + principal, shared component, time filters incl. BOSY/MOSY/EOSY / week / month).
- [ ] **Phase D** — student mobile-first (bottom tab bar, responsive grids).

> ⚠️ **Deployment note:** Mongoose strict mode drops unknown fields — when model schemas change (AnswerKey `modes/writtenItems`, `CustomExam`, Assessment hybrid fields), the dev server **must be restarted** (`npm run dev`) or the new fields silently won't persist.

## ⏳ REMAINING / NOT ACCOMPLISHED

- [ ] **Verify logout fix end-to-end** — code done, not yet confirmed in running app: click Logout → should land on `/login` without bouncing back.
- [x] **Non-Reader bucket on Principal → Reading Levels** — DONE. API now counts Non-Reader (<80% Phil-IRI) and the page shows it in the 4th stat card, donut, stacked bar + legend, and grade-table column. Dominant-level logic includes it too.
- [ ] **Forgot password? on login page** — still a placeholder (`href="#"`, `src/app/login/page.tsx:234`). User said handle later. Options: remove it, or add a stub page.
- [ ] **Final capstone demo walk-through** — log in as `teacher1`/`principal1`/`student1` (pw `123456`), drill one analytics + one reports page per role, end with a live OMR scan + reading-fluency run updating the dashboard.

## Dead-link audit (done 2026-09-05) ✅
- [x] **Profiles built** — `GET /api/auth/me` (returns id/username/name/role/email/active/createdAt) + `src/components/Profile.tsx` + `/dashboard/profile` + `/principal/profile`. Previously-dead "My Profile" sidebar links now resolve.
- [x] **"Upload Audio" wired** — teacher dashboard header button now links to `/dashboard/reading-fluency` (was disabled/"coming soon"; Groq Whisper already live there).
- [x] **"View Analytics" wired** — OMR recent-scans row button now links to `/dashboard/omr-assessments` (was disabled/"coming soon").
- [x] Student sidebar "My Profile" → `/student` is not dead (resolves). Left as-is.
- Note: `PrincipalHeader`/`Header` bell icons are decorative (no onClick). Not addressed.

## Capstone Paper Alignment (analyzed 2026-09-05) 
Source of truth: `context/AralSync_ ... (4).pdf` — title proposal, EARIST BS-IT 2026 (Pedrealba, Cruz, Navidad, Sumile). Paper specifies: MERN + separate Python AI microservice (OpenCV OMR, Whisper + Librosa reading assessment, scikit-learn K-Means), ISO/IEC 25010:2011 evaluation, 3 roles (Teacher / Beneficiary / Coordinator).

### Gaps between paper and built app — resolved 2026-09-08 ✅
- [x] **OMR is real CV** — DONE 2026-09-08. `python-service/app/omr.py` (OpenCV) does fiducial detection → perspective warp → bubble grid → disk-mask fill scoring; `POST /omr/detect`; wired into `src/app/api/teacher/omr/route.ts` (falls back to simulation only if the Python service is down). Verified on synthetic 6-question sheet: Q1=C Q2=A Q3=blank Q4=D Q5=B Q6=A all correct.
- [x] **Python AI microservice** — DONE 2026-09-08. FastAPI service at `python-service/` (port 8000, `PYTHON_SERVICE_URL`): OpenCV OMR (`app/omr.py`), Librosa reading features — pause/silence/pacing/hesitation (`app/reading.py`, portable ffmpeg at `python-service/ffmpeg/bin/ffmpeg.exe`), scikit-learn K-Means (`app/cluster.py`) now feeding Principal → Subject Analysis Learner Groups. Next.js routes call it with simulation fallbacks. Whisper STT still Groq-assisted (paper-acceptable: Whisper API ≈ Whisper). Env: `python-service/.venv`, `start.bat`/`start.sh`.
- [x] **K-Means learner grouping** — FR9: DONE. `src/app/api/principal/subject-analysis/route.ts` now clusters learners (K=3, k-means++ init) over per-subject averages; Principal → Subject Analysis has a "Learner Groups" panel (High Performing / On Track / Needs Support) with member chips. (In-process JS K-Means, not sklearn — see Python-service gap.)
- [x] **Reading metric is Word Error Rate** — DONE. `src/lib/reading.ts` adds `werFor()` (Levenshtein WER); both teacher + student reading-analyze routes compute and persist `wer`; UI shows it (teacher report modal, student result panel + history WER column).
- [x] **Teacher validation step** — DONE. `Assessment.status` (`pending|approved|flagged`) + `Intervention.reviewed`; new `PATCH /api/teacher/assessments/[id]`; teacher reading-fluency report modal has Approve/Flag; teacher Interventions shows Needs-review / Approve on learner-completed items.
- [x] **Audit_Log entity** — DONE. New `models/AuditLog.js` + `src/lib/audit.ts` (best-effort); logged at login (all roles), teacher OMR upload, teacher+student reading analysis, intervention updates (teacher + student), assessment validation. New Principal → Audit Log page (role/action filters, latest 200).
- [x] **Coordinator vs Principal naming** — DONE 2026-09-11/12. Real `coordinator` role + login + `/coordinator` route group + `/api/coordinator/*` namespace (see label below). Coordinator owns account management (create/edit/disable/delete), has its own analytics suite (reading-levels, subject-analysis, at-risk-learners, progress-trends), rich Learner Records (full profiles: guardian/contact/address/mastery + assessment history), audit-log, and account-overview dashboard. Principal is read-only on accounts. Login route now rejects disabled (`active:false`) accounts → 403.
- [x] **Learner self-service (recording upload / activity submit)** — FR6/FR14/FR18: DONE. Student Reading Fluency gets a recorder (mic → MediaRecorder → `/api/student/reading/analyze`, shared Phil-IRI pipeline, results start `pending`); Student Interventions gets "Mark as Done" (`PATCH /api/student/interventions/[id]`, ownership-checked). Assessments stay scoped to the JWT identity.

### Partially covered / by design
- Intervention pre/post recovery comparison → progress-monitoring timeline exists (partial).
- Exact score thresholds, mastery cutoffs, K value → NOT specified in paper; open implementation decisions.
- No LIS / third-party LMS integration → respected (self-contained app).

---
## Out of scope (deliberately)
- Full reading passage bank
- Real server-rendered PDF (client-side print/PDF used)

## Credentials
- Seeds: `teacher1` / `principal1` / `coordinator1` / `student1`, password `123456`
- `.env`: MONGODB_URI, PORT=3000, GROQ_API_KEY (do not commit `.env`)