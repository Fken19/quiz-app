# Phase 2.2: 講師結果一覧＋CSV実装設計

## 0. 目的
講師が配信ごとの結果を確認し、未受験者を把握し、CSVでエクスポートできるようにする（MVP必須機能）

---

## 1. API設計

### 1.1 講師結果一覧 API

**エンドポイント**: `GET /api/teacher/test-assignments/{assignment_id}/results`

**認証**: 講師権限（該当配信の作成者のみ）

**レスポンス**:
```json
{
  "assignment": {
    "test_assignment_id": "uuid",
    "test_id": "uuid",
    "test_title": "単語テスト Week 1",
    "available_from": "2026-02-15T09:00:00+09:00",
    "available_until": "2026-02-20T23:59:59+09:00",
    "max_attempts": 2,
    "created_at": "2026-02-01T10:00:00+09:00"
  },
  "summary": {
    "total_students": 30,
    "completed_students": 25,
    "not_started_students": 5,
    "average_score": 78.5,
    "highest_score": 100,
    "lowest_score": 45
  },
  "results": [
    {
      "student_id": "uuid",
      "student_name": "山田太郎",
      "student_email": "yamada@example.com",
      "status": "completed",  // "not_started" | "in_progress" | "completed" | "expired"
      "attempt_count": 2,
      "max_attempts": 2,
      "best_score": 85,
      "latest_score": 85,
      "first_attempt_at": "2026-02-15T10:30:00+09:00",
      "last_completed_at": "2026-02-16T11:00:00+09:00",
      "total_time_ms": 180000  // 最新試行の時間
    },
    {
      "student_id": "uuid",
      "student_name": "佐藤花子",
      "student_email": "sato@example.com",
      "status": "not_started",
      "attempt_count": 0,
      "max_attempts": 2,
      "best_score": null,
      "latest_score": null,
      "first_attempt_at": null,
      "last_completed_at": null,
      "total_time_ms": null
    }
  ]
}
```

**実装ポイント**:
- **母集団**: `TestAssignee` を使用（未受験者も含む）
- **集計**: LEFT JOIN で TestResult を結合
- **status 判定**:
  - `not_started`: attempt_count = 0
  - `in_progress`: 開始済み（started_at あり）だが未完了
  - `completed`: completed_at がある
  - `expired`: 期限切れ（available_until < now）かつ未完了

### 1.2 CSV エクスポート API

**エンドポイント**: `GET /api/teacher/test-assignments/{assignment_id}/results.csv`

**認証**: 講師権限（該当配信の作成者のみ）

**レスポンス**: CSV ファイル（UTF-8 BOM付き）

**CSVカラム**:
```csv
学生ID,学生名,メールアドレス,状態,受験回数,上限回数,最高得点,最新得点,初回受験日時,最終完了日時,最新所要時間(秒)
uuid,山田太郎,yamada@example.com,受験済,2,2,85,85,2026-02-15 10:30:00,2026-02-16 11:00:00,180
uuid,佐藤花子,sato@example.com,未受験,0,2,,,,,
```

**実装ポイント**:
- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="test_results_{assignment_id}_{timestamp}.csv"`
- BOM付き（Excel対応）: `'\ufeff'`
- 日時はJST表示（`YYYY-MM-DD HH:MM:SS`）
- null は空欄

---

## 2. バックエンド実装

### 2.1 views.py に追加

```python
class TeacherAssignmentResultsView(APIView):
    """
    講師向け：配信ごとの結果一覧
    GET /api/teacher/test-assignments/{assignment_id}/results
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, assignment_id):
        # 1. assignment 取得 + 権限チェック
        # 2. TestAssignee を母集団として取得（未受験者含む）
        # 3. LEFT JOIN で TestResult を集計
        # 4. status, best_score, latest_score, attempt_count 算出
        # 5. summary 算出（平均点、受験者数等）
        # 6. レスポンス返却
        pass


class TeacherAssignmentResultsCSVView(APIView):
    """
    講師向け：配信結果CSV出力
    GET /api/teacher/test-assignments/{assignment_id}/results.csv
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, assignment_id):
        # 1. assignment 取得 + 権限チェック
        # 2. 結果データ取得（上記と同じロジック）
        # 3. CSV生成（csv.DictWriter使用）
        # 4. HttpResponse で返却
        pass
```

### 2.2 urls.py に追加

```python
# Teacher result views
path("teacher/test-assignments/<uuid:assignment_id>/results", 
     views.TeacherAssignmentResultsView.as_view(), 
     name="teacher-assignment-results"),
path("teacher/test-assignments/<uuid:assignment_id>/results.csv", 
     views.TeacherAssignmentResultsCSVView.as_view(), 
     name="teacher-assignment-results-csv"),
```

---

## 3. フロントエンド実装

### 3.1 型定義 (`types/test.ts`)

```typescript
export interface TeacherAssignmentResult {
  student_id: string;
  student_name: string;
  student_email: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'expired';
  attempt_count: number;
  max_attempts: number;
  best_score: number | null;
  latest_score: number | null;
  first_attempt_at: string | null;
  last_completed_at: string | null;
  total_time_ms: number | null;
}

export interface TeacherAssignmentResultsResponse {
  assignment: {
    test_assignment_id: string;
    test_id: string;
    test_title: string;
    available_from: string;
    available_until: string;
    max_attempts: number;
    created_at: string;
  };
  summary: {
    total_students: number;
    completed_students: number;
    not_started_students: number;
    average_score: number;
    highest_score: number;
    lowest_score: number;
  };
  results: TeacherAssignmentResult[];
}
```

### 3.2 API関数 (`lib/api/test.ts`)

```typescript
/**
 * 配信結果一覧を取得（講師）
 * GET /api/teacher/test-assignments/{assignment_id}/results
 */
export async function getTeacherAssignmentResults(
  assignmentId: string
): Promise<TeacherAssignmentResultsResponse> {
  return apiGet(`/teacher/test-assignments/${assignmentId}/results/`);
}

/**
 * 配信結果CSVをダウンロード（講師）
 * GET /api/teacher/test-assignments/{assignment_id}/results.csv
 */
export function downloadTeacherAssignmentResultsCSV(assignmentId: string): void {
  const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/teacher/test-assignments/${assignmentId}/results.csv/`;
  window.open(url, '_blank');
}
```

### 3.3 UI実装 (`app/teacher/test-assignments/[assignmentId]/results/page.tsx`)

**ページ構成**:
```
┌─────────────────────────────────────────┐
│ テスト結果：単語テスト Week 1           │
│ 期間: 2026-02-15 - 2026-02-20          │
│ [CSVダウンロード] ボタン               │
├─────────────────────────────────────────┤
│ サマリー:                               │
│  受験者数: 25/30                        │
│  平均点: 78.5点                         │
│  最高点: 100点 / 最低点: 45点          │
├─────────────────────────────────────────┤
│ 学生別結果テーブル                      │
│ ┌──────┬─────┬────┬───┬────┐      │
│ │学生名│状態 │回数│得点│日時│      │
│ ├──────┼─────┼────┼───┼────┤      │
│ │山田  │受験済│ 2/2│ 85 │...│      │
│ │佐藤  │未受験│ 0/2│ -  │-  │      │
│ └──────┴─────┴────┴───┴────┘      │
└─────────────────────────────────────────┘
```

**機能**:
- 状態別フィルタ（全て / 受験済 / 未受験 / 期限切れ）
- ソート機能（名前順 / 得点順 / 日時順）
- CSVダウンロードボタン

---

## 4. データ構造確認

### 4.1 TestAssignee（母集団）
```python
class TestAssignee(models.Model):
    id = UUIDField(primary_key=True)
    test = ForeignKey(Test)
    test_assignment = ForeignKey(TestAssignment)
    student = ForeignKey(User)
    max_attempts = IntegerField(null=True)  # 個別上限（nullなら配信の上限を使用）
```

### 4.2 TestResult（受験記録）
```python
class TestResult(models.Model):
    id = UUIDField(primary_key=True)
    test = ForeignKey(Test)
    student = ForeignKey(User)
    test_assignee = ForeignKey(TestAssignee)  # ← 配信単位の紐付け
    attempt_no = IntegerField()
    started_at = DateTimeField()
    completed_at = DateTimeField(null=True)
    score = IntegerField(null=True)
```

### 4.3 集計クエリ例
```python
from django.db.models import Count, Max, Min, Avg, Q, F

assignees = TestAssignee.objects.filter(
    test_assignment_id=assignment_id
).select_related('student').annotate(
    attempt_count=Count('testresult', filter=Q(testresult__completed_at__isnull=False)),
    best_score=Max('testresult__score'),
    latest_score=F('testresult__score'),  # 最新のscoreを取得（別途処理必要）
    last_completed_at=Max('testresult__completed_at')
)
```

---

## 5. 実装順序（推奨）

### Phase 2.2.1: Backend API（2時間）
1. ✅ TeacherAssignmentResultsView 実装
   - TestAssignee母集団取得
   - LEFT JOIN で TestResult 集計
   - status, best_score, latest_score 算出
   - summary 算出
2. ✅ TeacherAssignmentResultsCSVView 実装
   - 上記と同じデータ取得
   - CSV生成（csv.DictWriter）
   - BOM付きUTF-8で返却
3. ✅ urls.py に追加
4. ✅ 手動テスト（Postman/curl）

### Phase 2.2.2: Frontend基本実装（1.5時間）
1. ✅ 型定義追加（types/test.ts）
2. ✅ API関数追加（lib/api/test.ts）
3. ✅ 結果ページ作成（最小構成）
   - サマリー表示
   - 結果テーブル（ソートなし）
   - CSVダウンロードボタン
4. ✅ 既存の配信一覧から結果ページへのリンク追加

### Phase 2.2.3: UI改善（1時間・オプション）
1. ⏳ 状態別フィルタ
2. ⏳ ソート機能
3. ⏳ ページネーション
4. ⏳ 検索機能

---

## 6. QA観点

### 6.1 結果一覧API
- [ ] 未受験者が results に含まれる
- [ ] best_score が複数回受験時に最高点になる
- [ ] latest_score が最新の受験の点数になる
- [ ] status が正しく判定される（not_started/completed/expired）
- [ ] 期限切れ判定が正しい（available_until < now）

### 6.2 CSV出力
- [ ] CSVファイルがダウンロードされる
- [ ] Excelで文字化けしない（BOM付きUTF-8）
- [ ] null値が空欄で表示される
- [ ] 日時がJST表示（+09:00）
- [ ] ファイル名に assignment_id とタイムスタンプが含まれる

### 6.3 権限チェック
- [ ] 配信作成者以外はアクセス不可（403）
- [ ] 学生はアクセス不可（403）

---

## 7. 次のステップ

Phase 2.2完了後：
1. **E2E テスト実施**（Phase 2.1 + Phase 2.2）
2. **MVP要件確認**
   - ✅ テスト作成（講師）
   - ✅ 配信作成（講師）
   - ✅ 学生割り当て（講師）
   - ✅ テスト一覧（学生）
   - ✅ 受験実行（学生）
   - ✅ 結果表示（学生）
   - ✅ 結果一覧（講師）
   - ✅ CSV出力（講師）
3. **本番デプロイ準備**
