import sqlite3

db_path = r"C:\Users\anshu\.gemini\antigravity\scratch\mariano\data\mariano.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT role, COUNT(*) FROM chat_messages GROUP BY role")
print("MESSAGE COUNTS BY ROLE:")
for row in cursor.fetchall():
    print(row)

print("==============================")
cursor.execute("SELECT chat_id, role, text FROM chat_messages ORDER BY timestamp DESC LIMIT 20")
print("RECENT 20 MESSAGES:")
for row in cursor.fetchall():
    print(row[0], "|", row[1], "|", repr(row[2][:50]))

conn.close()
