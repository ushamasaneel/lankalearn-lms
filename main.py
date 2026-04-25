"""
LankaLearn LMS - Main Backend
FastAPI + SQLite (raw SQL only)
Run: python main.py  →  http://127.0.0.1:8000
"""

import hashlib, json, os, sqlite3, uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import Cookie, Depends, FastAPI, Form, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "lankalearn.db"

app = FastAPI(title="LankaLearn LMS")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# In-memory session store  {session_id: user_id}
SESSIONS: dict[str, int] = {}

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def query(sql: str, params=(), *, one=False, db=None):
    close = db is None
    if db is None:
        db = get_db()
    cur = db.execute(sql, params)
    rows = cur.fetchall()
    if close:
        db.close()
    return (dict(rows[0]) if rows else None) if one else [dict(r) for r in rows]


def execute(sql: str, params=(), *, db=None):
    close = db is None
    if db is None:
        db = get_db()
    cur = db.execute(sql, params)
    db.commit()
    if close:
        db.close()
    return cur.lastrowid


def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def now_str() -> str:
    return datetime.now().isoformat(sep=" ", timespec="seconds")


def future(days: int) -> str:
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")

# ---------------------------------------------------------------------------
# DB initialisation
# ---------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    teacher_id INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES users(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    enrolled_at TEXT DEFAULT (datetime('now')),
    UNIQUE(student_id, course_id)
);

CREATE TABLE IF NOT EXISTS modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    content TEXT,
    file_name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    body TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    points INTEGER DEFAULT 100,
    rubric_id INTEGER REFERENCES rubrics(id),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS discussions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    prompt TEXT,
    due_date TEXT,
    graded INTEGER DEFAULT 0,
    rubric_id INTEGER REFERENCES rubrics(id),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    body TEXT,
    author_id INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rubrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rubric_criteria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rubric_id INTEGER NOT NULL REFERENCES rubrics(id),
    description TEXT NOT NULL,
    points INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS module_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id INTEGER NOT NULL REFERENCES modules(id),
    type TEXT NOT NULL CHECK(type IN ('material','assignment','discussion','page','quiz')),
    item_id INTEGER NOT NULL,
    position INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id),
    student_id INTEGER NOT NULL REFERENCES users(id),
    text_response TEXT,
    file_name TEXT,
    submitted_at TEXT DEFAULT (datetime('now')),
    grade REAL,
    feedback TEXT,
    graded_at TEXT,
    UNIQUE(assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS discussion_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discussion_id INTEGER NOT NULL REFERENCES discussions(id),
    author_id INTEGER NOT NULL REFERENCES users(id),
    parent_id INTEGER REFERENCES discussion_posts(id),
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS syllabus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER UNIQUE NOT NULL REFERENCES courses(id),
    content TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);
"""

def init_db():
    db = get_db()
    for stmt in SCHEMA.strip().split(";"):
        s = stmt.strip()
        if s:
            db.execute(s)
    db.commit()

    # Seed only if users table is empty
    if query("SELECT id FROM users LIMIT 1", db=db):
        db.close()
        return

    seed(db)
    db.close()


def seed(db):
    """Insert realistic Sri Lankan demo data."""
    now = now_str()

    # ---- Users ----
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
        db.execute("INSERT OR IGNORE INTO users(id,username,password_hash,full_name,role) VALUES(?,?,?,?,?)", u)

    # ---- Courses ----
    courses = [
        (1, "OL-MATH-11",  "O/L Mathematics",             "Combined Mathematics for Ordinary Level Grade 11", 2),
        (2, "OL-SCI-11",   "O/L Science",                 "Integrated Science for Ordinary Level Grade 11",  2),
        (3, "AL-BIO-13",   "A/L Biology",                 "Advanced Level Biology for Grade 13",             3),
        (4, "AL-ICT-13",   "A/L ICT",                     "Information & Communication Technology A/L",      3),
        (5, "OL-ENG-11",   "O/L English Language",        "English Language & Literature Grade 11",          2),
    ]
    for c in courses:
        db.execute("INSERT OR IGNORE INTO courses(id,code,name,description,teacher_id) VALUES(?,?,?,?,?)", c)

    # ---- Enrollments ----
    enrollments = [
        (4,1),(4,2),(4,5),
        (5,1),(5,3),(5,4),
        (6,1),(6,2),(6,4),
        (7,2),(7,3),(7,5),
        (8,3),(8,4),(8,5),
    ]
    for e in enrollments:
        db.execute("INSERT OR IGNORE INTO enrollments(student_id,course_id) VALUES(?,?)", e)

    # ---- Rubrics ----
    db.execute("INSERT OR IGNORE INTO rubrics(id,course_id,title) VALUES(1,1,'Math Assignment Rubric')")
    db.execute("INSERT OR IGNORE INTO rubrics(id,course_id,title) VALUES(2,3,'Biology Lab Report Rubric')")
    criteria = [
        (1,1,"Correct methodology and working",40),
        (2,1,"Accuracy of final answer",30),
        (3,1,"Clarity and presentation",30),
        (4,2,"Introduction and hypothesis",20),
        (5,2,"Observations and data",40),
        (6,2,"Analysis and conclusion",40),
    ]
    for cr in criteria:
        db.execute("INSERT OR IGNORE INTO rubric_criteria(id,rubric_id,description,points) VALUES(?,?,?,?)", cr)

    # ---- Modules ----
    modules = [
        (1, 1, "Unit 1: Algebra",       "Equations, inequalities and polynomials", 1),
        (2, 1, "Unit 2: Geometry",      "Circles, triangles and trigonometry",      2),
        (3, 2, "Unit 1: Matter",        "States of matter and atomic structure",    1),
        (4, 3, "Unit 1: Cell Biology",  "Cell structure and functions",             1),
        (5, 4, "Unit 1: Fundamentals",  "Number systems, logic and algorithms",     1),
        (6, 5, "Unit 1: Reading",       "Comprehension and vocabulary",             1),
    ]
    for m in modules:
        db.execute("INSERT OR IGNORE INTO modules(id,course_id,title,description,position) VALUES(?,?,?,?,?)", m)

    # ---- Materials ----
    materials = [
        (1,1,"Algebra Basics Notes",   "This chapter covers linear equations, quadratic equations and simultaneous equations...", "algebra_notes.pdf"),
        (2,1,"Geometry Worksheet",     "Practice problems on Pythagoras theorem and circle theorems.", "geometry_ws.pdf"),
        (3,2,"States of Matter Notes", "Solid, liquid, gas — kinetic theory and properties.", "matter_notes.pdf"),
        (4,3,"Cell Structure Diagram", "Labelled diagrams of plant and animal cells.", "cell_diagram.pdf"),
        (5,4,"Algorithm Flowcharts",   "Introduction to flowcharts and pseudocode.", "flowcharts.pdf"),
    ]
    for m in materials:
        db.execute("INSERT OR IGNORE INTO materials(id,course_id,title,content,file_name) VALUES(?,?,?,?,?)", m)

    # ---- Pages ----
    pages = [
        (1,1,"Course Welcome","<h2>Welcome to O/L Mathematics!</h2><p>Dear students, this course will prepare you thoroughly for the O/L examination. Please ensure you complete all assignments on time.</p><p><strong>Contact:</strong> nimal.teacher@lankalearn.lk</p>"),
        (2,4,"ICT Lab Rules","<h2>Computer Lab Rules</h2><ul><li>No food or drink near computers</li><li>Save your work every 10 minutes</li><li>Log off after every session</li></ul>"),
    ]
    for p in pages:
        db.execute("INSERT OR IGNORE INTO pages(id,course_id,title,body) VALUES(?,?,?,?)", p)

    # ---- Assignments ----
    assignments = [
        (1,1,"Algebra Problem Set 1","Solve the given 20 problems on linear and quadratic equations. Show all working clearly.",future(7), 100,1),
        (2,1,"Geometry Test Preparation","Complete the 15 circle theorem problems from the textbook page 234-240.",future(14),100,None),
        (3,2,"Science Lab Report","Write a full lab report on the experiment we conducted on density of materials.",future(5), 80, None),
        (4,3,"Cell Biology Essay","Write a 500-word essay comparing plant and animal cells with labelled diagrams.",future(10),100,2),
        (5,4,"Programming Exercise 1","Implement the bubble sort algorithm in pseudocode and trace through an example.",future(6), 50, None),
    ]
    for a in assignments:
        db.execute("INSERT OR IGNORE INTO assignments(id,course_id,title,description,due_date,points,rubric_id) VALUES(?,?,?,?,?,?,?)", a)

    # ---- Discussions ----
    discussions = [
        (1,1,"Tips for Solving Word Problems","Share your strategies for translating word problems into mathematical equations. What tricks help you?",future(5),0,None),
        (2,3,"Osmosis vs Diffusion","Discuss the key differences between osmosis and diffusion with real-life examples.",future(8),1,None),
        (3,4,"Future of AI in Sri Lanka","How do you think Artificial Intelligence will impact Sri Lanka in the next 10 years?",future(12),0,None),
    ]
    for d in discussions:
        db.execute("INSERT OR IGNORE INTO discussions(id,course_id,title,prompt,due_date,graded,rubric_id) VALUES(?,?,?,?,?,?,?)", d)

    # ---- Discussion posts ----
    posts = [
        (1,1,4,None,"I always underline the key numbers and draw a simple diagram first before writing equations. It helps me see the problem clearly!"),
        (2,1,5,None,"I try to identify what is being asked first, then work backwards. Also practicing past papers really helps."),
        (3,1,6,1,"Great tip! I also find that checking units throughout the calculation prevents careless mistakes."),
        (4,2,5,None,"Diffusion moves any substance from high to low concentration, but osmosis specifically moves water across a semi-permeable membrane."),
        (5,2,7,None,"A good real-life example of osmosis is how plants absorb water from the soil through their root hair cells!"),
    ]
    for p in posts:
        db.execute("INSERT OR IGNORE INTO discussion_posts(id,discussion_id,author_id,parent_id,body) VALUES(?,?,?,?,?)", p)

    # ---- Announcements ----
    announcements = [
        (1,1,"Term Test Dates Released","Dear students, the Term 1 test will be held on " + future(21)[:10] + ". Please revise Chapters 1–5. All the best!", 2),
        (2,2,"Lab Session Rescheduled","The science lab session originally on Friday has been moved to Monday. Please bring your lab books.", 2),
        (3,3,"Field Trip to Peradeniya","We will be visiting the University of Peradeniya Botany Department on " + future(30)[:10] + ". Permission slips required.", 3),
        (4,4,"New Software Installed","Adobe Photoshop and Python 3.12 have been installed in the ICT lab. You may now start the graphics unit.", 3),
    ]
    for a in announcements:
        db.execute("INSERT OR IGNORE INTO announcements(id,course_id,title,body,author_id) VALUES(?,?,?,?,?)", a)

    # ---- Quizzes ----
    quizzes = [
        (1,1,"Chapter 1 Quick Quiz","10-minute quiz on solving linear equations. Open book allowed.",future(3)),
        (2,3,"Cell Biology MCQ","Multiple choice questions on cell organelles and their functions.",future(9)),
        (3,4,"Algorithm Trace Quiz","Trace through given algorithms and find the output.",future(4)),
    ]
    for q in quizzes:
        db.execute("INSERT OR IGNORE INTO quizzes(id,course_id,title,description,due_date) VALUES(?,?,?,?,?)", q)

    # ---- Module items ----
    mitems = [
        # Algebra module
        (1,1,"page",1,1),
        (2,1,"material",1,2),
        (3,1,"assignment",1,3),
        (4,1,"discussion",1,4),
        (5,1,"quiz",1,5),
        # Geometry module
        (6,2,"material",2,1),
        (7,2,"assignment",2,2),
        # Science Matter module
        (8,3,"material",3,1),
        (9,3,"assignment",3,2),
        # Bio cell module
        (10,4,"material",4,1),
        (11,4,"discussion",2,2),
        (12,4,"assignment",4,3),
        # ICT fundamentals
        (13,5,"page",2,1),
        (14,5,"material",5,2),
        (15,5,"quiz",3,3),
        (16,5,"assignment",5,4),
        # English reading
        (17,6,"assignment",5,1), # reuse assignment 5 for demo
    ]
    for mi in mitems:
        db.execute("INSERT OR IGNORE INTO module_items(id,module_id,type,item_id,position) VALUES(?,?,?,?,?)", mi)

    # ---- Submissions (some already graded) ----
    submissions = [
        # kasun submitted algebra assignment, graded
        (1,1,4,"I solved problems 1-20. For Q1: x=3, Q2: x=5, x=2...","algebra_kasun.pdf",
         "2025-01-20 10:30:00", 85, "Good work Kasun! Excellent methodology. Lost marks on Q15 — check the sign.", "2025-01-21 14:00:00"),
        # tharushi submitted, graded
        (2,1,5,"Completed all 20 problems using substitution method as taught in class.","algebra_tharushi.pdf",
         "2025-01-20 11:00:00", 92, "Outstanding work Tharushi! Perfect working shown throughout. Q18 solution was particularly elegant.", "2025-01-21 14:30:00"),
        # amali submitted, not yet graded
        (3,1,6,"I solved all the equations step by step. Some were challenging especially the word problems.","algebra_amali.pdf",
         "2025-01-21 09:00:00", None, None, None),
        # kasun submitted sci lab report
        (4,3,4,"Lab Report: Density Experiment\n\nAim: To measure the density of different materials\nMethod: We used a measuring cylinder and scale...",None,
         "2025-01-22 15:00:00", 70, "Good effort. Next time include proper error analysis.", "2025-01-23 10:00:00"),
    ]
    for s in submissions:
        db.execute("""INSERT OR IGNORE INTO submissions
            (id,assignment_id,student_id,text_response,file_name,submitted_at,grade,feedback,graded_at)
            VALUES(?,?,?,?,?,?,?,?,?)""", s)

    # ---- Syllabus ----
    syllabi = [
        (1,1,"<h3>O/L Mathematics Syllabus 2025</h3><p><strong>Teacher:</strong> Nimal Jayasinghe</p><h4>Term 1 (Jan–Mar)</h4><ul><li>Algebra: Linear & Quadratic Equations</li><li>Geometry: Circles and Triangles</li></ul><h4>Term 2 (Apr–Jun)</h4><ul><li>Trigonometry</li><li>Statistics and Probability</li></ul><h4>Assessment</h4><ul><li>Homework: 30%</li><li>Term Tests: 40%</li><li>Final Exam: 30%</li></ul>"),
        (2,3,"<h3>A/L Biology Syllabus 2025</h3><p><strong>Teacher:</strong> Priyanka Wickramasinghe</p><h4>Term 1</h4><ul><li>Cell Biology</li><li>Biochemistry</li></ul><h4>Term 2</h4><ul><li>Genetics</li><li>Ecology</li></ul>"),
    ]
    for s in syllabi:
        db.execute("INSERT OR IGNORE INTO syllabus(id,course_id,content) VALUES(?,?,?)", s)

    db.commit()

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
        "users":   query("SELECT COUNT(*) as c FROM users")[0]["c"],
        "courses": query("SELECT COUNT(*) as c FROM courses")[0]["c"],
        "enrollments": query("SELECT COUNT(*) as c FROM enrollments")[0]["c"],
        "submissions": query("SELECT COUNT(*) as c FROM submissions")[0]["c"],
    }


@app.get("/api/admin/users")
def list_users(user=Depends(require_role("admin"))):
    return query("SELECT id,username,full_name,role,created_at FROM users ORDER BY role,full_name")


@app.post("/api/admin/users")
def create_user(full_name: str = Form(...), username: str = Form(...),
                password: str = Form(...), role: str = Form(...),
                user=Depends(require_role("admin"))):
    if role not in ("teacher","student"):
        raise HTTPException(400, "Role must be teacher or student")
    try:
        uid = execute("INSERT INTO users(username,password_hash,full_name,role) VALUES(?,?,?,?)",
                      (username, hash_pw(password), full_name, role))
        return {"id": uid, "message": "User created"}
    except sqlite3.IntegrityError:
        raise HTTPException(400, "Username already exists")


@app.delete("/api/admin/users/{uid}")
def delete_user(uid: int, user=Depends(require_role("admin"))):
    if uid == user["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    execute("DELETE FROM users WHERE id=?", (uid,))
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
                  user=Depends(require_role("admin"))):
    try:
        cid = execute("INSERT INTO courses(code,name,description,teacher_id) VALUES(?,?,?,?)",
                      (code, name, description, teacher_id))
        return {"id": cid, "message": "Course created"}
    except sqlite3.IntegrityError:
        raise HTTPException(400, "Course code already exists")


@app.delete("/api/admin/courses/{cid}")
def delete_course(cid: int, user=Depends(require_role("admin"))):
    execute("DELETE FROM courses WHERE id=?", (cid,))
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
    except sqlite3.IntegrityError:
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
# Shared course details (teacher + student)
# ---------------------------------------------------------------------------

def check_course_access(cid: int, user: dict):
    """Return course if user has access, else raise 403."""
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
    mods = query("SELECT * FROM modules WHERE course_id=? ORDER BY position,id", (cid,))
    for mod in mods:
        items = query("SELECT * FROM module_items WHERE module_id=? ORDER BY position,id", (mod["id"],))
        # Enrich items with title
        for item in items:
            t = item["type"]
            iid = item["item_id"]
            if t == "material":
                r = query("SELECT title FROM materials WHERE id=?", (iid,), one=True)
            elif t == "assignment":
                r = query("SELECT title,due_date,points FROM assignments WHERE id=?", (iid,), one=True)
            elif t == "discussion":
                r = query("SELECT title,due_date FROM discussions WHERE id=?", (iid,), one=True)
            elif t == "page":
                r = query("SELECT title FROM pages WHERE id=?", (iid,), one=True)
            elif t == "quiz":
                r = query("SELECT title,due_date FROM quizzes WHERE id=?", (iid,), one=True)
            else:
                r = None
            item["meta"] = r or {}
        mod["items"] = items
    return mods


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
        for a in assigns:
            sub = query("SELECT grade,feedback,submitted_at,graded_at FROM submissions WHERE assignment_id=? AND student_id=?",
                        (a["id"], user["id"]), one=True)
            a["submission"] = sub
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
    return query("SELECT * FROM quizzes WHERE course_id=? ORDER BY due_date", (cid,))


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
    pos = (query("SELECT MAX(position) as m FROM modules WHERE course_id=?", (cid,), one=True) or {}).get("m") or 0
    mid = execute("INSERT INTO modules(course_id,title,description,position) VALUES(?,?,?,?)",
                  (cid, title, description, pos+1))
    return {"id": mid}


@app.put("/api/courses/{cid}/modules/{mid}")
def update_module(cid: int, mid: int, title: str = Form(...), description: str = Form(""),
                  user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    execute("UPDATE modules SET title=?,description=? WHERE id=? AND course_id=?",
            (title, description, mid, cid))
    return {"ok": True}


@app.delete("/api/courses/{cid}/modules/{mid}")
def delete_module(cid: int, mid: int, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
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
def create_material(cid: int, title: str = Form(...), content: str = Form(""),
                    file_name: str = Form(""), user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    mid = execute("INSERT INTO materials(course_id,title,content,file_name) VALUES(?,?,?,?)",
                  (cid, title, content, file_name))
    return {"id": mid}


@app.post("/api/courses/{cid}/pages")
def create_page(cid: int, title: str = Form(...), body: str = Form(""),
                user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    pid = execute("INSERT INTO pages(course_id,title,body) VALUES(?,?,?)", (cid, title, body))
    return {"id": pid}


@app.get("/api/courses/{cid}/pages/{pid}")
def get_page(cid: int, pid: int, user=Depends(require_user)):
    check_course_access(cid, user)
    return query("SELECT * FROM pages WHERE id=? AND course_id=?", (pid, cid), one=True)


@app.post("/api/courses/{cid}/assignments")
def create_assignment(cid: int, title: str = Form(...), description: str = Form(""),
                      due_date: str = Form(""), points: int = Form(100),
                      rubric_id: Optional[int] = Form(None),
                      user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    aid = execute("INSERT INTO assignments(course_id,title,description,due_date,points,rubric_id) VALUES(?,?,?,?,?,?)",
                  (cid, title, description, due_date, points, rubric_id))
    return {"id": aid}


@app.post("/api/courses/{cid}/discussions")
def create_discussion(cid: int, title: str = Form(...), prompt: str = Form(""),
                      due_date: str = Form(""), graded: int = Form(0),
                      user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    did = execute("INSERT INTO discussions(course_id,title,prompt,due_date,graded) VALUES(?,?,?,?,?)",
                  (cid, title, prompt, due_date, graded))
    return {"id": did}


@app.post("/api/courses/{cid}/announcements")
def create_announcement(cid: int, title: str = Form(...), body: str = Form(""),
                        user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    aid = execute("INSERT INTO announcements(course_id,title,body,author_id) VALUES(?,?,?,?)",
                  (cid, title, body, user["id"]))
    return {"id": aid}


@app.post("/api/courses/{cid}/quizzes")
def create_quiz(cid: int, title: str = Form(...), description: str = Form(""),
                due_date: str = Form(""), user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    qid = execute("INSERT INTO quizzes(course_id,title,description,due_date) VALUES(?,?,?,?)",
                  (cid, title, description, due_date))
    return {"id": qid}


@app.post("/api/courses/{cid}/syllabus")
def update_syllabus(cid: int, content: str = Form(...), user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    existing = query("SELECT id FROM syllabus WHERE course_id=?", (cid,), one=True)
    if existing:
        execute("UPDATE syllabus SET content=?,updated_at=? WHERE course_id=?",
                (content, now_str(), cid))
    else:
        execute("INSERT INTO syllabus(course_id,content) VALUES(?,?)", (cid, content))
    return {"ok": True}

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
    # Accept JSON body for rubric with criteria
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

# ---------------------------------------------------------------------------
# Gradebook
# ---------------------------------------------------------------------------

@app.get("/api/courses/{cid}/gradebook")
def gradebook(cid: int, user=Depends(require_role("teacher"))):
    check_course_access(cid, user)
    students = query("""
        SELECT u.id,u.full_name,u.username FROM users u
        JOIN enrollments e ON e.student_id=u.id
        WHERE e.course_id=? ORDER BY u.full_name
    """, (cid,))
    assignments = query("SELECT id,title,points FROM assignments WHERE course_id=? ORDER BY due_date", (cid,))
    # Build grade matrix
    for s in students:
        s["grades"] = {}
        total_points = 0
        earned_points = 0
        for a in assignments:
            sub = query("SELECT grade FROM submissions WHERE assignment_id=? AND student_id=?",
                        (a["id"], s["id"]), one=True)
            g = sub["grade"] if sub and sub["grade"] is not None else None
            s["grades"][str(a["id"])] = g
            total_points += a["points"]
            if g is not None:
                earned_points += (g / 100) * a["points"]
        s["total_pct"] = round((earned_points / total_points * 100), 1) if total_points > 0 else None
    return {"students": students, "assignments": assignments}

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
    # Upcoming assignments
    upcoming = query("""
        SELECT a.id,a.title,a.due_date,a.points,c.name as course_name,c.id as course_id
        FROM assignments a JOIN courses c ON a.course_id=c.id
        JOIN enrollments e ON e.course_id=c.id
        WHERE e.student_id=? AND a.due_date >= datetime('now') ORDER BY a.due_date LIMIT 10
    """, (user["id"],))
    # Grades summary
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
    if user["role"] == "teacher":
        cids = [r["id"] for r in query("SELECT id FROM courses WHERE teacher_id=?", (user["id"],))]
    else:
        cids = [r["course_id"] for r in query("SELECT course_id FROM enrollments WHERE student_id=?", (user["id"],))]

    events = []
    for cid in cids:
        course = query("SELECT name,code FROM courses WHERE id=?", (cid,), one=True)
        for a in query("SELECT id,title,due_date,'assignment' as type FROM assignments WHERE course_id=? AND due_date!=''", (cid,)):
            a["course_name"] = course["name"]; a["course_id"] = cid; events.append(a)
        for q in query("SELECT id,title,due_date,'quiz' as type FROM quizzes WHERE course_id=? AND due_date!=''", (cid,)):
            q["course_name"] = course["name"]; q["course_id"] = cid; events.append(q)
        for d in query("SELECT id,title,due_date,'discussion' as type FROM discussions WHERE course_id=? AND due_date!=''", (cid,)):
            d["course_name"] = course["name"]; d["course_id"] = cid; events.append(d)

    events.sort(key=lambda x: x.get("due_date") or "")
    return events

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    init_db()
    print("\n" + "="*55)
    print("  🎓 LankaLearn LMS  —  http://127.0.0.1:8000")
    print("="*55)
    print("  Demo credentials:")
    print("  Admin:   admin          / admin123")
    print("  Teacher: nimal.teacher  / teacher123")
    print("  Teacher: priya.teacher  / teacher123")
    print("  Student: kasun          / student123")
    print("  Student: tharushi       / student123")
    print("="*55 + "\n")
    uvicorn.run(app, host="127.0.0.1", port=8000)
