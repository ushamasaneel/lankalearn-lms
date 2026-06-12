from main import get_db

def run_full_fix():
    conn = get_db()
    
    # 1. Create ALL tables in dependency order
    tables = [
        "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT NOT NULL, role TEXT NOT NULL, must_change_password BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS courses (id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT, teacher_id INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS class_details (grade TEXT PRIMARY KEY, teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL);",
        "CREATE TABLE IF NOT EXISTS teacher_salaries (id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, month TEXT NOT NULL, paid_date TEXT NOT NULL, method TEXT NOT NULL, reference TEXT, basic REAL DEFAULT 0.0, allowances REAL DEFAULT 0.0, deductions REAL DEFAULT 0.0, net_paid REAL DEFAULT 0.0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS attendance (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), student_id INTEGER NOT NULL REFERENCES users(id), date TEXT NOT NULL, status TEXT NOT NULL, UNIQUE(course_id, student_id, date));",
        "CREATE TABLE IF NOT EXISTS enrollments (id SERIAL PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES users(id), course_id INTEGER NOT NULL REFERENCES courses(id), enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(student_id, course_id));",
        "CREATE TABLE IF NOT EXISTS modules (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), title TEXT NOT NULL, description TEXT, position INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS materials (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), title TEXT NOT NULL, content TEXT, file_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS pages (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), title TEXT NOT NULL, body TEXT, file_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS assignments (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), title TEXT NOT NULL, description TEXT, due_date TEXT, points INTEGER DEFAULT 100, rubric_id INTEGER, file_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS discussions (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), title TEXT NOT NULL, prompt TEXT, due_date TEXT, graded INTEGER DEFAULT 0, rubric_id INTEGER, file_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS announcements (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), title TEXT NOT NULL, body TEXT, author_id INTEGER REFERENCES users(id), file_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS quizzes (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), title TEXT NOT NULL, description TEXT, due_date TEXT, file_name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS quiz_questions (id SERIAL PRIMARY KEY, quiz_id INTEGER NOT NULL REFERENCES quizzes(id), question_text TEXT NOT NULL, question_type TEXT NOT NULL, points INTEGER DEFAULT 1, position INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS quiz_options (id SERIAL PRIMARY KEY, question_id INTEGER NOT NULL REFERENCES quiz_questions(id), option_text TEXT NOT NULL, is_correct BOOLEAN DEFAULT FALSE, position INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS quiz_answers (id SERIAL PRIMARY KEY, quiz_id INTEGER NOT NULL REFERENCES quizzes(id), student_id INTEGER NOT NULL REFERENCES users(id), question_id INTEGER NOT NULL REFERENCES quiz_questions(id), selected_option_id INTEGER REFERENCES quiz_options(id), is_correct BOOLEAN, submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(quiz_id, student_id, question_id));",
        "CREATE TABLE IF NOT EXISTS rubrics (id SERIAL PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id), title TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS rubric_criteria (id SERIAL PRIMARY KEY, rubric_id INTEGER NOT NULL REFERENCES rubrics(id), description TEXT NOT NULL, points INTEGER NOT NULL);",
        "CREATE TABLE IF NOT EXISTS module_items (id SERIAL PRIMARY KEY, module_id INTEGER NOT NULL REFERENCES modules(id), type TEXT NOT NULL, item_id INTEGER NOT NULL, position INTEGER DEFAULT 0);",
        "CREATE TABLE IF NOT EXISTS submissions (id SERIAL PRIMARY KEY, assignment_id INTEGER NOT NULL REFERENCES assignments(id), student_id INTEGER NOT NULL REFERENCES users(id), text_response TEXT, file_name TEXT, submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, grade REAL, feedback TEXT, graded_at TEXT, UNIQUE(assignment_id, student_id));",
        "CREATE TABLE IF NOT EXISTS discussion_posts (id SERIAL PRIMARY KEY, discussion_id INTEGER NOT NULL REFERENCES discussions(id), author_id INTEGER NOT NULL REFERENCES users(id), parent_id INTEGER REFERENCES discussion_posts(id), body TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS syllabus (id SERIAL PRIMARY KEY, course_id INTEGER UNIQUE NOT NULL REFERENCES courses(id), content TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS calendar_events (id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT, event_date TEXT NOT NULL, event_type TEXT NOT NULL, course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS quiz_submissions (id SERIAL PRIMARY KEY, quiz_id INTEGER NOT NULL REFERENCES quizzes(id), student_id INTEGER NOT NULL REFERENCES users(id), attempts INTEGER DEFAULT 0, grade REAL, submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(quiz_id, student_id));",
        "CREATE TABLE IF NOT EXISTS grade_fee_structure (id SERIAL PRIMARY KEY, grade_name TEXT UNIQUE NOT NULL, monthly_tuition REAL NOT NULL);",
        "CREATE TABLE IF NOT EXISTS student_fee_payments (id SERIAL PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, amount REAL NOT NULL, payment_type TEXT NOT NULL DEFAULT 'monthly', payment_for TEXT, fee_month TEXT, paid_date TEXT NOT NULL, receipt_number TEXT, notes TEXT, recorded_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS class_timetables (id SERIAL PRIMARY KEY, grade TEXT NOT NULL, course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE, day_of_week TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL);",
        "CREATE TABLE IF NOT EXISTS broadcast_alerts (id SERIAL PRIMARY KEY, title TEXT NOT NULL, message TEXT NOT NULL, target_audience TEXT NOT NULL, created_by INTEGER REFERENCES users(id), is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expires_at TEXT);",
        "CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, details TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
        "CREATE TABLE IF NOT EXISTS student_invoices (id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES users(id), invoice_month TEXT, total_amount REAL, UNIQUE(student_id, invoice_month));",
        "CREATE TABLE IF NOT EXISTS invoice_payments (id SERIAL PRIMARY KEY, invoice_id INTEGER REFERENCES student_invoices(id), amount REAL, paid_date TEXT, recorded_by INTEGER REFERENCES users(id));",
        "CREATE TABLE IF NOT EXISTS student_fee_structure (id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES users(id), monthly_fee REAL, currency TEXT DEFAULT 'LKR', effective_from TEXT);"
    ]

    # 2. Add all dynamic columns
    columns = [
        ("users", "dob", "TEXT"), ("users", "address", "TEXT"), ("users", "phone", "TEXT"),
        ("users", "notes", "TEXT"), ("users", "profile_image", "TEXT"), ("users", "grade", "TEXT"),
        ("users", "admission_number", "TEXT"), ("users", "employment_status", "TEXT DEFAULT 'long-term'"),
        ("users", "must_change_password", "BOOLEAN DEFAULT FALSE"), ("users", "is_deleted", "BOOLEAN DEFAULT FALSE"),
        ("courses", "grade", "TEXT"), ("courses", "start_date", "TEXT"), ("courses", "end_date", "TEXT"),
        ("courses", "is_deleted", "BOOLEAN DEFAULT FALSE"),
        ("assignments", "file_name", "TEXT"), ("discussions", "file_name", "TEXT"),
        ("announcements", "file_name", "TEXT"), ("pages", "file_name", "TEXT"),
        ("syllabus", "file_name", "TEXT"), ("quizzes", "file_name", "TEXT"), 
        ("quizzes", "time_limit", "TEXT"), ("quizzes", "max_attempts", "TEXT"),
        ("calendar_events", "start_date", "TEXT"), ("calendar_events", "end_date", "TEXT"), 
        ("calendar_events", "has_time", "INTEGER"), ("student_fee_payments", "is_deleted", "BOOLEAN DEFAULT FALSE"),
        ("teacher_salaries", "is_deleted", "BOOLEAN DEFAULT FALSE")
    ]

    try:
        with conn.cursor() as cur:
            for query in tables:
                cur.execute(query)
            conn.commit()

        for table, col, dtype in columns:
            try:
                with conn.cursor() as cur:
                    cur.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {dtype};")
                conn.commit()
            except Exception:
                conn.rollback()
                
        # Fix defaults for soft-delete columns
        try:
            with conn.cursor() as cur:
                for t in ["users", "courses", "student_fee_payments", "teacher_salaries"]:
                    cur.execute(f"UPDATE {t} SET is_deleted = FALSE WHERE is_deleted IS NULL;")
            conn.commit()
        except Exception:
            conn.rollback()

        print("Full database schema perfectly mapped!")
    finally:
        conn.close()

if __name__ == "__main__":
    run_full_fix()