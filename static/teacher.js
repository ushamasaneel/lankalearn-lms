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
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-materials')">📄 Materials</button>
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-quizzes')">📝 Quizzes</button>
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-rubrics')">🏷️ Rubrics</button>
      <button class="course-nav-btn" onclick="tcSwitchTab(this,'tc-syllabus')">📋 Syllabus</button>
    </nav>
    <div id="tc-modules" class="tc-panel"></div>
    <div id="tc-assignments" class="tc-panel" style="display:none"></div>
    <div id="tc-discussions" class="tc-panel" style="display:none"></div>
    <div id="tc-announcements" class="tc-panel" style="display:none"></div>
    <div id="tc-gradebook" class="tc-panel" style="display:none"></div>
    <div id="tc-materials" class="tc-panel" style="display:none"></div>
    <div id="tc-quizzes" class="tc-panel" style="display:none"></div>
    <div id="tc-rubrics" class="tc-panel" style="display:none"></div>
    <div id="tc-syllabus" class="tc-panel" style="display:none"></div>
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
  const allItems = [
    ...(tc.materials||[]).map(m => ({ type:'material', id:m.id, label:`📄 ${m.title}` })),
    ...(tc.assignments||[]).map(a => ({ type:'assignment', id:a.id, label:`✏️ ${a.title}` })),
    ...(tc.discussions||[]).map(d => ({ type:'discussion', id:d.id, label:`💬 ${d.title}` })),
    ...(tc.pages||[]).map(p => ({ type:'page', id:p.id, label:`📃 ${p.title}` })),
    ...(tc.quizzes||[]).map(q => ({ type:'quiz', id:q.id, label:`📝 ${q.title}` })),
  ];

  openModal('Add Item to Module', modalForm([
    { label: 'Content Item', name: 'item_select', type: 'select', required: true,
      options: allItems.map(i => ({ value: `${i.type}|${i.id}`, label: i.label })) },
  ], async (fd) => {
    const val = fd.get('item_select').split('|');
    const itemFd = buildForm({ type: val[0], item_id: val[1] });
    try {
      await apiPost(`/api/courses/${_tcCourseId}/modules/${modId}/items`, itemFd);
      closeModal(); showToast('Item added!', 'success'); tcLoadModules();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Add to Module'));
}

async function tcDeleteModuleItem(modId, itemId) {
  await apiDelete(`/api/courses/${_tcCourseId}/modules/${modId}/items/${itemId}`);
  showToast('Item removed', 'success'); tcLoadModules();
}

function tcViewItem(type, itemId) {
  if (type === 'assignment') tcViewAssignmentSubmissions(itemId);
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
    html += '<div class="card"><div class="table-wrapper"><table><thead><tr><th>Title</th><th>Due Date</th><th>Points</th><th>Rubric</th><th>Actions</th></tr></thead><tbody>';
    html += assignments.map(a => {
      const due = daysUntil(a.due_date);
      const rubric = rubrics.find(r => r.id === a.rubric_id);
      return `<tr>
        <td><strong>${escHtml(a.title)}</strong><br><span class="text-sm text-muted">${escHtml((a.description||'').slice(0,60))}…</span></td>
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
          <span class="card-title">👤 ${escHtml(s.full_name)}</span>
          <div class="flex gap-8">
            <span class="text-sm text-muted">${fmtDateTime(s.submitted_at)}</span>
            ${s.grade !== null ? `<span class="badge badge-green">Graded: ${s.grade}/${assignment?.points}</span>` : '<span class="badge badge-yellow">Ungraded</span>'}
          </div>
        </div>
        <div class="card-body">
          ${s.text_response ? `<div class="mb-16"><strong>Response:</strong><div class="submission-view"><pre style="white-space:pre-wrap;font-family:inherit;font-size:13px">${escHtml(s.text_response)}</pre></div></div>` : ''}
          ${s.file_name ? `<div class="alert alert-info mb-16">📎 Submitted file: <strong>${escHtml(s.file_name)}</strong></div>` : ''}
          ${s.feedback ? `<div class="alert alert-success mb-16">💬 Feedback: ${escHtml(s.feedback)}</div>` : ''}
          <div style="border-top:1px solid var(--border);padding-top:16px">
            <div class="form-row form-row-2">
              <div class="form-group">
                <label>Grade (out of ${assignment?.points})</label>
                <input class="form-control" type="number" id="grade-${s.id}" value="${s.grade ?? ''}" min="0" max="${assignment?.points}">
              </div>
              <div class="form-group">
                <label>Feedback</label>
                <input class="form-control" id="feedback-${s.id}" value="${escHtml(s.feedback||'')}" placeholder="Write feedback…">
              </div>
            </div>
            <button class="btn btn-success btn-sm" onclick="tcGradeSubmission(${assignmentId},${s.id},${assignment?.points})">💾 Save Grade</button>
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
      </div>`).join('')}</div>`;
  }
  panel.innerHTML = html;
}

async function tcCreateAnnouncement() {
  openModal('Post Announcement', modalForm([
    { label: 'Title', name: 'title', placeholder: 'Announcement title…', required: true },
    { label: 'Message', name: 'body', type: 'textarea', placeholder: 'Write your announcement…' },
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
          ${m.file_name ? `<div class="text-sm" style="color:var(--primary);margin-top:4px">📎 ${escHtml(m.file_name)}</div>` : ''}
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
    { label: 'File Name (simulated upload)', name: 'file_name', placeholder: 'e.g. chapter1.pdf' },
  ], async (fd) => {
    try {
      await apiPost(`/api/courses/${_tcCourseId}/materials`, fd);
      closeModal(); showToast('Material added!', 'success'); tcLoadMaterials();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Add Material'));
}

// ---- Quizzes ----
async function tcLoadQuizzes() {
  const panel = document.getElementById('tc-quizzes');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const quizzes = await api(`/api/courses/${_tcCourseId}/quizzes`);

  let html = `<div class="flex gap-8 mb-16">
    <button class="btn btn-primary" onclick="tcCreateQuiz()">+ New Quiz</button>
  </div>`;

  if (!quizzes.length) { html += emptyState('📝','No quizzes yet.'); }
  else {
    html += `<div class="card"><div class="table-wrapper"><table><thead><tr><th>Title</th><th>Description</th><th>Due Date</th></tr></thead><tbody>
    ${quizzes.map(q => `<tr>
      <td><strong>📝 ${escHtml(q.title)}</strong></td>
      <td class="text-muted">${escHtml((q.description||'').slice(0,80))}</td>
      <td>${fmtDate(q.due_date)}</td>
    </tr>`).join('')}</tbody></table></div></div>`;
  }
  panel.innerHTML = html;
}

async function tcCreateQuiz() {
  openModal('Create Quiz', modalForm([
    { label: 'Title', name: 'title', placeholder: 'Quiz title…', required: true },
    { label: 'Description', name: 'description', type: 'textarea', placeholder: 'Instructions…' },
    { label: 'Due Date', name: 'due_date', type: 'datetime-local' },
  ], async (fd) => {
    try {
      await apiPost(`/api/courses/${_tcCourseId}/quizzes`, fd);
      closeModal(); showToast('Quiz created!', 'success'); tcLoadQuizzes();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Create Quiz'));
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
async function tcLoadSyllabus() {
  const panel = document.getElementById('tc-syllabus');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const syl = await api(`/api/courses/${_tcCourseId}/syllabus`);
  const content = syl?.content || '';

  panel.innerHTML = `
    <div class="page-header page-header-row">
      <div><h1 style="font-size:20px">📋 Syllabus</h1></div>
      <button class="btn btn-primary btn-sm" onclick="tcEditSyllabus()">Edit Syllabus</button>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="syllabus-content">${content || '<p class="text-muted">No syllabus content yet. Click "Edit Syllabus" to add content.</p>'}</div>
      </div>
    </div>`;
}

async function tcEditSyllabus() {
  const syl = await api(`/api/courses/${_tcCourseId}/syllabus`);
  openModal('Edit Syllabus', modalForm([
    { label: 'Content (HTML supported)', name: 'content', type: 'textarea', value: syl?.content || '',
      placeholder: '<h3>Course Syllabus</h3><p>…</p>' },
  ], async (fd) => {
    try {
      await apiPost(`/api/courses/${_tcCourseId}/syllabus`, fd);
      closeModal(); showToast('Syllabus updated!', 'success'); tcLoadSyllabus();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Save Syllabus'));
  // Make textarea taller
  setTimeout(() => {
    const ta = document.querySelector('#mf textarea');
    if (ta) ta.style.minHeight = '260px';
  }, 50);
}
