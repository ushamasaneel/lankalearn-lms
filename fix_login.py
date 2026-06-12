from main import get_db

conn = get_db()
cur = conn.cursor()

# Add the missing full_name column to users and update the admin account
cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);")
cur.execute("UPDATE users SET full_name = 'Admin User' WHERE username = 'admin';")

# Create the missing audit_logs table
cur.execute("""
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(255),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

conn.commit()
cur.close()
conn.close()

print("Schema updated successfully!")