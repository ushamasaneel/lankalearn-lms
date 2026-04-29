/* ============================================================
   teacher.js — Teacher: course overview, modules, grading, gradebook, rubrics
   ============================================================ */

async function loadTeacherDashboard() {
  setPageTitle('Dashboard');
  setActiveSidebar('tdash');
  setContent('<div class="loading-state"><div class="spinner"></div></div>');

  const courses = await api('/api/teacher/courses').catch(() => []);

  setContent(`
    <div class="page-header">
      <h1>👋 Welcome, ${escHtml(currentUser.full_name)}</h1>
      <p>You are teaching ${courses.length} course${courses.length !== 1 ? 's' : ''} this term.</p>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon">📚</div>
        <div class="stat-value">${courses.length}</div>
        <div class="stat-label">My Courses</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎒</div>
        <div class="stat-value">${courses.reduce((a,c)=>a+c.student_count,0)}</div>
        <div class="stat-label">Total Students</div>
      </div>
    </div>

    <div class="page-header"><h1 style="font-size:20px">My Courses</h1></div>
    <div class="course-grid">
      ${courses.map(c => `
        <div class="course-card" onclick="loadCourseView(${c.id},'${escHtml(c.name)}'); setActiveSidebar('course-${c.id}')">
          <div class="course-card-banner ${courseBannerClass(c.id)}"></div>
          <div class="course-card-body">
            <div class="course-card-code">${escHtml(c.code)}</div>
            <div class="course-card-name">${escHtml(c.name)}</div>
            <div class="course-card-desc">${escHtml(c.description||'')}</div>
            <div class="course-card-footer">
              <div class="course-card-teacher">🎒 ${c.student_count} students</div>
              <span class="badge badge-blue">Open →</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `);
}

// ============================================================
// Course view (teacher)
// ============================================================
let _tcCourseId = null;

async function renderTeacherCourse(courseId) {
  _tcCourseId = courseId;
  const course = await api(`/api/courses/${courseId}`);

  const navHtml = `
    <div class="page-header page-header-row">
      <div>
        <span class="badge badge-blue mb-8">${escHtml(course.code)}</span>
        <h1 style="margin-top:6px">${escHtml(course.name)}</h1>
        <p>${escHtml(course.description||'')}</p>
      </div>
    </div>
    <nav class="course-nav">
      <button class="course-nav-btn active" onclick="tcSwitchTab(this,'tc-modules')">📦 Modules</button>
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-assignments')">✏️ Assignments</button>
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-discussions')">💬 Discussions</button>
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-announcements')">📢 Announcements</button>
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-gradebook')">📊 Gradebook</button>
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-quizzes')">📝 Quizzes</button>
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-rubrics')">🏷️ Rubrics</button>
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-syllabus')">📋 Syllabus</button>
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-attendance')">📅 Attendance</button>
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-students')">👥 Students</button>
    </nav>
    <div id="tc-modules" class="tc-panel"></div>
    <div id="tc-assignments" class="tc-panel" style="display:none"></div>
    <div id="tc-discussions" class="tc-panel" style="display:none"></div>
    <div id="tc-announcements" class="tc-panel" style="display:none"></div>
    <div id="tc-gradebook" class="tc-panel" style="display:none"></div>
    <div id="tc-quizzes" class="tc-panel" style="display:none"></div>
    <div id="tc-rubrics" class="tc-panel" style="display:none"></div>
    <div id="tc-syllabus" class="tc-panel" style="display:none"></div>
    <div id="tc-attendance" class="tc-panel" style="display:none"></div>
    <div id="tc-students" class="tc-panel" style="display:none"></div>
  `;
  setContent(navHtml);
  tcLoadModules();
}

function tcSwitchTab(btn, id) {
  document.querySelectorAll('.course-nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tc-panel').forEach(p => p.style.display = 'none');
  btn.classList.add('active');
  document.getElementById(id).style.display = 'block';
  const loaders = {
    'tc-modules': tcLoadModules,
    'tc-assignments': tcLoadAssignments,
    'tc-discussions': tcLoadDiscussions,
    'tc-announcements': tcLoadAnnouncements,
    'tc-gradebook': tcLoadGradebook,
    'tc-materials': tcLoadMaterials,
    'tc-quizzes': tcLoadQuizzes,
    'tc-rubrics': tcLoadRubrics,
    'tc-syllabus': tcLoadSyllabus,
    'tc-attendance': tcLoadAttendance,
    'tc-students': tcLoadEnrolledStudents,
  };
  if (loaders[id]) loaders[id]();
}

// ---- Modules ----
async function tcLoadModules() {
  const panel = document.getElementById('tc-modules');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  const [modules, assignments, materials, pages, discussions, quizzes] = await Promise.all([
    api(`/api/courses/${_tcCourseId}/modules`),
    api(`/api/courses/${_tcCourseId}/assignments`),
    api(`/api/courses/${_tcCourseId}/materials`),
    api(`/api/courses/${_tcCourseId}/pages`),
    api(`/api/courses/${_tcCourseId}/discussions`),
    api(`/api/courses/${_tcCourseId}/quizzes`),
  ]);

  window._tc = { assignments, materials, pages, discussions, quizzes, modules };

  let html = `<div class="flex gap-8 mb-16">
    <button class="btn btn-primary" onclick="tcCreateModule()">+ Add Module</button>
  </div>`;

  if (!modules.length) {
    html += emptyState('📦', 'No modules yet. Create your first module to organize course content.');
  } else {
    html += modules.map(mod => renderModuleBlock(mod)).join('');
  }

  panel.innerHTML = html;
}

function renderModuleBlock(mod) {
  const items = mod.items || [];
  return `
  <div class="module-block">
    <div class="module-header" onclick="toggleModule('m${mod.id}')">
      <div class="module-header-left">
        <span class="module-chevron open" id="mc${mod.id}">▶</span>
        <div>
          <div class="module-title">${escHtml(mod.title)}</div>
          ${mod.description ? `<div class="module-desc">${escHtml(mod.description)}</div>` : ''}
        </div>
      </div>
      <div class="flex gap-8" onclick="event.stopPropagation()">
        <button class="btn btn-secondary btn-sm" onclick="tcAddModuleItem(${mod.id})">+ Add Item</button>
        <button class="btn btn-secondary btn-sm" onclick="tcEditModule(${mod.id},'${escHtml(mod.title)}','${escHtml(mod.description||'')}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="tcDeleteModule(${mod.id})">Delete</button>
      </div>
    </div>
    <div class="module-items" id="m${mod.id}">
      ${items.length ? items.map(item => renderModuleItem(item, mod.id)).join('') : '<div style="padding:14px 20px;color:var(--text-muted);font-size:13px">No items in this module yet.</div>'}
    </div>
  </div>`;
}

function renderModuleItem(item, modId) {
  const icon = TYPE_ICONS[item.type] || '📎';
  const meta = item.meta || {};
  let metaStr = '';
  if (meta.due_date) metaStr = `Due: ${fmtDate(meta.due_date)}`;
  if (meta.points) metaStr += (metaStr ? ' · ' : '') + `${meta.points} pts`;
  return `<div class="module-item">
    <span class="module-item-icon">${icon}</span>
    <span class="module-item-title" onclick="tcViewItem('${item.type}',${item.item_id})">${escHtml(meta.title||'—')}</span>
    <span class="badge badge-gray" style="font-size:10px">${item.type}</span>
    ${metaStr ? `<span class="module-item-meta">${escHtml(metaStr)}</span>` : ''}
    <button class="btn btn-danger btn-xs" onclick="tcDeleteModuleItem(${modId},${item.id})">✕</button>
  </div>`;
}

function toggleModule(id) {
  const el = document.getElementById(id);
  const ch = document.getElementById('mc' + id.slice(1));
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (ch) ch.classList.toggle('open', !open);
}

async function tcCreateModule() {
  openModal('Create Module', modalForm([
    { label: 'Title', name: 'title', placeholder: 'e.g. Unit 1: Algebra', required: true },
    { label: 'Description', name: 'description', type: 'textarea', placeholder: 'Brief description…' },
    { label: 'Upload File (Optional)', name: 'file', type: 'file' },
  ], async (fd) => {
    try {
      await apiPost(`/api/courses/${_tcCourseId}/modules`, fd);
      closeModal(); showToast('Module created!', 'success'); tcLoadModules();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Create Module'));
}

async function tcEditModule(id, title, desc) {
  openModal('Edit Module', modalForm([
    { label: 'Title', name: 'title', value: title, required: true },
    { label: 'Description', name: 'description', type: 'textarea', value: desc },
    { label: 'Upload New File (Optional)', name: 'file', type: 'file' },
  ], async (fd) => {
    try {
      await api(`/api/courses/${_tcCourseId}/modules/${id}`, { method: 'PUT', body: fd });
      closeModal(); showToast('Module updated!', 'success'); tcLoadModules();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Save Changes'));
}

async function tcDeleteModule(id) {
  if (!confirm('Delete this module? Items inside will be removed.')) return;
  await apiDelete(`/api/courses/${_tcCourseId}/modules/${id}`);
  showToast('Module deleted', 'success'); tcLoadModules();
}

async function tcAddModuleItem(modId) {
  const tc = window._tc || {};
  let html = `
    <div class="tabs mb-16">
      <button class="tab-btn active" onclick="switchModTab('upload')">📤 Upload New File</button>
      <button class="tab-btn" onclick="switchModTab('existing')">🔗 Link Existing Activity</button>
    </div>
    
    <div id="modTab-upload" style="display:block">
      <form id="modUploadForm" onsubmit="return false">
        <div class="form-group"><label>File Name / Title</label><input type="text" name="title" class="form-control" required></div>
        <div class="form-group"><label>Description (Optional)</label><textarea name="content" class="form-control" style="min-height:60px"></textarea></div>
        <div class="form-group"><label>File (Image, PDF, etc)</label><input type="file" name="file" class="form-control" required></div>
        <div class="flex gap-8 mt-16" style="justify-content:flex-end">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" onclick="submitNewModuleFile(${modId})">Upload & Add</button>
        </div>
      </form>
    </div>

    <div id="modTab-existing" style="display:none">
      <div class="form-group"><label>Select Activity</label>
        <select id="modExistingSelect" class="form-control">
          <optgroup label="Assignments">
            ${(tc.assignments||[]).map(a => `<option value="assignment|${a.id}">✏️ ${escHtml(a.title)}</option>`).join('')}
          </optgroup>
          <optgroup label="Quizzes">
            ${(tc.quizzes||[]).map(q => `<option value="quiz|${q.id}">📝 ${escHtml(q.title)}</option>`).join('')}
          </optgroup>
          <optgroup label="Discussions">
            ${(tc.discussions||[]).map(d => `<option value="discussion|${d.id}">💬 ${escHtml(d.title)}</option>`).join('')}
          </optgroup>
        </select>
      </div>
      <div class="flex gap-8 mt-16" style="justify-content:flex-end">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitExistingModuleItem(${modId})">Add to Module</button>
      </div>
    </div>
  `;
  
  window.switchModTab = (tab) => {
    document.querySelectorAll('#modalBody .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('modTab-upload').style.display = 'none';
    document.getElementById('modTab-existing').style.display = 'none';
    event.target.classList.add('active');
    document.getElementById('modTab-' + tab).style.display = 'block';
  };

  window.submitNewModuleFile = async (mId) => {
    const form = document.getElementById('modUploadForm');
    if(!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);
    const btn = form.querySelector('.btn-primary');
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Uploading...'; 
    btn.disabled = true;
    try {
      // Create the file in the backend
      const res = await apiPost(`/api/courses/${_tcCourseId}/materials`, fd);
      // Link it to the module folder
      const linkFd = buildForm({ type: 'material', item_id: res.id });
      await apiPost(`/api/courses/${_tcCourseId}/modules/${mId}/items`, linkFd);
      closeModal(); showToast('File added to module!', 'success'); tcLoadModules();
    } catch(e) { showToast(e.message, 'error'); btn.innerHTML='Upload & Add'; btn.disabled=false; }
  };

  window.submitExistingModuleItem = async (mId) => {
    const val = document.getElementById('modExistingSelect').value;
    if(!val) return;
    const [type, item_id] = val.split('|');
    const linkFd = buildForm({ type, item_id });
    try {
      await apiPost(`/api/courses/${_tcCourseId}/modules/${mId}/items`, linkFd);
      closeModal(); showToast('Activity linked!', 'success'); tcLoadModules();
    } catch(e) { showToast(e.message, 'error'); }
  };

  openModal('Add Item to Module', html);
}

async function tcDeleteModuleItem(modId, itemId) {
  await apiDelete(`/api/courses/${_tcCourseId}/modules/${modId}/items/${itemId}`);
  showToast('Item removed', 'success'); tcLoadModules();
}

function tcViewItem(type, itemId) {
  if (type === 'assignment') tcViewAssignmentSubmissions(itemId);
  if (type === 'material') tcViewMaterial(itemId);
  if (type === 'page') tcViewPage(itemId);
}

async function tcViewMaterial(materialId) {
  const materials = await api(`/api/courses/${_tcCourseId}/materials`);
  const m = materials.find(x => x.id === materialId);
  if (!m) return;
  
  // Smart Image Renderer
  let fileHtml = '';
  if (m.file_name) {
      const ext = m.file_name.split('.').pop().toLowerCase();
      const url = `/uploads/${encodeURIComponent(m.file_name)}`;
      if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
          fileHtml = `<div style="margin-top:16px; text-align:center;"><img src="${url}" style="max-width:100%; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1)"></div>`;
      } else {
          fileHtml = `<div class="alert alert-info mt-16">📎 <strong>Attached file:</strong> <a href="${url}" target="_blank">${escHtml(m.file_name)}</a></div>`;
      }
  }

  openModal(m.title, `
    <div class="rich-content" style="white-space:pre-wrap">${escHtml(m.content || '')}</div>
    ${fileHtml}
  `);
}

async function tcViewPage(pageId) {
  const pages = await api(`/api/courses/${_tcCourseId}/pages`);
  const p = pages.find(x => x.id === pageId);
  if (!p) return;
  openModal(p.title, `<div class="rich-content">${p.body || ''}</div>`);
}
// ---- Assignments ----
async function tcLoadAssignments() {
  const panel = document.getElementById('tc-assignments');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const [assignments, rubrics] = await Promise.all([
    api(`/api/courses/${_tcCourseId}/assignments`),
    api(`/api/courses/${_tcCourseId}/rubrics`),
  ]);
  window._tcRubrics = rubrics;

  let html = `<div class="flex gap-8 mb-16">
    <button class="btn btn-primary" onclick="tcCreateAssignment()">+ New Assignment</button>
  </div>`;

  if (!assignments.length) { html += emptyState('✏️','No assignments yet.'); }
  else {
    html += '<div class="card"><div class="table-wrapper"><table><thead><tr><th>Title</th><th>File</th><th>Due Date</th><th>Points</th><th>Rubric</th><th>Actions</th></tr></thead><tbody>';
    html += assignments.map(a => {
      const due = daysUntil(a.due_date);
      const rubric = rubrics.find(r => r.id === a.rubric_id);
      return `<tr>
        <td><strong>${escHtml(a.title)}</strong><br><span class="text-sm text-muted">${escHtml((a.description||'').slice(0,60))}…</span></td>
          ${a.file_name ? `<td><a href="/uploads/${encodeURIComponent(a.file_name)}" target="_blank">${escHtml(a.file_name)}</a></td>` : `<td class="text-muted">—</td>`}
        <td>${fmtDate(a.due_date)} ${due ? `<span class="badge ${due.cls}">${due.label}</span>` : ''}</td>
        <td>${a.points} pts</td>
        <td>${rubric ? `<span class="badge badge-purple">${escHtml(rubric.title)}</span>` : '<span class="text-muted">—</span>'}</td>
        <td><button class="btn btn-primary btn-sm" onclick="tcViewAssignmentSubmissions(${a.id})">Submissions</button></td>
      </tr>`;
    }).join('');
    html += '</tbody></table></div></div>';
  }
  panel.innerHTML = html;
}

async function tcCreateAssignment() {
  const rubrics = window._tcRubrics || [];
  openModal('Create Assignment', modalForm([
    { label: 'Title', name: 'title', placeholder: 'Assignment title…', required: true },
    { label: 'Description', name: 'description', type: 'textarea', placeholder: 'Instructions…' },
    { label: 'Due Date', name: 'due_date', type: 'datetime-local' },
    { label: 'Points', name: 'points', type: 'number', value: '100' },
    { label: 'Rubric (optional)', name: 'rubric_id', type: 'select',
      options: [{ value:'', label:'— None —' }, ...rubrics.map(r => ({ value: r.id, label: r.title }))] },
    { label: 'Upload Assignment File', name: 'file', type: 'file' },
  ], async (fd) => {
    try {
      await apiPost(`/api/courses/${_tcCourseId}/assignments`, fd);
      closeModal(); showToast('Assignment created!', 'success'); tcLoadAssignments();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Create Assignment'));
}

// ---- View submissions + grade ----
async function tcViewAssignmentSubmissions(assignmentId) {
  const [submissions, assignments, rubrics] = await Promise.all([
    api(`/api/courses/${_tcCourseId}/assignments/${assignmentId}/submissions`),
    api(`/api/courses/${_tcCourseId}/assignments`),
    api(`/api/courses/${_tcCourseId}/rubrics`),
  ]);
  const assignment = assignments.find(a => a.id === assignmentId);
  const rubric = rubrics.find(r => r.id === assignment?.rubric_id);

  let html = `<h3 style="margin-bottom:16px">✏️ ${escHtml(assignment?.title)}</h3>`;
  html += `<div class="alert alert-info">Points: ${assignment?.points} | Submissions: ${submissions.length}</div>`;

  if (rubric) {
    html += `<details style="margin-bottom:16px"><summary class="btn btn-secondary btn-sm" style="cursor:pointer;list-style:none">🏷️ View Rubric</summary>
    <div class="card mt-8"><div class="card-body" style="padding:12px">
      <table class="rubric-table"><thead><tr><th>Criteria</th><th style="text-align:center">Points</th></tr></thead>
      <tbody>${rubric.criteria.map(c => `<tr><td>${escHtml(c.description)}</td><td class="rubric-pts">${c.points}</td></tr>`).join('')}</tbody>
      </table></div></div></details>`;
  }

  if (!submissions.length) {
    html += emptyState('📭','No submissions yet.');
  } else {
    html += submissions.map(s => `
      <div class="card mb-16">
        <div class="card-header">
          <span class="card-title">${escHtml(s.full_name)}</span>
          ${s.grade !== null ? `<span class="badge badge-green">${s.grade}%</span>` : '<span class="badge badge-yellow">Needs Grading</span>'}
        </div>
        <div class="card-body">
          ${s.file_name ? `<div class="mb-12">📂 <strong>Attached File:</strong> <a href="/uploads/${s.file_name}" target="_blank" class="btn btn-secondary btn-xs">Open Submission</a></div>` : ''}
          <div class="form-row mt-12">
            <input type="number" id="grade-${s.id}" class="form-control" placeholder="Marks" value="${s.grade||''}">
            <input type="text" id="feedback-${s.id}" class="form-control" placeholder="Feedback" value="${s.feedback||''}">
            <button class="btn btn-success" onclick="tcGradeSubmission(${assignmentId}, ${s.id}, ${assignment.points})">Save</button>
            ${s.grade !== null ? `<button class="btn btn-warning" onclick="tcRegradeSubmission(${assignmentId}, ${s.id}, ${assignment.points})">Regrade</button>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  openModal(`Submissions — ${assignment?.title}`, html, 'modal-box-lg');
}

async function tcGradeSubmission(assignmentId, submissionId, maxPts) {
  const grade = document.getElementById(`grade-${submissionId}`).value;
  const feedback = document.getElementById(`feedback-${submissionId}`).value;
  if (grade === '') { showToast('Enter a grade', 'error'); return; }
  if (parseFloat(grade) > maxPts) { showToast(`Max points is ${maxPts}`, 'error'); return; }
  const fd = buildForm({ grade, feedback });
  try {
    await apiPost(`/api/courses/${_tcCourseId}/assignments/${assignmentId}/submissions/${submissionId}/grade`, fd);
    showToast('Grade saved!', 'success');
    tcViewAssignmentSubmissions(assignmentId);
  } catch (e) { showToast(e.message, 'error'); }
}

async function tcRegradeSubmission(assignmentId, submissionId, maxPts) {
  const grade = document.getElementById(`grade-${submissionId}`).value;
  const feedback = document.getElementById(`feedback-${submissionId}`).value;
  if (grade === '') { showToast('Enter a grade', 'error'); return; }
  if (parseFloat(grade) > maxPts) { showToast(`Max points is ${maxPts}`, 'error'); return; }
  const fd = buildForm({ grade, feedback });
  try {
    await apiPost(`/api/courses/${_tcCourseId}/assignments/${assignmentId}/submissions/${submissionId}/regrade`, fd);
    showToast('Submission regraded!', 'success');
    tcViewAssignmentSubmissions(assignmentId);
  } catch (e) { showToast(e.message, 'error'); }
}

// ---- Discussions ----
async function tcLoadDiscussions() {
  const panel = document.getElementById('tc-discussions');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const discussions = await api(`/api/courses/${_tcCourseId}/discussions`);

  let html = `<div class="flex gap-8 mb-16">
    <button class="btn btn-primary" onclick="tcCreateDiscussion()">+ New Discussion</button>
  </div>`;

  if (!discussions.length) { html += emptyState('💬','No discussions yet.'); }
  else {
    html += discussions.map(d => `
      <div class="card mb-12">
        <div class="card-header">
          <div>
            <div class="card-title">💬 ${escHtml(d.title)}</div>
            <div class="text-sm text-muted mt-8">${d.due_date ? `Due: ${fmtDate(d.due_date)}` : 'No due date'} ${d.graded ? ' · <span class="badge badge-purple">Graded</span>' : ''}</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="tcViewDiscussion(${d.id})">View Thread</button>
        </div>
        <div class="card-body">
          <p style="font-size:13.5px;color:var(--text-muted)">${escHtml(d.prompt||'')}</p>
          ${d.file_name ? `<div class="text-sm" style="color:var(--primary);margin-top:8px">📎 <a href="/uploads/${encodeURIComponent(d.file_name)}" target="_blank">${escHtml(d.file_name)}</a></div>` : ''}
        </div>
      </div>`).join('');
  }
  panel.innerHTML = html;
}

async function tcCreateDiscussion() {
  openModal('Create Discussion', modalForm([
    { label: 'Title', name: 'title', placeholder: 'Discussion topic…', required: true },
    { label: 'Prompt / Instructions', name: 'prompt', type: 'textarea', placeholder: 'What should students discuss?' },
    { label: 'Due Date (optional)', name: 'due_date', type: 'datetime-local' },
    { label: 'Graded?', name: 'graded', type: 'select', options: [{ value:0, label:'No' }, { value:1, label:'Yes' }] },
    { label: 'Upload Discussion File', name: 'file', type: 'file' },
  ], async (fd) => {
    try {
      await apiPost(`/api/courses/${_tcCourseId}/discussions`, fd);
      closeModal(); showToast('Discussion created!', 'success'); tcLoadDiscussions();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Create Discussion'));
}

async function tcViewDiscussion(discId) {
  const disc = await api(`/api/courses/${_tcCourseId}/discussions/${discId}`);
  const posts = disc.posts || [];
  const topLevel = posts.filter(p => !p.parent_id);
  const replies = posts.filter(p => p.parent_id);

  let html = `<div class="alert alert-info mb-16"><strong>Prompt:</strong> ${escHtml(disc.prompt||'')}</div>`;
  html += `<div style="margin-bottom:12px"><strong>${posts.length} posts</strong></div>`;

  topLevel.forEach(p => {
    html += `<div class="discussion-post">
      <span class="post-author">👤 ${escHtml(p.author_name)}</span>
      <span class="post-time">${fmtDateTime(p.created_at)}</span>
      <div class="post-body">${escHtml(p.body)}</div>
    </div>`;
    replies.filter(r => r.parent_id === p.id).forEach(r => {
      html += `<div class="discussion-post reply">
        <span class="post-author">↳ ${escHtml(r.author_name)}</span>
        <span class="post-time">${fmtDateTime(r.created_at)}</span>
        <div class="post-body">${escHtml(r.body)}</div>
      </div>`;
    });
  });

  if (!posts.length) html += emptyState('💬','No posts yet.');

  // Teacher can also post
  html += `<div style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px">
    <div class="form-group"><label>Post a reply</label>
    <textarea class="form-control" id="tcDiscReply" placeholder="Add your response…"></textarea></div>
    <button class="btn btn-primary btn-sm" onclick="tcPostDiscussionReply(${discId})">Post</button>
  </div>`;

  openModal(`Discussion: ${disc.title}`, html, 'modal-box-lg');
}

async function tcPostDiscussionReply(discId) {
  const body = document.getElementById('tcDiscReply').value.trim();
  if (!body) return;
  const fd = buildForm({ body });
  await apiPost(`/api/courses/${_tcCourseId}/discussions/${discId}/posts`, fd);
  showToast('Posted!', 'success');
  tcViewDiscussion(discId);
}

// ---- Announcements ----
async function tcLoadAnnouncements() {
  const panel = document.getElementById('tc-announcements');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const anns = await api(`/api/courses/${_tcCourseId}/announcements`);

  let html = `<div class="flex gap-8 mb-16">
    <button class="btn btn-primary" onclick="tcCreateAnnouncement()">+ Post Announcement</button>
  </div>`;

  if (!anns.length) { html += emptyState('📢','No announcements yet.'); }
  else {
    html += `<div class="card">${anns.map(a => `
      <div class="announcement-item">
        <div class="ann-title">📢 ${escHtml(a.title)}</div>
        <div class="ann-meta">By ${escHtml(a.author_name)} · ${fmtDateTime(a.created_at)}</div>
        <div class="ann-body">${escHtml(a.body||'')}</div>
        ${a.file_name ? `<div class="text-sm" style="color:var(--primary);margin-top:8px">📎 <a href="/uploads/${encodeURIComponent(a.file_name)}" target="_blank">${escHtml(a.file_name)}</a></div>` : ''}
      </div>`).join('')}</div>`;
  }
  panel.innerHTML = html;
}

async function tcCreateAnnouncement() {
  openModal('Post Announcement', modalForm([
    { label: 'Title', name: 'title', placeholder: 'Announcement title…', required: true },
    { label: 'Message', name: 'body', type: 'textarea', placeholder: 'Write your announcement…' },
    { label: 'Upload Attachment', name: 'file', type: 'file' },
  ], async (fd) => {
    try {
      await apiPost(`/api/courses/${_tcCourseId}/announcements`, fd);
      closeModal(); showToast('Announcement posted!', 'success'); tcLoadAnnouncements();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Post'));
}

// ---- Gradebook ----
async function tcLoadGradebook() {
  const panel = document.getElementById('tc-gradebook');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const data = await api(`/api/courses/${_tcCourseId}/gradebook`);
  const { students, assignments } = data;

  if (!students.length) { panel.innerHTML = emptyState('📊','No students enrolled.'); return; }

  let html = `<div class="alert alert-info mb-16">Showing grades for ${students.length} student(s) · ${assignments.length} assignment(s)</div>`;
  html += `<div class="table-wrapper"><table class="gradebook-table"><thead><tr>
    <th>Student</th>
    ${assignments.map(a => `<th title="${escHtml(a.title)}">${escHtml(a.title.slice(0,20))}…<br><span style="font-weight:400;color:var(--text-light)">${a.points}pts</span></th>`).join('')}
    <th>Total %</th>
  </tr></thead><tbody>`;

  html += students.map(s => {
    const rowCells = assignments.map(a => {
      const g = s.grades[String(a.id)];
      if (g === null || g === undefined) return `<td class="grade-cell grade-blank">—</td>`;
      const pct = Math.round(g / a.points * 100);
      const cls = gradeColor(pct);
      return `<td class="grade-cell ${cls}">${g}<br><span style="font-size:10px">(${pct}%)</span></td>`;
    }).join('');

    const totalCls = gradeColor(s.total_pct);
    return `<tr>
      <td><strong>${escHtml(s.full_name)}</strong><br><span class="text-sm text-muted">${escHtml(s.username)}</span></td>
      ${rowCells}
      <td class="grade-cell total-pct ${totalCls}">${s.total_pct !== null ? s.total_pct + '%' : '—'}</td>
    </tr>`;
  }).join('');

  html += '</tbody></table></div>';
  panel.innerHTML = html;
}

// ---- Materials ----
async function tcLoadMaterials() {
  const panel = document.getElementById('tc-materials');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const materials = await api(`/api/courses/${_tcCourseId}/materials`);

  let html = `<div class="flex gap-8 mb-16">
    <button class="btn btn-primary" onclick="tcCreateMaterial()">+ Add Material</button>
  </div>`;

  if (!materials.length) { html += emptyState('📄','No materials yet.'); }
  else {
    html += `<div class="card">${materials.map(m => `
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px">
        <span style="font-size:24px">📄</span>
        <div style="flex:1">
          <div style="font-weight:700;font-size:14px">${escHtml(m.title)}</div>
          <div class="text-sm text-muted">${escHtml((m.content||'').slice(0,80))}…</div>
          ${m.file_name ? `<div class="text-sm" style="color:var(--primary);margin-top:4px">📎 <a href="/uploads/${encodeURIComponent(m.file_name)}" target="_blank">${escHtml(m.file_name)}</a></div>` : ''}
        </div>
        <div class="text-sm text-muted">${fmtDate(m.created_at)}</div>
      </div>`).join('')}</div>`;
  }
  panel.innerHTML = html;
}

async function tcCreateMaterial() {
  openModal('Add Course Material', modalForm([
    { label: 'Title', name: 'title', placeholder: 'Material title…', required: true },
    { label: 'Content / Description', name: 'content', type: 'textarea', placeholder: 'Description or content…' },
    { label: 'Upload File (PDF, DOC, PPT, etc.)', name: 'file', type: 'file' },
  ], async (fd) => {
    try {
      await apiPost(`/api/courses/${_tcCourseId}/materials`, fd);
      closeModal(); showToast('Material added!', 'success'); tcLoadMaterials();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Add Material'));
}

// ---- Quizzes & Unified Quiz Builder ----
let _draftQuestions = []; // Temporarily holds questions while building

async function tcLoadQuizzes() {
  const panel = document.getElementById('tc-quizzes');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const quizzes = await api(`/api/courses/${_tcCourseId}/quizzes`);

  let html = `<div class="flex gap-8 mb-16">
    <button class="btn btn-primary" onclick="tcOpenQuizBuilder()">🚀 Create New Quiz</button>
  </div>`;

  if (!quizzes.length) { html += emptyState('📝','No quizzes yet. Click Create New Quiz to build one.'); }
  else {
    html += `<div class="card"><div class="table-wrapper"><table><thead><tr><th>Title</th><th>Time Limit</th><th>Due Date</th><th>Actions</th></tr></thead><tbody>
    ${quizzes.map(q => `<tr>
      <td><strong>📝 ${escHtml(q.title)}</strong><br><span class="text-sm text-muted">${escHtml((q.description||'').slice(0,60))}</span></td>
      <td>${q.time_limit > 0 ? q.time_limit + ' mins' : 'Unlimited'}</td>
      <td>${fmtDate(q.due_date)}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="tcPreviewQuiz(${q.id})">👀 Preview Answer Key</button></td> 
    </tr>`).join('')}</tbody></table></div></div>`;
  }
  panel.innerHTML = html;
}

// 1. Open the Unified Quiz Builder Modal
function tcOpenQuizBuilder() {
  _draftQuestions = []; 
  let html = `
    <div class="form-row form-row-2">
      <div class="form-group"><label>Quiz Title</label><input type="text" id="qbTitle" class="form-control" placeholder="e.g. Midterm Exam" required></div>
      <div class="form-group"><label>Due Date</label><input type="datetime-local" id="qbDue" class="form-control"></div>
    </div>
    <div class="form-row form-row-3">
      <div class="form-group"><label>Time Limit (Mins, 0 = no limit)</label><input type="number" id="qbTime" class="form-control" value="0"></div>
      <div class="form-group"><label>Max Attempts</label><input type="number" id="qbAttempts" class="form-control" value="1" min="1"></div>
      <div class="form-group"><label>Upload File (Optional)</label><input type="file" id="qbFile" class="form-control" style="padding:6px"></div>
    </div>
    <div class="form-group"><label>Description / Instructions</label><input type="text" id="qbDesc" class="form-control" placeholder="Instructions..."></div>
    <hr style="margin:24px 0; border:0; border-top:1px solid var(--border)">
    <div class="flex" style="justify-content:space-between; align-items:center; margin-bottom:16px;">
      <h3 style="margin:0; font-size:16px">Questions & Answer Key</h3>
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm" onclick="tcAddDraftQuestion('multiple_choice')">+ Multiple Choice</button>
        <button class="btn btn-secondary btn-sm" onclick="tcAddDraftQuestion('true_false')">+ True/False</button>
      </div>
    </div>
    <div id="qbQuestionsList" style="max-height: 400px; overflow-y: auto; padding-right:8px;"></div>
    <div class="flex mt-24" style="justify-content:flex-end; gap:10px; border-top:1px solid var(--border); padding-top:16px;">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="qbSubmitBtn" onclick="tcSubmitFullQuiz()">✅ Publish Complete Quiz</button>
    </div>
  `;
  openModal('Create Quiz & Add Questions', html, 'modal-box-lg');
  tcRenderDraftQuestions();
}

window.tcSubmitFullQuiz = async () => {
  const title = document.getElementById('qbTitle').value.trim();
  if(!title) { showToast('Quiz Title is required', 'error'); return; }
  if(_draftQuestions.length === 0) { showToast('Please add at least one question', 'error'); return; }

  const btn = document.getElementById('qbSubmitBtn');
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Saving...'; 
  btn.disabled = true;

  const fd = new FormData();
  fd.append('title', title);
  fd.append('due_date', document.getElementById('qbDue').value);
  fd.append('time_limit', document.getElementById('qbTime').value || '0');
  fd.append('max_attempts', document.getElementById('qbAttempts').value || '1'); // <-- Added this!
  fd.append('description', document.getElementById('qbDesc').value);
  if(document.getElementById('qbFile').files[0]) fd.append('file', document.getElementById('qbFile').files[0]);

  try {
    const res = await apiPost(`/api/courses/${_tcCourseId}/quizzes`, fd);
    const quizId = res.id;
    for(let q of _draftQuestions) {
      await apiJSON(`/api/courses/${_tcCourseId}/quizzes/${quizId}/questions`, {
        text: q.text, type: q.type, points: q.points, options: q.options
      });
    }
    showToast('Quiz Published!', 'success');
    closeModal(); tcLoadQuizzes();
  } catch (e) {
    showToast(e.message, 'error');
    btn.innerHTML = '✅ Publish Complete Quiz'; btn.disabled = false;
  }
};

// 2. Add a question to the draft
window.tcAddDraftQuestion = (type) => {
  const q = { id: Date.now(), type: type, text: '', points: 1, options: [] };
  if (type === 'true_false') {
    q.options = [{text: 'True', is_correct: true}, {text: 'False', is_correct: false}];
  } else {
    q.options = [
      {text: '', is_correct: true}, {text: '', is_correct: false},
      {text: '', is_correct: false}, {text: '', is_correct: false}
    ];
  }
  _draftQuestions.push(q);
  tcRenderDraftQuestions();
  // Scroll to bottom
  const list = document.getElementById('qbQuestionsList');
  setTimeout(() => list.scrollTop = list.scrollHeight, 50);
};

// 3. Render the dynamic question list inside the modal
window.tcRenderDraftQuestions = () => {
  const list = document.getElementById('qbQuestionsList');
  if (!list) return;
  if (_draftQuestions.length === 0) { list.innerHTML = emptyState('📝', 'No questions yet. Click the buttons above to add questions.'); return; }

  let html = '';
  _draftQuestions.forEach((q, index) => {
    html += `<div class="card mb-16" style="background:#f8fafc; border:1px solid #cbd5e1;"><div class="card-body" style="padding:16px;">
      <div class="flex" style="justify-content:space-between; margin-bottom:12px;">
        <strong style="color:var(--primary-dark)">Question ${index + 1} <span class="badge badge-gray">${q.type === 'true_false' ? 'True/False' : 'Multiple Choice'}</span></strong>
        <button class="btn btn-danger btn-xs" onclick="tcRemoveDraftQuestion(${q.id})">✕ Remove</button>
      </div>
      <div class="form-row form-row-2">
        <div class="form-group" style="flex:3; margin-bottom:12px"><label>Question Text</label>
          <input type="text" class="form-control" value="${escHtml(q.text)}" onchange="tcUpdateDraftQ(${q.id}, 'text', this.value)" placeholder="Type the question here...">
        </div>
        <div class="form-group" style="flex:1; margin-bottom:12px"><label>Points</label>
          <input type="number" class="form-control" value="${q.points}" onchange="tcUpdateDraftQ(${q.id}, 'points', this.value)">
        </div>
      </div>
      <div><label class="text-sm bold text-muted">Answers (Select the radio button for the correct answer)</label></div>
      <div style="margin-top:8px;">`;

    q.options.forEach((opt, oIdx) => {
      if (q.type === 'true_false') {
        html += `<div style="margin-bottom:8px;"><label style="cursor:pointer; font-size:14px; display:flex; align-items:center; gap:8px;">
          <input type="radio" name="correct_${q.id}" ${opt.is_correct ? 'checked' : ''} onchange="tcSetDraftCorrect(${q.id}, ${oIdx})"> ${opt.text}
        </label></div>`;
      } else {
        html += `<div class="flex gap-8" style="margin-bottom:8px; align-items:center;">
          <input type="radio" name="correct_${q.id}" ${opt.is_correct ? 'checked' : ''} onchange="tcSetDraftCorrect(${q.id}, ${oIdx})" style="transform:scale(1.2)">
          <input type="text" class="form-control" style="padding:6px 10px" value="${escHtml(opt.text)}" placeholder="Option ${oIdx + 1}" onchange="tcUpdateDraftOpt(${q.id}, ${oIdx}, this.value)">
        </div>`;
      }
    });
    html += `</div></div></div>`;
  });
  list.innerHTML = html;
};

// Listeners to keep draft array updated
window.tcUpdateDraftQ = (id, field, val) => { const q = _draftQuestions.find(x => x.id === id); if(q) q[field] = field==='points' ? parseInt(val)||0 : val; };
window.tcUpdateDraftOpt = (qId, oIdx, val) => { const q = _draftQuestions.find(x => x.id === qId); if(q) q.options[oIdx].text = val; };
window.tcSetDraftCorrect = (qId, correctIdx) => { const q = _draftQuestions.find(x => x.id === qId); if(q) q.options.forEach((o, i) => o.is_correct = (i === correctIdx)); };
window.tcRemoveDraftQuestion = (id) => { _draftQuestions = _draftQuestions.filter(x => x.id !== id); tcRenderDraftQuestions(); };

// 4. Submit everything to the backend
window.tcSubmitFullQuiz = async () => {
  const title = document.getElementById('qbTitle').value.trim();
  if(!title) { showToast('Quiz Title is required', 'error'); return; }
  if(_draftQuestions.length === 0) { showToast('Please add at least one question', 'error'); return; }

  // Validation
  for(let q of _draftQuestions) {
    if(!q.text.trim()) { showToast('All questions must have text', 'error'); return; }
    if(q.type === 'multiple_choice') {
      for(let o of q.options) { if(!o.text.trim()) { showToast('All multiple choice options must be filled', 'error'); return; } }
    }
  }

  const btn = document.getElementById('qbSubmitBtn');
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Connecting (May take 15s if server is sleeping)...'; 
  btn.disabled = true;

  const fd = new FormData();
  fd.append('title', title);
  fd.append('due_date', document.getElementById('qbDue').value);
  fd.append('time_limit', document.getElementById('qbTime').value || '0');
  fd.append('description', document.getElementById('qbDesc').value);
  const fileInput = document.getElementById('qbFile');
  if(fileInput.files[0]) fd.append('file', fileInput.files[0]);

  try {
    // A. Create the base quiz
    const res = await apiPost(`/api/courses/${_tcCourseId}/quizzes`, fd);
    const quizId = res.id;

    // B. Save all the questions instantly
    for(let q of _draftQuestions) {
      await apiJSON(`/api/courses/${_tcCourseId}/quizzes/${quizId}/questions`, {
        text: q.text, type: q.type, points: q.points, options: q.options
      });
    }

    showToast('Quiz Published Successfully!', 'success');
    closeModal(); tcLoadQuizzes();
  } catch (e) {
    showToast(e.message, 'error');
    btn.innerHTML = '✅ Publish Complete Quiz'; btn.disabled = false;
  }
};

// 5. Preview the Answer Key
window.tcPreviewQuiz = async (quizId) => {
  const questions = await api(`/api/courses/${_tcCourseId}/quizzes/${quizId}/questions`);
  if(!questions.length) { showToast('No questions found.', 'info'); return; }

  let html = `<div>`;
  questions.forEach((q, i) => {
    html += `<div class="card mb-16"><div class="card-body">
      <p style="font-size:15px; margin-bottom:8px"><strong>${i+1}. ${escHtml(q.question_text)}</strong> <span class="text-muted text-sm">(${q.points} pts)</span></p>
      <ul style="list-style:none; padding:0; margin:0;">`;
    q.options.forEach(opt => {
      // Teachers can see the answer key highlighted in green
      const isCorrect = opt.is_correct || opt.is_correct === "true" || opt.is_correct === 1;
      html += `<li style="padding:8px 12px; background:${isCorrect ? '#dcfce7' : '#f8fafc'}; border:1px solid ${isCorrect ? '#86efac' : '#e2e8f0'}; border-radius:6px; margin-bottom:6px; font-size:14px;">
        ${isCorrect ? '✅' : '⚪'} ${escHtml(opt.option_text)}
      </li>`;
    });
    html += `</ul></div></div>`;
  });
  html += `</div>`;
  openModal('Quiz Preview & Answer Key', html, 'modal-box-lg');
}
// ---- Rubrics ----
async function tcLoadRubrics() {
  const panel = document.getElementById('tc-rubrics');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const rubrics = await api(`/api/courses/${_tcCourseId}/rubrics`);
  window._tcRubrics = rubrics;

  let html = `<div class="flex gap-8 mb-16">
    <button class="btn btn-primary" onclick="tcCreateRubric()">+ New Rubric</button>
  </div>`;

  if (!rubrics.length) { html += emptyState('🏷️','No rubrics yet. Create rubrics to attach to assignments.'); }
  else {
    html += rubrics.map(r => `
      <div class="card mb-16">
        <div class="card-header"><span class="card-title">🏷️ ${escHtml(r.title)}</span></div>
        <div class="card-body" style="padding:0">
          <table class="rubric-table"><thead><tr><th>Criteria</th><th style="text-align:center">Points</th></tr></thead>
          <tbody>${(r.criteria||[]).map(c => `
            <tr><td>${escHtml(c.description)}</td><td class="rubric-pts">${c.points}</td></tr>`).join('')}
            <tr style="background:#f8fafc"><td><strong>Total</strong></td>
              <td class="rubric-pts">${(r.criteria||[]).reduce((a,c)=>a+c.points,0)}</td></tr>
          </tbody></table>
        </div>
      </div>`).join('');
  }
  panel.innerHTML = html;
}

function tcCreateRubric() {
  let criteriaCount = 2;
  function renderCriteriaFields(n) {
    let h = '';
    for (let i = 0; i < n; i++) {
      h += `<div class="form-row form-row-2" style="align-items:end">
        <div class="form-group"><label>Criteria ${i+1}</label>
        <input class="form-control" name="crit_desc_${i}" placeholder="e.g. Accuracy of answer" required></div>
        <div class="form-group"><label>Points</label>
        <input class="form-control" type="number" name="crit_pts_${i}" value="20" min="1" required></div>
      </div>`;
    }
    return h;
  }

  function renderModal() {
    openModal('Create Rubric', `
      <div class="form-group"><label>Rubric Title</label>
        <input class="form-control" id="rubricTitle" placeholder="e.g. Lab Report Rubric" required>
      </div>
      <div id="criteriaContainer">${renderCriteriaFields(criteriaCount)}</div>
      <div class="flex gap-8 mb-16">
        <button class="btn btn-secondary btn-sm" onclick="addRubricCriteria()">+ Add Criteria</button>
      </div>
      <div class="flex gap-8" style="justify-content:flex-end">
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="submitRubric()">Create Rubric</button>
      </div>
    `);
  }

  window.addRubricCriteria = () => {
    criteriaCount++;
    document.getElementById('criteriaContainer').innerHTML = renderCriteriaFields(criteriaCount);
  };

  window.submitRubric = async () => {
    const title = document.getElementById('rubricTitle').value.trim();
    if (!title) { showToast('Enter a title', 'error'); return; }
    const criteria = [];
    for (let i = 0; i < criteriaCount; i++) {
      const d = document.querySelector(`[name="crit_desc_${i}"]`)?.value.trim();
      const p = parseInt(document.querySelector(`[name="crit_pts_${i}"]`)?.value || 0);
      if (d) criteria.push({ description: d, points: p });
    }
    if (!criteria.length) { showToast('Add at least one criterion', 'error'); return; }
    try {
      await apiJSON(`/api/courses/${_tcCourseId}/rubrics`, { title, criteria });
      closeModal(); showToast('Rubric created!', 'success'); tcLoadRubrics();
    } catch (e) { showToast(e.message, 'error'); }
  };

  renderModal();
}

// ---- Syllabus ----
// ---- Syllabus ----
async function tcLoadSyllabus() {
  const panel = document.getElementById('tc-syllabus');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const syl = await api(`/api/courses/${_tcCourseId}/syllabus`);
  const content = syl?.content || '';

  // Smart Image Renderer
  let fileHtml = '';
  if (syl?.file_name) {
      const ext = syl.file_name.split('.').pop().toLowerCase();
      const url = `/uploads/${encodeURIComponent(syl.file_name)}`;
      if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
          fileHtml = `<div style="margin-top:20px"><img src="${url}" style="max-width:100%; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1)"></div>`;
      } else {
          fileHtml = `<div class="alert alert-info mt-16">📎 <strong>Attached Syllabus:</strong> <a href="${url}" target="_blank">Download File</a></div>`;
      }
  }

  panel.innerHTML = `
    <div class="page-header page-header-row">
      <div><h1 style="font-size:20px">📋 Syllabus</h1></div>
      <button class="btn btn-primary btn-sm" onclick="tcEditSyllabus()">Edit Syllabus</button>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="syllabus-content">${content || '<p class="text-muted">No syllabus content yet. Click "Edit Syllabus" to add content.</p>'}</div>
        ${fileHtml}
      </div>
    </div>`;
}

async function tcEditSyllabus() {
  const syl = await api(`/api/courses/${_tcCourseId}/syllabus`);
  openModal('Edit Syllabus', modalForm([
    { label: 'Content (HTML supported)', name: 'content', type: 'textarea', value: syl?.content || '' },
    { label: 'Attach Syllabus File', name: 'file', type: 'file' } // Added File Input
  ], async (fd) => {
    try {
      await apiPost(`/api/courses/${_tcCourseId}/syllabus`, fd);
      closeModal(); showToast('Syllabus updated!', 'success'); tcLoadSyllabus();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Save Syllabus'));
}

// ---- Advanced Attendance System ----
async function tcLoadAttendance() {
  const panel = document.getElementById('tc-attendance');
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  
  // Fetch stats and course dates
  const statsData = await api(`/api/courses/${_tcCourseId}/attendance/stats`);
  const dates = statsData.dates || {};
  const stats = statsData.stats || {};
  
  // Calculate percentages
  const total = (stats.present || 0) + (stats.absent || 0) + (stats.late || 0);
  const pPct = total ? Math.round(((stats.present || 0) / total) * 100) : 0;
  const aPct = total ? Math.round(((stats.absent || 0) / total) * 100) : 0;
  const lPct = total ? Math.round(((stats.late || 0) / total) * 100) : 0;

  const today = new Date().toISOString().split('T')[0];
  
  let html = `
    <div class="page-header page-header-row">
      <div>
        <h1 style="font-size:20px">📅 Course Attendance Dashboard</h1>
        <p class="text-muted">Academic Term: ${fmtDate(dates.start_date) || 'Not set'} to ${fmtDate(dates.end_date) || 'Not set'}</p>
      </div>
    </div>
    
    <div class="att-dashboard">
      <div class="att-stat-card"><div class="att-stat-value text-green">${pPct}%</div><div class="att-stat-label">Overall Present</div></div>
      <div class="att-stat-card"><div class="att-stat-value text-red">${aPct}%</div><div class="att-stat-label">Overall Absent</div></div>
      <div class="att-stat-card"><div class="att-stat-value text-yellow">${lPct}%</div><div class="att-stat-label">Overall Late</div></div>
    </div>

    <div class="card mb-24">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
        <div class="form-group" style="margin:0; width:220px;">
          <label style="margin-bottom:4px">Record Attendance For:</label>
          <input type="date" id="attDate" class="form-control" value="${today}" 
                 min="${dates.start_date || ''}" max="${dates.end_date || ''}" 
                 onchange="tcFetchAttendance()">
        </div>
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-sm" onclick="tcMarkAll('present')">✓ Mark All Present</button>
          <button class="btn btn-secondary btn-sm" onclick="tcMarkAll('absent')">✕ Mark All Absent</button>
        </div>
      </div>
      <div id="attList"><div class="loading-state"><div class="spinner"></div></div></div>
    </div>
  `;
  panel.innerHTML = html;
  tcFetchAttendance();
}

window.tcFetchAttendance = async () => {
  const date = document.getElementById('attDate').value;
  const students = await api(`/api/courses/${_tcCourseId}/attendance?date=${date}`);
  
  if (!students.length) {
     document.getElementById('attList').innerHTML = emptyState('👥', 'No students enrolled in this course.');
     return;
  }

  let html = `<div class="table-wrapper"><table style="width:100%"><thead><tr><th>Student Name</th><th style="width:250px;text-align:right">Status</th></tr></thead><tbody id="attBody">`;
  
  students.forEach(s => {
    // Default to present if no record exists for the day
    const status = s.status || 'present'; 
    html += `<tr data-sid="${s.id}">
      <td><strong>${escHtml(s.full_name)}</strong></td>
      <td style="text-align:right">
        <div class="att-btn-group" data-val="${status}">
          <button class="att-btn present ${status === 'present' ? 'active' : ''}" onclick="tcSetStatus(this, 'present')">Present</button>
          <button class="att-btn absent ${status === 'absent' ? 'active' : ''}" onclick="tcSetStatus(this, 'absent')">Absent</button>
          <button class="att-btn late ${status === 'late' ? 'active' : ''}" onclick="tcSetStatus(this, 'late')">Late</button>
        </div>
      </td>
    </tr>`;
  });
  
  html += `</tbody></table></div>
  <div style="padding:16px 20px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; background:#fafafa;">
    <button class="btn btn-primary" onclick="tcSaveAttendance()">💾 Save Attendance</button>
  </div>`;
  document.getElementById('attList').innerHTML = html;
}

window.tcSetStatus = (btn, status) => {
  const group = btn.parentElement;
  // Remove active class from all buttons in this specific group
  group.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active'));
  // Add active class to clicked button
  btn.classList.add('active');
  // Update the hidden data value
  group.setAttribute('data-val', status);
}

window.tcMarkAll = (status) => {
  document.querySelectorAll('.att-btn-group').forEach(group => {
     group.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active'));
     group.querySelector(`.att-btn.${status}`).classList.add('active');
     group.setAttribute('data-val', status);
  });
}

window.tcSaveAttendance = async () => {
  const date = document.getElementById('attDate').value;
  const records = {};
  
  // Read values from our custom button groups instead of select dropdowns
  document.querySelectorAll('#attBody tr').forEach(row => {
    const sid = row.getAttribute('data-sid');
    const status = row.querySelector('.att-btn-group').getAttribute('data-val');
    records[sid] = status;
  });
  
  try {
    const originalBtn = document.querySelector('#attList .btn-primary');
    originalBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Saving...';
    
    await apiJSON(`/api/courses/${_tcCourseId}/attendance`, { date, records });
    showToast('Attendance Saved Successfully!', 'success');
    
    // Reload the whole panel to update the charts
    tcLoadAttendance(); 
  } catch(e) {
    showToast(e.message, 'error');
  }
}

async function tcLoadEnrolledStudents() {
  const panel = document.getElementById('tc-students');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  try {
    const students = await api(`/api/courses/${_tcCourseId}/enrolled-students`);

    if (!students.length) {
      panel.innerHTML = emptyState('👥', 'No students enrolled in this course yet.');
      return;
    }

    let html = `
      <div class="page-header"><h1 style="font-size:20px">👥 Enrolled Students</h1></div>
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Profile</th>
                <th>Name</th>
                <th>Username</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(s => {
                const imgUrl = s.profile_image ? `/uploads/${s.profile_image.split('/').map(encodeURIComponent).join('/')}` : '';
                const imgHtml = imgUrl ? `<img src="${imgUrl}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">` : `<div class="user-avatar" style="width:40px;height:40px;font-size:16px;">${s.full_name.charAt(0)}</div>`;
                
                return `<tr>
                  <td style="width:60px;text-align:center;">${imgHtml}</td>
                  <td><strong>${escHtml(s.full_name)}</strong></td>
                  <td><code>${escHtml(s.username)}</code></td>
                  <td>${s.phone ? `📞 ${escHtml(s.phone)}` : '<span class="text-muted">No phone</span>'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    panel.innerHTML = html;
  } catch (e) {
    showToast('Failed to load students', 'error');
  }
}