import sqlite3

db_path = r"C:\Users\anshu\.gemini\antigravity\scratch\mariano\data\mariano.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get recent chat sessions
cursor.execute("SELECT id, title, project FROM chat_sessions ORDER BY created_at DESC LIMIT 5")
print("RECENT SESSIONS:")
for row in cursor.fetchall():
    print(row)
print("==============================")

# Get messages for active session
cursor.execute("SELECT role, text, metadata FROM chat_messages WHERE chat_id = 'chat_1783737332636'")
print("ACTIVE SESSION MESSAGES:")
for row in cursor.fetchall():
    print("ROLE:", row[0])
    text_preview = row[1][:100] + "..." if len(row[1]) > 100 else row[1]
    print("TEXT:", repr(text_preview))
    print("META:", row[2])
    print("------------------------------")

conn.close()
