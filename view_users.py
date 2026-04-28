import psycopg2

# Paste your EXTERNAL Database URL here
EXTERNAL_URL = "postgresql://lankalearn1_user:QIkCMALDh9p4gTIkLGtmCzAl3cebZ77Q@dpg-d7mit4hf9bms7381m55g-a.oregon-postgres.render.com/lankalearn1" 

conn = psycopg2.connect(EXTERNAL_URL)
cur = conn.cursor()

cur.execute("SELECT id, username, role, password_hash FROM users;")
print("ID | USERNAME | ROLE | PASSWORD_HASH")
print("-" * 60)
for row in cur.fetchall():
    print(f"{row[0]} | {row[1]} | {row[2]} | {row[3][:15]}...")

conn.close()