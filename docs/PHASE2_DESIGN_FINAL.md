# Phase 2 E2E QA Infrastructure - Status & Design (2026-02-15)

## Overview

Phase 2 E2E QA setup is **infrastructure-ready** for execution. The design avoids DB schema changes by using Test duplication (A/B via separate Tests).

---

## ✅ Completed

### Backend API Layer
- ✅ Fixed 500 errors: `student.name` → `student.email`, `HttpResponse` import
- ✅ Fixed run_params parsing: `schedule.start_at/end_at`, `attempts.default_max_attempts`
- ✅ Fixed Teacher permission checks: email-based (not `user_id` FK)
- ✅ Fixed zoneinfo: replaced `pytz` with stdlib `zoneinfo.ZoneInfo`
- ✅ Fixed serializer: `self.TestAssignmentParamsV1` class reference

### Frontend UI Layer
- ✅ `/teacher/tests` lists tests with "詳細" button
- ✅ `/teacher/tests/[testId]` shows detail + assignment form + list
- ✅ Assignment creation form with date/attempt defaults
- ✅ `/teacher/test-assignments/[id]/results` shows results + CSV download

### Security & Architecture
- ✅ Same-origin enforcement: Browser only calls `http://localhost:3000/api/*`
- ✅ Proxy cookie forwarding: enables session-based auth
- ✅ DRF path normalization: auto-trailing-slash for POST/PUT/PATCH

### Test A/B Setup
- ✅ Created `backend/quiz/management/commands/duplicate_test.py`
- ✅ Generated **E2E_Quiz_TestA** (ID: `d86eb90e-2944-44cf-9813-3c1b59e89ff5`)
- ✅ Generated **E2E_Quiz_TestB** (ID: `11952b52-cdbd-472e-bbd2-c0066d40b13c`)
- ✅ Both have 6 identical questions, 0 assignments (clean slate)

---

## 🎯 Design Decisions

### Why Test Duplication (Not Migration)?

| Aspect | Test Duplication | Migration |
|--------|-----------------|-----------|
| **Risk** | Minimal (no schema change) | High (concurrent fixes) |
| **Speed** | Immediate (script execution) | Slow (testing cycle) |
| **Reversibility** | Delete test = undo | Rollback complexity |
| **Phase 2 Goal** | ✅ Sufficient (problems identical) | Overkill (problems identical) |

### A/B Design

```
TestA (Problem: English→日本語)
  ├─ 6 Questions (identical to TestB)
  └─ AssignmentA (max_attempts=2)
      └─ StudentX (attempt count tracked)

TestB (Problem: English→日本語)  ← Same questions, separate Test
  ├─ 6 Questions (identical to TestA)
  └─ AssignmentB (max_attempts=3)
      └─ StudentX (attempt count tracked separately)

Unique constraint (test, student) works ✅
  - TestA + StudentX = 1 record
  - TestB + StudentX = 1 record (separate)
```

---

## ⚠️ Known Limitations

### Current (No Migration)
- **Cannot assign same test to same student twice** (unique constraint blocks it)
- **Solution**: Use separate Tests (TestA, TestB) with identical questions ✓

### Future (If Requirements Change)
- To assign same test with different params to same student:
  - Change unique constraint: `(test, student)` → `(test_assignment, student)`
  - Requires migration + results query refactoring
  - Not needed for Phase 2 QA (A/B via duplicate Tests is sufficient)

---

## 📋 Command Reference

### Django Management Command (Recommended)

```bash
# Preview (no creation)
python manage.py duplicate_test <SOURCE_ID> --dry-run

# Create with suffix
python manage.py duplicate_test <SOURCE_ID> --title-suffix " (B)"

# Create with custom title
python manage.py duplicate_test <SOURCE_ID> --new-title "My Custom Title"

# Force create (overwrite if title exists)
python manage.py duplicate_test <SOURCE_ID> --force

# Show help
python manage.py duplicate_test --help
```

### Via Docker

```bash
docker compose exec -T backend python manage.py duplicate_test <SOURCE_ID> --dry-run
docker compose exec -T backend python manage.py duplicate_test <SOURCE_ID> --title-suffix " (C)"
```

---

## 🔐 Security Principles

### DO ✅
- Use environment variables for sensitive data: `QA_SEED_TEACHER_EMAIL`, `QA_SEED_STUDENTS`
- Store secrets in `.env` (git-ignored)
- Use management commands (reproducible, no hardcoding)
- Document with placeholder examples: `student@example.com`

### DON'T ❌
- Embed personal emails in code: `fukuik19@gmail.com`
- Put tokens in docs: `Bearer <actual_token>`
- Hardcode UUIDs in reusable scripts
- Commit `.env` file (use `.env.example`)

---

## 🧪 Test Scenarios (Ready to Execute)

### Scenario A: Standard A/B Test
```
1. Create Assignment for TestA (max_attempts=2)
2. Create Assignment for TestB (max_attempts=3)
3. Submit quiz responses from StudentX
4. Verify TestA score + attempt count
5. Verify TestB score + attempt count
```

### Scenario B: Multiple Groups
```
1. Duplicate TestA → TestA_GroupB
2. Create AssignmentA for Group1 (students: S1-S3)
3. Create AssignmentB for Group2 (students: S4-S6)
4. Submit responses per group
5. Compare results by assignment
```

---

## 📊 Current State

### Database
```
Tests:
  ✅ E2E_Quiz_TestA         (6Q, 0A, 0R)
  ✅ E2E_Quiz_TestB         (6Q, 0A, 0R)
  ✅ E2E用テスト             (6Q, 3A, ?)

Note: Q=Questions, A=Assignments, R=Results
```

### API Endpoints
| Method | Path | Status |
|--------|------|--------|
| GET | `/api/tests/` | ✅ 200 |
| GET | `/api/tests/{id}/` | ✅ 200 |
| POST | `/api/test-assignments/` | ✅ 201 |
| GET | `/api/teacher/test-assignments/` | ✅ 200 |
| GET | `/api/teacher/test-assignments/{id}/results` | ✅ 200 |
| GET | `/api/teacher/test-assignments/{id}/results.csv` | ✅ 200 |

### UI Pages
| Route | Status | Notes |
|-------|--------|-------|
| `/teacher/tests` | ✅ Ready | List with detail button |
| `/teacher/tests/[testId]` | ✅ Ready | Detail + create form + list |
| `/teacher/test-assignments/[id]/results` | ✅ Ready | Results table + CSV |

---

## 🚀 Next Steps

### Immediate (Required for Phase 2 Launch)
1. **UI Flow Test**: Execute `tests → detail → create → results` in browser
2. **Verify No 404/500**: Check Network tab, console for errors
3. **Confirm Idempotency**: Test `--dry-run`, then `--force` duplicate

### Short-term (Nice-to-have, Time Permitting)
1. **Seed Automation**: `.env` variables for teacher/students
2. **Debug Safety**: Guard `/api/debug/*` with `DEBUG=True`
3. **Student E2E**: Test full submission flow (optional)

### Long-term (If A/B Within Same Test Required)
1. Create migration: change unique constraint
2. Update results aggregation queries
3. Re-test assignment scoping
4. Expected effort: 2-4 hours

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| **QUICK_START.md** | Entry point: commands + browser flow |
| **BROWSER_TEST_GUIDE.md** | Step-by-step UI testing checklist |
| **E2E_QA_AB_SETUP.md** | Detailed design + limitations |
| **This file** | Architecture overview + decisions |

---

## ✨ Key Insight

> "A/B testing doesn't require same-test-different-params. It only requires measuring identical problems under different conditions. We achieve this by duplicating Tests (separate IDs, identical questions) and separate Assignments. DB schema unchanged, zero migration risk, full Phase 2 QA capability."

---

**Status**: Infrastructure complete. Browser validation pending.  
**Timeline**: UI test (1 hour) → clean-up (1 hour) → phase 2 launch ready.
