from __future__ import annotations
import re
from pathlib import Path

def has_file_action_intent(text: str) -> bool:
    t_low = text.lower()
    coding_verbs = ["create", "write", "make", "save", "generate", "banao", "karo", "likho", "run", "build", "bana"]
    coding_nouns = ["file", "folder", "directory", "dir", "script", "code", "repo", "website", "project", "app", "ui", "template", "page"]
    
    # Strong specific coding phrases that shouldn't require both a verb and a noun
    strong_indicators = [
        "banao", "likho", "create", "generate", "write code", "code write", 
        "polish karo", "better karo", "refactor", "modify", "change code",
        "ui bana", "website bana", "page bana"
    ]
    if any(si in t_low for si in strong_indicators):
        return True
        
    has_verb = any(v in t_low for v in coding_verbs)
    has_noun = any(n in t_low for n in coding_nouns)
    if has_verb and has_noun:
        return True
    phrases = ["file manager", "write code to", "save code to", "write to file", "code write", "script save", "output.pdf"]
    if any(p in t_low for p in phrases):
        return True
    extensions = [".py", ".js", ".html", ".css", ".txt", ".json", ".pdf"]
    if has_verb and any(ext in t_low for ext in extensions):
        return True
    return False

def get_fuzzy_folder(text: str) -> Path | None:
    t_low = text.lower()
    words = re.findall(r'[a-zA-Z]+', t_low)
    
    targets = {
        "downloads": ["downloads", "download", "downlaod", "downlod", "downld", "downl"],
        "desktop": ["desktop", "desktp", "desk", "dsktp"],
        "documents": ["documents", "document", "decument", "doc", "docs", "docmnt"]
    }
    
    # 1. Check direct substring matches
    for key, variations in targets.items():
        for var in variations:
            if var in t_low:
                if key == "downloads":
                    return Path.home() / "Downloads"
                elif key == "desktop":
                    return Path.home() / "Desktop"
                elif key == "documents":
                    return Path.home() / "Documents"
    
    # 2. Levenshtein edit distance for heavy typos
    def edit_distance(s1: str, s2: str) -> int:
        if len(s1) < len(s2):
            return edit_distance(s2, s1)
        if len(s2) == 0:
            return len(s1)
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        return previous_row[-1]

    for word in words:
        for standard_name, dest_path in [
            ("downloads", Path.home() / "Downloads"),
            ("desktop", Path.home() / "Desktop"),
            ("documents", Path.home() / "Documents")
        ]:
            if len(word) >= 4 and edit_distance(word, standard_name) <= 2:
                return dest_path
    return None
