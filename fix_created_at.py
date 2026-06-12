from main import get_db

conn = get_db()
cur = conn.cursor()

tables = [
    "users", "courses", "modules", "materials", "pages", "assignments", 
    "discussions", "announcements", "quizzes", "quiz_questions", 
    "quiz_options", "quiz_answers", "rubrics", "submissions", 
    "discussion_posts", "calendar_events", "student_fee_payments", "teacher_salaries"
]

for table in tables:
    try:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
        conn.commit()
    except Exception as e:
        conn.rollback()

cur.close()
conn.close()

print("Missing columns added!")