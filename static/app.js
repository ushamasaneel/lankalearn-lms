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
  initializeUserPreferences(); // <--- ADD THIS LINE HERE

  // ... rest of your code ...

  if (currentUser.must_change_password) {
      openModal('Security Required', `
          <div class="alert alert-warn mb-16">You are using a temporary password. You must set a private password to continue.</div>
          <div class="form-group">
              <label>New Password</label>
              <input type="password" id="forceNewPw" class="form-control" placeholder="Enter new password">
          </div>
          <button class="btn btn-primary w-full mt-8" onclick="submitForcedPassword()">Update Password</button>
      `, 'modal-box');
      
      window.submitForcedPassword = async () => {
          const pw = document.getElementById('forceNewPw').value;
          if (pw.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
          const fd = new FormData(); fd.append('new_password', pw);
          try {
              await apiPost('/api/auth/change-password', fd);
              closeModal(); showToast('Password updated!', 'success');
              currentUser.must_change_password = false;
          } catch (e) { showToast(e.message, 'error'); }
      };
  }


// Check for active broadcasts
// Check for active broadcasts
// Check for active broadcasts
api('/api/broadcasts/active').then(alert => {
    if (alert) {
        // Tie the dismissed memory to the specific user ID
        const storageKey = `dismissedAlerts_${currentUser.id}`;
        let dismissed = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (dismissed.includes(alert.id)) return;

        const banner = document.createElement('div');
        banner.style.cssText = "background: #dc2626; color: white; padding: 10px 20px; text-align: center; font-weight: 600; font-size: 13.5px; z-index: 1050; position: relative;";
        
        window.dismissAlert = (alertId, element) => {
            dismissed.push(alertId);
            localStorage.setItem(storageKey, JSON.stringify(dismissed)); // Update key here too
            element.style.display = 'none';
            document.querySelector('.top-header').style.top = '0px';
            document.querySelector('.sidebar').style.top = '64px';
        };

        banner.innerHTML = `🚨 <strong>${escHtml(alert.title)}:</strong> ${escHtml(alert.message)} <span style="float:right; cursor:pointer;" onclick="dismissAlert(${alert.id}, this.parentElement)">✕</span>`;
        document.body.insertBefore(banner, document.body.firstChild);
        
        document.querySelector('.top-header').style.top = banner.offsetHeight + 'px';
        document.querySelector('.sidebar').style.top = (64 + banner.offsetHeight) + 'px';
    }
}).catch(() => {});


 // Route to default view based on role
  if (currentUser.role === 'admin' || currentUser.role === 'sub_admin' || currentUser.role === 'super_admin') {
      loadAdminDashboard();
  }
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
// ---- Build sidebar by role ----
function buildSidebar() {
  const nav = document.getElementById('sidebarNav');
  if (currentUser.role === 'admin' || currentUser.role === 'sub_admin' || currentUser.role === 'super_admin') {
    nav.innerHTML = `
      <div class="sidebar-heading">Administration</div>
      <div class="sidebar-item" id="si-dash" onclick="loadAdminDashboard(); setActiveSidebar('dash')">
        <i class="fas fa-chart-line si-icon"></i> Dashboard
      </div>
      <div class="sidebar-item" id="si-users" onclick="loadAdminUsers(); setActiveSidebar('users')">
        <i class="fas fa-users si-icon"></i> Users
      </div>
      <div class="sidebar-item" id="si-courses" onclick="loadAdminCourses(); setActiveSidebar('courses')">
        <i class="fas fa-book si-icon"></i> Courses
      </div>
      <div class="sidebar-item" id="si-fees" onclick="loadAdminFees(); setActiveSidebar('fees')">
        <i class="fas fa-money-bill-wave si-icon"></i> Student Fees
      </div>
      <div class="sidebar-item" id="si-tsalaries" onclick="loadTeacherSalaries(); setActiveSidebar('tsalaries')">
        <i class="fas fa-file-invoice-dollar si-icon"></i> Teacher Salaries
      </div>
      <div class="sidebar-divider"></div>
      <div class="sidebar-heading">System</div>
      <div class="sidebar-item" id="si-cal" onclick="loadCalendar(); setActiveSidebar('cal')">
        <i class="fas fa-calendar-alt si-icon"></i> Calendar
      </div>
      <div class="sidebar-item" id="si-logs" onclick="loadAuditLogs(); setActiveSidebar('logs')">
        <i class="fas fa-shield-alt si-icon"></i> Audit Logs
      </div>
      <div class="sidebar-item" id="si-trash" onclick="loadTrashBin(); setActiveSidebar('trash')">
        <i class="fas fa-trash-alt si-icon"></i> Trash Bin
      </div>
      <div class="sidebar-item" id="si-exec" onclick="loadExecutiveDashboard(); setActiveSidebar('exec')">
         <i class="fas fa-briefcase si-icon"></i> Executive Dash
      </div>
      <div class="sidebar-item" id="si-help" onclick="loadFAQ(); setActiveSidebar('help')">
        <i class="fas fa-question-circle si-icon"></i> Help & Support
      </div>
    `;
  } else if (currentUser.role === 'teacher') {
    nav.innerHTML = `
      <div class="sidebar-heading">Teaching</div>
      <div class="sidebar-item" id="si-tdash" onclick="loadTeacherDashboard(); setActiveSidebar('tdash')">
        <span class="si-icon"><i class="fas fa-home"></i></span> Dashboard
      </div>
      <div class="sidebar-item" id="si-tcal" onclick="loadCalendar(); setActiveSidebar('tcal')">
        <span class="si-icon"><i class="fas fa-calendar-alt"></i></span> Calendar
      </div>
      <div class="sidebar-item" id="si-msalary" onclick="loadTeacherSalaryView(); setActiveSidebar('msalary')">
        <span class="si-icon"><i class="fas fa-file-invoice-dollar"></i></span> My Salary
      </div>
      <div class="sidebar-item" id="si-help" onclick="loadFAQ(); setActiveSidebar('help')">
        <span class="si-icon"><i class="fas fa-question-circle"></i></span> Help & Support
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
        <span class="si-icon"><i class="fas fa-home"></i></span> Dashboard
      </div>
      <div class="sidebar-item" id="si-scal" onclick="loadCalendar(); setActiveSidebar('scal')">
        <span class="si-icon"><i class="fas fa-calendar-alt"></i></span> Calendar
      </div>
      <div class="sidebar-item" id="si-stimetable" onclick="loadStudentTimetable(); setActiveSidebar('stimetable')">
        <span class="si-icon"><i class="fas fa-clock"></i></span> Class Timetable
      </div>
      <div class="sidebar-item" id="si-sfees" onclick="loadStudentFees(); setActiveSidebar('sfees')">
        <span class="si-icon"><i class="fas fa-money-bill-wave"></i></span> Fees
      </div>
      <div class="sidebar-item" id="si-help" onclick="loadFAQ(); setActiveSidebar('help')">
        <span class="si-icon"><i class="fas fa-question-circle"></i></span> Help & Support
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
  setContent('<div class="loading-state"><div class="edu-loader"></div><p class="mt-16 text-muted font-bold">Loading LankaLearn...</p></div>');
  
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
  let typeOptions = `<option value="personal"><i class="fas fa-user"></i> Personal Reminder</option>`;
  let courseSelectHtml = '';
  if (currentUser.role === 'admin') typeOptions = `<option value="global"><i class="fas fa-school"></i> Global School Event (All Users)</option>` + typeOptions;
  else if (currentUser.role === 'teacher') {
    typeOptions = `<option value="course"><i class="fas fa-backpack"></i> Course Event</option>` + typeOptions;
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
    <div class="alert alert-info"><i class="fas fa-calendar-alt"></i> From: ${e.start_date.replace('T', ' ')}<br><i class="fas fa-calendar-alt"></i> To: ${e.end_date ? e.end_date.replace('T', ' ') : '—'}</div>
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
  setContent('<div class="loading-state"><div class="edu-loader"></div><p class="mt-16 text-muted font-bold">Loading LankaLearn...</p></div>');
  
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
  { id: 'tc-modules', icon: '<i class="fas fa-box"></i>', label: 'Modules', fn: 'tcLoadModules' },
  { id: 'tc-assignments', icon: '<i class="fas fa-pencil-alt"></i>', label: 'Assignments', fn: 'tcLoadAssignments' },
  { id: 'tc-discussions', icon: '<i class="fas fa-comments"></i>', label: 'Discussions', fn: 'tcLoadDiscussions' },
  { id: 'tc-announcements', icon: '<i class="fas fa-bullhorn"></i>', label: 'Announcements', fn: 'tcLoadAnnouncements' },
  { id: 'tc-gradebook', icon: '<i class="fas fa-chart-bar"></i>', label: 'Gradebook', fn: 'tcLoadGradebook' },
  { id: 'tc-quizzes', icon: '<i class="fas fa-file-alt"></i>', label: 'Quizzes', fn: 'tcLoadQuizzes' },
  { id: 'tc-rubrics', icon: '<i class="fas fa-tags"></i>', label: 'Rubrics', fn: 'tcLoadRubrics' },
  { id: 'tc-syllabus', icon: '<i class="fas fa-clipboard"></i>', label: 'Syllabus', fn: 'tcLoadSyllabus' },
  { id: 'tc-attendance', icon: '<i class="fas fa-calendar-alt"></i>', label: 'Attendance', fn: 'tcLoadAttendance' },
  { id: 'tc-students', icon: '<i class="fas fa-users"></i>', label: 'Students', fn: 'tcLoadEnrolledStudents' }
]
: [
  // Students usually have fewer items (7 total)
  { id: 'sc-modules', icon: '<i class="fas fa-box"></i>', label: 'Modules', fn: 'scLoadModules' },
  { id: 'sc-assignments', icon: '<i class="fas fa-pencil-alt"></i>', label: 'Assignments', fn: 'scLoadAssignments' },
  { id: 'sc-discussions', icon: '<i class="fas fa-comments"></i>', label: 'Discussions', fn: 'scLoadDiscussions' },
  { id: 'sc-announcements', icon: '<i class="fas fa-bullhorn"></i>', label: 'Announcements', fn: 'scLoadAnnouncements' },
  { id: 'sc-grades', icon: '<i class="fas fa-chart-bar"></i>', label: 'Grades', fn: 'scLoadGrades' },
  { id: 'sc-quizzes', icon: '<i class="fas fa-file-alt"></i>', label: 'Quizzes', fn: 'scLoadQuizzes' },
  { id: 'sc-syllabus', icon: '<i class="fas fa-clipboard"></i>', label: 'Syllabus', fn: 'scLoadSyllabus' }
];

  subNav.innerHTML = tabs.map(t => `
    <div class="sidebar-sub-item" id="sub-${t.id}" onclick="handleSubNavClick('${t.id}', ${t.fn}, '${t.label}')">
      <span>${t.icon}</span> ${t.label}
    </div>
  `).join('');

  courseItem.after(subNav);
}


// ================================================================
// HELP & SUPPORT (FAQ)
// ================================================================

// ================================================================
// HELP & SUPPORT (FAQ & CONTACT)
// ================================================================

function loadFAQ() {
  setPageTitle('Help & Support');
  setActiveSidebar('help');

  let faqs = [];

  if (currentUser.role === 'admin') {
    faqs = [
      { q: "How do I add a new user?", a: "Go to Users > Select the Teacher or Student tab > Click '+ Create'." },
      { q: "How do I enroll students in a course?", a: "Go to Courses > Click 'Students' on a course card > Use the 'Add Students' panel." },
      { q: "How do I record a fee payment?", a: "Go to Fees > Click 'Manage Fees & Receipts' for a student > Click '+ Record Payment'." },
      { q: "How do I print a fee receipt?", a: "In the student's Fee modal, click the 🖨️ icon next to the specific payment in the history table." },
      { q: "How do I add a school holiday?", a: "Go to Calendar > Click '+ Add Event' > Select 'Global School Event'." },
      { q: "How do I reset a user's password?", a: "Go to Users > Click 'Reset PW' on the user >  Click OK (Copy the termporary Password and send it to the respective user)." },
      { q: "Can a user change the password on their own?", a: "No, only admins can reset passwords." }
    ];
  } else if (currentUser.role === 'teacher') {
    faqs = [
      { q: "How do I create a quiz?", a: "Open your course > Go to Quizzes > Click 'Create New Quiz' > Add questions and save." },
      { q: "How do I mark attendance?", a: "Open your course > Go to Attendance > Select the date > Mark Present/Absent/Late > Click 'Save Attendance'." },
      { q: "How do I grade an assignment?", a: "Open your course > Go to Assignments > Click 'Submissions' > Enter the marks and feedback > Click 'Save'." },
      { q: "How do I upload lecture notes?", a: "Open your course > Go to Modules > Open a module > Click '+ Add Item' > Upload your file." },
      { q: "How do I notify my students?", a: "Go to Announcements in your course and click '+ Post Announcement'." },
      { q: "Can I change my password on my own?", a: "No, only admins can reset passwords, when you request a password reset, Admin will send you a temporary password > use that to change your password." }
    ];
  } else if (currentUser.role === 'student') {
    faqs = [
      { q: "How do I submit an assignment?", a: "Open the course > Go to Assignments > Click 'Submit Assignment' > Upload your file or type your answer." },
      { q: "How do I take a quiz?", a: "Open the course > Go to Quizzes > Click 'Take Quiz'. Note the time limit before starting." },
      { q: "Where can I see my grades?", a: "Click on 'Grades' inside your course to see your overall average and individual scores." },
      { q: "How do I check my fee payments?", a: "Click 'Fees' in the main left sidebar to view your payment history and print statements." },
      { q: "How do I view the course syllabus?", a: "Open the course and click the 'Syllabus' tab." },
      { q: "Can I change my password on my own?", a: "No, only admins can reset passwords, when you request a password reset, Admin will send you a temporary password > use that to change your password." }
    ];
  }

  const faqHtml = faqs.map(f => `
    <details style="background:white; border:1px solid var(--border); border-radius:8px; margin-bottom:12px; padding:16px; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
      <summary style="font-weight:700; cursor:pointer; color:var(--primary-dark); outline:none; font-size:15px;">
        ${f.q}
      </summary>
      <div style="margin-top:12px; font-size:14px; color:var(--text); line-height:1.6; padding-left:18px; border-left:2px solid var(--border);">
        ${f.a}
      </div>
    </details>
  `).join('');

setContent(`
    <div class="page-header page-header-row">
      <div>
        <h1><i class="fas fa-question-circle" style="color:var(--primary-dark);"></i> Help & Support</h1>
        <p>Frequently asked questions and guides for your role.</p>
      </div>
    </div>
    
    <div style="display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start;">
      <div style="flex: 1; min-width: 300px;">
        <h3 style="margin-bottom:16px; font-size:18px;">Frequently Asked Questions</h3>
        ${faqHtml}
      </div>

      <div class="card" style="width: 350px; flex-shrink: 0;">
        <div class="card-header"><span class="card-title"><i class="fas fa-headset" style="color:var(--primary);"></i> Contact Administration</span></div>
        <div class="card-body">
          <p class="text-sm text-muted mb-16">Need further assistance? Reach out to the school administration directly.</p>
          
          <div style="margin-bottom: 24px; font-size: 13.5px; line-height: 1.6;">
            <div><strong><i class="fas fa-envelope" style="color:#64748b; margin-right:8px;"></i> Email:</strong> support@lankalearn.lk</div>
            <div><strong><i class="fas fa-phone-alt" style="color:#64748b; margin-right:8px;"></i> Phone:</strong> +94 11 234 5678</div>
            <div><strong><i class="fas fa-clock" style="color:#64748b; margin-right:8px;"></i> Hours:</strong> Mon - Fri, 8:00 AM - 4:00 PM</div>
          </div>

          <form id="supportForm" onsubmit="submitSupportTicket(event)">
            <div class="form-group">
              <label>Subject</label>
              <input type="text" id="supportSubject" class="form-control" placeholder="Briefly describe the issue" required>
            </div>
            <div class="form-group">
              <label>Message</label>
              <textarea id="supportMessage" class="form-control" style="min-height: 100px;" placeholder="How can we help you?" required></textarea>
            </div>
            <button type="submit" id="supportBtn" class="btn btn-primary w-full"><i class="fas fa-paper-plane"></i> Send Message</button>
          </form>
        </div>
      </div>
    </div>
  `);

  window.submitSupportTicket = (e) => {
    e.preventDefault();
    const btn = document.getElementById('supportBtn');
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Sending...';
    btn.disabled = true;

    // Simulate network request
    setTimeout(() => {
      document.getElementById('supportSubject').value = '';
      document.getElementById('supportMessage').value = '';
      btn.innerHTML = '✉️ Send Message';
      btn.disabled = false;
      showToast('Your message has been sent to support!', 'success');
    }, 1000);
  };
}

function toggleAiChat() {
    const box = document.getElementById('aiChatBox');
    if (!box) return;
    box.style.display = (box.style.display === 'none' || box.style.display === '') ? 'flex' : 'none';
}

async function sendAiMessage() {
    const input = document.getElementById('aiInput');
    const content = document.getElementById('aiChatContent');
    const msg = input.value.trim();
    if (!msg) return;

    // 1. Show your message
    content.innerHTML += `<div style="align-self:flex-end; background:#1e40af; color:white; padding:8px 12px; border-radius:12px 12px 0 12px; max-width:80%;">${msg}</div>`;
    input.value = '';
    content.scrollTop = content.scrollHeight;

    // 2. Show loading dots
    const loadingId = 'ai-load-' + Date.now();
    content.innerHTML += `<div id="${loadingId}" style="align-self:flex-start; background:#e2e8f0; padding:8px 12px; border-radius:12px 12px 12px 0;">...</div>`;
    content.scrollTop = content.scrollHeight;

    try {
        const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        
        // Remove loading dots
        const loadEl = document.getElementById(loadingId);
        if (loadEl) loadEl.remove();
        
        // 3. Show AI reply
        content.innerHTML += `<div style="align-self:flex-start; background:#ffffff; border:1px solid #e2e8f0; padding:8px 12px; border-radius:12px 12px 12px 0; max-width:80%; box-shadow:0 2px 4px rgba(0,0,0,0.05);">${data.reply}</div>`;
        content.scrollTop = content.scrollHeight;
    } catch (e) {
        const loadEl = document.getElementById(loadingId);
        if (loadEl) loadEl.innerText = "Connection error. Please try again.";
    }
}


// ================================================================
// STUDENT TIMETABLE VIEW
// ================================================================

async function loadStudentTimetable() {
    setPageTitle('Class Timetable');
    setActiveSidebar('stimetable');
    setContent('<div class="loading-state"><div class="edu-loader"></div><p class="mt-16 text-muted font-bold">Loading LankaLearn...</p></div>');
    
    try {
        const entries = await api('/api/student/timetable');
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        
        let html = `
            <div class="page-header page-header-row">
                <div><h1><i class="fas fa-clock" style="color:var(--primary-dark);"></i> My Class Timetable</h1><p>Your weekly live class schedule.</p></div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:16px; margin-top:20px;">
        `;

        days.forEach(day => {
            const dayEntries = entries.filter(e => e.day_of_week === day).sort((a,b) => a.start_time.localeCompare(b.start_time));
            
            html += `<div class="card" style="padding:0; border:none; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                <div style="background:var(--primary); color:white; text-align:center; font-weight:700; padding:10px; border-radius:8px 8px 0 0;">${day}</div>
                <div style="padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 8px 8px; min-height:200px;">
                    ${dayEntries.length === 0 ? `<div class="text-center text-muted text-sm" style="margin-top:20px;">No Classes</div>` : ''}
                    ${dayEntries.map(e => `
                        <div style="background:white; border-left:3px solid #10b981; padding:10px; border-radius:4px; box-shadow:0 1px 2px rgba(0,0,0,0.05); margin-bottom:8px;">
                            <div style="font-size:11px; font-weight:700; color:#10b981; margin-bottom:4px;"><i class="fas fa-clock"></i>&nbsp; ${e.start_time} - ${e.end_time}</div>
                            <div style="font-size:13px; font-weight:700; color:var(--text); line-height:1.2;">${escHtml(e.course_name)}</div>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:6px;"><i class="fas fa-chalkboard-teacher"></i>&nbsp; ${escHtml(e.teacher_name || 'TBA')}</div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        });
        
        html += `</div>`;
        setContent(html);
        
    } catch(e) { setContent(`<div class="alert alert-error">Failed to load timetable: ${e.message}</div>`); }
}
// ============================================================
// THEME & AUTO-TRANSLATION ENGINE (User-Specific)
// ============================================================

window.toggleDarkMode = function() {
    if (!currentUser) return; 
    
    document.body.classList.toggle('dark-mode');
    const icon = document.getElementById('darkModeIcon');
    const label = document.getElementById('themeLabel'); // Grabs the new label
    const isDark = document.body.classList.contains('dark-mode');
    
    if (isDark) {
        icon?.classList.replace('fa-moon', 'fa-sun');
        if (label) label.textContent = 'Light Mode';
        localStorage.setItem(`theme_${currentUser.id}`, 'dark');
    } else {
        icon?.classList.replace('fa-sun', 'fa-moon');
        if (label) label.textContent = 'Dark Mode';
        localStorage.setItem(`theme_${currentUser.id}`, 'light');
    }
};

window.changeLanguage = function(lang, event) {
    if (event) event.stopPropagation(); // Stops the menu from instantly closing incorrectly
    if (!currentUser) return;
    localStorage.setItem(`lang_${currentUser.id}`, lang);
    showToast('Language updated! Refreshing...', 'success');
    setTimeout(() => { window.location.reload(); }, 600);
};

// Expanded Dictionary (Added Sidebar Headers)
const dictionary = {
    "Dashboard": { si: "පුවරුව", ta: "முகப்பு" },
    "Users": { si: "පරිශීලකයන්", ta: "பயனர்கள்" },
    "Courses": { si: "පාඨමාලා", ta: "பாடநெறிகள்" },
    "Fees": { si: "ගාස්තු", ta: "கட்டணங்கள்" },
    "System": { si: "පද්ධතිය", ta: "கணினி" },
    "Calendar": { si: "දින දර්ශනය", ta: "நாள்காட்டி" },
    "Audit Logs": { si: "විගණන ලොග", ta: "தணிக்கை பதிவுகள்" },
    "Trash Bin": { si: "කුණු කූඩය", ta: "குப்பை தொட்டி" },
    "Executive Dash": { si: "විධායක පුවරුව", ta: "நிர்வாக குழு" },
    "Help & Support": { si: "උදව් සහ සහාය", ta: "உதவி மற்றும் ஆதரவு" },
    "Sign Out": { si: "පිටවන්න", ta: "வெளியேறு" },
    "Class Timetable": { si: "පන්ති කාලසටහන", ta: "வகுப்பு நேர அட்டவணை" },
    "Administration": { si: "පරිපාලනය", ta: "நிர்வாகம்" },
    "Teaching": { si: "ඉගැන්වීම", ta: "கற்பித்தல்" },
    "Learning": { si: "ඉගෙනුම", ta: "கற்றல்" },
    "My Courses": { si: "මගේ පාඨමාලා", ta: "என் பாடநெறிகள்" },
    "Dark Mode": { si: "අඳුරු තේමාව", ta: "இருண்ட பயன்முறை" },
    "Light Mode": { si: "ආලෝක තේමාව", ta: "ஒளி பயன்முறை" },
    "Language": { si: "භාෂාව", ta: "மொழி" },
    "Teacher Salaries": { si: "ගුරුවරුන්ගේ වැටුප්", ta: "ஆசிரியர் சம்பளம்" },
    "My Salary": { si: "මගේ වැටුප", ta: "என் சம்பளம்" }
};

function initializeUserPreferences() {
    if (!currentUser) return;
    
    // 1. Load User's Theme
    const savedTheme = localStorage.getItem(`theme_${currentUser.id}`);
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeIcon')?.classList.replace('fa-moon', 'fa-sun');
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('darkModeIcon')?.classList.replace('fa-sun', 'fa-moon');
    }
    
    // 2. Load User's Language
    // 2. Load User's Language & Update Custom UI
    const lang = localStorage.getItem(`lang_${currentUser.id}`) || 'en';
    
    // Set the display text of the custom dropdown
    const langMap = {
        'en': 'English (EN)',
        'si': 'සිංහල (SI)',
        'ta': 'தமிழ் (TA)'
    };
    const currentLangLabel = document.getElementById('currentLangLabel');
    if (currentLangLabel && langMap[lang]) {
        currentLangLabel.textContent = langMap[lang];
    }

    // 3. Translation Engine
    const translateNode = (node) => {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
        let textNode;
        while (textNode = walker.nextNode()) {
            let original = textNode.nodeValue.trim();
            if (dictionary[original] && dictionary[original][lang]) {
                textNode.nodeValue = textNode.nodeValue.replace(original, dictionary[original][lang]);
            }
        }
    };

    // Step A: Translate the existing page immediately on load (Catches Sidebar & Header)
    translateNode(document.body);

    // Step B: Watch for future dynamic clicks and page loads
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { 
                    translateNode(node);
                }
            });
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
}