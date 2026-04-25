/* ============================================================
   student.js — Student: dashboard, modules, submissions, discussions, grades
   ============================================================ */

async function loadStudentDashboard() {
  setPageTitle('Dashboard');
  setActiveSidebar('sdash');
  setContent('<div class="loading-state"><div class="spinner"></div></div>');

  const data = await api('/api/student/dashboard').catch(() => ({ courses:[], upcoming:[], grades:[] }));

  // Calculate average grade
  let avgPct = null;
  if (data.grades.length) {
    const total = data.grades.reduce((a, g) => a + (g.grade / g.points * 100), 0);
    avgPct = Math.round(total / data.grades.length);
  }

  const upcomingHtml = data.upcoming.length ? data.upcoming.map(a => {
    const due = daysUntil(a.due_date);
    return `<div class="upcoming-item">
      <div class="upcoming-type-icon" style="background:#dbeafe">✏️</div>
      <div style="flex:1">
        <div style="font-size:13.5px;font-weight:600">${escHtml(a.title)}</div>
        <div class="text-sm text-muted">${escHtml(a.course_name)}</div>
      </div>
      <div>
        ${due ? `<span class="badge ${due.cls}">${due.label}</span>` : fmtDate(a.due_date)}
      </div>
    </div>`;
  }).join('') : emptyState('📅', 'No upcoming assignments');

  const recentGradesHtml = data.grades.slice(0, 5).map(g => {
    const pct = Math.round(g.grade / g.points * 100);
    const cls = gradeColor(pct);
    return `<div class="upcoming-item">
      <div class="upcoming-type-icon" style="background:#dcfce7">📊</div>
      <div style="flex:1">
        <div class="text-sm text-muted">${escHtml(g.course_name)}</div>
      </div>
      <span class="${cls}" style="font-weight:700">${pct}%</span>
    </div>`;
  }).join('') || emptyState('📊', 'No grades yet');

  setContent(`
    <div class="page-header">
      <h1>👋 Welcome, ${escHtml(currentUser.full_name)}</h1>
      <p>You are enrolled in ${data.courses.length} course${data.courses.length !== 1 ? 's' : ''} this term.</p>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon">📚</div>
        <div class="stat-value">${data.courses.length}</div>
        <div class="stat-label">Enrolled Courses</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✏️</div>
        <div class="stat-value">${data.upcoming.length}</div>
        <div class="stat-label">Upcoming Assignments</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-value">${avgPct !== null ? avgPct + '%' : '—'}</div>
        <div class="stat-label">Average Grade</div>
      </div>
    </div>

    <div class="form-row form-row-2">
      <div class="card">
        <div class="card-header"><span class="card-title">📅 Upcoming Due Dates</span></div>
        <div class="card-body">${upcomingHtml}</div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">📊 Recent Grades</span></div>
        <div class="card-body">${recentGradesHtml}</div>
      </div>
    </div>

    <div class="page-header mt-24"><h1 style="font-size:20px">My Courses</h1></div>
    <div class="course-grid">
      ${data.courses.map(c => `
        <div class="course-card" onclick="loadCourseView(${c.id},'${escHtml(c.name)}'); setActiveSidebar('course-${c.id}')">
          <div class="course-card-banner ${courseBannerClass(c.id)}"></div>
          <div class="course-card-body">
            <div class="course-card-code">${escHtml(c.code)}</div>
            <div class="course-card-name">${escHtml(c.name)}</div>
            <div class="course-card-footer">
              <div class="course-card-teacher">👨‍🏫 ${escHtml(c.teacher_name)}</div>
              <span class="badge badge-blue">Open →</span>
            </div>
          </div>
        </div>`).join('')}
    </div>
  `);
}

// ============================================================
// Student Course View
// ============================================================
let _scCourseId = null;

async function renderStudentCourse(courseId) {
  _scCourseId = courseId;
  const course = await api(`/api/courses/${courseId}`);

  setContent(`
    <div class="page-header page-header-row">
      <div>
        <span class="badge badge-blue mb-8">${escHtml(course.code)}</span>
        <h1 style="margin-top:6px">${escHtml(course.name)}</h1>
        <p>${escHtml(course.description || '')}</p>
      </div>
    </div>
    <nav class="course-nav">
      <button class="course-nav-btn active" onclick="scSwitchTab(this,'sc-modules')">📦 Modules</button>
      <button class="course-nav-btn" onclick="scSwitchTab(this,'sc-assignments')">✏️ Assignments</button>
      <button class="course-nav-btn" onclick="scSwitchTab(this,'sc-discussions')">💬 Discussions</button>
      <button class="course-nav-btn" onclick="scSwitchTab(this,'sc-announcements')">📢 Announcements</button>
      <button class="course-nav-btn" onclick="scSwitchTab(this,'sc-grades')">📊 Grades</button>
      <button class="course-nav-btn" onclick="scSwitchTab(this,'sc-syllabus')">📋 Syllabus</button>
    </nav>
    <div id="sc-modules" class="sc-panel"></div>
    <div id="sc-assignments" class="sc-panel" style="display:none"></div>
    <div id="sc-discussions" class="sc-panel" style="display:none"></div>
    <div id="sc-announcements" class="sc-panel" style="display:none"></div>
    <div id="sc-grades" class="sc-panel" style="display:none"></div>
    <div id="sc-syllabus" class="sc-panel" style="display:none"></div>
  `);
  scLoadModules();
}

function scSwitchTab(btn, id) {
  document.querySelectorAll('.course-nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sc-panel').forEach(p => p.style.display = 'none');
  btn.classList.add('active');
  document.getElementById(id).style.display = 'block';
  const loaders = {
    'sc-modules': scLoadModules,
    'sc-assignments': scLoadAssignments,
    'sc-discussions': scLoadDiscussions,
    'sc-announcements': scLoadAnnouncements,
    'sc-grades': scLoadGrades,
    'sc-syllabus': scLoadSyllabus,
  };
  if (loaders[id]) loaders[id]();
}

// ---- Modules ----
async function scLoadModules() {
  const panel = document.getElementById('sc-modules');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const modules = await api(`/api/courses/${_scCourseId}/modules`);

  if (!modules.length) { panel.innerHTML = emptyState('📦', 'No modules available yet.'); return; }

  panel.innerHTML = modules.map(mod => {
    const items = mod.items || [];
    return `
    <div class="module-block">
      <div class="module-header" onclick="toggleScModule('scm${mod.id}','scmc${mod.id}')">
        <div class="module-header-left">
          <span class="module-chevron open" id="scmc${mod.id}">▶</span>
          <div>
            <div class="module-title">${escHtml(mod.title)}</div>
            ${mod.description ? `<div class="module-desc">${escHtml(mod.description)}</div>` : ''}
          </div>
        </div>
        <span class="badge badge-gray">${items.length} items</span>
      </div>
      <div class="module-items" id="scm${mod.id}">
        ${items.length ? items.map(item => scRenderModuleItem(item)).join('')
          : '<div style="padding:14px 20px;color:var(--text-muted);font-size:13px">No content in this module yet.</div>'}
      </div>
    </div>`;
  }).join('');
}

function toggleScModule(id, chevId) {
  const el = document.getElementById(id);
  const ch = document.getElementById(chevId);
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (ch) ch.classList.toggle('open', !open);
}

function scRenderModuleItem(item) {
  const icon = TYPE_ICONS[item.type] || '📎';
  const meta = item.meta || {};
  let metaStr = '';
  if (meta.due_date) metaStr = `Due: ${fmtDate(meta.due_date)}`;
  if (meta.points) metaStr += (metaStr ? ' · ' : '') + `${meta.points} pts`;

  let onclick = '';
  if (item.type === 'assignment') onclick = `scOpenAssignment(${item.item_id})`;
  else if (item.type === 'discussion') onclick = `scOpenDiscussion(${item.item_id})`;
  else if (item.type === 'material') onclick = `scViewMaterial(${item.item_id})`;
  else if (item.type === 'page') onclick = `scViewPage(${item.item_id})`;
  else if (item.type === 'quiz') onclick = `scViewQuiz(${item.item_id})`;

  return `<div class="module-item" onclick="${onclick}">
    <span class="module-item-icon">${icon}</span>
    <span class="module-item-title">${escHtml(meta.title || '—')}</span>
    <span class="badge badge-gray" style="font-size:10px">${item.type}</span>
    ${metaStr ? `<span class="module-item-meta">${escHtml(metaStr)}</span>` : ''}
    <span style="font-size:11px;color:var(--primary)">→</span>
  </div>`;
}

// ---- View material ----
async function scViewMaterial(materialId) {
  const materials = await api(`/api/courses/${_scCourseId}/materials`);
  const m = materials.find(x => x.id === materialId);
  if (!m) return;
  openModal(m.title, `
    <div class="rich-content" style="white-space:pre-wrap">${escHtml(m.content || 'No content provided.')}</div>
    ${m.file_name ? `<div class="alert alert-info mt-16">📎 Attached file: <strong>${escHtml(m.file_name)}</strong></div>` : ''}
  `);
}

// ---- View page ----
async function scViewPage(pageId) {
  const page = await api(`/api/courses/${_scCourseId}/pages/${pageId}`);
  if (!page) return;
  openModal(page.title, `<div class="rich-content">${page.body || 'No content.'}</div>`);
}

// ---- View quiz ----
async function scViewQuiz(quizId) {
  const quizzes = await api(`/api/courses/${_scCourseId}/quizzes`);
  const q = quizzes.find(x => x.id === quizId);
  if (!q) return;
  openModal(q.title, `
    <div class="alert alert-info mb-16">📅 Due: ${fmtDate(q.due_date)}</div>
    <div class="rich-content">${escHtml(q.description || 'No description.')}</div>
    <div class="alert alert-warn mt-16">⚠️ Online quiz submission is not yet available. Please submit your answers in class or as directed by your teacher.</div>
  `);
}

// ---- Assignments ----
async function scLoadAssignments() {
  const panel = document.getElementById('sc-assignments');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const assignments = await api(`/api/courses/${_scCourseId}/assignments`);

  if (!assignments.length) { panel.innerHTML = emptyState('✏️', 'No assignments yet.'); return; }

  panel.innerHTML = assignments.map(a => {
    const sub = a.submission;
    const due = daysUntil(a.due_date);
    let statusBadge = '<span class="badge badge-gray">Not submitted</span>';
    if (sub && sub.grade !== null && sub.grade !== undefined)
      statusBadge = `<span class="badge badge-green">Graded: ${sub.grade}/${a.points}</span>`;
    else if (sub)
      statusBadge = '<span class="badge badge-yellow">Submitted — awaiting grade</span>';

    return `
    <div class="card mb-16">
      <div class="card-header">
        <div>
          <div class="card-title">✏️ ${escHtml(a.title)}</div>
          <div class="text-sm text-muted mt-8">${a.points} pts · ${fmtDate(a.due_date)} ${due ? `<span class="badge ${due.cls}">${due.label}</span>` : ''}</div>
        </div>
        ${statusBadge}
      </div>
      <div class="card-body">
        <p style="font-size:13.5px;color:var(--text-muted);margin-bottom:16px">${escHtml(a.description || '')}</p>
        <button class="btn btn-primary btn-sm" onclick="scOpenAssignment(${a.id})">
          ${sub ? '📋 View / Resubmit' : '📤 Submit Assignment'}
        </button>
      </div>
    </div>`;
  }).join('');
}

async function scOpenAssignment(assignmentId) {
  const [assignments, rubrics, mySub] = await Promise.all([
    api(`/api/courses/${_scCourseId}/assignments`),
    api(`/api/courses/${_scCourseId}/rubrics`),
    api(`/api/courses/${_scCourseId}/assignments/${assignmentId}/submissions/my`).catch(() => null),
  ]);
  const a = assignments.find(x => x.id === assignmentId);
  const rubric = rubrics.find(r => r.id === a?.rubric_id);

  let html = `
    <div class="alert alert-info mb-16">
      <strong>${a?.points} points</strong> · Due: ${fmtDate(a?.due_date)}
    </div>
    <div class="rich-content mb-16">${escHtml(a?.description || '')}</div>`;

  // Show rubric if available
  if (rubric) {
    html += `<div class="card mb-16">
      <div class="card-header"><span class="card-title">🏷️ Rubric: ${escHtml(rubric.title)}</span></div>
      <div class="card-body" style="padding:0">
        <table class="rubric-table"><thead><tr><th>Criteria</th><th style="text-align:center">Points</th></tr></thead>
        <tbody>${(rubric.criteria||[]).map(c => `
          <tr><td>${escHtml(c.description)}</td><td class="rubric-pts">${c.points}</td></tr>`).join('')}
          <tr style="background:#f8fafc"><td><strong>Total</strong></td>
            <td class="rubric-pts">${(rubric.criteria||[]).reduce((s,c)=>s+c.points,0)}</td></tr>
        </tbody></table>
      </div>
    </div>`;
  }

  // Show grade/feedback if graded
  if (mySub && mySub.grade !== null && mySub.grade !== undefined) {
    const pct = Math.round(mySub.grade / a.points * 100);
    const cls = gradeColor(pct);
    html += `<div class="card mb-16" style="border-color:#86efac">
      <div class="card-header" style="background:#f0fdf4">
        <span class="card-title">📊 Your Grade</span>
        <span class="grade-pill" style="font-size:16px">${mySub.grade}/${a.points} (${pct}%)</span>
      </div>
      ${mySub.feedback ? `<div class="card-body">
        <div class="ann-meta">Teacher Feedback:</div>
        <div style="font-size:14px;line-height:1.6;color:var(--text)">${escHtml(mySub.feedback)}</div>
      </div>` : ''}
    </div>`;
  }

  // Show previous submission
  if (mySub) {
    html += `<div class="alert alert-warn mb-16">
      ✅ Submitted on ${fmtDateTime(mySub.submitted_at)}
      ${mySub.file_name ? `<br>📎 ${escHtml(mySub.file_name)}` : ''}
    </div>`;
    if (mySub.text_response) {
      html += `<div class="card mb-16"><div class="card-header"><span class="card-title">Your Submission</span></div>
        <div class="card-body"><pre style="white-space:pre-wrap;font-size:13px;font-family:inherit">${escHtml(mySub.text_response)}</pre></div></div>`;
    }
  }

  // Submission form
  html += `<div style="border-top:1px solid var(--border);padding-top:16px">
    <h4 style="margin-bottom:12px">${mySub ? 'Update Submission' : 'Submit Your Work'}</h4>
    <div class="form-group"><label>Your Response</label>
      <textarea class="form-control" id="subText" style="min-height:120px" placeholder="Type your answer here…">${escHtml(mySub?.text_response || '')}</textarea>
    </div>
    <div class="form-group"><label>File Name (simulated upload)</label>
      <input class="form-control" id="subFile" placeholder="e.g. my_assignment.pdf" value="${escHtml(mySub?.file_name || '')}">
    </div>
    <button class="btn btn-primary" onclick="scSubmitAssignment(${assignmentId})">📤 ${mySub ? 'Update' : 'Submit'}</button>
  </div>`;

  openModal(`${a?.title}`, html, 'modal-box-lg');
}

async function scSubmitAssignment(assignmentId) {
  const text = document.getElementById('subText').value.trim();
  const file = document.getElementById('subFile').value.trim();
  if (!text && !file) { showToast('Please add a response or file name', 'error'); return; }
  const fd = buildForm({ text_response: text, file_name: file });
  try {
    await apiPost(`/api/courses/${_scCourseId}/assignments/${assignmentId}/submissions`, fd);
    showToast('Assignment submitted!', 'success');
    closeModal();
    scLoadAssignments();
  } catch (e) { showToast(e.message, 'error'); }
}

// ---- Discussions ----
async function scLoadDiscussions() {
  const panel = document.getElementById('sc-discussions');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const discussions = await api(`/api/courses/${_scCourseId}/discussions`);

  if (!discussions.length) { panel.innerHTML = emptyState('💬', 'No discussions yet.'); return; }

  panel.innerHTML = discussions.map(d => `
    <div class="card mb-12">
      <div class="card-header">
        <div>
          <div class="card-title">💬 ${escHtml(d.title)}</div>
          <div class="text-sm text-muted mt-8">${d.due_date ? `Due: ${fmtDate(d.due_date)}` : 'No due date'}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="scOpenDiscussion(${d.id})">Join Discussion</button>
      </div>
      <div class="card-body">
        <p style="font-size:13.5px;color:var(--text-muted)">${escHtml(d.prompt || '')}</p>
      </div>
    </div>`).join('');
}

async function scOpenDiscussion(discId) {
  const disc = await api(`/api/courses/${_scCourseId}/discussions/${discId}`);
  const posts = disc.posts || [];
  const topLevel = posts.filter(p => !p.parent_id);
  const replies  = posts.filter(p => p.parent_id);

  let html = `<div class="alert alert-info mb-16"><strong>Discussion Prompt:</strong> ${escHtml(disc.prompt || '')}</div>`;
  html += `<div class="mb-16"><strong>${posts.length} post${posts.length !== 1 ? 's' : ''}</strong></div>`;

  topLevel.forEach(p => {
    const myPost = p.author_id === currentUser.id;
    html += `<div class="discussion-post">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="post-author">${myPost ? '⭐ ' : ''}👤 ${escHtml(p.author_name)}</span>
        <span class="post-time">${fmtDateTime(p.created_at)}</span>
      </div>
      <div class="post-body">${escHtml(p.body)}</div>
      <div class="post-reply-btn" onclick="scToggleReply('reply-${p.id}')">↩ Reply</div>
      <div id="reply-${p.id}" style="display:none;margin-top:10px">
        <textarea class="form-control" id="rt-${p.id}" style="min-height:70px" placeholder="Write your reply…"></textarea>
        <div class="flex gap-8 mt-8">
          <button class="btn btn-primary btn-xs" onclick="scPostReply(${discId},${p.id},'rt-${p.id}')">Post Reply</button>
          <button class="btn btn-secondary btn-xs" onclick="scToggleReply('reply-${p.id}')">Cancel</button>
        </div>
      </div>
    </div>`;
    replies.filter(r => r.parent_id === p.id).forEach(r => {
      const myReply = r.author_id === currentUser.id;
      html += `<div class="discussion-post reply">
        <span class="post-author">${myReply ? '⭐ ' : ''}↳ ${escHtml(r.author_name)}</span>
        <span class="post-time">${fmtDateTime(r.created_at)}</span>
        <div class="post-body">${escHtml(r.body)}</div>
      </div>`;
    });
  });

  if (!posts.length) html += emptyState('💬', 'No posts yet. Be the first to reply!');

  // New top-level post
  html += `<div style="border-top:1px solid var(--border);padding-top:16px;margin-top:16px">
    <div class="form-group"><label>Post a Response</label>
      <textarea class="form-control" id="newDiscPost" style="min-height:90px" placeholder="Share your thoughts…"></textarea>
    </div>
    <button class="btn btn-primary btn-sm" onclick="scPostToDiscussion(${discId})">📤 Post</button>
  </div>`;

  openModal(`💬 ${disc.title}`, html, 'modal-box-lg');
}

function scToggleReply(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function scPostToDiscussion(discId) {
  const body = document.getElementById('newDiscPost')?.value.trim();
  if (!body) { showToast('Write something first!', 'error'); return; }
  const fd = buildForm({ body });
  try {
    await apiPost(`/api/courses/${_scCourseId}/discussions/${discId}/posts`, fd);
    showToast('Posted!', 'success');
    scOpenDiscussion(discId);
  } catch (e) { showToast(e.message, 'error'); }
}

async function scPostReply(discId, parentId, textareaId) {
  const body = document.getElementById(textareaId)?.value.trim();
  if (!body) { showToast('Write something first!', 'error'); return; }
  const fd = buildForm({ body, parent_id: parentId });
  try {
    await apiPost(`/api/courses/${_scCourseId}/discussions/${discId}/posts`, fd);
    showToast('Reply posted!', 'success');
    scOpenDiscussion(discId);
  } catch (e) { showToast(e.message, 'error'); }
}

// ---- Announcements ----
async function scLoadAnnouncements() {
  const panel = document.getElementById('sc-announcements');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const anns = await api(`/api/courses/${_scCourseId}/announcements`);

  if (!anns.length) { panel.innerHTML = emptyState('📢', 'No announcements yet.'); return; }

  panel.innerHTML = `<div class="card">
    ${anns.map(a => `
      <div class="announcement-item">
        <div class="ann-title">📢 ${escHtml(a.title)}</div>
        <div class="ann-meta">By ${escHtml(a.author_name)} · ${fmtDateTime(a.created_at)}</div>
        <div class="ann-body">${escHtml(a.body || '')}</div>
      </div>`).join('')}
  </div>`;
}

// ---- Grades ----
async function scLoadGrades() {
  const panel = document.getElementById('sc-grades');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const assignments = await api(`/api/courses/${_scCourseId}/assignments`);

  const graded   = assignments.filter(a => a.submission && a.submission.grade !== null);
  const ungraded = assignments.filter(a => a.submission && a.submission.grade === null);
  const pending  = assignments.filter(a => !a.submission);

  let totalPct = null;
  if (graded.length) {
    const sum = graded.reduce((s, a) => s + (a.submission.grade / a.points * 100), 0);
    totalPct = Math.round(sum / graded.length);
  }

  let html = '';

  if (totalPct !== null) {
    const cls = gradeColor(totalPct);
    html += `<div class="card mb-24" style="text-align:center;padding:28px">
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Current Average</div>
      <div class="total-pct ${cls}" style="font-size:48px;margin:8px 0">${totalPct}%</div>
      <div class="text-muted text-sm">Based on ${graded.length} graded assignment${graded.length!==1?'s':''}</div>
    </div>`;
  }

  function assignmentRow(a) {
    const sub = a.submission;
    const rubricText = '';
    if (!sub) {
      return `<tr>
        <td><strong>${escHtml(a.title)}</strong></td>
        <td>${fmtDate(a.due_date)}</td>
        <td>${a.points}</td>
        <td><span class="badge badge-gray">Not submitted</span></td>
        <td>—</td>
      </tr>`;
    }
    if (sub.grade === null || sub.grade === undefined) {
      return `<tr>
        <td><strong>${escHtml(a.title)}</strong></td>
        <td>${fmtDate(a.due_date)}</td>
        <td>${a.points}</td>
        <td><span class="badge badge-yellow">Awaiting grade</span></td>
        <td>—</td>
      </tr>`;
    }
    const pct = Math.round(sub.grade / a.points * 100);
    const cls = gradeColor(pct);
    return `<tr>
      <td><strong>${escHtml(a.title)}</strong></td>
      <td>${fmtDate(a.due_date)}</td>
      <td>${a.points}</td>
      <td><span class="badge badge-green">Graded</span></td>
      <td><span class="${cls}" style="font-weight:700">${sub.grade}/${a.points} (${pct}%)</span>
        ${sub.feedback ? `<div class="text-sm text-muted mt-8">💬 ${escHtml(sub.feedback.slice(0,60))}…</div>` : ''}
      </td>
    </tr>`;
  }

  html += `<div class="card">
    <div class="card-header"><span class="card-title">📊 All Assignments</span></div>
    <div class="table-wrapper">
      <table><thead><tr><th>Assignment</th><th>Due</th><th>Points</th><th>Status</th><th>Grade</th></tr></thead>
      <tbody>${assignments.map(assignmentRow).join('')}</tbody></table>
    </div>
  </div>`;

  panel.innerHTML = html;
}

// ---- Syllabus ----
async function scLoadSyllabus() {
  const panel = document.getElementById('sc-syllabus');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const syl = await api(`/api/courses/${_scCourseId}/syllabus`);
  const content = syl?.content || '';

  panel.innerHTML = `<div class="card">
    <div class="card-header"><span class="card-title">📋 Syllabus</span></div>
    <div class="card-body">
      <div class="syllabus-content">${content || '<p class="text-muted">Syllabus not yet published by the teacher.</p>'}</div>
    </div>
  </div>`;
}
