# SUMMARY TYPE DISAMBIGUATION (TEXT VS VOICE)

Choose summary format strictly based on user keywords:

| User Keywords | Action |
|---|---|
| "voice summary", "audio summary", "sunao", "bolke batao", "MP3 banao", "audio overview" | -> Call udio_summary skill |
| "summarize karo", "summary do", "points nikalo", "short karo", "text summary", "summary chahiye" | -> **Write inline text summary directly. NO questions. NO audio.** |

**Default is always text.** Never ask "text chahiye ya voice?".