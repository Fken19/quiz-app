# E2E QA Setup Progress - 2026-02-15

## 🎯 Goal
Establish a repeatable E2E QA environment without DB schema changes, using Test duplication (A/B separation).

---

## ✅ Completed

### Infrastructure Layer (DB/API)
- ✅ Fixed 500 errors: student.name → student.email, HttpResponse import
- ✅ Fixed run_params parsing: schedule.start_at/end_at, attempts.default_max_attempts
- ✅ Fixed Teacher permission: email-based (not user_id FK)
- ✅ Fixed pytz dependency: zoneinfo.ZoneInfo (stdlib)
- ✅ Fixed serializer NameError: self.TestAssignmentParamsV1

### Same-Origin Security
- ✅ Browser only calls http://localhost:3000/api/*
- ✅ Proxy cookie forwarding enabled
- ✅ DRF path normalization (auto-trailing-slash)

### UI Navigation
- ✅ /teacher/tests lists all tests with "詳細" button
- ✅ /teacher/tests/[testId] shows detail + form + assignments
- ✅ Form creates TestAssignment (POST returns 201)

### Test Duplication (A/B Setup)
- ✅ Created `backend/scripts/duplicate_test.py` utility
- ✅ Generated E2E_Quiz_TestA (ID: d86eb90e-2944-44cf-9813-3c1b59e89ff5)
- ✅ Generated E2E_Quiz_TestB (ID: 11952b52-cdbd-472e-bbd2-c0066d40b13c)
- ✅ Both have 6 identical questions, 0 assignments (clean slate)

---

## 📊 Current State

### Tests in Database
```
Original:       E2E用テスト              (725ffa45-...)  6 questions, 3 assignments
Test A (Dup):   E2E_Quiz_TestA          (d86eb90e-...)  6 questions, 0 assignments ← A/B test
Test B (Dup):   E2E_Quiz_TestB          (11952b52-...)  6 questions, 0 assignments ← A/B test
```

### Schema Design (No Migration Needed)
- TestAssignee unique constraint: (test, student) ✓ (works for separate tests)
- Each test_assignment has run_params: {schema_version, schedule, timer, attempts}
- Results scoped by test_assignment, not by test

---

## 🚀 Next Phase: UI + E2E Validation

### Step 1: Manual Browser Test (NOW)
**Goal**: Verify UI导线 works end-to-end

**Flow**:
1. Open http://localhost:3000/teacher/tests
2. See both E2E_Quiz_TestA and E2E_Quiz_TestB in list
3. Click "詳細" on TestA → see test detail page
4. Create assignment for TestA (e.g., attempt=2)
5. Click "結果を見る" → see empty results (no submissions yet)
6. Verify form validates (required fields, date range)

**Success Criteria**:
- ✅ Navigation doesn't 404
- ✅ Form submits and returns 201
- ✅ Results page loads (even if empty)
- ✅ No 500 errors in browser console

### Step 2: Seed/Debug Hardening (After UI Validation)
**Todo**:
- Remove hardcoded emails from code/logs
- Env variables: QA_SEED_TEACHER_EMAIL, QA_SEED_STUDENTS
- /api/debug/* guarded by DEBUG=true
- Standardize seed data process

### Step 3: Student Submission E2E (Optional, Time Permitting)
**Todo**:
- Create test-taker account (student@example.com)
- Submit quiz for TestA assignment
- Verify results show in teacher dashboard
- Repeat for TestB with different scores
- Validate A/B comparison is clear

---

## 📝 Command Reference

### Duplicate a Test
```bash
# Inside backend container
python run_duplicate_test.py
```

### View All Tests
```bash
docker compose exec -T backend python manage.py shell << 'EOF'
from quiz.models import Test
for t in Test.objects.all():
    print(f"{t.title}: {t.id} (Q:{t.questions.count()} A:{t.assignments.count()})")
EOF
```

### Create Test Assignment (curl)
```bash
TOKEN="your_teacher_token"
curl -X POST http://localhost:3000/api/test-assignments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "test": "d86eb90e-2944-44cf-9813-3c1b59e89ff5",
    "note": "A/B Test - Group A",
    "run_params": {
      "run_params": {
        "schema_version": 1,
        "timezone": "Asia/Tokyo",
        "schedule": {
          "start_at": "2026-02-15T20:00:00+09:00",
          "end_at": "2026-02-22T23:59:59+09:00"
        },
        "timer": {"mode": "uniform", "seconds": 10},
        "attempts": {
          "default_max_attempts": 2,
          "source_of_truth": "testassignee"
        }
      }
    }
  }'
```

---

## 🔍 Known Limitations

### Current (Without Migration)
- **Same test**: Cannot assign same student twice (unique constraint blocks it)
- **Solution**: Use separate Test objects (A/B) — that's what we did ✓

### Future (If Needed)
- To assign same test with different params to same student → requires migration
- Change unique constraint: (test, student) → (test_assignment, student)
- Not needed for Phase 2 QA (A/B approach is sufficient)

---

## 📌 Key Design Decisions

**Why Test Duplication (Not Migration)**:
1. Zero risk: no schema changes
2. Fast: can create/destroy tests via script
3. Clear: A/B results are in separate Test records
4. Reversible: just delete tests if needed
5. Matches Phase 2 QA reality: "are questions understandable?" (questions are identical)

**Why Same-Origin Only**:
1. Security: prevents CSRF
2. Architecture: proxy handles all API routing
3. Debug simplicity: single network hop (3000 → 8080)

---

## 📋 Checklist

### Completed ✅
- [ x ] Test duplication script
- [ x ] E2E_Quiz_TestA + TestB created
- [ x ] API endpoints fixed (run_params, email, pytz)
- [ x ] UI navigation (tests → detail → form)
- [ x ] Proxy hardening (same-origin, cookie forward)

### Pending ⏳
- [ ] Browser validation (next step)
- [ ] Seed/debug hardening
- [ ] Student submission E2E (optional)
- [ ] Migration to (test_assignment, student) unique (only if A/B insufficient)

---

**Status**: E2E infrastructure ready. UI validation pending.
