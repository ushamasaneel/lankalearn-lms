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
  }  else {
    nav.innerHTML = `
      <div class="sidebar-heading">Learning</div>
      <div class="sidebar-item" id="si-sdash" onclick="loadStudentDashboard(); setActiveSidebar('sdash')">
        <span class="si-icon">🏠</span> Dashboard
      </div>
      <div class="sidebar-item" id="si-scal" onclick="loadCalendar(); setActiveSidebar('scal')">
        <span class="si-icon">📅</span> Calendar
      </div>
      <div class="sidebar-item" id="si-sfees" onclick="loadStudentFees(); setActiveSidebar('sfees')">
        <span class="si-icon">💰</span> Fees
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
// ---- Tiered Interactive Calendar ----
// ---- Full Grid Calendar ----
// ---- Full Grid Calendar (Mobile Scaled) ----
let currentCalDate = new Date();
let cachedEvents = [];

async function loadCalendar() {
  setPageTitle('Calendar');
  const roleCode = currentUser.role === 'admin' ? 'cal' : (currentUser.role === 'teacher' ? 'tcal' : 'scal');
  setActiveSidebar(roleCode);
  setContent('<div class="loading-state"><div class="spinner"></div></div>');
  
  // Inject CSS for the Grid (Responsive scaling instead of a list)
  if (!document.getElementById('calGridStyles')) {
    const style = document.createElement('style');
    style.id = 'calGridStyles';
    style.innerHTML = `
      .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin-top:16px;}
      .cal-header-cell { background: #f8fafc; padding: 12px; text-align: center; font-weight: 700; font-size: 12px; text-transform: uppercase; color: var(--text-muted); }
      .cal-cell { background: white; min-height: 110px; padding: 6px; display: flex; flex-direction: column; gap: 4px; transition: background 0.2s; }
      .cal-cell:hover { background: #f8fafc; }
      .cal-cell.empty { background: #f1f5f9; color: #cbd5e1; }
      .cal-cell.today { background: #eff6ff; box-shadow: inset 0 0 0 2px var(--primary); }
      .cal-date-num { font-weight: 600; font-size: 13px; margin-bottom: 4px; text-align: right; padding-right:4px;}
      .cal-event-pill { font-size: 10.5px; font-weight: 600; padding: 4px 6px; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; color: white; box-shadow: 0 1px 2px rgba(0,0,0,0.1); transition: opacity 0.2s; }
      .cal-event-pill:hover { opacity: 0.8; }
      .bg-global { background: #ef4444; } .bg-course { background: #8b5cf6; } .bg-personal { background: #10b981; } .bg-academic { background: #3b82f6; }

      /* Mobile Grid Scaling (Squish to fit) */
      @media (max-width: 768px) {
        .page-header-row { flex-direction: column; gap: 12px; align-items: stretch !important; }
        .page-header-row h1 { font-size: 20px !important; }
        
        /* Keep the 7 columns, but reduce spacing and font sizes */
        .cal-header-cell { padding: 8px 2px; font-size: 10px; }
        .cal-cell { min-height: 70px; padding: 3px; gap: 2px; }
        .cal-date-num { font-size: 11px; text-align: center; margin-bottom: 2px; padding: 0; }
        
        /* Make the event pills tiny so they fit */
        .cal-event-pill { font-size: 9px; padding: 3px 2px; border-radius: 2px; letter-spacing: -0.2px; line-height: 1; text-align: center;}
      }
      
      /* Extra tiny screens */
      @media (max-width: 400px) {
        .cal-header-cell { font-size: 8.5px; letter-spacing: -0.5px; }
        .cal-event-pill { font-size: 8px; }
      }
    `;
    document.head.appendChild(style);
  }

  cachedEvents = await api('/api/calendar').catch(() => []);
  renderCalendarMonth();
}

function renderCalendarMonth() {
  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();
  const today = new Date();
  
  const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Make Monday first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const monthName = currentCalDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  let html = `
    <div class="page-header page-header-row" style="align-items:center;">
      <div style="display:flex; align-items:center; justify-content:space-between; width:100%; max-width: 400px; margin: 0 auto;">
        <button class="btn btn-secondary btn-sm" onclick="changeMonth(-1)">◀ Prev</button>
        <h1 style="margin:0; text-align:center;">${monthName}</h1>
        <button class="btn btn-secondary btn-sm" onclick="changeMonth(1)">Next ▶</button>
      </div>
      <button class="btn btn-primary" onclick="showAddEventModal()">+ Add Event</button>
    </div>
    <div class="cal-grid">
      <div class="cal-header-cell">Mon</div><div class="cal-header-cell">Tue</div>
      <div class="cal-header-cell">Wed</div><div class="cal-header-cell">Thu</div>
      <div class="cal-header-cell">Fri</div><div class="cal-header-cell">Sat</div>
      <div class="cal-header-cell">Sun</div>
  `;

  // Empty cells before start of month
  for (let i = 0; i < startOffset; i++) { html += `<div class="cal-cell empty"></div>`; }

  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const currentDateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    
    // Find events falling on this day
    const dayEvents = cachedEvents.filter(e => {
        if (!e.start_date) return false;
        const s = e.start_date.split('T')[0];
        const en = (e.end_date || e.start_date).split('T')[0];
        return currentDateStr >= s && currentDateStr <= en;
    });

    html += `<div class="cal-cell ${isToday ? 'today' : ''}">
      <div class="cal-date-num">${d}</div>
      ${dayEvents.map(e => {
        let bgClass = e.type === 'global' ? 'bg-global' : e.type === 'course' ? 'bg-course' : e.type === 'personal' ? 'bg-personal' : 'bg-academic';
        let timeStr = (e.has_time && e.start_date.includes('T')) ? `<span style="opacity:0.8; margin-right:2px;">${e.start_date.split('T')[1]}</span>` : '';
        return `<div class="cal-event-pill ${bgClass}" onclick="viewCalendarEvent(${e.id})" title="${escHtml(e.title)}">${timeStr}${escHtml(e.title)}</div>`;
      }).join('')}
    </div>`;
  }

  // Fill remainder of grid
  const totalCells = startOffset + daysInMonth;
  const trailingEmpty = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < trailingEmpty; i++) { html += `<div class="cal-cell empty"></div>`; }

  html += `</div>`;
  setContent(html);
}


window.changeMonth = (offset) => {
  currentCalDate.setMonth(currentCalDate.getMonth() + offset);
  renderCalendarMonth();
};

window.showAddEventModal = async () => {
  let typeOptions = `<option value="personal">👤 Personal Reminder</option>`;
  let courseSelectHtml = '';
  if (currentUser.role === 'admin') typeOptions = `<option value="global">🏫 Global School Event (All Users)</option>` + typeOptions;
  else if (currentUser.role === 'teacher') {
    typeOptions = `<option value="course">🎒 Course Event</option>` + typeOptions;
    const courses = await api('/api/teacher/courses').catch(() => []);
    courseSelectHtml = `<div class="form-group" id="courseSelectGroup"><label>Course</label><select name="course_id" class="form-control">${courses.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}</select></div>`;
  }

  openModal('Add Calendar Event', `
    <form id="calEventForm" onsubmit="return false">
      <div class="form-row form-row-2">
        <div class="form-group"><label>Event Type</label><select name="event_type" id="calEventType" class="form-control" onchange="document.getElementById('courseSelectGroup').style.display = this.value==='course'?'block':'none'">${typeOptions}</select></div>
        ${courseSelectHtml || '<div></div>'}
      </div>
      <div class="form-group"><label>Event Title</label><input type="text" name="title" class="form-control" required></div>
      
      <div style="background:#f8fafc; border:1px solid var(--border); padding:16px; border-radius:8px; margin-bottom:16px;">
        <label style="display:flex; align-items:center; gap:8px; font-weight:700; cursor:pointer; margin-bottom:12px;">
          <input type="checkbox" id="hasTimeCheck" onchange="toggleTimeFields()" style="transform:scale(1.2)"> Include Specific Time
        </label>
        <div class="form-row form-row-2" style="margin:0">
          <div class="form-group" style="margin:0"><label>Start</label><input type="date" name="start_date" id="calStart" class="form-control" required></div>
          <div class="form-group" style="margin:0"><label>End</label><input type="date" name="end_date" id="calEnd" class="form-control" required></div>
        </div>
      </div>

      <div class="form-group"><label>Description</label><textarea name="description" class="form-control" style="min-height:60px"></textarea></div>
      <div class="flex gap-8 mt-16" style="justify-content:flex-end">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="submitCalendarEvent()">Save Event</button>
      </div>
    </form>
  `);
  if(document.getElementById('courseSelectGroup')) document.getElementById('calEventType').dispatchEvent(new Event('change'));
};

window.toggleTimeFields = () => {
  const isTime = document.getElementById('hasTimeCheck').checked;
  document.getElementById('calStart').type = isTime ? 'datetime-local' : 'date';
  document.getElementById('calEnd').type = isTime ? 'datetime-local' : 'date';
};

window.submitCalendarEvent = async () => {
  const form = document.getElementById('calEventForm');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const fd = new FormData(form);
  fd.append('has_time', document.getElementById('hasTimeCheck').checked ? '1' : '0');
  
  try {
    await apiPost('/api/calendar/events', fd);
    closeModal(); showToast('Event added!', 'success'); loadCalendar();
  } catch (e) { showToast(e.message, 'error'); }
};

window.viewCalendarEvent = (eid) => {
  const e = cachedEvents.find(x => x.id === eid);
  if(!e) return;
  const canDelete = ['global', 'course', 'personal'].includes(e.type) && (currentUser.role === 'admin' || e.user_id === currentUser.id);
  openModal(e.title, `
    <div class="alert alert-info">📅 From: ${e.start_date.replace('T', ' ')}<br>📅 To: ${e.end_date ? e.end_date.replace('T', ' ') : '—'}</div>
    <p>${e.course_name ? `<strong>Course:</strong> ${escHtml(e.course_name)}` : ''}</p>
    <p>${e.description || 'No additional details provided.'}</p>
    ${canDelete ? `<div style="margin-top:20px; border-top:1px solid var(--border); padding-top:16px; text-align:right;"><button class="btn btn-danger btn-sm" onclick="deleteCalendarEvent(${e.id})">Delete Event</button></div>` : ''}
  `);
};

window.deleteCalendarEvent = async (eid) => {
  if (!confirm('Delete this event?')) return;
  try {
    await apiDelete(`/api/calendar/events/${eid}`);
    closeModal(); showToast('Event deleted', 'success'); loadCalendar();
  } catch (e) { showToast(e.message, 'error'); }
};

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

