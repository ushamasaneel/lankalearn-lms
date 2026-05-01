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
      <div class="sidebar-item" id="si-fees" onclick="loadAdminFees(); setActiveSidebar('fees')">
        <span class="si-icon">💰</span> Fees
      </div>
      <div class="sidebar-divider"></div>
      <div class="sidebar-heading">System</div>
      <div class="sidebar-item" id="si-cal" onclick="loadCalendar(); setActiveSidebar('cal')">
        <span class="si-icon">📅</span> Calendar
      </div>
    `;
// ... rest of the function remains the same
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
  
  // Only inject into sidebar if we are actually on a mobile device
  if (window.innerWidth <= 900) {
    renderMobileSubNav(courseId);
  } else {
    // Ensure sidebar is clean on laptop
    document.querySelectorAll('.sidebar-sub-menu').forEach(el => el.remove());
  }

  if (currentUser.role === 'teacher') {
    await renderTeacherCourse(courseId);
  } else {
    await renderStudentCourse(courseId);
  }
}

// Automatically clean up sidebar if user resizes window from phone to laptop
window.addEventListener('resize', () => {
  if (window.innerWidth > 900) {
    document.querySelectorAll('.sidebar-sub-menu').forEach(el => el.remove());
  }
});

window.handleSubNavClick = (panelId, loadFn, label) => {
  document.querySelectorAll('.sidebar-sub-item').forEach(el => el.classList.remove('active'));
  const activeItem = document.getElementById(`sub-${panelId}`);
  if (activeItem) activeItem.classList.add('active');
  
  const prefix = currentUser.role === 'teacher' ? 'tc-' : 'sc-';
  document.querySelectorAll(`.${prefix}panel`).forEach(p => p.style.display = 'none');
  
  const targetPanel = document.getElementById(panelId);
  if (targetPanel) {
    targetPanel.style.display = 'block';
    
    // Create the "Nice Label" below the menu bar
    const existingLabel = document.getElementById('mobileViewIndicator');
    if (existingLabel) existingLabel.remove();
    
    const indicator = document.createElement('div');
    indicator.id = 'mobileViewIndicator';
    indicator.className = 'mobile-view-label';
    indicator.innerHTML = `<span>📍 Viewing:</span> ${label}`;
    targetPanel.prepend(indicator);
  }
  
  loadFn();
  if (window.innerWidth <= 900) toggleMobileSidebar();
};

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar && overlay) { // Added safety check
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
    }
}

// Close sidebar automatically when a course or menu item is clicked on mobile
document.addEventListener('click', function(e) {
    const isMobile = window.innerWidth <= 900;
    const isNavItem = e.target.closest('.sidebar-item') || e.target.closest('.sidebar-course-item');
    
    if (isMobile && isNavItem) {
        toggleMobileSidebar();
    }
});



function renderMobileSubNav(courseId) {
  // Remove any existing sub-nav from a previously opened course
  document.querySelectorAll('.sidebar-sub-menu').forEach(el => el.remove());
  
  const courseItem = document.getElementById(`si-course-${courseId}`);
  if (!courseItem) return;

  const subNav = document.createElement('div');
  subNav.className = 'sidebar-sub-menu';
  
  // UPDATED: Full list of 10 items for the Teacher role
  const tabs = currentUser.role === 'teacher' 
    ? [
        { id: 'tc-modules', icon: '📦', label: 'Modules', fn: 'tcLoadModules' },
        { id: 'tc-assignments', icon: '✏️', label: 'Assignments', fn: 'tcLoadAssignments' },
        { id: 'tc-discussions', icon: '💬', label: 'Discussions', fn: 'tcLoadDiscussions' },
        { id: 'tc-announcements', icon: '📢', label: 'Announcements', fn: 'tcLoadAnnouncements' },
        { id: 'tc-gradebook', icon: '📊', label: 'Gradebook', fn: 'tcLoadGradebook' },
        { id: 'tc-quizzes', icon: '📝', label: 'Quizzes', fn: 'tcLoadQuizzes' },
        { id: 'tc-rubrics', icon: '🏷️', label: 'Rubrics', fn: 'tcLoadRubrics' },
        { id: 'tc-syllabus', icon: '📋', label: 'Syllabus', fn: 'tcLoadSyllabus' },
        { id: 'tc-attendance', icon: '📅', label: 'Attendance', fn: 'tcLoadAttendance' },
        { id: 'tc-students', icon: '👥', label: 'Students', fn: 'tcLoadEnrolledStudents' }
      ]
    : [
        // Students usually have fewer items (7 total)
        { id: 'sc-modules', icon: '📦', label: 'Modules', fn: 'scLoadModules' },
        { id: 'sc-assignments', icon: '✏️', label: 'Assignments', fn: 'scLoadAssignments' },
        { id: 'sc-discussions', icon: '💬', label: 'Discussions', fn: 'scLoadDiscussions' },
        { id: 'sc-announcements', icon: '📢', label: 'Announcements', fn: 'scLoadAnnouncements' },
        { id: 'sc-grades', icon: '📊', label: 'Grades', fn: 'scLoadGrades' },
        { id: 'sc-quizzes', icon: '📝', label: 'Quizzes', fn: 'scLoadQuizzes' },
        { id: 'sc-syllabus', icon: '📋', label: 'Syllabus', fn: 'scLoadSyllabus' }
      ];

  subNav.innerHTML = tabs.map(t => `
    <div class="sidebar-sub-item" id="sub-${t.id}" onclick="handleSubNavClick('${t.id}', ${t.fn}, '${t.label}')">
      <span>${t.icon}</span> ${t.label}
    </div>
  `).join('');

  courseItem.after(subNav);
}

