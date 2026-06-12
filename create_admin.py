from main import get_db

conn = get_db()
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    role VARCHAR(50),
    is_deleted BOOLEAN DEFAULT FALSE
);
""")

cur.execute("""
INSERT INTO users (username, password, role) 
VALUES ('admin', 'admin123', 'admin')
ON CONFLICT (username) DO NOTHING;
""")

conn.commit()
cur.close()
conn.close()

print("User table and admin account created successfully!")