import sqlite3

def list_tables_and_data():
    conn = sqlite3.connect('data/mariano.db')
    cursor = conn.cursor()
    try:
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [t[0] for t in cursor.fetchall()]
        print("Tables in database:", tables)
        
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"Table '{table}' has {count} rows.")
            
            # Print column names
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [c[1] for c in cursor.fetchall()]
            print(f"  Columns: {columns}")
            
            # Print sample data
            cursor.execute(f"SELECT * FROM {table} LIMIT 2")
            rows = cursor.fetchall()
            for r in rows:
                print("  Row:", r)
    except Exception as e:
        print("Error:", e)
    finally:
        conn.close()

if __name__ == '__main__':
    list_tables_and_data()
