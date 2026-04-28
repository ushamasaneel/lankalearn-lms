"""
LankaLearn LMS - Main Backend
FastAPI + PostgreSQL (Render)
Optimized for Sri Lankan Market with Real File Uploads
"""

import hashlib, json, os, uuid, shutil
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import IntegrityError
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import Cookie, Depends, FastAPI, Form, HTTPException, Request, Response, File, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

# ---------------------------------------------------------------------------
# App setup & File Storage
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
# Create organized directory structure for uploaded files
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create subdirectories for organization
TEACHER_UPLOAD_DIR = UPLOAD_DIR / "teachers"
STUDENT_UPLOAD_DIR = UPLOAD_DIR / "students"
TEACHER_UPLOAD_DIR.mkdir(exist_ok=True)
STUDENT_UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="LankaLearn LMS")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
# This line makes the uploaded files accessible via URL
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# In-memory session store  {session_id: user_id}
SESSIONS: dict[str, int] = {}

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

# We use the Render external URL so your local computer can talk to the cloud DB
DATABASE_URL = "postgresql://lankalearn1_user:QIkCMALDh9p4gTIkLGtmCzAl3cebZ77Q@dpg-d7mit4hf9bms7381m55g-a.oregon-postgres.render.com/lankalearn1"

def get_db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is missing. Please set it in your environment variables.")
    return psycopg2.connect(DATABASE_URL)

def query(sql: str, params=(), *, one=False, db=None):
    close = db is None
    if db is None:
        db = get_db()
    
    with db.cursor(cursor_factory=RealDictCursor) as cur:
        formatted_sql = sql.replace('?', '%s')
        cur.execute(formatted_sql, params)
        rows = cur.fetchall()
    
    if close:
        db.close()
    if one:
        return dict(rows[0]) if rows else None
    return [dict(r) for r in rows]

def execute(sql: str, params=(), *, db=None):
    close = db is None
    if db is None:
        db = get_db()
    
    with db.cursor() as cur:
        formatted_sql = sql.replace('?', '%s')
        
        if "INSERT" in sql.upper() and "RETURNING" not in formatted_sql.upper():
            formatted_sql += " RETURNING id"
            
        cur.execute(formatted_sql, params)
        
        last_id = None
        if "RETURNING" in formatted_sql.upper() and cur.description:
            result = cur.fetchone()
            if result:
                last_id = result[0]
                
    db.commit()
    if close:
        db.close()
    return last_id

def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def now_str() -> str:
    return datetime.now().isoformat(sep=" ", timespec="seconds")

def future(days: int) -> str:
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def get_session(session_id: Optional[str] = Cookie(default=None)) -> Optional[int]:
    if session_id and session_id in SESSIONS:
        return SESSIONS[session_id]
    return None

def require_user(session_id: Optional[str] = Cookie(default=None)):
    uid = get_session(session_id)
    if uid is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = query("SELECT * FROM users WHERE id=?", (uid,), one=True)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_role(*roles):
    def dep(user=Depends(require_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return dep

# ---------------------------------------------------------------------------
# Enhanced Assignment Submission (Real File Handling)
# ---------------------------------------------------------------------------
@app.post("/api/courses/{cid}/assignments/{aid}/submissions")
async def submit_assignment(
    cid: int, 
    aid: int, 
    text_response: str = Form(""),
    file: UploadFile = File(None),
    user=Depends(require_user)
):
    if user["role"] != "student":
        raise HTTPException(403, "Only students can submit assignments")
    
    # Check course access
    check_course_access(cid, user)

    saved_filename = None
    
    try:
        if file and file.filename:
            # Create organized directory structure for student uploads
            assignment_dir = STUDENT_UPLOAD_DIR / f"assignment_{aid}"
            assignment_dir.mkdir(exist_ok=True)
            
            # Create a unique filename for the Sri Lankan context (User_ID + Time + Name)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            # Clean the filename to prevent security issues
            clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
            saved_filename = f"submissions/assignment_{aid}/student_{user['id']}_{timestamp}_{clean_name}"
            file_path = assignment_dir / f"student_{user['id']}_{timestamp}_{clean_name}"
            
            # Use shutil to avoid reading entire file into memory
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

        existing = query("SELECT id, file_name FROM submissions WHERE assignment_id=? AND student_id=?",
                         (aid, user["id"]), one=True)
        
        if existing:
            # If no new file uploaded, keep the old one
            final_file = saved_filename if saved_filename else existing["file_name"]
            execute("UPDATE submissions SET text_response=?, file_name=?, submitted_at=? WHERE assignment_id=? AND student_id=?",
                    (text_response, final_file, now_str(), aid, user["id"]))
        else:
            execute("INSERT INTO submissions(assignment_id, student_id, text_response, file_name, submitted_at) VALUES(?,?,?,?,?)",
                    (aid, user["id"], text_response, saved_filename, now_str()))
        
        return {"ok": True, "file_name": saved_filename}
    except Exception as e:
        # Clean up file if it was created but DB operation failed
        if saved_filename:
            try:
                (STUDENT_UPLOAD_DIR / f"assignment_{aid}" / saved_filename.split("/")[-1]).unlink()
            except:
                pass
        raise HTTPException(500, f"Failed to submit assignment: {str(e)}")

# ---------------------------------------------------------------------------
# DB initialisation
# ---------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    student_id INTEGER NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late')),
    UNIQUE(course_id, student_id, date)
);

CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    teacher_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

CREATE TABLE IF NOT EXISTS modules (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS materials (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    content TEXT,
    file_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pages (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    body TEXT,
    file_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    points INTEGER DEFAULT 100,
    rubric_id INTEGER,
    file_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discussions (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    prompt TEXT,
    due_date TEXT,
    graded INTEGER DEFAULT 0,
    rubric_id INTEGER,
    file_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    body TEXT,
    author_id INTEGER REFERENCES users(id),
    file_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    file_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK(question_type IN ('multiple_choice', 'true_false')),
    points INTEGER DEFAULT 1,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_options (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_answers (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
    student_id INTEGER NOT NULL REFERENCES users(id),
    question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
    selected_option_id INTEGER REFERENCES quiz_options(id),
    is_correct BOOLEAN,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(quiz_id, student_id, question_id)
);

CREATE TABLE IF NOT EXISTS rubrics (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rubric_criteria (
    id SERIAL PRIMARY KEY,
    rubric_id INTEGER NOT NULL REFERENCES rubrics(id),
    description TEXT NOT NULL,
    points INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS module_items (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id),
    type TEXT NOT NULL CHECK(type IN ('material','assignment','discussion','page','quiz')),
    item_id INTEGER NOT NULL,
    position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id),
    student_id INTEGER NOT NULL REFERENCES users(id),
    text_response TEXT,
    file_name TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    grade REAL,
    feedback TEXT,
    graded_at TEXT,
    UNIQUE(assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS discussion_posts (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER NOT NULL REFERENCES discussions(id),
    author_id INTEGER NOT NULL REFERENCES users(id),
    parent_id INTEGER REFERENCES discussion_posts(id),
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS syllabus (
    id SERIAL PRIMARY KEY,
    course_id INTEGER UNIQUE NOT NULL REFERENCES courses(id),
    content TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

def init_db():
    db = get_db()
    for stmt in SCHEMA.strip().split(";"):
        s = stmt.strip()
        if s:
            db.cursor().execute(s)
    try:
        with db.cursor() as cur:
            # Add file_name columns to tables that need them
            tables_to_update = [
                ('users', 'dob'),                # <-- ADD THIS
                ('users', 'address'),            # <-- ADD THIS
                ('users', 'notes'),              # <-- ADD THIS
                ('users', 'profile_image'),      # <-- ADD THIS
                ('users', 'phone'),
                ('assignments', 'file_name'),
                ('discussions', 'file_name'),
                ('announcements', 'file_name'),
                ('quizzes', 'file_name'),
                ('quizzes', 'time_limit'),
                ('quizzes', 'max_attempts'), 
                ('pages', 'file_name'),
                ('syllabus', 'file_name'),
                ('courses', 'start_date'), 
                ('courses', 'end_date')
            ]
            for table, column in tables_to_update:
                cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s AND column_name=%s",
                            (table, column))
                if cur.fetchone() is None:
                    cur.execute(f'ALTER TABLE {table} ADD COLUMN {column} TEXT')
            
            # Create the quiz submissions table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS quiz_submissions (
                    id SERIAL PRIMARY KEY,
                    quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
                    student_id INTEGER NOT NULL REFERENCES users(id),
                    attempts INTEGER DEFAULT 0,
                    grade REAL,
                    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(quiz_id, student_id)
                )
            """)
            
            # --- THE FIX: Auto-sync all PostgreSQL sequences ---
            tables_with_sequences = [
                'users', 'courses', 'modules', 'materials', 'pages', 'assignments', 
                'discussions', 'announcements', 'quizzes', 'rubrics', 'rubric_criteria', 
                'module_items', 'submissions', 'discussion_posts', 'syllabus', 'quiz_submissions'
            ]
            for table in tables_with_sequences:
                try:
                    # Tells Postgres: "Look at the highest ID in this table, and set your counter to that number"
                    cur.execute(f"SELECT setval('{table}_id_seq', (SELECT COALESCE(MAX(id), 0) FROM {table}))")
                except:
                    pass

    except Exception:
        pass
    db.commit()

    if query("SELECT id FROM users LIMIT 1", db=db):
        db.close()
        return

    seed(db)
    db.close()


def seed(db):
    users = [
        (1, "admin",         hash_pw("admin123"),    "Admin User",            "admin"),
        (2, "nimal.teacher", hash_pw("teacher123"),  "Nimal Jayasinghe",      "teacher"),
        (3, "priya.teacher", hash_pw("teacher123"),  "Priyanka Wickramasinghe","teacher"),
        (4, "kasun",         hash_pw("student123"),  "Kasun Perera",          "student"),
        (5, "tharushi",      hash_pw("student123"),  "Tharushi Silva",        "student"),
        (6, "amali",         hash_pw("student123"),  "Amali Fernando",        "student"),
        (7, "dinesh",        hash_pw("student123"),  "Dinesh Rajapaksa",      "student"),
        (8, "sachini",       hash_pw("student123"),  "Sachini Bandara",       "student"),
    ]
    for u in users:
        db.cursor().execute("INSERT INTO users(id,username,password_hash,full_name,role) VALUES(%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING", u)

    courses = [
        (1, "OL-MATH-11",  "O/L Mathematics",      "Combined Mathematics for Ordinary Level Grade 11", 2),
        (2, "OL-SCI-11",   "O/L Science",          "Integrated Science for Ordinary Level Grade 11",  2),
        (3, "AL-BIO-13",   "A/L Biology",          "Advanced Level Biology for Grade 13",             3),
        (4, "AL-ICT-13",   "A/L ICT",              "Information & Communication Technology A/L",       3),
        (5, "OL-ENG-11",   "O/L English Language", "English Language & Literature Grade 11",          2),
    ]
    for c in courses:
        db.cursor().execute("INSERT INTO courses(id,code,name,description,teacher_id) VALUES(%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING", c)

    enrollments = [(4,1),(4,2),(4,5),(5,1),(5,3),(5,4),(6,1),(6,2),(6,4),(7,2),(7,3),(7,5),(8,3),(8,4),(8,5)]
    for e in enrollments:
        db.cursor().execute("INSERT INTO enrollments(student_id,course_id) VALUES(%s,%s) ON CONFLICT (student_id, course_id) DO NOTHING", e)

    db.cursor().execute("INSERT INTO rubrics(id,course_id,title) VALUES(1,1,'Math Assignment Rubric') ON CONFLICT (id) DO NOTHING")
    db.cursor().execute("INSERT INTO rubrics(id,course_id,title) VALUES(2,3,'Biology Lab Report Rubric') ON CONFLICT (id) DO NOTHING")
    
    criteria = [
        (1,1,"Correct methodology and working",40), (2,1,"Accuracy of final answer",30), (3,1,"Clarity and presentation",30),
        (4,2,"Introduction and hypothesis",20), (5,2,"Observations and data",40), (6,2,"Analysis and conclusion",40)
    ]
    for cr in criteria:
        db.cursor().execute("INSERT INTO rubric_criteria(id,rubric_id,description,points) VALUES(%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING", cr)

    # No fake seeded modules - allow teachers to create their own
    # modules = []

    materials = [
        (1,1,"Algebra Basics Notes",   "This chapter covers linear equations, quadratic equations and simultaneous equations...", "algebra_notes.pdf"),
        (2,1,"Geometry Worksheet",     "Practice problems on Pythagoras theorem and circle theorems.", "geometry_ws.pdf"),
        (3,2,"States of Matter Notes", "Solid, liquid, gas — kinetic theory and properties.", "matter_notes.pdf"),
        (4,3,"Cell Structure Diagram", "Labelled diagrams of plant and animal cells.", "cell_diagram.pdf"),
        (5,4,"Algorithm Flowcharts",   "Introduction to flowcharts and pseudocode.", "flowcharts.pdf"),
    ]
    for m in materials:
        db.cursor().execute("INSERT INTO materials(id,course_id,title,content,file_name) VALUES(%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING", m)

    pages = [
        (1,1,"Course Welcome","<h2>Welcome to O/L Mathematics!</h2><p>Dear students, this course will prepare you thoroughly for the O/L examination.</p>"),
        (2,4,"ICT Lab Rules","<h2>Computer Lab Rules</h2><ul><li>No food or drink near computers</li><li>Save your work every 10 minutes</li></ul>"),
    ]
    for p in pages:
        db.cursor().execute("INSERT INTO pages(id,course_id,title,body) VALUES(%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING", p)

    assignments = [
        (1,1,"Algebra Problem Set 1","Solve the given 20 problems on linear and quadratic equations.",future(7), 100,1),
        (2,1,"Geometry Test Preparation","Complete the 15 circle theorem problems from the textbook.",future(14),100,None),
        (3,2,"Science Lab Report","Write a full lab report on the experiment we conducted on density.",future(5), 80, None),
        (4,3,"Cell Biology Essay","Write a 500-word essay comparing plant and animal cells.",future(10),100,2),
        (5,4,"Programming Exercise 1","Implement the bubble sort algorithm in pseudocode.",future(6), 50, None),
    ]
    for a in assignments:
        db.cursor().execute("INSERT INTO assignments(id,course_id,title,description,due_date,points,rubric_id) VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING", a)

    discussions = [
        (1,1,"Tips for Solving Word Problems","Share your strategies for translating word problems into mathematical equations.",future(5),0,None),
        (2,3,"Osmosis vs Diffusion","Discuss the key differences between osmosis and diffusion.",future(8),1,None),
        (3,4,"Future of AI in Sri Lanka","How do you think Artificial Intelligence will impact Sri Lanka in the next 10 years?",future(12),0,None),
    ]
    for d in discussions:
        db.cursor().execute("INSERT INTO discussions(id,course_id,title,prompt,due_date,graded,rubric_id) VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING", d)

    posts = [
        (1,1,4,None,"I always underline the key numbers and draw a simple diagram first!"),
        (2,1,5,None,"I try to identify what is being asked first, then work backwards."),
        (3,1,6,1,"Great tip! I also find that checking units helps prevent mistakes."),
        (4,2,5,None,"Diffusion moves any substance from high to low concentration."),
        (5,2,7,None,"A good real-life example is how plants absorb water!"),
    ]
    for p in posts:
        db.cursor().execute("INSERT INTO discussion_posts(id,discussion_id,author_id,parent_id,body) VALUES(%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING", p)

    announcements = [
        (1,1,"Term Test Dates Released","Dear students, the Term 1 test will be held on " + future(21)[:10], 2),
        (2,2,"Lab Session Rescheduled","The science lab session originally on Friday has been moved to Monday.", 2),
        (3,3,"Field Trip to Peradeniya","We will be visiting the University of Peradeniya Botany Department.", 3),
        (4,4,"New Software Installed","Adobe Photoshop and Python 3.12 have been installed in the ICT lab.", 3),
    ]
    for a in announcements:
        db.cursor().execute("INSERT INTO announcements(id,course_id,title,body,author_id) VALUES(%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING", a)

    quizzes = [
        (1,1,"Chapter 1 Quick Quiz","10-minute quiz on solving linear equations.",future(3)),
        (2,3,"Cell Biology MCQ","Multiple choice questions on cell organelles.",future(9)),
        (3,4,"Algorithm Trace Quiz","Trace through given algorithms and find the output.",future(4)),
    ]
    for q in quizzes:
        db.cursor().execute("INSERT INTO quizzes(id,course_id,title,description,due_date) VALUES(%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING", q)

    # No fake seeded module items - removed fake modules
    # mitems = []

    submissions = [
        (1,1,4,"I solved problems 1-20. For Q1: x=3, Q2: x=5, x=2...","algebra_kasun.pdf", "2025-01-20 10:30:00", 85, "Good work Kasun!", "2025-01-21 14:00:00"),
        (2,1,5,"Completed all 20 problems using substitution method.","algebra_tharushi.pdf", "2025-01-20 11:00:00", 92, "Outstanding work!", "2025-01-21 14:30:00"),
        (3,1,6,"I solved all the equations step by step.","algebra_amali.pdf", "2025-01-21 09:00:00", None, None, None),
        (4,3,4,"Lab Report: Density Experiment...",None, "2025-01-22 15:00:00", 70, "Good effort.", "2025-01-23 10:00:00"),
    ]
    for s in submissions:
        db.cursor().execute("""INSERT INTO submissions(id,assignment_id,student_id,text_response,file_name,submitted_at,grade,feedback,graded_at) 
                               VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""", s)

    syllabi = [(1,1,"<h3>O/L Mathematics Syllabus</h3>"), (2,3,"<h3>A/L Biology Syllabus</h3>")]
    for s in syllabi:
        db.cursor().execute("INSERT INTO syllabus(id,course_id,content) VALUES(%s,%s,%s) ON CONFLICT (id) DO NOTHING", s)

    # Reset sequences to avoid ID conflicts when inserting new records
    tables_with_sequences = [
        'users', 'courses', 'modules', 'materials', 'pages', 'assignments', 
        'discussions', 'announcements', 'quizzes', 'rubrics', 'rubric_criteria', 
        'module_items', 'submissions', 'discussion_posts', 'syllabus'
    ]
    for table in tables_with_sequences:
        db.cursor().execute(f"SELECT setval('{table}_id_seq', (SELECT COALESCE(MAX(id), 0) FROM {table}))")

    db.commit()

# Run init_db when the application starts up on Render
@app.on_event("startup")
def startup_event():
    try:
        init_db()
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Error initializing database: {e}")

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def get_session(session_id: Optional[str] = Cookie(default=None)) -> Optional[int]:
    if session_id and session_id in SESSIONS:
        return SESSIONS[session_id]
    return None

def require_user(session_id: Optional[str] = Cookie(default=None)):
    uid = get_session(session_id)
    if uid is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = query("SELECT * FROM users WHERE id=?", (uid,), one=True)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_role(*roles):
    def dep(user=Depends(require_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return dep

# ---------------------------------------------------------------------------
# Static HTML routes
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def root():
    return (STATIC_DIR / "index.html").read_text(encoding="utf-8")

@app.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    return (STATIC_DIR / "dashboard.html").read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# Auth API
# ---------------------------------------------------------------------------

@app.post("/api/auth/login")
def login(response: Response, username: str = Form(...), password: str = Form(...)):
    user = query("SELECT * FROM users WHERE username=? AND password_hash=?",
                 (username, hash_pw(password)), one=True)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    sid = str(uuid.uuid4())
    SESSIONS[sid] = user["id"]
    response.set_cookie("session_id", sid, httponly=True, samesite="lax")
    return {"id": user["id"], "username": user["username"],
            "full_name": user["full_name"], "role": user["role"]}

@app.post("/api/auth/logout")
def logout(response: Response, session_id: Optional[str] = Cookie(default=None)):
    if session_id in SESSIONS:
        del SESSIONS[session_id]
    response.delete_cookie("session_id")
    return {"ok": True}

@app.get("/api/auth/me")
def me(user=Depends(require_user)):
    return {"id": user["id"], "username": user["username"],
            "full_name": user["full_name"], "role": user["role"]}

# ---------------------------------------------------------------------------
# Admin API
# ---------------------------------------------------------------------------

@app.get("/api/admin/stats")
def admin_stats(user=Depends(require_role("admin"))):
    return {
        "users":       query("SELECT COUNT(*) as c FROM users")[0]["c"],
        "courses":     query("SELECT COUNT(*) as c FROM courses")[0]["c"],
        "enrollments": query("SELECT COUNT(*) as c FROM enrollments")[0]["c"],
        "submissions": query("SELECT COUNT(*) as c FROM submissions")[0]["c"],
    }

@app.get("/api/admin/users")
def list_users(user=Depends(require_role("admin"))):
    return query("SELECT id, username, full_name, role, created_at, dob, address, phone, notes, profile_image FROM users ORDER BY role, full_name")

@app.post("/api/admin/users")
async def create_user(
    full_name: str = Form(...), username: str = Form(...), password: str = Form(...), 
    role: str = Form(...), dob: str = Form(""), address: str = Form(""), 
    phone: str = Form(""), notes: str = Form(""),
    file: UploadFile = File(None), user=Depends(require_role("admin"))
):
    if role not in ("teacher", "student", "admin"):
        raise HTTPException(400, "Invalid role")
    
    saved_filename = ""
    try:
        if file and file.filename:
            # ORGANIZED FOLDERS: uploads/profiles/teachers/Kasun_Perera/
            folder_role = "teachers" if role == "teacher" else "students"
            clean_folder_name = "".join(x for x in full_name if x.isalnum() or x == " ").replace(" ", "_")
            profile_dir = UPLOAD_DIR / "profiles" / folder_role / clean_folder_name
            profile_dir.mkdir(parents=True, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            clean_file_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
            saved_filename = f"profiles/{folder_role}/{clean_folder_name}/usr_{timestamp}_{clean_file_name}"
            file_path = UPLOAD_DIR / saved_filename
            
            content_bytes = await file.read()
            with file_path.open("wb") as buffer:
                buffer.write(content_bytes)

        uid = execute("""
            INSERT INTO users(username, password_hash, full_name, role, dob, address, phone, notes, profile_image) 
            VALUES(?,?,?,?,?,?,?,?,?)
        """, (username, hash_pw(password), full_name, role, dob, address, phone, notes, saved_filename))
        
        return {"id": uid, "message": "User created"}
    except IntegrityError:
        raise HTTPException(400, "Username already exists")
    except Exception as e:
        raise HTTPException(500, f"Failed to create user: {str(e)}")

@app.put("/api/admin/users/{uid}")
async def update_user(
    uid: int, full_name: str = Form(...), username: str = Form(...), password: str = Form(""), 
    dob: str = Form(""), address: str = Form(""), phone: str = Form(""), notes: str = Form(""),
    file: UploadFile = File(None), user=Depends(require_role("admin"))
):
    target = query("SELECT role, profile_image, full_name FROM users WHERE id=?", (uid,), one=True)
    if not target: raise HTTPException(404, "User not found")
    
    saved_filename = target["profile_image"]
    
    try:
        if file and file.filename:
            folder_role = "teachers" if target["role"] == "teacher" else "students"
            clean_folder_name = "".join(x for x in full_name if x.isalnum() or x == " ").replace(" ", "_")
            profile_dir = UPLOAD_DIR / "profiles" / folder_role / clean_folder_name
            profile_dir.mkdir(parents=True, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            clean_file_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
            saved_filename = f"profiles/{folder_role}/{clean_folder_name}/usr_{timestamp}_{clean_file_name}"
            file_path = UPLOAD_DIR / saved_filename
            
            content_bytes = await file.read()
            with file_path.open("wb") as buffer:
                buffer.write(content_bytes)

        if password:
            execute("""
                UPDATE users SET full_name=?, username=?, password_hash=?, dob=?, address=?, phone=?, notes=?, profile_image=? WHERE id=?
            """, (full_name, username, hash_pw(password), dob, address, phone, notes, saved_filename, uid))
        else:
            execute("""
                UPDATE users SET full_name=?, username=?, dob=?, address=?, phone=?, notes=?, profile_image=? WHERE id=?
            """, (full_name, username, dob, address, phone, notes, saved_filename, uid))
            
        return {"ok": True}
    except IntegrityError:
        raise HTTPException(400, "Username already exists")
    except Exception as e:
        raise HTTPException(500, f"Failed to update user: {str(e)}")

@app.delete("/api/admin/users/{uid}")
def delete_user(uid: int, user=Depends(require_role("admin"))):
    if uid == user["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    
    db = get_db()
    try:
        # We use a standard cursor here to avoid the "tuple indices" error
        with db.cursor() as cur:
            cur.execute("SELECT role FROM users WHERE id=%s", (uid,))
            res = cur.fetchone()
            if not res: return {"ok": True}
            
            user_role = res[0] # Fix: Access by index (0) instead of string "role"
            
            if user_role == "teacher":
                cur.execute("UPDATE courses SET teacher_id=NULL WHERE teacher_id=%s", (uid,))
                cur.execute("DELETE FROM announcements WHERE author_id=%s", (uid,))
            elif user_role == "student":
                cur.execute("DELETE FROM enrollments WHERE student_id=%s", (uid,))
                cur.execute("DELETE FROM attendance WHERE student_id=%s", (uid,))
                cur.execute("DELETE FROM quiz_answers WHERE student_id=%s", (uid,))
                cur.execute("DELETE FROM quiz_submissions WHERE student_id=%s", (uid,))
                cur.execute("DELETE FROM submissions WHERE student_id=%s", (uid,))
                
            cur.execute("DELETE FROM discussion_posts WHERE author_id=%s", (uid,))
            cur.execute("DELETE FROM users WHERE id=%s", (uid,))
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to delete user: {str(e)}")
    finally:
        db.close()
        
    return {"ok": True}


@app.get("/api/admin/courses")
def admin_list_courses(user=Depends(require_role("admin"))):
    return query("""
        SELECT c.*, u.full_name as teacher_name
        FROM courses c LEFT JOIN users u ON c.teacher_id=u.id
        ORDER BY c.code
    """)

@app.post("/api/admin/courses")
def create_course(code: str = Form(...), name: str = Form(...),
                  description: str = Form(""), teacher_id: int = Form(...),
                  start_date: str = Form(""), end_date: str = Form(""),
                  user=Depends(require_role("admin"))):
    try:
        cid = execute("INSERT INTO courses(code,name,description,teacher_id,start_date,end_date) VALUES(?,?,?,?,?,?)",
                      (code, name, description, teacher_id, start_date, end_date))
        return {"id": cid, "message": "Course created"}
    except IntegrityError:
        raise HTTPException(400, "Course code already exists")

@app.put("/api/admin/courses/{cid}")
def update_course(cid: int, code: str = Form(...), name: str = Form(...),
                  description: str = Form(""), teacher_id: int = Form(...),
                  start_date: str = Form(""), end_date: str = Form(""),
                  user=Depends(require_role("admin"))):
    try:
        execute("UPDATE courses SET code=?, name=?, description=?, teacher_id=?, start_date=?, end_date=? WHERE id=?",
                (code, name, description, teacher_id, start_date, end_date, cid))
        return {"ok": True}
    except IntegrityError:
        raise HTTPException(400, "Course code already exists")

@app.delete("/api/admin/courses/{cid}")
def delete_course(cid: int, user=Depends(require_role("admin"))):
    # We must manually clear all dependent data first to satisfy Database Foreign Key constraints
    db = get_db()
    try:
        with db.cursor() as cur:
            # 1. Enrollments & Attendance & Syllabus
            cur.execute("DELETE FROM enrollments WHERE course_id=%s", (cid,))
            cur.execute("DELETE FROM attendance WHERE course_id=%s", (cid,))
            cur.execute("DELETE FROM syllabus WHERE course_id=%s", (cid,))
            
            # 2. Modules
            cur.execute("DELETE FROM module_items WHERE module_id IN (SELECT id FROM modules WHERE course_id=%s)", (cid,))
            cur.execute("DELETE FROM modules WHERE course_id=%s", (cid,))
            
            # 3. Quizzes
            cur.execute("DELETE FROM quiz_answers WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id=%s)", (cid,))
            cur.execute("DELETE FROM quiz_submissions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id=%s)", (cid,))
            cur.execute("DELETE FROM quiz_options WHERE question_id IN (SELECT id FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id=%s))", (cid,))
            cur.execute("DELETE FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id=%s)", (cid,))
            cur.execute("DELETE FROM quizzes WHERE course_id=%s", (cid,))
            
            # 4. Assignments
            cur.execute("DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id=%s)", (cid,))
            cur.execute("DELETE FROM assignments WHERE course_id=%s", (cid,))
            
            # 5. Discussions
            cur.execute("DELETE FROM discussion_posts WHERE discussion_id IN (SELECT id FROM discussions WHERE course_id=%s)", (cid,))
            cur.execute("DELETE FROM discussions WHERE course_id=%s", (cid,))
            
            # 6. Rubrics
            cur.execute("DELETE FROM rubric_criteria WHERE rubric_id IN (SELECT id FROM rubrics WHERE course_id=%s)", (cid,))
            cur.execute("DELETE FROM rubrics WHERE course_id=%s", (cid,))
            
            # 7. Basic Items
            cur.execute("DELETE FROM materials WHERE course_id=%s", (cid,))
            cur.execute("DELETE FROM pages WHERE course_id=%s", (cid,))
            cur.execute("DELETE FROM announcements WHERE course_id=%s", (cid,))
            
            # 8. Finally, safely delete the course itself
            cur.execute("DELETE FROM courses WHERE id=%s", (cid,))
            
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to delete course: {str(e)}")
    finally:
        db.close()
        
    return {"ok": True}

@app.get("/api/admin/courses/{cid}/students")
def course_students(cid: int, user=Depends(require_role("admin"))):
    enrolled = query("""
        SELECT u.id,u.full_name,u.username,e.enrolled_at
        FROM enrollments e JOIN users u ON e.student_id=u.id
        WHERE e.course_id=? ORDER BY u.full_name
    """, (cid,))
    all_students = query("SELECT id,full_name,username FROM users WHERE role='student' ORDER BY full_name")
    enrolled_ids = {s["id"] for s in enrolled}
    available = [s for s in all_students if s["id"] not in enrolled_ids]
    return {"enrolled": enrolled, "available": available}

@app.post("/api/admin/courses/{cid}/enroll")
def enroll_student(cid: int, student_id: int = Form(...),
                   user=Depends(require_role("admin"))):
    try:
        execute("INSERT INTO enrollments(student_id,course_id) VALUES(?,?)", (student_id, cid))
        return {"ok": True}
    except IntegrityError:
        raise HTTPException(400, "Already enrolled")

@app.delete("/api/admin/courses/{cid}/enroll/{sid}")
def unenroll_student(cid: int, sid: int, user=Depends(require_role("admin"))):
    execute("DELETE FROM enrollments WHERE course_id=? AND student_id=?", (cid, sid))
    return {"ok": True}

@app.get("/api/admin/teachers")
def list_teachers(user=Depends(require_role("admin"))):
    return query("SELECT id,full_name FROM users WHERE role='teacher' ORDER BY full_name")

# ---------------------------------------------------------------------------
# Teacher API - courses
# ---------------------------------------------------------------------------

@app.get("/api/teacher/courses")
def teacher_courses(user=Depends(require_role("teacher"))):
    return query("""
        SELECT c.*,
            (SELECT COUNT(*) FROM enrollments WHERE course_id=c.id) as student_count
        FROM courses c WHERE c.teacher_id=? ORDER BY c.code
    """, (user["id"],))



# ---------------------------------------------------------------------------
# ENROLLED STUDENTS
# ---------------------------------------------------------------------------

@app.get("/api/courses/{cid}/enrolled-students")
def get_enrolled_students(cid: int, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    # Fetches student details from the users table via the enrollments table
    return query("""
        SELECT u.id, u.full_name, u.username, u.phone, u.profile_image 
        FROM users u
        JOIN enrollments e ON e.student_id = u.id
        WHERE e.course_id = ?
        ORDER BY u.full_name
    """, (cid,))


# ---------------------------------------------------------------------------
# Shared course details (teacher + student)
# ---------------------------------------------------------------------------

def check_course_access(cid: int, user: dict):
    if user["role"] == "teacher":
        c = query("SELECT * FROM courses WHERE id=? AND teacher_id=?", (cid, user["id"]), one=True)
    elif user["role"] == "student":
        c = query("""SELECT c.* FROM courses c
                     JOIN enrollments e ON e.course_id=c.id
                     WHERE c.id=? AND e.student_id=?""", (cid, user["id"]), one=True)
    else:
        c = query("SELECT * FROM courses WHERE id=?", (cid,), one=True)
    if not c:
        raise HTTPException(403, "Access denied")
    return c

@app.get("/api/courses/{cid}")
def get_course(cid: int, user=Depends(require_user)):
    return check_course_access(cid, user)

@app.get("/api/courses/{cid}/modules")
def get_modules(cid: int, user=Depends(require_user)):
    check_course_access(cid, user)
    
    db = get_db()
    try:
        # FIX: Reverted to SELECT * (Removed the file_name request)
        mods = query("SELECT * FROM modules WHERE course_id=? ORDER BY position,id", (cid,), db=db)
        for mod in mods:
            items = query("SELECT * FROM module_items WHERE module_id=? ORDER BY position,id", (mod["id"],), db=db)
            for item in items:
                t = item["type"]
                iid = item["item_id"]
                r = None
                if t == "material":
                    r = query("SELECT title FROM materials WHERE id=?", (iid,), one=True, db=db)
                elif t == "assignment":
                    r = query("SELECT title,due_date,points FROM assignments WHERE id=?", (iid,), one=True, db=db)
                elif t == "discussion":
                    r = query("SELECT title,due_date FROM discussions WHERE id=?", (iid,), one=True, db=db)
                elif t == "page":
                    r = query("SELECT title FROM pages WHERE id=?", (iid,), one=True, db=db)
                elif t == "quiz":
                    r = query("SELECT title,due_date FROM quizzes WHERE id=?", (iid,), one=True, db=db)
                
                item["meta"] = r or {}
            mod["items"] = items
        return mods
    finally:
        db.close()

@app.get("/api/courses/{cid}/announcements")
def get_announcements(cid: int, user=Depends(require_user)):
    check_course_access(cid, user)
    return query("""
        SELECT a.*, u.full_name as author_name
        FROM announcements a JOIN users u ON a.author_id=u.id
        WHERE a.course_id=? ORDER BY a.created_at DESC
    """, (cid,))

@app.get("/api/courses/{cid}/assignments")
def get_assignments(cid: int, user=Depends(require_user)):
    check_course_access(cid, user)
    assigns = query("SELECT * FROM assignments WHERE course_id=? ORDER BY due_date", (cid,))
    if user["role"] == "student":
        # Optimize: Get all submissions for this student at once instead of N+1
        subs = query("SELECT assignment_id, grade, feedback, submitted_at, graded_at FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id=?) AND student_id=?",
                     (cid, user["id"]))
        sub_map = {s["assignment_id"]: s for s in subs}
        for a in assigns:
            a["submission"] = sub_map.get(a["id"])
    return assigns

@app.get("/api/courses/{cid}/discussions")
def get_discussions(cid: int, user=Depends(require_user)):
    check_course_access(cid, user)
    return query("SELECT * FROM discussions WHERE course_id=? ORDER BY created_at DESC", (cid,))

@app.get("/api/courses/{cid}/materials")
def get_materials(cid: int, user=Depends(require_user)):
    check_course_access(cid, user)
    return query("SELECT * FROM materials WHERE course_id=? ORDER BY created_at DESC", (cid,))

@app.get("/api/courses/{cid}/pages")
def get_pages(cid: int, user=Depends(require_user)):
    check_course_access(cid, user)
    return query("SELECT * FROM pages WHERE course_id=? ORDER BY title", (cid,))

@app.get("/api/courses/{cid}/quizzes")
def get_quizzes(cid: int, user=Depends(require_user)):
    check_course_access(cid, user)
    quizzes = query("SELECT * FROM quizzes WHERE course_id=? ORDER BY due_date", (cid,))
    # If student, attach their specific grade and attempt count!
    if user["role"] == "student":
        # Optimize: Get all submissions at once instead of N+1
        subs = query("SELECT quiz_id, grade, attempts, submitted_at FROM quiz_submissions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id=?) AND student_id=?",
                     (cid, user["id"]))
        sub_map = {s["quiz_id"]: s for s in subs}
        for q in quizzes:
            q["submission"] = sub_map.get(q["id"])
    return quizzes

# Quiz questions and auto-grading
@app.get("/api/courses/{cid}/quizzes/{qid}/questions")
def get_quiz_questions(cid: int, qid: int, user=Depends(require_user)):
    check_course_access(cid, user)
    questions = query("""
        SELECT q.* FROM quiz_questions q 
        JOIN quizzes quiz ON q.quiz_id=quiz.id
        WHERE quiz.id=? AND quiz.course_id=? ORDER BY q.position
    """, (qid, cid))
    for q in questions:
        q["options"] = query("""
            SELECT id, option_text, is_correct, position FROM quiz_options 
            WHERE question_id=? ORDER BY position
        """, (q["id"],))
        # Hide correct answers from students
        if user["role"] == "student":
            for opt in q["options"]:
                del opt["is_correct"]
    return questions

@app.post("/api/courses/{cid}/quizzes/{qid}/submit")
async def submit_quiz(cid: int, qid: int, request: Request, user=Depends(require_user)):
    check_course_access(cid, user)
    if user["role"] != "student": 
        raise HTTPException(403, "Only students can submit quizzes")
    
    # Check Max Attempts Security
    quiz = query("SELECT max_attempts FROM quizzes WHERE id=?", (qid,), one=True)
    max_att = int(quiz["max_attempts"]) if quiz and quiz["max_attempts"] else 1
    sub = query("SELECT attempts FROM quiz_submissions WHERE quiz_id=? AND student_id=?", (qid, user["id"]), one=True)
    if sub and sub["attempts"] >= max_att:
        raise HTTPException(400, "Maximum attempts reached.")
        
    body = await request.json()
    answers = body.get("answers", {})  # {question_id: option_id}
    
    total_points = 0
    earned_points = 0
    
    # Calculate Grade
    for question_id_str, option_id in answers.items():
        question_id = int(question_id_str)
        q = query("SELECT * FROM quiz_questions WHERE id=?", (question_id,), one=True)
        if not q: 
            continue
            
        is_correct = False
        if option_id:
            opt = query("SELECT is_correct FROM quiz_options WHERE id=?", (option_id,), one=True)
            is_correct = opt and opt["is_correct"]
        
        # Store answer
        execute("""
            INSERT INTO quiz_answers(quiz_id, student_id, question_id, selected_option_id, is_correct)
            VALUES(?,?,?,?,?) 
            ON CONFLICT(quiz_id, student_id, question_id) DO UPDATE SET 
            selected_option_id=EXCLUDED.selected_option_id, is_correct=EXCLUDED.is_correct
        """, (qid, user["id"], question_id, option_id if option_id else None, is_correct))
        
        total_points += q["points"]
        if is_correct: 
            earned_points += q["points"]
    
    pct = (earned_points / total_points * 100) if total_points > 0 else 0
    
    # Permanently Save to Quiz Submissions! (Updates highest grade if multiple attempts allowed)
    execute("""
        INSERT INTO quiz_submissions(quiz_id, student_id, attempts, grade, submitted_at)
        VALUES(?,?,1,?,?)
        ON CONFLICT(quiz_id, student_id) DO UPDATE SET
        attempts = quiz_submissions.attempts + 1,
        grade = GREATEST(quiz_submissions.grade, EXCLUDED.grade),
        submitted_at = EXCLUDED.submitted_at
    """, (qid, user["id"], pct, now_str()))
    
    return {"ok": True, "earned": earned_points, "total": total_points}

@app.get("/api/courses/{cid}/quizzes/{qid}/answers/{sid}")
def get_student_answers(cid: int, qid: int, sid: int, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    answers = query("""
        SELECT qa.*, q.question_text, q.points, opt.option_text 
        FROM quiz_answers qa
        JOIN quiz_questions q ON qa.question_id=q.id
        LEFT JOIN quiz_options opt ON qa.selected_option_id=opt.id
        WHERE qa.quiz_id=? AND qa.student_id=?
    """, (qid, sid))
    return answers

@app.get("/api/courses/{cid}/syllabus")
def get_syllabus(cid: int, user=Depends(require_user)):
    check_course_access(cid, user)
    return query("SELECT * FROM syllabus WHERE course_id=?", (cid,), one=True) or {"content": ""}

# ---------------------------------------------------------------------------
# Teacher create/edit endpoints
# ---------------------------------------------------------------------------

@app.post("/api/courses/{cid}/modules")
def create_module(cid: int, title: str = Form(...), description: str = Form(""),
                  user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    
    # Find the current highest position so the new module goes at the bottom
    pos = (query("SELECT MAX(position) as m FROM modules WHERE course_id=?", (cid,), one=True) or {}).get("m") or 0
    
    # Insert without any file_name reference
    mid = execute("INSERT INTO modules(course_id,title,description,position) VALUES(?,?,?,?)",
                  (cid, title, description, pos+1))
    
    return {"id": mid}

@app.put("/api/courses/{cid}/modules/{mid}")
async def update_module(cid: int, mid: int, title: str = Form(...), description: str = Form(""),
                  file: UploadFile = File(None),
                  user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    saved_filename = None
    
    try:
        # Get existing module to preserve old file if no new one uploaded
        existing = query("SELECT file_name FROM modules WHERE id=? AND course_id=?", (mid, cid), one=True)
        existing_file = existing["file_name"] if existing else None
        
        if file and file.filename:
            course_dir = TEACHER_UPLOAD_DIR / f"course_{cid}"
            course_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
            saved_filename = f"module_{cid}_{timestamp}_{clean_name}"
            file_path = course_dir / saved_filename
            
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Delete old file if exists
            if existing_file:
                try:
                    (TEACHER_UPLOAD_DIR / f"course_{cid}" / existing_file).unlink()
                except:
                    pass
        
        final_file = saved_filename if saved_filename else existing_file
        execute("UPDATE modules SET title=?,description=?,file_name=? WHERE id=? AND course_id=?",
                (title, description, final_file, mid, cid))
        return {"ok": True}
    except Exception as e:
        if saved_filename:
            try:
                (TEACHER_UPLOAD_DIR / f"course_{cid}" / saved_filename).unlink()
            except:
                pass
        raise HTTPException(500, f"Failed to update module: {str(e)}")

@app.delete("/api/courses/{cid}/modules/{mid}")
def delete_module(cid: int, mid: int, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    # Delete items inside the module first to prevent foreign key errors
    execute("DELETE FROM module_items WHERE module_id=?", (mid,))
    execute("DELETE FROM modules WHERE id=? AND course_id=?", (mid, cid))
    return {"ok": True}

@app.post("/api/courses/{cid}/modules/{mid}/items")
def add_module_item(cid: int, mid: int, type: str = Form(...), item_id: int = Form(...),
                    user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    pos = (query("SELECT MAX(position) as m FROM module_items WHERE module_id=?", (mid,), one=True) or {}).get("m") or 0
    iid = execute("INSERT INTO module_items(module_id,type,item_id,position) VALUES(?,?,?,?)",
                  (mid, type, item_id, pos+1))
    return {"id": iid}

@app.delete("/api/courses/{cid}/modules/{mid}/items/{iid}")
def delete_module_item(cid: int, mid: int, iid: int, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    execute("DELETE FROM module_items WHERE id=? AND module_id=?", (iid, mid))
    return {"ok": True}

@app.post("/api/courses/{cid}/materials")
async def create_material(cid: int, title: str = Form(...), content: str = Form(""),
                          file_name: str = Form(""), file: UploadFile = File(None),
                          user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    saved_filename = ""
    try:
        if file and file.filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
            
            # CRITICAL FIX: No slashes here! Saves directly as mat_courseID_time_name
            saved_filename = f"mat_{cid}_{timestamp}_{clean_name}"
            
            # Saves to the root UPLOAD_DIR
            file_path = UPLOAD_DIR / saved_filename
            
            # Securely writes the file
            content_bytes = await file.read()
            with file_path.open("wb") as buffer:
                buffer.write(content_bytes)
                
        elif file_name:
            saved_filename = file_name.strip()

        mid = execute("INSERT INTO materials(course_id,title,content,file_name) VALUES(?,?,?,?)",
                      (cid, title, content, saved_filename))
        return {"id": mid}
    except Exception as e:
        if saved_filename:
            try: (UPLOAD_DIR / saved_filename).unlink()
            except: pass
        raise HTTPException(500, f"Failed to create material: {str(e)}")

@app.post("/api/courses/{cid}/pages")
async def create_page(cid: int, title: str = Form(...), body: str = Form(""),
                file: UploadFile = File(None),
                user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    saved_filename = ""
    
    try:
        if file and file.filename:
            # Create organized directory structure for teacher uploads
            course_dir = TEACHER_UPLOAD_DIR / f"course_{cid}"
            course_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
            saved_filename = f"pages/course_{cid}/page_{cid}_{timestamp}_{clean_name}"
            file_path = course_dir / f"page_{cid}_{timestamp}_{clean_name}"
            
            # Use shutil to avoid reading entire file into memory
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        
        pid = execute("INSERT INTO pages(course_id,title,body,file_name) VALUES(?,?,?,?)", (cid, title, body, saved_filename))
        return {"id": pid}
    except Exception as e:
        # Clean up file if it was created but DB insert failed
        if saved_filename:
            try:
                (TEACHER_UPLOAD_DIR / f"course_{cid}" / saved_filename.split("/")[-1]).unlink()
            except:
                pass
        raise HTTPException(500, f"Failed to create page: {str(e)}")

@app.get("/api/courses/{cid}/pages/{pid}")
def get_page(cid: int, pid: int, user=Depends(require_user)):
    check_course_access(cid, user)
    return query("SELECT * FROM pages WHERE id=? AND course_id=?", (pid, cid), one=True)

@app.post("/api/courses/{cid}/assignments")
async def create_assignment(cid: int, title: str = Form(...), description: str = Form(""),
                          due_date: str = Form(""), points: int = Form(100),
                          rubric_id: Optional[int] = Form(None),
                          file: UploadFile = File(None),
                          user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    saved_filename = ""
    
    try:
        if file and file.filename:
            # Create organized directory structure for teacher uploads
            course_dir = TEACHER_UPLOAD_DIR / f"course_{cid}"
            course_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
            saved_filename = f"assignments/course_{cid}/assignment_{cid}_{timestamp}_{clean_name}"
            file_path = course_dir / f"assignment_{cid}_{timestamp}_{clean_name}"
            
            # Use shutil to avoid reading entire file into memory
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        
        aid = execute("INSERT INTO assignments(course_id,title,description,due_date,points,rubric_id,file_name) VALUES(?,?,?,?,?,?,?)",
                      (cid, title, description, due_date, points, rubric_id, saved_filename))
        return {"id": aid}
    except Exception as e:
        # Clean up file if it was created but DB insert failed
        if saved_filename:
            try:
                (TEACHER_UPLOAD_DIR / f"course_{cid}" / saved_filename.split("/")[-1]).unlink()
            except:
                pass
        raise HTTPException(500, f"Failed to create assignment: {str(e)}")

@app.post("/api/courses/{cid}/discussions")
async def create_discussion(cid: int, title: str = Form(...), prompt: str = Form(""),
                      due_date: str = Form(""), graded: int = Form(0),
                      file: UploadFile = File(None),
                      user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    saved_filename = ""
    
    try:
        if file and file.filename:
            # Create organized directory structure for teacher uploads
            course_dir = TEACHER_UPLOAD_DIR / f"course_{cid}"
            course_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
            saved_filename = f"discussions/course_{cid}/discussion_{cid}_{timestamp}_{clean_name}"
            file_path = course_dir / f"discussion_{cid}_{timestamp}_{clean_name}"
            
            # Use shutil to avoid reading entire file into memory
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        
        did = execute("INSERT INTO discussions(course_id,title,prompt,due_date,graded,file_name) VALUES(?,?,?,?,?,?)",
                      (cid, title, prompt, due_date, graded, saved_filename))
        return {"id": did}
    except Exception as e:
        # Clean up file if it was created but DB insert failed
        if saved_filename:
            try:
                (TEACHER_UPLOAD_DIR / f"course_{cid}" / saved_filename.split("/")[-1]).unlink()
            except:
                pass
        raise HTTPException(500, f"Failed to create discussion: {str(e)}")

@app.post("/api/courses/{cid}/announcements")
async def create_announcement(cid: int, title: str = Form(...), body: str = Form(""),
                        file: UploadFile = File(None),
                        user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    saved_filename = ""
    
    try:
        if file and file.filename:
            # Create organized directory structure for teacher uploads
            course_dir = TEACHER_UPLOAD_DIR / f"course_{cid}"
            course_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
            saved_filename = f"announcements/course_{cid}/announcement_{cid}_{timestamp}_{clean_name}"
            file_path = course_dir / f"announcement_{cid}_{timestamp}_{clean_name}"
            
            # Use shutil to avoid reading entire file into memory
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        
        aid = execute("INSERT INTO announcements(course_id,title,body,author_id,file_name) VALUES(?,?,?,?,?)",
                      (cid, title, body, user["id"], saved_filename))
        return {"id": aid}
    except Exception as e:
        # Clean up file if it was created but DB insert failed
        if saved_filename:
            try:
                (TEACHER_UPLOAD_DIR / f"course_{cid}" / saved_filename.split("/")[-1]).unlink()
            except:
                pass
        raise HTTPException(500, f"Failed to create announcement: {str(e)}")

@app.post("/api/courses/{cid}/quizzes")
async def create_quiz(cid: int, title: str = Form(...), description: str = Form(""),
                due_date: str = Form(""), time_limit: str = Form("0"), file: UploadFile = File(None),
                user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    saved_filename = ""
    
    try:
        if file and file.filename:
            course_dir = TEACHER_UPLOAD_DIR / f"course_{cid}"
            course_dir.mkdir(exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
            saved_filename = f"quizzes/course_{cid}/quiz_{cid}_{timestamp}_{clean_name}"
            file_path = course_dir / f"quiz_{cid}_{timestamp}_{clean_name}"
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        
        # Note the added time_limit here!
        qid = execute("INSERT INTO quizzes(course_id,title,description,due_date,time_limit,file_name) VALUES(?,?,?,?,?,?)",
                      (cid, title, description, due_date, time_limit, saved_filename))
        return {"id": qid}
    except Exception as e:
        if saved_filename:
            try:
                (TEACHER_UPLOAD_DIR / f"course_{cid}" / saved_filename.split("/")[-1]).unlink()
            except: pass
        raise HTTPException(500, f"Failed to create quiz: {str(e)}")

@app.post("/api/courses/{cid}/syllabus")
async def update_syllabus(cid: int, content: str = Form(""), file: UploadFile = File(None), user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    saved_filename = None
    try:
        if file and file.filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            clean_name = "".join(x for x in file.filename if x.isalnum() or x in "._- ")
            saved_filename = f"syl_{cid}_{timestamp}_{clean_name}"
            file_path = UPLOAD_DIR / saved_filename
            
            # FIX: Await file.read() ensures the file completely saves to disk
            content_bytes = await file.read()
            with file_path.open("wb") as buffer:
                buffer.write(content_bytes)

        existing = query("SELECT id FROM syllabus WHERE course_id=?", (cid,), one=True)
        if existing:
            if saved_filename:
                execute("UPDATE syllabus SET content=?, file_name=?, updated_at=? WHERE course_id=?",
                        (content, saved_filename, now_str(), cid))
            else:
                execute("UPDATE syllabus SET content=?, updated_at=? WHERE course_id=?",
                        (content, now_str(), cid))
        else:
            execute("INSERT INTO syllabus(course_id,content,file_name) VALUES(?,?,?)", (cid, content, saved_filename))
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, f"Failed to update syllabus: {str(e)}")
# ---------------------------------------------------------------------------
# Rubrics
# ---------------------------------------------------------------------------

@app.get("/api/courses/{cid}/rubrics")
def get_rubrics(cid: int, user=Depends(require_user)):
    check_course_access(cid, user)
    rubrics = query("SELECT * FROM rubrics WHERE course_id=?", (cid,))
    for r in rubrics:
        r["criteria"] = query("SELECT * FROM rubric_criteria WHERE rubric_id=?", (r["id"],))
    return rubrics

@app.post("/api/courses/{cid}/rubrics")
def create_rubric(request: Request, cid: int, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    import asyncio
    body = asyncio.get_event_loop().run_until_complete(request.json())
    title = body.get("title","New Rubric")
    criteria = body.get("criteria",[])
    rid = execute("INSERT INTO rubrics(course_id,title) VALUES(?,?)", (cid, title))
    for c in criteria:
        execute("INSERT INTO rubric_criteria(rubric_id,description,points) VALUES(?,?,?)",
                (rid, c["description"], c["points"]))
    return {"id": rid}

# ---------------------------------------------------------------------------
# Submissions
# ---------------------------------------------------------------------------

@app.get("/api/courses/{cid}/assignments/{aid}/submissions")
def get_submissions(cid: int, aid: int, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    return query("""
        SELECT s.*, u.full_name, u.username
        FROM submissions s JOIN users u ON s.student_id=u.id
        WHERE s.assignment_id=? ORDER BY s.submitted_at
    """, (aid,))

@app.get("/api/courses/{cid}/assignments/{aid}/submissions/my")
def my_submission(cid: int, aid: int, user=Depends(require_role("student"))):
    check_course_access(cid, user)
    return query("SELECT * FROM submissions WHERE assignment_id=? AND student_id=?",
                 (aid, user["id"]), one=True)

@app.post("/api/courses/{cid}/assignments/{aid}/submissions")
def submit_assignment(cid: int, aid: int, text_response: str = Form(""),
                      file_name: str = Form(""), user=Depends(require_role("student"))):
    check_course_access(cid, user)
    existing = query("SELECT id FROM submissions WHERE assignment_id=? AND student_id=?",
                     (aid, user["id"]), one=True)
    if existing:
        execute("UPDATE submissions SET text_response=?,file_name=?,submitted_at=? WHERE assignment_id=? AND student_id=?",
                (text_response, file_name, now_str(), aid, user["id"]))
    else:
        execute("INSERT INTO submissions(assignment_id,student_id,text_response,file_name) VALUES(?,?,?,?)",
                (aid, user["id"], text_response, file_name))
    return {"ok": True}

@app.post("/api/courses/{cid}/assignments/{aid}/submissions/{sid}/grade")
def grade_submission(cid: int, aid: int, sid: int,
                     grade: float = Form(...), feedback: str = Form(""),
                     user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    execute("UPDATE submissions SET grade=?,feedback=?,graded_at=? WHERE id=? AND assignment_id=?",
            (grade, feedback, now_str(), sid, aid))
    return {"ok": True}

@app.post("/api/courses/{cid}/assignments/{aid}/submissions/{sid}/regrade")
def regrade_submission(cid: int, aid: int, sid: int,
                      grade: float = Form(...), feedback: str = Form(""),
                      user=Depends(require_role("teacher"))):
    """Regrade a submission - allows changing the grade after it was initially graded"""
    check_course_access(cid, user)
    sub = query("SELECT * FROM submissions WHERE id=? AND assignment_id=?", (sid, aid), one=True)
    if not sub:
        raise HTTPException(404, "Submission not found")
    
    # Update with new grade and add note that it was regraded
    feedback_with_note = f"[REGRADED] {feedback}\n\nPrevious grade: {sub['grade']}\nPrevious feedback: {sub['feedback']}"
    execute("UPDATE submissions SET grade=?,feedback=?,graded_at=? WHERE id=?",
            (grade, feedback_with_note, now_str(), sid))
    return {"ok": True, "message": "Submission regraded successfully"}

# ---------------------------------------------------------------------------
# Gradebook
# ---------------------------------------------------------------------------

@app.get("/api/courses/{cid}/gradebook")
def gradebook(cid: int, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    
    db = get_db()
    try:
        students = query("""
            SELECT u.id,u.full_name,u.username FROM users u
            JOIN enrollments e ON e.student_id=u.id
            WHERE e.course_id=? ORDER BY u.full_name
        """, (cid,), db=db)
        
        # Fetch both Assignments AND Quizzes
        assignments = query("SELECT id, title, points, 'assignment' as type FROM assignments WHERE course_id=? ORDER BY due_date", (cid,), db=db)
        quizzes = query("SELECT id, title, 100 as points, 'quiz' as type FROM quizzes WHERE course_id=? ORDER BY due_date", (cid,), db=db)
        
        all_items = []
        for a in assignments:
            a['item_key'] = f"a_{a['id']}" # Unique ID so they don't clash
            a['title'] = f"✏️ {a['title']}"
            all_items.append(a)
        for q in quizzes:
            q['item_key'] = f"q_{q['id']}"
            q['title'] = f"📝 {q['title']}"
            all_items.append(q)

        # Get all submissions for both
        a_subs = query("SELECT assignment_id as id, student_id, grade FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id=?)", (cid,), db=db)
        q_subs = query("SELECT quiz_id as id, student_id, grade FROM quiz_submissions WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id=?)", (cid,), db=db)
        
        sub_map = {}
        for s in a_subs: sub_map[(f"a_{s['id']}", s["student_id"])] = s["grade"]
        for s in q_subs: sub_map[(f"q_{s['id']}", s["student_id"])] = s["grade"]
        
        for s in students:
            s["grades"] = {}
            total_points = 0
            earned_points = 0
            for item in all_items:
                g = sub_map.get((item["item_key"], s["id"]))
                # We trick the frontend into mapping these perfectly by overriding the ID
                item["original_id"] = item["id"]
                item["id"] = item["item_key"] 
                s["grades"][item["id"]] = g
                
                total_points += item["points"]
                if g is not None:
                    earned_points += (g / 100) * item["points"]
            s["total_pct"] = round((earned_points / total_points * 100), 1) if total_points > 0 else None
            
        return {"students": students, "assignments": all_items}
    finally:
        db.close()
# ---------------------------------------------------------------------------
# Discussions
# ---------------------------------------------------------------------------

@app.get("/api/courses/{cid}/discussions/{did}")
def get_discussion(cid: int, did: int, user=Depends(require_user)):
    check_course_access(cid, user)
    disc = query("SELECT * FROM discussions WHERE id=? AND course_id=?", (did, cid), one=True)
    if not disc:
        raise HTTPException(404, "Discussion not found")
    posts = query("""
        SELECT p.*, u.full_name as author_name
        FROM discussion_posts p JOIN users u ON p.author_id=u.id
        WHERE p.discussion_id=? ORDER BY p.created_at
    """, (did,))
    disc["posts"] = posts
    return disc

@app.post("/api/courses/{cid}/discussions/{did}/posts")
def post_to_discussion(cid: int, did: int, body: str = Form(...),
                       parent_id: Optional[int] = Form(None),
                       user=Depends(require_user)):
    check_course_access(cid, user)
    pid = execute("INSERT INTO discussion_posts(discussion_id,author_id,parent_id,body) VALUES(?,?,?,?)",
                  (did, user["id"], parent_id, body))
    return {"id": pid}

# ---------------------------------------------------------------------------
# Student dashboard
# ---------------------------------------------------------------------------

@app.get("/api/student/dashboard")
def student_dashboard(user=Depends(require_role("student"))):
    courses = query("""
        SELECT c.id,c.code,c.name,u.full_name as teacher_name
        FROM courses c JOIN enrollments e ON e.course_id=c.id
        JOIN users u ON c.teacher_id=u.id
        WHERE e.student_id=? ORDER BY c.code
    """, (user["id"],))
    
    upcoming = query("""
        SELECT a.id,a.title,a.due_date,a.points,c.name as course_name,c.id as course_id
        FROM assignments a JOIN courses c ON a.course_id=c.id
        JOIN enrollments e ON e.course_id=c.id
        WHERE e.student_id=? AND a.due_date >= CURRENT_TIMESTAMP ORDER BY a.due_date LIMIT 10
    """, (user["id"],))
    
    grades = query("""
        SELECT s.grade, a.points, c.name as course_name
        FROM submissions s JOIN assignments a ON s.assignment_id=a.id
        JOIN courses c ON a.course_id=c.id
        WHERE s.student_id=? AND s.grade IS NOT NULL
    """, (user["id"],))
    return {"courses": courses, "upcoming": upcoming, "grades": grades}

@app.get("/api/student/courses")
def student_courses(user=Depends(require_role("student"))):
    return query("""
        SELECT c.id,c.code,c.name,c.description,u.full_name as teacher_name,
               (SELECT COUNT(*) FROM assignments WHERE course_id=c.id) as assignment_count
        FROM courses c JOIN enrollments e ON e.course_id=c.id
        JOIN users u ON c.teacher_id=u.id
        WHERE e.student_id=? ORDER BY c.code
    """, (user["id"],))

# ---------------------------------------------------------------------------
# Calendar (shared)
# ---------------------------------------------------------------------------

@app.get("/api/calendar")
def calendar(user=Depends(require_user)):
    # Get all events in one efficient query using UNION
    if user["role"] == "teacher":
        query_sql = """
            SELECT a.id, a.title, a.due_date, 'assignment' as type, c.name as course_name, c.id as course_id
            FROM assignments a JOIN courses c ON a.course_id=c.id
            WHERE c.teacher_id=? AND a.due_date!=''
            UNION ALL
            SELECT q.id, q.title, q.due_date, 'quiz' as type, c.name as course_name, c.id as course_id
            FROM quizzes q JOIN courses c ON q.course_id=c.id
            WHERE c.teacher_id=? AND q.due_date!=''
            UNION ALL
            SELECT d.id, d.title, d.due_date, 'discussion' as type, c.name as course_name, c.id as course_id
            FROM discussions d JOIN courses c ON d.course_id=c.id
            WHERE c.teacher_id=? AND d.due_date!=''
            ORDER BY due_date, type
        """
        events = query(query_sql, (user["id"], user["id"], user["id"]))
    else:
        query_sql = """
            SELECT a.id, a.title, a.due_date, 'assignment' as type, c.name as course_name, c.id as course_id
            FROM assignments a JOIN courses c ON a.course_id=c.id
            JOIN enrollments e ON e.course_id=c.id
            WHERE e.student_id=? AND a.due_date!=''
            UNION ALL
            SELECT q.id, q.title, q.due_date, 'quiz' as type, c.name as course_name, c.id as course_id
            FROM quizzes q JOIN courses c ON q.course_id=c.id
            JOIN enrollments e ON e.course_id=c.id
            WHERE e.student_id=? AND q.due_date!=''
            UNION ALL
            SELECT d.id, d.title, d.due_date, 'discussion' as type, c.name as course_name, c.id as course_id
            FROM discussions d JOIN courses c ON d.course_id=c.id
            JOIN enrollments e ON e.course_id=c.id
            WHERE e.student_id=? AND d.due_date!=''
            ORDER BY due_date, type
        """
        events = query(query_sql, (user["id"], user["id"], user["id"]))
    
    return events

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

@app.post("/api/courses/{cid}/quizzes/{qid}/questions")
async def add_quiz_question(cid: int, qid: int, request: Request, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    data = await request.json()
    
    # Open ONE connection for the entire batch
    db = get_db()
    try:
        q_id = execute("INSERT INTO quiz_questions(quiz_id, question_text, question_type, points) VALUES(?,?,?,?) RETURNING id",
                       (qid, data['text'], data['type'], data['points']), db=db)
        
        for opt in data['options']:
            execute("INSERT INTO quiz_options(question_id, option_text, is_correct) VALUES(?,?,?)",
                    (q_id, opt['text'], opt['is_correct']), db=db)
    finally:
        # Close it once at the very end
        db.close()
        
    return {"ok": True}

@app.get("/api/courses/{cid}/attendance/stats")
def get_attendance_stats(cid: int, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    # Get overall attendance counts
    stats = query("""
        SELECT status, COUNT(*) as count 
        FROM attendance 
        WHERE course_id=? 
        GROUP BY status
    """, (cid,))
    
    # Get course dates
    course = query("SELECT start_date, end_date FROM courses WHERE id=?", (cid,), one=True)
    
    return {
        "stats": {row["status"]: row["count"] for row in stats},
        "dates": course
    }

@app.get("/api/courses/{cid}/attendance")
def get_attendance(cid: int, date: str, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    students = query("SELECT u.id, u.full_name FROM users u JOIN enrollments e ON e.student_id=u.id WHERE e.course_id=?", (cid,))
    records = query("SELECT student_id, status FROM attendance WHERE course_id=? AND date=?", (cid, date))
    status_map = {r['student_id']: r['status'] for r in records}
    for s in students:
        s['status'] = status_map.get(s['id'], 'present')
    return students

@app.post("/api/courses/{cid}/attendance")
async def save_attendance(cid: int, request: Request, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    data = await request.json()
    date = data['date']
    for student_id, status in data['records'].items():
        execute("""
            INSERT INTO attendance(course_id, student_id, date, status) VALUES(?,?,?,?)
            ON CONFLICT(course_id, student_id, date) DO UPDATE SET status=EXCLUDED.status
        """, (cid, student_id, date, status))
    return {"ok": True}


@app.get("/fix-db")
def fix_database():
    db = get_db()
    try:
        with db.cursor() as cur:
            # Forcefully inject the missing columns into PostgreSQL
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS dob TEXT;")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT;")
        db.commit()
        return {"status": "Success! Database columns forcefully added. You can go back to the dashboard now."}
    except Exception as e:
        db.rollback()
        return {"status": "Error", "details": str(e)}
    finally:
        db.close()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))