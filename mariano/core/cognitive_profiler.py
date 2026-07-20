"""MARIANO Core — Cognitive Profiler (Employee Identity, User Persona & Feedback Loop)."""
from __future__ import annotations

import csv
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import structlog

from mariano.config import get_settings

log = structlog.get_logger(__name__)


class EmployeeProfile:
    """MARIANO's professional identification card & performance tracker."""

    def __init__(self) -> None:
        self.employee_id = "MARIANO-001"
        self.designation = "Lead Cognitive Sentinel"
        self.department = "Autonomous Operations & Metaprogramming"
        self.boot_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def get_performance_stats(self) -> Dict[str, Any]:
        """Fetch real-time execution statistics for HUD."""
        from mariano.skills._registry.registry import SkillRegistry
        registry = SkillRegistry.get_instance()
        
        all_stats = [s.get_stats() for s in registry.get_all()]
        total_calls = sum(s["call_count"] for s in all_stats)
        total_errors = sum(s["error_count"] for s in all_stats)
        
        success_rate = 1.0
        if total_calls > 0:
            success_rate = (total_calls - total_errors) / total_calls

        return {
            "id": self.employee_id,
            "role": self.designation,
            "boot_time": self.boot_time,
            "total_calls": total_calls,
            "success_rate": round(success_rate * 100, 1),
        }


class UserProfiler:
    """Tracks user tastes, dislikes, active projects, and daily tasks."""

    def __init__(self, data_dir: Path) -> None:
        self.profile_path = data_dir / "user_persona.json"
        self.profile = {
            "name": "Admin",
            "traits": ["Highly demanding", "Prefers direct solutions", "Tech-savvy"],
            "likes": [],
            "dislikes": [],
            "past_activities": {},
        }
        self.load_profile()

    def load_profile(self) -> None:
        if self.profile_path.exists():
            try:
                self.profile = json.loads(self.profile_path.read_text(encoding="utf-8"))
            except Exception as e:
                log.error("profiler.load_failed", error=str(e))

    def save_profile(self) -> None:
        self.profile_path.parent.mkdir(parents=True, exist_ok=True)
        self.profile_path.write_text(json.dumps(self.profile, indent=2), encoding="utf-8")

    def record_activity(self, date_str: str, activity: str) -> None:
        activities = self.profile.setdefault("past_activities", {})
        day_logs = activities.setdefault(date_str, [])
        if activity not in day_logs:
            day_logs.append(activity)
            self.save_profile()

    def update_preferences(self, like: str = "", dislike: str = "") -> None:
        if like and like not in self.profile["likes"]:
            self.profile["likes"].append(like)
        if dislike and dislike not in self.profile["dislikes"]:
            self.profile["dislikes"].append(dislike)
        self.save_profile()


class FeedbackAnalyzer:
    """Data Science loop analyzing user sentiment, logging csv logs, and predicting parameters."""

    def __init__(self, data_dir: Path) -> None:
        self.csv_path = data_dir / "user_feedback_data.csv"
        self.user_profiler = UserProfiler(data_dir)
        self._init_csv()

    def _init_csv(self) -> None:
        if not self.csv_path.exists():
            self.csv_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "timestamp", "user_input", "assistant_output", 
                    "sentiment", "detected_likes", "detected_dislikes"
                ])

    def analyze_feedback(self, user_input: str, assistant_output: str) -> str:
        """Heuristic analysis of user sentiment & updates memory/profile states."""
        text = user_input.lower()
        sentiment = "neutral"
        
        # 1. Detection of Negative Feedback (Boring, wrong, reject)
        neg_patterns = [
            r"nahin", r"nahi", r"galat", r"boring", r"bekar", r"wrong", 
            r"error", r"fault", r"waste", r"bakwas", r"change this"
        ]
        pos_patterns = [
            r"sahi", r"mast", r"perfect", r"awesome", r"great", r"good",
            r"dhanyawad", r"thanks", r"nice", r"achha"
        ]

        if any(re.search(pat, text) for pat in neg_patterns):
            sentiment = "negative"
            # Extrapolate dislikes
            disliked_item = self._extract_subject(user_input)
            if disliked_item:
                self.user_profiler.update_preferences(dislike=disliked_item)
        elif any(re.search(pat, text) for pat in pos_patterns):
            sentiment = "positive"
            liked_item = self._extract_subject(user_input)
            if liked_item:
                self.user_profiler.update_preferences(like=liked_item)

        # 2. Log to CSV for data-science feedback loop
        with open(self.csv_path, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                user_input,
                assistant_output[:200],
                sentiment,
                ", ".join(self.user_profiler.profile["likes"][-3:]),
                ", ".join(self.user_profiler.profile["dislikes"][-3:])
            ])

        return sentiment

    def get_dynamic_prompt_rules(self) -> str:
        """Generates dynamic safety directives based on user likes/dislikes data analysis."""
        profile = self.user_profiler.profile
        likes_str = ", ".join(profile["likes"]) if profile["likes"] else "None logged yet"
        dislikes_str = ", ".join(profile["dislikes"]) if profile["dislikes"] else "None logged yet"
        
        return (
            f"\n\n[USER PERSONA & ALIGNMENT DICTATES]\n"
            f"- User Likes/Preferences: {likes_str}\n"
            f"- User Dislikes/Avoid: {dislikes_str}\n"
            f"Directives:\n"
            f"- ABSOLUTELY avoid doing anything listed in the User Dislikes.\n"
            f"- Prioritize methods matching User Likes.\n"
            f"- You must adapt your vocabulary to align with the user's style."
        )

    def _extract_subject(self, text: str) -> str:
        # Simple extraction of last few words representing the topic
        words = text.split()
        if len(words) >= 2:
            return " ".join(words[-2:])
        return ""


class CognitiveProfiler:
    """The master integration class holding AI Persona, User Profile, and Data-Science Feedback loop."""

    _instance: Optional[CognitiveProfiler] = None

    def __init__(self) -> None:
        settings = get_settings()
        self.employee = EmployeeProfile()
        self.user = UserProfiler(settings.mariano_data_dir)
        self.feedback = FeedbackAnalyzer(settings.mariano_data_dir)

    @classmethod
    def get_instance(cls) -> CognitiveProfiler:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
