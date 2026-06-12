import main

hashed_pw = None
hash_func_names = ['hash_pw', 'get_password_hash', 'hash_password', 'create_hash']

for name in hash_func_names:
    if hasattr(main, name):
        hashed_pw = getattr(main, name)("admin123")
        break

if not hashed_pw:
    from passlib.context import CryptContext
    hashed_pw = CryptContext(schemes=["bcrypt"], deprecated="auto").hash("admin123")

conn = main.get_db()
cur = conn.cursor()
cur.execute("UPDATE users SET password_hash = %s WHERE username = 'admin'", (hashed_pw,))
conn.commit()
cur.close()
conn.close()

print("Admin password hashed and updated successfully!")