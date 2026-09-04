# Final Fix Report

Source review: `final-review-report.md` (`b718eb3..7aa2a6a`)

Fix base: `7aa2a6a`

## Result

All ten findings from the final whole-branch review are implemented. The final automated suite passes with 150 tests and no failures, and the local-only, accessibility, deterministic-restore, storage-degradation, reduced-motion, idempotent-reward, and no-punishment behaviors remain covered.

## Finding-by-Finding Resolution

### Critical 1: Complete playable language inventory

- Added deterministic multi-skill interaction generation so every assigned Chinese character, English word, and sentence pattern appears in learner-playable semantics without expanding a lesson beyond its exact 12-interaction structure.
- Kept seeded order and restoration deterministic.
- RED: the exhaustive generation assertion reproduced the review gaps (188/700 Chinese characters, 152/300 English words, and 42/100 patterns reached by the old generator).
- GREEN: `every assigned language skill appears in playable lesson semantics with the exact block structure` passes across the complete catalog.

### Important 1: Mastery and spaced-review event model

- Changed review credit from per-interaction mutation to one event per distinct lesson completion.
- Added date and lesson-count schedules, successful due-review evidence, and immutable schedule updates.
- Mastery now requires three independent lesson events plus a successful due review; repeated interactions in one completion cannot manufacture spacing credit.
- Added compatible defaults and validation for older version-two data.
- RED: new tests failed on duplicate same-lesson credit, missing lesson-count fallback, and mastery without due-review evidence.
- GREEN: event deduplication, exact due boundaries, assisted retries, maintenance reviews, fallback scheduling, and v2 compatibility tests all pass.

### Important 2: Meaningful visual mathematics

- Replaced answer-revealing numeral prompts with semantic quantity, ruler, clock-face, and coin stimuli.
- Added tier-sensitive relational classification and spatial tasks; clock choices remain valid on a 12-hour dial while elapsed-time targets retain their intended ranges.
- Rendered generated `visualPrompt` content in the lesson view with escaping.
- RED: semantic factory assertions failed against the former bare-number prompts; the renderer-focused run was 16/17 before `visualPrompt` was displayed.
- GREEN: visual meaning, tier progression, numeric bounds, and escaped rendering assertions pass; the renderer-focused run is 35/35.

### Important 3: Sentence-pattern slot instantiation

- Deterministically fills every `{item}`, `{action}`, and related slot with compatible same-tier vocabulary.
- Completed patterns are used in role-based exchanges and no learner-facing slot markers remain.
- RED: the catalog-wide generated-content assertion found unresolved placeholders.
- GREEN: `every learner-facing sentence pattern is deterministically instantiated without slot markers` passes.

### Important 4: Natural Chinese contexts

- Replaced repeated meta-literacy and writing boilerplate with unique, short, meaning-bearing child-facing contexts.
- Removed writing-focused copy and audited weak, incomplete, and overly formal associations.
- RED: new uniqueness and language-quality assertions detected repeated boilerplate and banned writing/formal phrases.
- GREEN: all Chinese context, association, uniqueness, and scope assertions pass.

### Important 5: Placement, progression states, and replay

- Added a six-interaction balanced placement check that can move the lesson pointer forward but never records mastery, misses, rewards, or backward progress.
- Added completed, review-due, in-progress, learnable, and locked map states derived from live lesson and skill evidence.
- Completed projects expose exact learn/build/review replay; future phases remain inaccessible.
- RED: placement/progression tests initially failed because assessment and derived states did not exist; the final stale-label/phase-shortcut hardening run was 20/22.
- GREEN: placement, skip safety, five-state mapping, stale-label rejection, and exact phase replay pass; the final focused run is 31/31.

### Important 6: Persistent scene outcomes and applied vehicle upgrades

- Added an exact completed-project-to-regional-upgrade mapping and 90 persistent scene symbols, 15 per region.
- Applied earned work lights, stickers, flag, reinforced tires, paint, toolbox, medallion, and crown beacon directly to rendered vehicle artwork.
- RED: the focused scene/garage run was 16/20 with four expected failures for missing exact outcomes and unapplied parts.
- GREEN: the focused scene/garage run is 36/36, including noncontiguous completions and locked-upgrade controls.

### Minor 1: Recent repeated-hint review scheduling

- Defined recent repeated hints as at least two hint events in the rolling seven-day window.
- Persisted the two latest hint timestamps and derived course-table/map review state from current evidence; lifetime `hintCount` alone does not trigger review.
- Old v2 records normalize to an empty timestamp list and invalid arrays are rejected.
- RED: the focused scheduling/storage run was 44/50 with six expected failures.
- GREEN: the focused run is 50/50, including exact time boundaries and stale stored-label rejection.

### Minor 2: Immediate resolved snapshot persistence

- Added a sanitized `answered` snapshot field.
- A correct response now saves the locked/resolved interaction synchronously before feedback or animation, and advancement saves the following snapshot again.
- Restored resolved interactions remain locked and cannot record evidence twice.
- RED: the focused persistence run was 16/20 with four expected failures.
- GREEN: the focused run is 58/58, including old-snapshot compatibility and post-advance persistence.

### Minor 3: Sound preference synchronization

- Added immutable sound-preference synchronization across global progress and an active lesson.
- Both the utility toggle and parent settings update the active lesson, and the briefing transition cannot restore a stale preference.
- RED: the initial focused test failed 0/1 because the synchronization behavior was absent.
- GREEN: the focused game/app run is 43/43.

## Preserved Constraints

- Exact catalog counts remain six regions, 90 projects, 270 lessons, 700 Chinese characters, 300 English words, 100 sentence patterns, and the existing math inventory.
- Generation and refresh restoration remain seeded and deterministic.
- V1 migration and old-v2 compatibility remain supported; malformed data falls back without losing recoverable raw input.
- Storage exceptions retain usable in-memory progress and surface degraded availability.
- Rewards remain completion-first, idempotent, and independent of mistakes; placement cannot award or punish.
- Learner-facing dynamic text remains escaped. Assets remain local, controls retain accessible labels/touch sizes, and reduced-motion behavior remains intact.

## Final Validation

- `npm test`: 150 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo.
- `node --check src/app.js`: passed.
- `git diff --check`: passed; the staged diff is checked again before commit.
- Remote-resource audit: no remote runtime resources. The only URL-like matches are `http://www.w3.org/2000/svg` namespace declarations in the two local SVG files.
- Browser smoke check at desktop width: map layout rendered without overlap, primary navigation was available, and the placement flow opened with visible playable answers. The deeper math-interaction walkthrough was intentionally left for controller acceptance; generated visual-math markup is covered by automated tests.

## Residual Concerns

No known automated correctness failures remain. The only outstanding acceptance item is a final manual/browser walkthrough of an in-lesson math stimulus, plus optional mobile visual inspection; responsive and visual-prompt behavior is covered by automated assertions.
