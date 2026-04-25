/* ============================================================
   app.js — Core: auth, routing, sidebar, navigation
   ============================================================ */

let currentUser = null;
let sidebarOpen = true;

// ---- Bootstrap ----
window.addEventListener('DOMContentLoaded', async () => {
  try {
    currentUser = await api('/api/auth/me');
  } catch {
    window.location.href = '/';
    return;
  }
  if (!currentUser) return;

  // Set header user info
  document.getElementById('userName').textContent = currentUser.full_name;
  document.getElementById('userRole').textContent = currentUser.role;
  const initials = currentUser.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('userAvatar').textContent = initials;

  buildSidebar();

  // Route to default view
  if (currentUser.role === 'admin') loadAdminDashboard();
  else if (currentUser.role === 'teacher') loadTeacherDashboard();
  else loadStudentDashboard();
});

// ---- Logout ----
async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

// ---- Sidebar toggle ----
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const mc = document.getElementById('mainContent');
  if (window.innerWidth < 900) {
    sb.classList.toggle('mobile-open');
  } else {
    sidebarOpen = !sidebarOpen;
    sb.classList.toggle('collapsed', !sidebarOpen);
    mc.classList.toggle('expanded', !sidebarOpen);
  }
}

// ---- Set active sidebar item ----
function setActiveSidebar(id) {
  document.querySelectorAll('.sidebar-item, .sidebar-course-item').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('si-' + id);
  if (target) target.classList.add('active');
}

// ---- Build sidebar by role ----
function buildSidebar() {
  const nav = document.getElementById('sidebarNav');
  if (currentUser.role === 'admin') {
    nav.innerHTML = `
      <div class="sidebar-heading">Administration</div>
      <div class="sidebar-item" id="si-dash" onclick="loadAdminDashboard(); setActiveSidebar('dash')">
        <span class="si-icon">🏠</span> Dashboard
      </div>
      <div class="sidebar-item" id="si-users" onclick="loadAdminUsers(); setActiveSidebar('users')">
        <span class="si-icon">👥</span> Users
      </div>
      <div class="sidebar-item" id="si-courses" onclick="loadAdminCourses(); setActiveSidebar('courses')">
        <span class="si-icon">📚</span> Courses
      </div>
      <div class="sidebar-divider"></div>
      <div class="sidebar-heading">System</div>
      <div class="sidebar-item" id="si-cal" onclick="loadCalendar(); setActiveSidebar('cal')">
        <span class="si-icon">📅</span> Calendar
      </div>
    `;
  } else if (currentUser.role === 'teacher') {
    nav.innerHTML = `
      <div class="sidebar-heading">Teaching</div>
      <div class="sidebar-item" id="si-tdash" onclick="loadTeacherDashboard(); setActiveSidebar('tdash')">
        <span class="si-icon">🏠</span> Dashboard
      </div>
      <div class="sidebar-item" id="si-tcal" onclick="loadCalendar(); setActiveSidebar('tcal')">
        <span class="si-icon">📅</span> Calendar
      </div>
      <div class="sidebar-divider"></div>
      <div class="sidebar-heading">My Courses</div>
      <div id="teacherCourseList" class="sidebar-course-list"></div>
    `;
    loadTeacherSidebarCourses();
  } else {
    nav.innerHTML = `
      <div class="sidebar-heading">Learning</div>
      <div class="sidebar-item" id="si-sdash" onclick="loadStudentDashboard(); setActiveSidebar('sdash')">
        <span class="si-icon">🏠</span> Dashboard
      </div>
      <div class="sidebar-item" id="si-scal" onclick="loadCalendar(); setActiveSidebar('scal')">
        <span class="si-icon">📅</span> Calendar
      </div>
      <div class="sidebar-divider"></div>
      <div class="sidebar-heading">My Courses</div>
      <div id="studentCourseList" class="sidebar-course-list"></div>
    `;
    loadStudentSidebarCourses();
  }
}

async function loadTeacherSidebarCourses() {
  const courses = await api('/api/teacher/courses').catch(() => []);
  const list = document.getElementById('teacherCourseList');
  if (!list) return;
  list.innerHTML = courses.map(c => `
    <div class="sidebar-course-item" id="si-course-${c.id}"
         onclick="loadCourseView(${c.id},'${escHtml(c.name)}'); setActiveSidebar('course-${c.id}')">
      <div class="course-dot ${courseColorClass(c.id)}">${c.code.slice(0,2)}</div>
      <div>
        <div class="course-dot-label">${escHtml(c.name)}</div>
        <div class="course-dot-code">${c.code}</div>
      </div>
    </div>
  `).join('');
}

async function loadStudentSidebarCourses() {
  const courses = await api('/api/student/courses').catch(() => []);
  const list = document.getElementById('studentCourseList');
  if (!list) return;
  list.innerHTML = courses.map(c => `
    <div class="sidebar-course-item" id="si-course-${c.id}"
         onclick="loadCourseView(${c.id},'${escHtml(c.name)}'); setActiveSidebar('course-${c.id}')">
      <div class="course-dot ${courseColorClass(c.id)}">${c.code.slice(0,2)}</div>
      <div>
        <div class="course-dot-label">${escHtml(c.name)}</div>
        <div class="course-dot-code">${c.code}</div>
      </div>
    </div>
  `).join('');
}

// ---- HTML escape ----
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Calendar (shared) ----
async function loadCalendar() {
  setPageTitle('Calendar');
  setActiveSidebar(currentUser.role === 'teacher' ? 'tcal' : 'scal');
  setContent('<div class="loading-state"><div class="spinner"></div></div>');
  const events = await api('/api/calendar').catch(() => []);
  const upcoming = events.filter(e => e.due_date && new Date(e.due_date) >= new Date());
  const past = events.filter(e => e.due_date && new Date(e.due_date) < new Date());

  function renderEvents(list) {
    if (!list.length) return emptyState('📅','No events');
    return list.map(e => {
      const d = new Date(e.due_date);
      const day = d.getDate();
      const mon = d.toLocaleString('en',{month:'short'});
      const typeIcon = e.type === 'assignment' ? '✏️' : e.type === 'quiz' ? '📝' : '💬';
      return `<div class="calendar-event">
        <div class="cal-date-box"><div class="cal-day">${day}</div><div class="cal-month">${mon}</div></div>
        <div class="cal-info">
          <div class="cal-title">${typeIcon} ${escHtml(e.title)}</div>
          <div class="cal-course">${escHtml(e.course_name)}</div>
        </div>
        <div><span class="badge badge-blue">${e.type}</span></div>
      </div>`;
    }).join('');
  }

  setContent(`
    <div class="page-header"><h1>📅 Calendar</h1><p>Upcoming due dates across all your courses</p></div>
    <div class="card mb-24">
      <div class="card-header"><span class="card-title">Upcoming (${upcoming.length})</span></div>
      <div>${renderEvents(upcoming)}</div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Past Events (${past.length})</span></div>
      <div>${renderEvents(past)}</div>
    </div>
  `);
}

// ---- Course view router ----
async function loadCourseView(courseId, courseName) {
  setPageTitle(courseName);
  setContent('<div class="loading-state"><div class="spinner"></div></div>');
  if (currentUser.role === 'teacher') {
    await renderTeacherCourse(courseId);
  } else {
    await renderStudentCourse(courseId);
  }
}
