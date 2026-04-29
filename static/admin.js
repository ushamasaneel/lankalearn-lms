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
// activeTab: 'tab-teachers' | 'tab-students' | 'tab-admins'
async function loadAdminUsers(activeTab) {
  if (!activeTab) {
    const cur = document.querySelector('.tab-panel[style*="display: block"], .tab-panel.active:not([style*="display: none"])');
    activeTab = cur ? cur.id : 'tab-teachers';
  }
  setPageTitle('Users');
  setActiveSidebar('users');
  setContent('<div class="loading-state"><div class="spinner"></div></div>');
  const users = await api('/api/admin/users');

  // Cache for editing
  window._adminUsers = users;

  const teachers = users.filter(u => u.role === 'teacher');
  const students = users.filter(u => u.role === 'student');
  const admins   = users.filter(u => u.role === 'admin');

  // ---- Teacher table with mass-select ----
  function teacherTable(list) {
    if (!list.length) return '<p class="text-muted" style="padding:16px">None</p>';
    return `
      <div class="bulk-toolbar" id="teacherBulkBar" style="display:none">
        <span id="teacherSelCount">0</span> selected
        <button class="btn btn-danger btn-sm" onclick="bulkDelete('teacher')">🗑 Delete Selected</button>
        <button class="btn btn-secondary btn-sm" onclick="clearSelection('teacher')">✕ Clear</button>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:40px"><input type="checkbox" id="teacherSelectAll" onchange="toggleSelectAll('teacher', this.checked)" title="Select all"></th>
            <th>Profile</th><th>Details</th><th>Contact / Extra</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="teacherTableBody">
          ${list.map(u => {
            const imgUrl = u.profile_image ? `/uploads/${u.profile_image.split('/').map(encodeURIComponent).join('/')}` : '';
            const imgHtml = imgUrl
              ? `<img src="${imgUrl}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
              : `<div class="user-avatar" style="width:40px;height:40px;font-size:16px;">${u.full_name.charAt(0)}</div>`;
            const isYou = u.id === currentUser.id;
            return `<tr data-uid="${u.id}" data-role="teacher">
              <td style="width:40px;text-align:center;">
                ${isYou ? '' : `<input type="checkbox" class="row-check teacher-check" data-uid="${u.id}" onchange="onRowCheck('teacher')">`}
              </td>
              <td style="width:60px;text-align:center;">${imgHtml}</td>
              <td>
                <strong>${escHtml(u.full_name)}</strong><br>
                <code>${escHtml(u.username)}</code><br>
                <span class="badge badge-purple" style="margin-top:4px">teacher</span>
              </td>
              <td>
                <div class="text-sm">
                  ${u.phone ? `<strong>Phone:</strong> ${escHtml(u.phone)}<br>` : ''}
                  ${u.dob ? `<strong>DOB:</strong> ${escHtml(u.dob)}<br>` : ''}
                  ${u.address ? `<strong>Address:</strong> ${escHtml(u.address)}<br>` : ''}
                  ${u.notes ? `<strong>Notes:</strong> ${escHtml(u.notes)}` : ''}
                </div>
              </td>
              <td>
                ${isYou ? '<span class="text-muted text-sm">You</span>' : `
                  <button class="btn btn-secondary btn-sm" onclick="showEditUser(${u.id},'teacher')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id},'${escHtml(u.full_name)}')">Delete</button>
                `}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  // ---- Student table with mass-select + grade filter ----
  function studentTable(list) {
    if (!list.length) return '<p class="text-muted" style="padding:16px">None</p>';

    // Collect unique grades
    const grades = [...new Set(list.map(u => u.grade || 'Unassigned'))].sort((a, b) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    });

    const gradeOptions = ['All', ...grades].map(g =>
      `<option value="${escHtml(g)}">${escHtml(g)}</option>`
    ).join('');

    return `
      <div class="bulk-toolbar" id="studentBulkBar" style="display:none">
        <span id="studentSelCount">0</span> selected
        <button class="btn btn-danger btn-sm" onclick="bulkDelete('student')">🗑 Delete Selected</button>
        <button class="btn btn-secondary btn-sm" onclick="clearSelection('student')">✕ Clear</button>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:40px"><input type="checkbox" id="studentSelectAll" onchange="toggleSelectAll('student', this.checked)" title="Select all"></th>
            <th>Profile</th>
            <th>Details</th>
            <th style="min-width:130px">Adm. No.</th>
            <th style="min-width:160px">
              Grade
              <select id="gradeFilter" onchange="filterStudentsByGrade()" style="margin-left:8px;padding:3px 6px;border-radius:6px;border:1px solid var(--border);font-size:12px;cursor:pointer;">
                ${gradeOptions}
              </select>
            </th>
            <th>Contact / Extra</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="studentTableBody">
          ${list.map(u => {
            const imgUrl = u.profile_image ? `/uploads/${u.profile_image.split('/').map(encodeURIComponent).join('/')}` : '';
            const imgHtml = imgUrl
              ? `<img src="${imgUrl}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
              : `<div class="user-avatar" style="width:40px;height:40px;font-size:16px;">${u.full_name.charAt(0)}</div>`;
            const grade = u.grade || 'Unassigned';
            return `<tr data-uid="${u.id}" data-role="student" data-grade="${escHtml(grade)}">
              <td style="width:40px;text-align:center;">
                <input type="checkbox" class="row-check student-check" data-uid="${u.id}" onchange="onRowCheck('student')">
              </td>
              <td style="width:60px;text-align:center;">${imgHtml}</td>
              <td>
                <strong>${escHtml(u.full_name)}</strong><br>
                <code>${escHtml(u.username)}</code><br>
                <span class="badge badge-blue" style="margin-top:4px">student</span>
              </td>
              <td>
                ${u.admission_number ? `<code class="adm-number">${escHtml(u.admission_number)}</code>` : '<span class="text-muted text-sm">—</span>'}
              </td>
              <td>
                <span class="grade-pill">${escHtml(grade)}</span>
              </td>
              <td>
                <div class="text-sm">
                  ${u.phone ? `<strong>Phone:</strong> ${escHtml(u.phone)}<br>` : ''}
                  ${u.dob ? `<strong>DOB:</strong> ${escHtml(u.dob)}<br>` : ''}
                  ${u.address ? `<strong>Address:</strong> ${escHtml(u.address)}<br>` : ''}
                  ${u.notes ? `<strong>Notes:</strong> ${escHtml(u.notes)}` : ''}
                </div>
              </td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="showEditUser(${u.id},'student')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id},'${escHtml(u.full_name)}')">Delete</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  function adminTable(list) {
    if (!list.length) return '<p class="text-muted" style="padding:16px">None</p>';
    return `<table><thead><tr><th>Profile</th><th>Details</th><th>Contact / Extra</th><th>Actions</th></tr></thead>
    <tbody>${list.map(u => {
      const imgUrl = u.profile_image ? `/uploads/${u.profile_image.split('/').map(encodeURIComponent).join('/')}` : '';
      const imgHtml = imgUrl ? `<img src="${imgUrl}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">` : `<div class="user-avatar" style="width:40px;height:40px;font-size:16px;">${u.full_name.charAt(0)}</div>`;
      return `<tr>
        <td style="width:60px;text-align:center;">${imgHtml}</td>
        <td><strong>${escHtml(u.full_name)}</strong><br><code>${escHtml(u.username)}</code></td>
        <td><div class="text-sm">${u.phone ? `<strong>Phone:</strong> ${escHtml(u.phone)}<br>` : ''}${u.notes ? `<strong>Notes:</strong> ${escHtml(u.notes)}` : ''}</div></td>
        <td>${u.id !== currentUser.id ? `<button class="btn btn-secondary btn-sm" onclick="showEditUser(${u.id},'admin')">Edit</button>` : '<span class="text-muted text-sm">You</span>'}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
  }

  setContent(`
    <div class="page-header page-header-row">
      <div><h1>👥 Users</h1><p>Manage teachers and students</p></div>
    </div>

    <div class="tabs">
      <button class="tab-btn" id="tbtn-tab-teachers" onclick="switchTab(this,'tab-teachers')">👨‍🏫 Teachers (${teachers.length})</button>
      <button class="tab-btn" id="tbtn-tab-students" onclick="switchTab(this,'tab-students')">🎒 Students (${students.length})</button>
      <button class="tab-btn" id="tbtn-tab-admins" onclick="switchTab(this,'tab-admins')">🔐 Admins (${admins.length})</button>
    </div>

    <div id="tab-teachers" class="tab-panel card" style="display:none">
      <div class="card-header" style="background:#fafafa;display:flex;justify-content:flex-end;">
        <button class="btn btn-primary btn-sm" onclick="showCreateUser('teacher')">+ Create Teacher</button>
      </div>
      <div class="card-body" style="padding:0">${teacherTable(teachers)}</div>
    </div>

    <div id="tab-students" class="tab-panel card" style="display:none">
      <div class="card-header" style="background:#fafafa;display:flex;justify-content:flex-end;">
        <button class="btn btn-primary btn-sm" onclick="showCreateUser('student')">+ Create Student</button>
      </div>
      <div class="card-body" style="padding:0">${studentTable(students)}</div>
    </div>

    <div id="tab-admins" class="tab-panel card" style="display:none">
      <div class="card-body" style="padding:0">${adminTable(admins)}</div>
    </div>
  `);

  // Restore whichever tab was active (or default to teachers)
  const tabToShow = document.getElementById(activeTab) ? activeTab : 'tab-teachers';
  const btnToActivate = document.getElementById('tbtn-' + tabToShow);
  if (btnToActivate) switchTab(btnToActivate, tabToShow);
}

function roleToTab(role) {
  return { teacher: 'tab-teachers', student: 'tab-students', admin: 'tab-admins' }[role] || 'tab-teachers';
}

function switchTab(btn, tabId) {
  btn.closest('.tabs').parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  btn.classList.add('active');
  document.getElementById(tabId).style.display = 'block';
}

// ---- Mass-select helpers ----
function toggleSelectAll(role, checked) {
  document.querySelectorAll(`.${role}-check`).forEach(cb => {
    const row = cb.closest('tr');
    if (row && row.style.display !== 'none') {
      cb.checked = checked;
    }
  });
  onRowCheck(role);
}

function onRowCheck(role) {
  const checked = document.querySelectorAll(`.${role}-check:checked`);
  const bar = document.getElementById(`${role}BulkBar`);
  const count = document.getElementById(`${role}SelCount`);
  if (bar) bar.style.display = checked.length ? 'flex' : 'none';
  if (count) count.textContent = checked.length;
  // Sync header checkbox
  const all = document.querySelectorAll(`.${role}-check`);
  const visible = [...all].filter(cb => cb.closest('tr').style.display !== 'none');
  const selectAll = document.getElementById(`${role}SelectAll`);
  if (selectAll) selectAll.checked = visible.length > 0 && checked.length === visible.length;
}

function clearSelection(role) {
  document.querySelectorAll(`.${role}-check`).forEach(cb => cb.checked = false);
  const selectAll = document.getElementById(`${role}SelectAll`);
  if (selectAll) selectAll.checked = false;
  onRowCheck(role);
}

async function bulkDelete(role) {
  const checked = [...document.querySelectorAll(`.${role}-check:checked`)];
  if (!checked.length) return;
  const ids = checked.map(cb => cb.dataset.uid);
  const names = ids.map(id => {
    const u = window._adminUsers.find(u => String(u.id) === String(id));
    return u ? u.full_name : id;
  });
  if (!confirm(`Delete ${ids.length} ${role}(s)?\n\n${names.join(', ')}\n\nThis cannot be undone.`)) return;

  let failed = 0;
  for (const id of ids) {
    try {
      await apiDelete(`/api/admin/users/${id}`);
    } catch { failed++; }
  }

  if (failed) showToast(`${ids.length - failed} deleted, ${failed} failed.`, 'error');
  else showToast(`${ids.length} ${role}(s) deleted.`, 'success');
  loadAdminUsers(roleToTab(role));
}

// ---- Grade filter ----
function filterStudentsByGrade() {
  const filter = document.getElementById('gradeFilter')?.value || 'All';
  document.querySelectorAll('#studentTableBody tr').forEach(row => {
    const grade = row.dataset.grade || 'Unassigned';
    row.style.display = (filter === 'All' || grade === filter) ? '' : 'none';
  });
  // Uncheck hidden rows and refresh toolbar
  document.querySelectorAll('.student-check').forEach(cb => {
    if (cb.closest('tr').style.display === 'none') cb.checked = false;
  });
  onRowCheck('student');
}

const GRADE_OPTIONS = [
  { value: '', label: '— Select Grade —' },
  { value: 'Grade 6', label: 'Grade 6' },
  { value: 'Grade 7', label: 'Grade 7' },
  { value: 'Grade 8', label: 'Grade 8' },
  { value: 'Grade 9', label: 'Grade 9' },
  { value: 'Grade 10', label: 'Grade 10' },
  { value: 'Grade 11 (O/L)', label: 'Grade 11 (O/L)' },
  { value: 'Grade 12 (A/L)', label: 'Grade 12 (A/L)' },
  { value: 'Grade 13 (A/L)', label: 'Grade 13 (A/L)' },
];

function showCreateUser(role) {
  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
  const gradeField = role === 'student'
    ? [{ label: 'Grade', name: 'grade', type: 'select', options: GRADE_OPTIONS }]
    : [];
  const admissionField = role === 'student'
    ? [{ label: 'Admission Number', name: 'admission_number', placeholder: 'e.g. LL-2026-0001' }]
    : [];

  openModal(`Create New ${roleTitle}`, modalForm([
    { name: 'role', type: 'hidden', value: role },
    { label: 'Full Name', name: 'full_name', placeholder: 'e.g. Kasun Perera', required: true },
    { label: 'Username', name: 'username', placeholder: 'e.g. kasun.p', required: true },
    { label: 'Password', name: 'password', type: 'password', placeholder: '••••••••', required: true },
    { label: 'Phone Number', name: 'phone', type: 'tel', placeholder: 'e.g. 077 123 4567' },
    { label: 'Date of Birth', name: 'dob', type: 'date' },
    { label: 'Address', name: 'address', type: 'textarea', placeholder: 'Street address...' },
    ...gradeField,
    ...admissionField,
    { label: 'Additional Notes', name: 'notes', type: 'textarea', placeholder: 'Any extra information...' },
    { label: 'Profile Image', name: 'file', type: 'file' }
  ], async (fd) => {
    try {
      await apiPost('/api/admin/users', fd);
      closeModal(); showToast(`${roleTitle} created successfully`, 'success'); loadAdminUsers(roleToTab(role));
    } catch (e) { showToast(e.message, 'error'); }
  }, `Create ${roleTitle}`));

  // Auto-suggest next admission number for students
  if (role === 'student') {
    api('/api/admin/next-admission').then(res => {
      const field = document.querySelector('[name="admission_number"]');
      if (field && !field.value) field.value = res.admission_number;
    }).catch(() => {});
  }
}

function showEditUser(id, roleLabel) {
  const u = window._adminUsers.find(x => x.id === id);
  const roleTitle = roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1);
  const gradeField = roleLabel === 'student'
    ? [{ label: 'Grade', name: 'grade', type: 'select', value: u.grade || '', options: GRADE_OPTIONS }]
    : [];
  const admissionField = roleLabel === 'student'
    ? [{ label: 'Admission Number', name: 'admission_number', value: u.admission_number || '' }]
    : [];
  openModal(`Edit ${roleTitle}: ${u.full_name}`, modalForm([
    { label: 'Full Name', name: 'full_name', value: u.full_name, required: true },
    { label: 'Username', name: 'username', value: u.username, required: true },
    { label: 'New Password (Leave blank to keep current)', name: 'password', type: 'password', placeholder: '••••••••' },
    { label: 'Phone Number', name: 'phone', type: 'tel', value: u.phone || '' },
    { label: 'Date of Birth', name: 'dob', type: 'date', value: u.dob || '' },
    { label: 'Address', name: 'address', type: 'textarea', value: u.address || '' },
    { label: 'Additional Notes', name: 'notes', type: 'textarea', value: u.notes || '' },
    ...gradeField,
    ...admissionField,
    { label: 'Update Profile Image', name: 'file', type: 'file' }
  ], async (fd) => {
    try {
      await api(`/api/admin/users/${id}`, { method: 'PUT', body: fd });
      closeModal(); showToast('User updated!', 'success'); loadAdminUsers(roleToTab(roleLabel));
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Save Changes'));
}

async function deleteUser(id, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  // Remember which tab we're on before the DOM is rebuilt
  const cur = document.querySelector('.tab-panel[style*="display: block"], .tab-panel.active:not([style*="display: none"])');
  const activeTab = cur ? cur.id : 'tab-teachers';
  try {
    await apiDelete(`/api/admin/users/${id}`);
    showToast('User deleted', 'success');
    loadAdminUsers(activeTab);
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

  // Store in memory so the Edit Modal can read the current data easily
  window._adminCourses = courses;
  window._adminTeachers = teachers;

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
                <button class="btn btn-secondary btn-sm" onclick="showEditCourse(${c.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteCourse(${c.id},'${escHtml(c.name)}')">Delete</button>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
      ${!courses.length ? `<div class="empty-state"><div class="empty-icon">📚</div><p>No courses yet. Create your first one!</p></div>` : ''}
    </div>
  `);
}

function showEditCourse(id) {
  const c = window._adminCourses.find(x => x.id === id);
  const teachers = window._adminTeachers || [];
  openModal('Edit Course', modalForm([
    { label: 'Course Code', name: 'code', value: c.code, required: true },
    { label: 'Course Name', name: 'name', value: c.name, required: true },
    { label: 'Description', name: 'description', type: 'textarea', value: c.description || '' },
    { label: 'Start Date', name: 'start_date', type: 'date', value: c.start_date || '', required: true },
    { label: 'End Date', name: 'end_date', type: 'date', value: c.end_date || '', required: true },
    { label: 'Teacher', name: 'teacher_id', type: 'select', value: c.teacher_id, required: true,
      options: teachers.map(t => ({ value: t.id, label: t.full_name })) },
  ], async (fd) => {
    try {
      await api(`/api/admin/courses/${id}`, { method: 'PUT', body: fd });
      closeModal();
      showToast('Course updated!', 'success');
      loadAdminCourses();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Save Changes'));


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