"""MITRE technique mapping and severity helper for red_team_ops."""
from __future__ import annotations

TECHNIQUE_MAP = {
    ".env": ("T1552.001", "Unsecured Credentials — Environment Files"),
    ".git": ("T1213", "Data from Information Repositories — Source Control"),
    "swagger": ("T1592", "Gather Victim Host Information — API Surface"),
    "openapi": ("T1592", "Gather Victim Host Information — API Surface"),
    "api-docs": ("T1592", "Gather Victim Host Information — API Surface"),
    "actuator": ("T1046", "Network Service Discovery — Health/Actuator"),
    "admin": ("T1078", "Valid Accounts — Admin Panel Exposure"),
    "login": ("T1110", "Brute Force Surface — Auth Endpoint"),
    "jenkins": ("T1072", "Software Deployment Tools"),
    "grafana": ("T1190", "Exploit Public-Facing Application — Dashboard"),
    "cors": ("T1539", "Steal Web Session Cookie / Cross-Origin Risk"),
    "headers": ("T1190", "Public App Hardening Gap — Missing Controls"),
    "server_disclosure": ("T1592.002", "Software Fingerprinting via Headers"),
}


def match_technique(key: str) -> tuple[str, str]:
    key_l = key.lower()
    for needle, pair in TECHNIQUE_MAP.items():
        if needle in key_l:
            return pair
    return ("T1595", "Active Scanning")


def severity_to_priority(severity: str) -> int:
    s = severity.upper()
    if s == "CRITICAL":
        return 1
    if s == "HIGH":
        return 2
    if s == "MEDIUM":
        return 3
    if s == "LOW":
        return 4
    return 5
