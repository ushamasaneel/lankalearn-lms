/* ============================================================
   admin.js — Admin dashboard, users, courses, enrollments
   ============================================================ */

async function loadAdminDashboard() {
  setPageTitle('Dashboard');
  setActiveSidebar('dash');
  setContent('<div class="loading-state"><div class="spinner"></div></div>');

  const stats = await api('/api/admin/stats').catch(() => ({}));
  const users = await api('/api/admin/users').catch(() => []);
  const courses = await api('/api/admin/courses').catch(() => []);

  const recentUsers = users.slice(-5).reverse();

  setContent(`
    <div class="page-header">
      <h1>🏠 Admin Dashboard</h1>
      <p>Welcome back, ${escHtml(currentUser.full_name)}. Here's an overview of LankaLearn.</p>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${stats.users || 0}</div>
        <div class="stat-label">Total Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📚</div>
        <div class="stat-value">${stats.courses || 0}</div>
        <div class="stat-label">Courses</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎓</div>
        <div class="stat-value">${stats.enrollments || 0}</div>
        <div class="stat-label">Enrollments</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✏️</div>
        <div class="stat-value">${stats.submissions || 0}</div>
        <div class="stat-label">Submissions</div>
      </div>
    </div>

    <div class="form-row form-row-2">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Recent Users</span>
          <button class="btn btn-primary btn-sm" onclick="loadAdminUsers()">Manage All</button>
        </div>
        <div class="card-body" style="padding:0">
          <table><thead><tr><th>Name</th><th>Username</th><th>Role</th></tr></thead>
          <tbody>${recentUsers.map(u => `
            <tr>
              <td><strong>${escHtml(u.full_name)}</strong></td>
              <td><code>${escHtml(u.username)}</code></td>
              <td><span class="badge ${roleBadge(u.role)}">${u.role}</span></td>
            </tr>`).join('')}
          </tbody></table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Courses</span>
          <button class="btn btn-primary btn-sm" onclick="loadAdminCourses()">Manage All</button>
        </div>
        <div class="card-body" style="padding:0">
          <table><thead><tr><th>Code</th><th>Name</th><th>Teacher</th></tr></thead>
          <tbody>${courses.slice(0,6).map(c => `
            <tr>
              <td><span class="badge badge-blue">${escHtml(c.code)}</span></td>
              <td>${escHtml(c.name)}</td>
              <td>${escHtml(c.teacher_name||'—')}</td>
            </tr>`).join('')}
          </tbody></table>
        </div>
      </div>
    </div>
  `);
}

function roleBadge(role) {
  return role === 'admin' ? 'badge-red' : role === 'teacher' ? 'badge-purple' : 'badge-blue';
}

// ---- Users ----
async function loadAdminUsers() {
  setPageTitle('Users');
  setActiveSidebar('users');
  setContent('<div class="loading-state"><div class="spinner"></div></div>');
  const users = await api('/api/admin/users');

  const teachers = users.filter(u => u.role === 'teacher');
  const students = users.filter(u => u.role === 'student');
  const admins   = users.filter(u => u.role === 'admin');

  function userTable(list) {
    if (!list.length) return '<p class="text-muted" style="padding:16px">None</p>';
    return `<table><thead><tr><th>Full Name</th><th>Username</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
    <tbody>${list.map(u => `<tr>
      <td><strong>${escHtml(u.full_name)}</strong></td>
      <td><code>${escHtml(u.username)}</code></td>
      <td><span class="badge ${roleBadge(u.role)}">${u.role}</span></td>
      <td>${fmtDate(u.created_at)}</td>
      <td>${u.id !== currentUser.id ? `<button class="btn btn-danger btn-xs" onclick="deleteUser(${u.id},'${escHtml(u.full_name)}')">Delete</button>` : '<span class="text-muted text-sm">You</span>'}</td>
    </tr>`).join('')}</tbody></table>`;
  }

  setContent(`
    <div class="page-header page-header-row">
      <div><h1>👥 Users</h1><p>Manage teachers and students</p></div>
      <button class="btn btn-primary" onclick="showCreateUser()">+ Create User</button>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab(this,'tab-teachers')">👨‍🏫 Teachers (${teachers.length})</button>
      <button class="tab-btn" onclick="switchTab(this,'tab-students')">🎒 Students (${students.length})</button>
      <button class="tab-btn" onclick="switchTab(this,'tab-admins')">🔐 Admins (${admins.length})</button>
    </div>

    <div id="tab-teachers" class="tab-panel active card">
      <div class="card-body" style="padding:0">${userTable(teachers)}</div>
    </div>
    <div id="tab-students" class="tab-panel card">
      <div class="card-body" style="padding:0">${userTable(students)}</div>
    </div>
    <div id="tab-admins" class="tab-panel card">
      <div class="card-body" style="padding:0">${userTable(admins)}</div>
    </div>
  `);
}

function switchTab(btn, tabId) {
  btn.closest('.tabs, .page-content, #contentArea')
     .parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

function showCreateUser() {
  openModal('Create New User', modalForm([
    { label: 'Full Name', name: 'full_name', placeholder: 'e.g. Kasun Perera', required: true },
    { label: 'Username', name: 'username', placeholder: 'e.g. kasun.p', required: true },
    { label: 'Password', name: 'password', type: 'password', placeholder: '••••••••', required: true },
    { label: 'Role', name: 'role', type: 'select', required: true, options: [
      { value: 'teacher', label: 'Teacher' },
      { value: 'student', label: 'Student' },
    ]}
  ], async (fd) => {
    try {
      await apiPost('/api/admin/users', fd);
      closeModal();
      showToast('User created successfully', 'success');
      loadAdminUsers();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Create User'));
}

async function deleteUser(id, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  try {
    await apiDelete(`/api/admin/users/${id}`);
    showToast('User deleted', 'success');
    loadAdminUsers();
  } catch (e) { showToast(e.message, 'error'); }
}

// ---- Courses ----
async function loadAdminCourses() {
  setPageTitle('Courses');
  setActiveSidebar('courses');
  setContent('<div class="loading-state"><div class="spinner"></div></div>');

  const [courses, teachers] = await Promise.all([
    api('/api/admin/courses'),
    api('/api/admin/teachers')
  ]);

  setContent(`
    <div class="page-header page-header-row">
      <div><h1>📚 Courses</h1><p>Create and manage all courses</p></div>
      <button class="btn btn-primary" onclick="showCreateCourse()">+ Create Course</button>
    </div>

    <div class="course-grid">
      ${courses.map((c, i) => `
        <div class="course-card">
          <div class="course-card-banner ${courseBannerClass(c.id)}"></div>
          <div class="course-card-body">
            <div class="course-card-code">${escHtml(c.code)}</div>
            <div class="course-card-name">${escHtml(c.name)}</div>
            <div class="course-card-desc">${escHtml(c.description||'No description')}</div>
            <div class="course-card-footer">
              <div class="course-card-teacher">👨‍🏫 ${escHtml(c.teacher_name||'Unassigned')}</div>
              <div class="flex gap-8">
                <button class="btn btn-secondary btn-sm" onclick="manageEnrollments(${c.id},'${escHtml(c.name)}')">Students</button>
                <button class="btn btn-danger btn-sm" onclick="deleteCourse(${c.id},'${escHtml(c.name)}')">Delete</button>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
      ${!courses.length ? `<div class="empty-state"><div class="empty-icon">📚</div><p>No courses yet. Create your first one!</p></div>` : ''}
    </div>
  `);

  // Store teachers for modal
  window._adminTeachers = teachers;
}

function showCreateCourse() {
  const teachers = window._adminTeachers || [];
  openModal('Create New Course', modalForm([
    { label: 'Course Code', name: 'code', placeholder: 'e.g. OL-MATH-11', required: true },
    { label: 'Course Name', name: 'name', placeholder: 'e.g. O/L Mathematics', required: true },
    { label: 'Description', name: 'description', type: 'textarea', placeholder: 'Brief description…' },
    { label: 'Start Date', name: 'start_date', type: 'date', required: true },
    { label: 'End Date', name: 'end_date', type: 'date', required: true },
    { label: 'Teacher', name: 'teacher_id', type: 'select', required: true,
      options: teachers.map(t => ({ value: t.id, label: t.full_name })) },
  ], async (fd) => {
    try {
      await apiPost('/api/admin/courses', fd);
      closeModal();
      showToast('Course created!', 'success');
      loadAdminCourses();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Create Course'));
}

async function deleteCourse(id, name) {
  if (!confirm(`Delete course "${name}"? This cannot be undone.`)) return;
  try {
    await apiDelete(`/api/admin/courses/${id}`);
    showToast('Course deleted', 'success');
    loadAdminCourses();
  } catch (e) { showToast(e.message, 'error'); }
}

async function manageEnrollments(courseId, courseName) {
  const data = await api(`/api/admin/courses/${courseId}/students`);

  let html = `<h4 style="margin-bottom:12px">Currently Enrolled (${data.enrolled.length})</h4>`;
  if (data.enrolled.length) {
    html += `<table><thead><tr><th>Name</th><th>Username</th><th>Enrolled</th><th></th></tr></thead><tbody>
    ${data.enrolled.map(s => `<tr>
      <td>${escHtml(s.full_name)}</td>
      <td><code>${escHtml(s.username)}</code></td>
      <td>${fmtDate(s.enrolled_at)}</td>
      <td><button class="btn btn-danger btn-xs" onclick="unenrollStudent(${courseId},${s.id},'${escHtml(s.full_name)}','${escHtml(courseName)}')">Remove</button></td>
    </tr>`).join('')}</tbody></table>`;
  } else {
    html += '<p class="text-muted text-sm">No students enrolled yet.</p>';
  }

  html += `<h4 style="margin:20px 0 12px">Add Student</h4>`;
  if (data.available.length) {
    html += `<div class="flex gap-8 flex-wrap">
    ${data.available.map(s => `
      <button class="btn btn-secondary btn-sm" onclick="enrollStudent(${courseId},${s.id},'${escHtml(s.full_name)}','${escHtml(courseName)}')">
        + ${escHtml(s.full_name)}
      </button>`).join('')}
    </div>`;
  } else {
    html += '<p class="text-muted text-sm">All students are enrolled.</p>';
  }

  openModal(`Students — ${courseName}`, html, 'modal-box-lg');
}

async function enrollStudent(courseId, studentId, studentName, courseName) {
  try {
    const fd = buildForm({ student_id: studentId });
    await apiPost(`/api/admin/courses/${courseId}/enroll`, fd);
    showToast(`${studentName} enrolled!`, 'success');
    manageEnrollments(courseId, courseName);
  } catch (e) { showToast(e.message, 'error'); }
}

async function unenrollStudent(courseId, studentId, studentName, courseName) {
  if (!confirm(`Remove ${studentName} from this course?`)) return;
  try {
    await apiDelete(`/api/admin/courses/${courseId}/enroll/${studentId}`);
    showToast(`${studentName} removed`, 'success');
    manageEnrollments(courseId, courseName);
  } catch (e) { showToast(e.message, 'error'); }
}
