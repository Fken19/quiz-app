"""
テスト機能（Test）の run_params スキーマ管理
JST（Asia/Tokyo）運用を想定し、タイムゾーン付きISO8601を強制
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from django.utils import timezone
from dateutil.parser import isoparse
from dateutil.relativedelta import relativedelta
from rest_framework import serializers as drf_serializers


class TestParamsValidationError(Exception):
    """run_params バリデーションエラー"""
    pass


@dataclass
class Timer:
    """タイマー設定（MVP：uniform固定）"""
    mode: str = "uniform"  # "uniform" のみ対応
    seconds: int = 10

    def validate(self) -> None:
        if self.mode != "uniform":
            raise TestParamsValidationError(
                f"timer.mode は 'uniform' のみサポートしています（指定: {self.mode}）"
            )
        if not isinstance(self.seconds, int) or self.seconds <= 0:
            raise TestParamsValidationError(
                f"timer.seconds は正の整数である必要があります（指定: {self.seconds}）"
            )
        if self.seconds > 120:
            raise TestParamsValidationError(
                f"timer.seconds は 120 以下である必要があります（指定: {self.seconds}）"
            )


@dataclass
class Schedule:
    """配信スケジュール（必須、JST+09:00固定で保存）"""
    start_at: str  # ISO8601 with +09:00 (e.g., "2026-02-01T09:00:00+09:00")
    end_at: str    # ISO8601 with +09:00

    def validate(self) -> None:
        """日時の妥当性を検証"""
        try:
            start_dt = isoparse(self.start_at)
            end_dt = isoparse(self.end_at)
        except (ValueError, TypeError) as e:
            raise TestParamsValidationError(
                f"start_at/end_at はISO8601形式で、タイムゾーン付きである必要があります。エラー: {e}"
            )

        # naiveチェック
        if start_dt.tzinfo is None:
            raise TestParamsValidationError(
                f"start_at はタイムゾーン情報を含む必要があります（現在: {self.start_at}）"
            )
        if end_dt.tzinfo is None:
            raise TestParamsValidationError(
                f"end_at はタイムゾーン情報を含む必要があります（現在: {self.end_at}）"
            )

        # 前後関係
        if start_dt >= end_dt:
            raise TestParamsValidationError(
                f"start_at < end_at である必要があります。"
                f"start_at={self.start_at}, end_at={self.end_at}"
            )

        # 6ヶ月制約
        max_end = start_dt + relativedelta(months=6)
        if end_dt > max_end:
            raise TestParamsValidationError(
                f"配信期間は6ヶ月以内である必要があります。"
                f"start={self.start_at}, end={self.end_at}, max_allowed={max_end.isoformat()}"
            )

    def to_dict(self) -> Dict[str, str]:
        return {"start_at": self.start_at, "end_at": self.end_at}


@dataclass
class Attempts:
    """受験回数制限設定"""
    default_max_attempts: int = 1
    source_of_truth: str = "testassignee"

    def validate(self) -> None:
        if not isinstance(self.default_max_attempts, int):
            raise TestParamsValidationError(
                f"attempts.default_max_attempts は整数である必要があります"
            )
        if self.default_max_attempts < 1 or self.default_max_attempts > 99:
            raise TestParamsValidationError(
                f"attempts.default_max_attempts は 1 〜 99 の範囲である必要があります"
                f"（指定: {self.default_max_attempts}）"
            )
        if self.source_of_truth != "testassignee":
            raise TestParamsValidationError(
                f"attempts.source_of_truth は 'testassignee' のみサポートしています"
            )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "default_max_attempts": self.default_max_attempts,
            "source_of_truth": self.source_of_truth,
        }


@dataclass
class OverrideTranslation:
    """単語訳の上書き"""
    ja: str

    def validate(self) -> None:
        if not isinstance(self.ja, str) or not self.ja.strip():
            raise TestParamsValidationError(
                "override_translations の訳は空でない文字列である必要があります"
            )
        if len(self.ja) > 200:
            raise TestParamsValidationError(
                "override_translations の訳は 200 文字以下である必要があります"
            )

    def to_dict(self) -> Dict[str, str]:
        return {"ja": self.ja}


@dataclass
class TargetGroup:
    """配信対象グループ"""
    source_type: str  # "roster_folder" | "student_teacher_link_tag"
    source_id: Optional[str] = None
    tag_value: Optional[str] = None

    def validate(self) -> None:
        if self.source_type not in ["roster_folder", "student_teacher_link_tag"]:
            raise TestParamsValidationError(
                f"targets_snapshot.groups[].source_type は "
                f"'roster_folder' または 'student_teacher_link_tag' である必要があります"
            )
        if self.source_type == "roster_folder" and not self.source_id:
            raise TestParamsValidationError(
                "source_type='roster_folder' の場合は source_id が必須です"
            )
        if self.source_type == "student_teacher_link_tag" and not self.tag_value:
            raise TestParamsValidationError(
                "source_type='student_teacher_link_tag' の場合は tag_value が必須です"
            )

    def to_dict(self) -> Dict[str, Any]:
        if self.source_type == "roster_folder":
            return {"source_type": self.source_type, "source_id": self.source_id}
        else:
            return {"source_type": self.source_type, "tag_value": self.tag_value}


@dataclass
class TargetsSnapshot:
    """配信対象の記録（監査用）"""
    students: List[str] = field(default_factory=list)  # UUIDs
    groups: List[TargetGroup] = field(default_factory=list)

    def validate(self) -> None:
        # students: UUID文字列チェック
        for student_id in self.students:
            try:
                uuid.UUID(student_id)
            except (ValueError, TypeError):
                raise TestParamsValidationError(
                    f"targets_snapshot.students の値はUUIDである必要があります: {student_id}"
                )

        # groups: 各グループを検証
        for group in self.groups:
            group.validate()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "students": self.students,
            "groups": [g.to_dict() for g in self.groups],
        }


@dataclass
class TestAssignmentParamsV1:
    """
    TestAssignment.run_params の v1 スキーマ
    JST（Asia/Tokyo）運用を想定し、ISO8601 +09:00 で保存・比較
    """
    schema_version: int = 1
    timezone: str = "Asia/Tokyo"
    schedule: Schedule = field(default_factory=lambda: Schedule(
        start_at="2026-02-01T09:00:00+09:00",
        end_at="2026-02-01T23:59:59+09:00"
    ))
    timer: Timer = field(default_factory=Timer)
    attempts: Attempts = field(default_factory=Attempts)
    override_translations: Dict[str, OverrideTranslation] = field(default_factory=dict)
    ui: Dict[str, str] = field(default_factory=lambda: {"theme": "test_yellow_orange"})
    targets_snapshot: Optional[TargetsSnapshot] = field(default_factory=TargetsSnapshot)

    @classmethod
    def from_json(cls, data: Dict[str, Any]) -> TestAssignmentParamsV1:
        """JSON/dictから Params インスタンスを生成"""
        if not isinstance(data, dict):
            raise TestParamsValidationError("run_params はオブジェクト（dict）である必要があります")

        schema_version = data.get("schema_version", 1)
        if schema_version != 1:
            raise TestParamsValidationError(
                f"schema_version=1 のみサポートしています（指定: {schema_version}）"
            )

        timezone = data.get("timezone", "Asia/Tokyo")
        if timezone != "Asia/Tokyo":
            raise TestParamsValidationError(
                "timezone は 'Asia/Tokyo' のみサポートしています"
            )

        # schedule
        schedule_data = data.get("schedule", {})
        schedule = Schedule(
            start_at=schedule_data.get("start_at", ""),
            end_at=schedule_data.get("end_at", ""),
        )

        # timer
        timer_data = data.get("timer", {})
        timer = Timer(
            mode=timer_data.get("mode", "uniform"),
            seconds=timer_data.get("seconds", 10),
        )

        # attempts
        attempts_data = data.get("attempts", {})
        attempts = Attempts(
            default_max_attempts=attempts_data.get("default_max_attempts", 1),
            source_of_truth=attempts_data.get("source_of_truth", "testassignee"),
        )

        # override_translations
        override_data = data.get("override_translations", {})
        override_translations = {}
        for vocab_id, trans_info in override_data.items():
            try:
                uuid.UUID(vocab_id)  # UUID文字列チェック
            except (ValueError, TypeError):
                raise TestParamsValidationError(
                    f"override_translations のキーはUUIDである必要があります: {vocab_id}"
                )
            if isinstance(trans_info, dict) and "ja" in trans_info:
                override_translations[vocab_id] = OverrideTranslation(ja=trans_info["ja"])

        # ui
        ui = data.get("ui", {"theme": "test_yellow_orange"})

        # targets_snapshot
        targets_data = data.get("targets_snapshot")
        targets_snapshot = None
        if targets_data:
            students = targets_data.get("students", [])
            groups_data = targets_data.get("groups", [])
            groups = [
                TargetGroup(
                    source_type=g.get("source_type"),
                    source_id=g.get("source_id"),
                    tag_value=g.get("tag_value"),
                )
                for g in groups_data
            ]
            targets_snapshot = TargetsSnapshot(students=students, groups=groups)

        return cls(
            schema_version=schema_version,
            timezone=timezone,
            schedule=schedule,
            timer=timer,
            attempts=attempts,
            override_translations=override_translations,
            ui=ui,
            targets_snapshot=targets_snapshot,
        )

    def validate(self) -> None:
        """全フィールドの妥当性検証"""
        self.schedule.validate()
        self.timer.validate()
        self.attempts.validate()
        for override in self.override_translations.values():
            override.validate()
        if self.targets_snapshot:
            self.targets_snapshot.validate()

    def normalize(self) -> TestAssignmentParamsV1:
        """
        日時を +09:00 形式に正規化
        入力が Z（UTC）でも +09:00 に変換して統一
        """
        try:
            start_dt = isoparse(self.schedule.start_at)
            end_dt = isoparse(self.schedule.end_at)

            # UTC → +09:00 に変換（astimezone で JST に変換）
            import pytz
            jst = pytz.timezone("Asia/Tokyo")
            start_jst = start_dt.astimezone(jst)
            end_jst = end_dt.astimezone(jst)

            # +09:00 形式で出力
            self.schedule.start_at = start_jst.isoformat()
            self.schedule.end_at = end_jst.isoformat()

            return self
        except Exception as e:
            raise TestParamsValidationError(f"日時の正規化に失敗しました: {e}")

    def is_available(self, now: Optional[datetime] = None) -> bool:
        """
        現時刻で受験可能か判定
        now は UTC datetime（デフォルトは timezone.now()）
        """
        if now is None:
            now = timezone.now()

        try:
            start_dt = isoparse(self.schedule.start_at)
            end_dt = isoparse(self.schedule.end_at)

            # UTC で比較
            return start_dt <= now < end_dt
        except Exception:
            return False

    def to_dict(self) -> Dict[str, Any]:
        """JSON出力用の辞書に変換"""
        return {
            "schema_version": self.schema_version,
            "timezone": self.timezone,
            "schedule": self.schedule.to_dict(),
            "timer": asdict(self.timer),
            "attempts": self.attempts.to_dict(),
            "override_translations": {
                k: v.to_dict() for k, v in self.override_translations.items()
            },
            "ui": self.ui,
            "targets_snapshot": (
                self.targets_snapshot.to_dict() if self.targets_snapshot else None
            ),
        }

    def to_json_str(self) -> str:
        """JSON文字列に変換（DB保存用）"""
        return json.dumps(self.to_dict(), ensure_ascii=False)


class TestAssignmentParamsSerializer(drf_serializers.Serializer):
    """DRF用シリアライザー（入力バリデーション）"""
    run_params = drf_serializers.JSONField()

    def validate_run_params(self, value):
        """run_params の形式を検証し、TestAssignmentParamsV1 へ変換"""
        try:
            params = TestAssignmentParamsV1.from_json(value)
            params.validate()
            params.normalize()
            return params.to_dict()  # 正規化済みのdictを返す
        except TestParamsValidationError as e:
            raise drf_serializers.ValidationError(str(e))
        except Exception as e:
            raise drf_serializers.ValidationError(f"run_params の処理に失敗しました: {e}")
