import os
import re

SRC_DIR = r"d:\Hekki-Assistant\zero_voip_telephony_bridge\react_dashboard\src"

HEX_MAP = {
    # Blue shades
    r"#2563EB": "var(--text-main)",
    r"#1D4ED8": "var(--text-main)",
    r"#3B82F6": "var(--text-main)",
    r"#60A5FA": "var(--text-main)",
    r"#93C5FD": "var(--text-main)",
    r"#EFF6FF": "var(--surface-muted)",
    r"#BFDBFE": "var(--surface-border)",
    r"#1E40AF": "var(--text-main)",
    r"#1E3A8A": "var(--text-main)",
    r"#2563eb": "var(--text-main)",
    r"#3b82f6": "var(--text-main)",
    r"rgba\(37, 99, 235, 0.08\)": "rgba(15, 23, 42, 0.06)",
    r"rgba\(37, 99, 235, 0.15\)": "rgba(15, 23, 42, 0.10)",
    r"rgba\(37, 99, 235, 0.25\)": "rgba(15, 23, 42, 0.15)",
    r"rgba\(59, 130, 246, 0.15\)": "rgba(255, 255, 255, 0.10)",
    r"rgba\(59, 130, 246, 0.08\)": "rgba(255, 255, 255, 0.06)",
    r"rgba\(59, 130, 246, 0.04\)": "rgba(255, 255, 255, 0.04)",

    # Green shades
    r"#10B981": "var(--text-main)",
    r"#059669": "var(--text-main)",
    r"#047857": "var(--text-muted)",
    r"#065F46": "var(--text-main)",
    r"#ECFDF5": "var(--surface-muted)",
    r"#F0FDF4": "var(--surface-muted)",
    r"#16A34A": "var(--text-main)",
    r"#34D399": "var(--text-main)",

    # Red/Orange shades
    r"#DC2626": "var(--text-main)",
    r"#EF4444": "var(--text-muted)",
    r"#FEF2F2": "var(--surface-muted)",
    r"#EA580C": "var(--text-main)",
    r"#F59E0B": "var(--text-main)",
    r"#FFF7ED": "var(--surface-muted)",

    # Purple shades
    r"#7C3AED": "var(--text-main)",
    r"#6D28D9": "var(--text-main)",
    r"#8B5CF6": "var(--text-main)",
    r"#F5F3FF": "var(--surface-muted)",
}

replaced_files = []

for root, dirs, files in os.walk(SRC_DIR):
    for f in files:
        if f.endswith(('.jsx', '.js', '.css')):
            fpath = os.path.join(root, f)
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as fp:
                content = fp.read()

            new_content = content
            # Replace icon color="#2563EB" -> color="var(--text-main)"
            new_content = re.sub(r'color=[\'"]#(?:2563EB|1D4ED8|3B82F6|60A5FA|10B981|059669|DC2626|EF4444|EA580C|F59E0B|7C3AED|8B5CF6)[\'"]', 'color="var(--text-main)"', new_content)

            # Replace background-color / fills
            for pattern, replacement in HEX_MAP.items():
                new_content = re.sub(pattern, replacement, new_content)

            if new_content != content:
                with open(fpath, 'w', encoding='utf-8') as fp:
                    fp.write(new_content)
                replaced_files.append(fpath)

print(f"Swept {len(replaced_files)} files.")
for f in replaced_files:
    print(f" - {f}")
