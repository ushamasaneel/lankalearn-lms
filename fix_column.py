from main import get_db

conn = get_db()
cur = conn.cursor()
cur.execute("ALTER TABLE users RENAME COLUMN password TO password_hash;")
conn.commit()
cur.close()
conn.close()

print("Column renamed!")