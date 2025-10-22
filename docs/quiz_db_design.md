# 統合版：Quiz DBテーブル役割まとめ

## 1. アカウント／プロフィール／講師認可

### users（生徒アカウント）
生徒側ポータルのログイン主体。学習・クイズ受験・結果の当事者。

| 列名 | 型 | NULL | 既定値 | 主/外部 | 制約/索引 | 説明 |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | NO | gen_random_uuid() | PK | PK | 学習当事者ID |
| email | varchar(255) | NO | – | – | UNIQUE(lower(email)) WHERE deleted_at IS NULL, INDEX | ログインメール（Django USERNAME_FIELD） |
| username | varchar(150) | YES | – | – | UNIQUE | Django管理画面互換の内部フィールド（未設定時は自動生成） |
| oauth_provider | varchar(32) | NO | 'google' | – | INDEX | 認証プロバイダ |
| oauth_sub | varchar(255) | NO | – | – | UNIQUE(oauth_provider, oauth_sub) | プロバイダ内一意 |
| last_login | timestamptz | YES | – | – | INDEX | 最終ログイン |
| disabled_at | timestamptz | YES | – | – | INDEX | アカウント停止 |
| deleted_at | timestamptz | YES | – | – | INDEX | 論理削除（退会） |
| created_at | timestamptz | NO | now() | – | INDEX | 作成 |
| updated_at | timestamptz | NO | now() | – | – | 更新 |
| is_active | boolean | NO | true | – | – | Django互換フラグ（無効化判定はdisabled_atを使用） |

**注記**:
- `username`フィールドは設計書に明示されていないが、Django管理画面との互換性のため保持
- 講師権限の判定には`is_staff`フィールドを使用せず、`teachers_whitelists`テーブルで厳密に制御
- `is_active`はDjango認証システムとの互換性のため保持（実際の無効化は`disabled_at`で判定）

### users_profile（生徒プロフィール）
学年・表示名など、生徒の追加属性（users と 1:1）。

| 列名 | 型 | NULL | 既定値 | 主/外部 | 制約/索引 | 説明 |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | NO | – | PK, FK | PK / FK→ users(user_id) ON DELETE CASCADE | 1:1（users と同一ID） |
| display_name | varchar(120) | NO | – | – | – | 表示名（初回は Google から反映） |
| avatar_url | text | NO | – | – | – | アイコン画像 URL（初回は Google から反映） |
| grade | varchar(32) | YES | – | – | – | 学年・学級など（任意） |
| self_intro | text | YES | – | – | – | 自己紹介（任意） |
| updated_at | timestamptz | NO | now() | – | – | 更新日時 |

### teachers（講師アカウント）
講師ポータルのログイン主体。名簿作成・配布・成績確認の当事者。

| 列名 | 型 | NULL | 既定値 | 主/外部 | 制約/索引 | 説明 |
| --- | --- | --- | --- | --- | --- | --- |
| teacher_id | uuid | NO | gen_random_uuid() | PK | PK | 講師ID |
| email | varchar(255) | NO | – | – | UNIQUE (lower(email)) WHERE deleted_at IS NULL, INDEX | ログインメール |
| oauth_provider | varchar(32) | NO | 'google' | – | INDEX | 認証プロバイダ |
| oauth_sub | varchar(255) | NO | – | – | UNIQUE(oauth_provider, oauth_sub) | プロバイダ内一意 |
| last_login | timestamptz | YES | – | – | INDEX | 最終ログイン |
| disabled_at | timestamptz | YES | – | – | INDEX | 停止 |
| deleted_at | timestamptz | YES | – | – | INDEX | 論理削除 |
| created_at | timestamptz | NO | now() | – | INDEX | 作成 |
| updated_at | timestamptz | NO | now() | – | – | 更新 |

### teachers_profile（講師プロフィール）
所属・自己紹介など、講師の追加属性（teachers と 1:1）。

| 列名 | 型 | NULL | 既定値 | 主/外部 | 制約/索引 | 説明 |
| --- | --- | --- | --- | --- | --- | --- |
| teacher_id | uuid | NO | – | PK, FK | PK / FK→ teachers(teacher_id) ON DELETE CASCADE | 1:1（teachers と同一ID） |
| display_name | varchar(120) | YES | – | – | – | 表示名（初回は Google 反映可） |
| affiliation | varchar(120) | YES | – | – | – | 所属校・塾等 |
| avatar_url | text | YES | – | – | – | 画像 URL |
| bio | text | YES | – | – | – | 自己紹介 |
| updated_at | timestamptz | NO | now() | – | – | 更新日時 |

### teachers_whitelists（講師ホワイトリスト）
講師ポータルの入場条件。**Google認証OK ∧ メールがここに存在**で入場可。運用監査の基準。

| 列名 | 型 | NULL | 既定値 | 主/外部 | 制約/索引 | 説明 |
| --- | --- | --- | --- | --- | --- | --- |
| teachers_whitelist_id | uuid | NO | gen_random_uuid() | PK | PK | エントリID |
| email | varchar(255) | NO | – | – | UNIQUE (lower(email)) WHERE revoked_at IS NULL, INDEX | 許可メール |
| can_publish_vocab | boolean | NO | false | – | INDEX | 公開語彙の作成申請可否 |
| note | varchar(200) | YES | – | – | – | 備考 |
| revoked_at | timestamptz | YES | – | – | INDEX | 権限取り消し |
| created_by | uuid | YES | – | FK | FK → teachers(teacher_id) ON DELETE SET NULL | 登録者 |
| created_at | timestamptz | NO | now() | – | – | 登録 |
| updated_at | timestamptz | NO | now() | – | – | 更新 |

### invitation_codes（招待コード）
講師→生徒の**招待フロー**を管理。発行者・有効期限・使用状況を保持。

| 列名 | 型 | NULL | 既定値 | 主/外部 | 制約/索引 | 説明 |
| --- | --- | --- | --- | --- | --- | --- |
| invitation_code_id | uuid | NO | gen_random_uuid() | PK | PK | 招待ID |
| invitation_code | varchar(24) | NO | – | – | UNIQUE(invitation_code) | 表示用コード（衝突回避） |
| issued_by | uuid | NO | – | FK | FK→ teachers(teacher_id) ON DELETE CASCADE | 発行者 |
| issued_at | timestamptz | NO | now() | – | INDEX | 発行日時 |
| expires_at | timestamptz | YES | – | – | INDEX | 有効期限 |
| used_by | uuid | YES | – | FK | FK→ users(user_id) ON DELETE SET NULL | 使用者（生徒） |
| used_at | timestamptz | YES | – | – | – | 使用日時 |
| revoked | boolean | NO | false | – | – | 失効フラグ |
| revoked_at | timestamptz | YES | – | – | – | 失効日時 |

### student_teacher_links（講師–生徒リンク）
承認後の**恒久的な関係**を保存（1生徒:多講師も可）。アクセス権や一覧の基礎。

| 列名 | 型 | NULL | 既定値 | 主/外部 | 制約/索引 | 説明 |
| --- | --- | --- | --- | --- | --- | --- |
| student_teacher_link_id | uuid | NO | gen_random_uuid() | PK | PK | リンクID |
| teacher_id | uuid | NO | – | FK | FK→ teachers(teacher_id) ON DELETE CASCADE | 講師 |
| student_id | uuid | NO | – | FK | FK→ users(user_id) ON DELETE CASCADE | 生徒 |
| status | enum(link_status) | NO | 'active' | – | INDEX(status), INDEX(teacher_id,status), INDEX(student_id,status) | pending / active / revoked |
| linked_at | timestamptz | NO | now() | – | INDEX | 連携日時 |
| revoked_at | timestamptz | YES | – | – | – | 解除日時 |
| revoked_by_teacher_id | uuid | YES | – | FK | FK→ teachers(teacher_id) ON DELETE SET NULL | 講師が解除時のみ |
| revoked_by_student_id | uuid | YES | – | FK | FK→ users(user_id) ON DELETE SET NULL | 生徒が解除時のみ |
| invitation_id | uuid | YES | – | FK | FK→ invitation_codes(invitation_code_id) ON DELETE SET NULL | 由来コード |
| custom_display_name | varchar(120) | YES | – | – | – | 講師専用の表示名（上書き）。未設定時は生徒の users_profile.display_name をフォールバック表示 |
| private_note | text | YES | – | – | – | 講師だけが見える自由メモ（詳細/所属/連絡メモなど） |
| local_student_code | varchar(64) | YES | – | – | – | 校務・社内台帳の管理番号等（検索キーにも） |
| tags | jsonb | YES | '[]'::jsonb | – | – | ラベル/タグ |
| kana_for_sort | varchar(160) | YES | – | – | – | ふりがな/ヨミ。講師画面のソート・検索用 |
| color | varchar(7) | YES | – | – | – | UI表示用色（例: "#F5A623"） |
| updated_at | timestamptz | NO | now() | – | – | 更新追跡 |

---

## 2. 名簿（Roster）

### roster_folders（名簿フォルダ）
講師が任意に作る**名簿の入れ物**（例：A中学／1組／補習…）。フォルダ階層は制限なし。

| 列名 | 型 | NULL | 既定値 | 主/外部 | 制約/索引 | 説明 |
| --- | --- | --- | --- | --- | --- | --- |
| roster_folder_id | uuid | NO | gen_random_uuid() | PK | PK | フォルダID |
| owner_teacher_id | uuid | NO | – | FK | FK→ teachers(teacher_id) ON DELETE CASCADE, INDEX | 所有者 |
| parent_folder_id | uuid | YES | – | FK | FK→ roster_folders(roster_folder_id) ON DELETE CASCADE, INDEX | 親フォルダ（NULL=ルート） |
| name | varchar(120) | NO | – | – | – | 名称 |
| sort_order | integer | NO | 0 | – | – | 並び順 |
| is_dynamic | boolean | NO | false | – | – | 動的名簿フラグ |
| dynamic_filter | jsonb | YES | – | – | – | フィルタ条件（任意） |
| notes | text | YES | – | – | – | 備考 |
| archived_at | timestamptz | YES | – | – | INDEX | 論理アーカイブ |
| created_at | timestamptz | NO | now() | – | INDEX | 作成 |

### roster_memberships（名簿登録リンク）
フォルダと生徒のリンク。誰をどこに載せるかの唯一の根拠。

| 列名 | 型 | NULL | 既定値 | 主/外部 | 制約/索引 | 説明 |
| --- | --- | --- | --- | --- | --- | --- |
| roster_membership_id | uuid | NO | gen_random_uuid() | PK | PK | 登録ID |
| roster_folder_id | uuid | NO | – | FK | FK → roster_folders(roster_folder_id) ON DELETE CASCADE, INDEX | フォルダ |
| student_id | uuid | NO | – | FK | FK → users(user_id) ON DELETE CASCADE, INDEX | 生徒 |
| added_at | timestamptz | NO | now() | – | INDEX | 追加日時 |
| removed_at | timestamptz | YES | – | – | INDEX | 退会（論理） |
| note | varchar(200) | YES | – | – | – | 備考 |

---

## 3. 語彙と問題コンテンツ

### vocabularies（語彙マスタ）
見出し語・品詞・説明・例文を保持。並び用の `sort_key` と `head_letter` を生成列で提供。

| 列名 | 型 | NULL | 既定値 | 主/外部 | 制約/索引 | 説明 |
| --- | --- | --- | --- | --- | --- | --- |
| vocabulary_id | uuid | NO | gen_random_uuid() | PK | PK | 語彙ID |
| text_en | varchar(120) | NO | – | – | INDEX | 見出し語 |
| text_key | citext (生成) | NO | unaccent(lower(text_en))::citext | – | INDEX | 一意判定キー |
| part_of_speech | varchar(30) | YES | – | – | – | 品詞 |
| explanation | text | YES | – | – | – | 説明 |
| example_en | text | YES | – | – | – | 例文(英) |
| example_ja | text | YES | – | – | – | 例文(日) |
| sort_key | varchar(生成) | NO | unaccent(lower(text_en)) | – | INDEX | 並び用 |
| head_letter | char(1)(生成) | NO | substr(sort_key,1,1) | – | INDEX | 先頭 |
| sense_count | integer | NO | 1 | – | – | 多義数 |
| visibility | enum(vocab_visibility) | NO | 'private' | – | INDEX | public/private |
| status | enum(vocab_status) | NO | 'draft' | – | INDEX | draft/proposed/published/archived |
| created_by_user_id | uuid | YES | – | FK | FK → users(user_id) ON DELETE SET NULL | 生徒所有 |
| created_by_teacher_id | uuid | YES | – | FK | FK → teachers(teacher_id) ON DELETE SET NULL | 講師所有 |
| alias_of_vocabulary_id | uuid | YES | – | FK | FK → vocabularies(vocabulary_id) ON DELETE SET NULL | 統合先 |
| published_at | timestamptz | YES | – | – | – | 公開日時 |
| archived_at | timestamptz | YES | – | – | INDEX | 論理アーカイブ |
| created_at | timestamptz | NO | now() | – | INDEX | 作成 |
| updated_at | timestamptz | NO | now() | – | – | 更新 |

### vocab_translations（訳語集合）
複数訳を保持。代表訳（is_primary）を最大1件に制約。

| 列名 | 型 | NULL | 既定値 | 主/外部 | 制約/索引 | 説明 |
| --- | --- | --- | --- | --- | --- | --- |
| vocab_translation_id | uuid | NO | gen_random_uuid() | PK | PK | 訳ID |
| vocabulary_id | uuid | NO | – | FK | FK → vocabularies(vocabulary_id) ON DELETE CASCADE, INDEX | 親語彙 |
| text_ja | varchar(120) | NO | – | – | UNIQUE(vocabulary_id, text_ja) | 訳文 |
| is_primary | boolean | NO | false | – | 部分一意: UNIQUE(vocabulary_id) WHERE is_primary | 代表訳は最大1つ |
| created_at | timestamptz | NO | now() | – | – | 登録 |
| updated_at | timestamptz | NO | now() | – | – | 更新 |

### vocab_choice_bank（出題用選択肢プール）
正解1＋ダミー(n-1)を保持。重み(weight)でダミー抽選を制御。

| 列名 | 型 | NULL | 既定値 | 主/外部 | 制約/索引 | 説明 |
| --- | --- | --- | --- | --- | --- | --- |
| vocab_choice_id | uuid | NO | gen_random_uuid() | PK | PK | 選択肢ID |
| vocabulary_id | uuid | NO | – | FK | FK → vocabularies(vocabulary_id) ON DELETE CASCADE, INDEX(vocabulary_id, is_correct) | 親語彙 |
| text_ja | varchar(120) | NO | – | – | UNIQUE(vocabulary_id, text_ja) | 選択肢テキスト |
| is_correct | boolean | NO | false | – | – | 正解/ダミー |
| weight | numeric(4,2) | NO | 0 | – | INDEX(vocabulary_id, weight DESC) | 抽選重み |
| source_vocabulary_id | uuid | YES | – | FK | FK → vocabularies(vocabulary_id) ON DELETE SET NULL | ダミー出所 |
| created_at | timestamptz | NO | now() | – | – | 登録 |
| updated_at | timestamptz | NO | now() | – | – | 更新 |

### quiz_collections / quizzes / quiz_questions
教材入れ物 → 回 → 出題リスト。

| テーブル | 主な役割 |
| --- | --- |
| quiz_collections | scope（default/custom）と owner で公開範囲を制御。タイトル重複は同一 owner + 非アーカイブで禁止。 |
| quizzes | 1回分の出題単位。sequence_no で並び順。origin_quiz_id で複製元追跡。 |
| quiz_questions | 出題語彙と順序を保持。archived_at で論理削除。 |

---

## 4. クイズ実行と成績

### quiz_results / quiz_result_details
学習用クイズの実行履歴（ヘッダ＋明細）。`user_id`、`quiz_id` は ON DELETE RESTRICT。

| フィールドのポイント |
| --- |
| total_time_ms / reaction_time_ms で所要時間を保存。 |
| selected_text で当時の選択肢文言をスナップショット。 |
| 同一 user × quiz で複数回受験を許容。 |

---

## 5. テスト（講師配布の評価回）

### tests / test_questions
講師が作成する評価回。`max_attempts_per_student` や `timer_seconds` で受験制約を設定。`test_questions` は vocab を参照。

### test_assignments / test_assignees
配布バッチと受け手スナップショット。配布後の名簿変動に影響されないように対象者を固定化。

### test_results / test_result_details
受験1回のヘッダと明細。`attempt_no` は1から連番。配点は weight×正誤で再計算可能。

---

## 6. 権限と可視性
- 学習者は自分のプロフィールと自分の結果のみ。
- 講師は所有する名簿/教材/テストと、active リンクの生徒成績を参照可能。
- 運営は scope=default 教材の作成・公開・アーカイブを担当。

## 7. 監査・論理削除ポリシー
- 履歴（quiz_results/test_results、invitation_codes、student_teacher_links）は不変領域。
- 名簿・教材は archived_at / removed_at / revoked_at で可視性制御。
- 誤登録など例外を除き物理削除は避ける。

## 8. 典型ユースフロー（講師視点）
1. 名簿準備（フォルダ作成→生徒登録）
2. 教材準備（default を活用 or custom 作成）
3. テスト作成（tests / test_questions）
4. 配布（test_assignments → test_assignees）
5. 受験（quiz/test 実行）
6. 採点/講評（弱点語彙抽出→再学習）
7. 再テスト（attempt_no 採番、上限判定）

## 9. 実装メモ
- 名簿再帰はCTE＋インデックス必須。
- attempt_no 採番は一意制約で保護し衝突時は再試行。
- vocab_choice_bank.weight は重み付きランダム抽選に利用。
- 配布後の名簿変動対策として test_assignees で対象固定。
- 公開/アーカイブ/権限変更はアプリ層で監査ログ化。データは不変を優先。
