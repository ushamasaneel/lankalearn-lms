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
// Course view (student)
// ============================================================
let _scCourseId = null;

async function renderStudentCourse(courseId) {
  _scCourseId = courseId;
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
      <button class="course-nav-btn active" onclick="scSwitchTab(this,'sc-modules')">📦 Modules</button>
      <button class="course-nav-btn" onclick="scSwitchTab(this,'sc-assignments')">✏️ Assignments</button>
      <button class="course-nav-btn" onclick="scSwitchTab(this,'sc-discussions')">💬 Discussions</button>
      <button class="course-nav-btn" onclick="scSwitchTab(this,'sc-announcements')">📢 Announcements</button>
      <button class="course-nav-btn" onclick="scSwitchTab(this,'sc-grades')">📊 Grades</button>
      <button class="course-nav-btn" onclick="scSwitchTab(this,'sc-quizzes')">📝 Quizzes</button>
      <button class="course-nav-btn" onclick="scSwitchTab(this,'sc-syllabus')">📋 Syllabus</button>
    </nav>
    <div id="sc-modules" class="sc-panel"></div>
    <div id="sc-assignments" class="sc-panel" style="display:none"></div>
    <div id="sc-discussions" class="sc-panel" style="display:none"></div>
    <div id="sc-announcements" class="sc-panel" style="display:none"></div>
    <div id="sc-grades" class="sc-panel" style="display:none"></div>
    <div id="sc-quizzes" class="sc-panel" style="display:none"></div>
    <div id="sc-syllabus" class="sc-panel" style="display:none"></div>
  `;
  setContent(navHtml);
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
    'sc-quizzes': scLoadQuizzes,
    'sc-syllabus': scLoadSyllabus
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
// ---- View material ----
async function scViewMaterial(materialId) {
  const materials = await api(`/api/courses/${_scCourseId}/materials`);
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
    <div class="rich-content" style="white-space:pre-wrap">${escHtml(m.content || 'No content provided.')}</div>
    ${fileHtml}
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

// ---- Materials ----
async function scLoadMaterials() {
  const panel = document.getElementById('sc-materials');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const materials = await api(`/api/courses/${_scCourseId}/materials`);
  if (!materials.length) { panel.innerHTML = emptyState('📄', 'No materials available yet.'); return; }

  panel.innerHTML = materials.map(m => `
    <div class="card mb-16">
      <div class="card-header">
        <div class="card-title">📄 ${escHtml(m.title)}</div>
      </div>
      <div class="card-body">
        <p style="font-size:13.5px;color:var(--text-muted);margin-bottom:16px">${escHtml(m.content || '')}</p>
        ${m.file_name ? `<p style="margin-bottom:16px"><strong>📎 Attached file:</strong> <a href="/uploads/${encodeURIComponent(m.file_name)}" target="_blank" class="link">Download/View File</a></p>` : ''}
        <div class="text-xs text-muted">Added ${fmtDate(m.created_at)}</div>
      </div>
    </div>
  `).join('');
}

// ---- Quizzes ----
// ---- Load Quizzes with Attempt Locks ----
async function scLoadQuizzes() {
  const panel = document.getElementById('sc-quizzes');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const quizzes = await api(`/api/courses/${_scCourseId}/quizzes`);
  if (!quizzes.length) { panel.innerHTML = emptyState('📝', 'No quizzes available yet.'); return; }

  panel.innerHTML = quizzes.map(q => {
    const sub = q.submission;
    const attempts = sub ? sub.attempts : 0;
    const maxAtt = parseInt(q.max_attempts) || 1;
    const outOfTries = attempts >= maxAtt;
    
    let statusHtml = '';
    if (sub) {
        statusHtml = `<div class="mt-8 mb-12">
          <span class="badge badge-green">Highest Grade: ${Math.round(sub.grade)}%</span> 
          <span class="badge ${outOfTries ? 'badge-red' : 'badge-yellow'}">Attempts Used: ${attempts}/${maxAtt}</span>
        </div>`;
    }

    return `
    <div class="card mb-16">
      <div class="card-header">
        <div class="card-title">📝 ${escHtml(q.title)}</div>
        <div class="text-sm text-muted mt-8">${fmtDate(q.due_date)}</div>
      </div>
      <div class="card-body">
        <p style="font-size:13.5px;color:var(--text-muted);margin-bottom:8px">${escHtml(q.description || '')}</p>
        ${statusHtml}
        <button class="btn ${outOfTries ? 'btn-secondary' : 'btn-primary'} btn-sm" ${outOfTries ? 'disabled' : `onclick="scOpenQuiz(${q.id})"`}>
          ${outOfTries ? '🔒 Max Attempts Reached' : '📝 Take Quiz'}
        </button>
      </div>
    </div>`;
  }).join('');
}

async function scOpenAssignment(assignmentId) {
  const [assignments, mySub] = await Promise.all([
    api(`/api/courses/${_scCourseId}/assignments`),
    api(`/api/courses/${_scCourseId}/assignments/${assignmentId}/submissions/my`).catch(() => null),
  ]);
  const a = assignments.find(x => x.id === assignmentId);

  let html = `
    <div class="alert alert-info mb-16">
      <strong>Points: ${a.points}</strong> | Due: ${fmtDate(a.due_date)}
    </div>
    <p class="mb-16">${escHtml(a.description || 'No description provided.')}</p>
  `;

  if (a.file_name) {
    html += `<div class="alert alert-info mb-16">📎 Assignment file: <a href="/uploads/${encodeURIComponent(a.file_name)}" target="_blank">${escHtml(a.file_name)}</a></div>`;
  }

  if (mySub) {
    html += `
      <div class="alert alert-success mb-16">
        ✅ Submitted on ${fmtDateTime(mySub.submitted_at)}
        ${mySub.file_name ? `<br>📎 <a href="/uploads/${encodeURIComponent(mySub.file_name)}" target="_blank">View Uploaded Work</a>` : ''}
      </div>
    `;
  }

  html += `<div style="border-top:1px solid var(--border);padding-top:16px">
      <h4 style="margin-bottom:12px">${mySub ? 'Update Submission' : 'Submit Your Work'}</h4>
      <div class="form-group"><label>Your Response</label>
        <textarea class="form-control" id="subText" style="min-height:120px" placeholder="Type your answer here…">${escHtml(mySub?.text_response || '')}</textarea>
      </div>
      <div class="form-group"><label>Upload File (PDF/Photo)</label>
        <input class="form-control" type="file" id="subFileReal">
      </div>
      <button class="btn btn-primary" onclick="scSubmitAssignment(${assignmentId})">📤 ${mySub ? 'Update' : 'Submit'}</button>
    </div>`;

  openModal(`${a?.title}`, html, 'modal-box-lg');
}


async function scSubmitAssignment(assignmentId) {
  const text = document.getElementById('subText').value;
  const fileInput = document.getElementById('subFileReal');
  
  const fd = new FormData();
  fd.append('text_response', text);
  if (fileInput.files[0]) {
    fd.append('file', fileInput.files[0]);
  }

  try {
    const res = await fetch(`/api/courses/${_scCourseId}/assignments/${assignmentId}/submissions`, {
        method: 'POST',
        body: fd
    });
    if (res.ok) {
        showToast('Assignment submitted successfully!', 'success');
        closeModal();
        scLoadAssignments();
    } else {
        showToast('Upload failed. Please try again.', 'error');
    }
  } catch (e) {
    showToast('Connection error.', 'error');
  }
}

// Variable to hold our countdown interval
let _quizTimerInterval = null;

async function scOpenQuiz(quizId) {
  // Add heavy blur to modal background
  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
      overlay.style.backdropFilter = 'blur(12px)';
      overlay.style.webkitBackdropFilter = 'blur(12px)';
      overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
  }

  // Fetch quizzes to get the specific time limit and attempt data
  const quizzes = await api(`/api/courses/${_scCourseId}/quizzes`);
  const quiz = quizzes.find(q => q.id === quizId);
  const timeLimit = parseInt(quiz.time_limit) || 0;
  const maxAtt = parseInt(quiz.max_attempts) || 1;
  const attempts = quiz.submission ? quiz.submission.attempts : 0;

  if (attempts >= maxAtt) {
      showToast('Maximum attempts reached.', 'error');
      if(overlay) overlay.style.backdropFilter = '';
      return;
  }

  // The Start Screen!
  let introHtml = `
    <div style="text-align:center; padding: 30px 10px;">
        <div style="font-size:54px; margin-bottom:16px;">📝</div>
        <h2 style="margin-bottom:8px; font-family:'Playfair Display', serif; color:var(--primary-dark)">${escHtml(quiz.title)}</h2>
        <p class="text-muted" style="margin-bottom:32px; font-size:15px;">${escHtml(quiz.description || 'Read the questions carefully before submitting.')}</p>

        <div style="display:flex; justify-content:center; gap:24px; margin-bottom:36px;">
            <div style="background:#f8fafc; padding:20px; border-radius:12px; border:1px solid var(--border); min-width:140px; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                <div style="font-size:28px; font-weight:700; color:var(--primary);">${timeLimit > 0 ? timeLimit + ' Min' : '∞'}</div>
                <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; font-weight:700; margin-top:6px; letter-spacing:1px;">Time Limit</div>
            </div>
            <div style="background:#f8fafc; padding:20px; border-radius:12px; border:1px solid var(--border); min-width:140px; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                <div style="font-size:28px; font-weight:700; color:var(--primary);">${attempts} / ${maxAtt}</div>
                <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; font-weight:700; margin-top:6px; letter-spacing:1px;">Attempts</div>
            </div>
        </div>

        <button class="btn btn-primary" style="font-size:16px; padding:12px 36px; border-radius:30px; box-shadow:0 4px 12px rgba(30,64,175,0.3);" onclick="scStartQuizTaking(${quizId}, ${timeLimit})">🚀 Start Quiz</button>
    </div>
  `;

  // Restore background when modal closes
  const oldClose = window.closeModal;
  window.closeModal = function() {
      if (overlay) {
          overlay.style.backdropFilter = '';
          overlay.style.webkitBackdropFilter = '';
          overlay.style.backgroundColor = '';
      }
      if (_quizTimerInterval) clearInterval(_quizTimerInterval);
      oldClose();
      window.closeModal = oldClose; // Restore original function
  };

  openModal('', introHtml);
}

window.scStartQuizTaking = async (quizId, timeLimit) => {
  const questions = await api(`/api/courses/${_scCourseId}/quizzes/${quizId}/questions`);
  if (!questions.length) { showToast('Teacher has not added questions yet.', 'error'); return; }

  const quizzes = await api(`/api/courses/${_scCourseId}/quizzes`);
  const quiz = quizzes.find(q => q.id === quizId);

  let html = `
    <div style="position:sticky; top:-22px; background:white; z-index:10; padding-bottom:16px; margin-bottom:16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h3 style="margin:0">${escHtml(quiz.title)}</h3>
        <p class="text-muted text-sm" style="margin:4px 0 0 0">${questions.length} Questions</p>
      </div>
      ${timeLimit > 0 ? `<div id="quizTimerDisplay" style="font-size:18px; font-weight:800; color:#dc2626; background:#fee2e2; padding:8px 16px; border-radius:8px; border:1px solid #fca5a5; font-family:monospace; box-shadow:0 2px 4px rgba(220,38,38,0.2);">⏱️ ${timeLimit}:00</div>` : '<div class="badge badge-gray">No Time Limit</div>'}
    </div>
    <form id="quizForm">`;

  questions.forEach((q, i) => {
    html += `<div class="card mb-16"><div class="card-body">
      <p style="font-size:15px; margin-bottom:12px;"><strong>${i+1}. ${escHtml(q.question_text)}</strong> <span class="text-muted text-sm">(${q.points} pts)</span></p>`;
    q.options.forEach(opt => {
      html += `<label style="display:block; margin-bottom:8px; cursor:pointer; padding:10px 14px; border:1px solid var(--border); border-radius:8px; transition:all 0.2s;" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1';" onmouseout="this.style.background='transparent'; this.style.borderColor='var(--border)';">
        <input type="radio" name="q_${q.id}" value="${opt.id}" style="margin-right:8px; transform:scale(1.1);"> <span style="font-size:14.5px;">${escHtml(opt.option_text)}</span>
      </label>`;
    });
    html += `</div></div>`;
  });
  html += `<button type="button" class="btn btn-primary w-full" style="padding:14px; font-size:16px; font-weight:700; margin-top:8px;" onclick="scSubmitQuiz(${quizId})">📤 Submit Answers</button></form>`;

  openModal('', html, 'modal-box-lg');

  if (_quizTimerInterval) clearInterval(_quizTimerInterval);
  if (timeLimit > 0) {
    let timeLeft = timeLimit * 60;
    const display = document.getElementById('quizTimerDisplay');

    _quizTimerInterval = setInterval(() => {
      timeLeft--;
      const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
      const s = (timeLeft % 60).toString().padStart(2, '0');
      if (display) display.innerHTML = `⏱️ ${m}:${s}`;

      if (timeLeft <= 0) {
        clearInterval(_quizTimerInterval);
        if(display) display.innerHTML = `⏱️ 00:00`;
        showToast('Time is up! Auto-submitting quiz...', 'error');
        scSubmitQuiz(quizId);
      }
    }, 1000);
  }
}

window.scSubmitQuiz = async (quizId) => {
  if (_quizTimerInterval) clearInterval(_quizTimerInterval);

  const form = document.getElementById('quizForm');
  const answers = {};
  new FormData(form).forEach((val, key) => { answers[key.split('_')[1]] = parseInt(val); });

  try {
    const btn = document.querySelector('#quizForm .btn-primary');
    if (btn) { btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:8px;"></div> Grading...'; btn.disabled = true; }

    const res = await apiJSON(`/api/courses/${_scCourseId}/quizzes/${quizId}/submit`, { answers });
    showToast(`Quiz graded! Score: ${res.earned}/${res.total}`, 'success');
    closeModal(); scLoadQuizzes(); scLoadGrades();
  } catch (e) {
      showToast(e.message, 'error');
      const btn = document.querySelector('#quizForm .btn-primary');
      if (btn) { btn.innerHTML = '📤 Submit Answers'; btn.disabled = false; }
  }
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
        ${d.file_name ? `<p style="margin-top:8px"><strong>📎 Attached file:</strong> <a href="/uploads/${encodeURIComponent(d.file_name)}" target="_blank" class="link">Download/View File</a></p>` : ''}
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
        ${a.file_name ? `<div style="margin-top:8px"><strong>📎 Attachment:</strong> <a href="/uploads/${encodeURIComponent(a.file_name)}" target="_blank" class="link">${escHtml(a.file_name)}</a></div>` : ''}
      </div>`).join('')}
  </div>`;
}

// ---- Grades ----
// ---- Unified Gradebook (Shows both Assignments & Quizzes) ----
async function scLoadGrades() {
  const panel = document.getElementById('sc-grades');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  
  // Fetch both assignments and our newly functioning quizzes!
  const [assignments, quizzes] = await Promise.all([
    api(`/api/courses/${_scCourseId}/assignments`),
    api(`/api/courses/${_scCourseId}/quizzes`)
  ]);

  const gradedAssigns = assignments.filter(a => a.submission && a.submission.grade !== null);
  const gradedQuizzes = quizzes.filter(q => q.submission && q.submission.grade !== null);
  const totalGradedCount = gradedAssigns.length + gradedQuizzes.length;

  let totalPct = null;
  if (totalGradedCount > 0) {
    let sum = 0;
    gradedAssigns.forEach(a => sum += (a.submission.grade / a.points * 100));
    gradedQuizzes.forEach(q => sum += q.submission.grade); // Quizzes are already in %
    totalPct = Math.round(sum / totalGradedCount);
  }

  let html = '';
  if (totalPct !== null) {
    const cls = gradeColor(totalPct);
    html += `<div class="card mb-24" style="text-align:center;padding:28px">
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Current Average</div>
      <div class="total-pct ${cls}" style="font-size:48px;margin:8px 0">${totalPct}%</div>
      <div class="text-muted text-sm">Based on ${totalGradedCount} graded items</div>
    </div>`;
  }

  html += `<div class="card"><div class="card-header"><span class="card-title">📊 Grades</span></div><div class="table-wrapper">
    <table><thead><tr><th>Type</th><th>Item Name</th><th>Due</th><th>Points</th><th>Grade</th></tr></thead><tbody>`;
  
  // Render Assignments
  assignments.forEach(a => {
    const sub = a.submission;
    if (!sub) return html += `<tr><td><span class="badge badge-gray">Assignment</span></td><td><strong>${escHtml(a.title)}</strong></td><td>${fmtDate(a.due_date)}</td><td>${a.points}</td><td><span class="badge badge-gray">Not submitted</span></td></tr>`;
    if (sub.grade === null) return html += `<tr><td><span class="badge badge-gray">Assignment</span></td><td><strong>${escHtml(a.title)}</strong></td><td>${fmtDate(a.due_date)}</td><td>${a.points}</td><td><span class="badge badge-yellow">Awaiting grade</span></td></tr>`;
    const pct = Math.round(sub.grade / a.points * 100);
    html += `<tr><td><span class="badge badge-gray">Assignment</span></td><td><strong>${escHtml(a.title)}</strong></td><td>${fmtDate(a.due_date)}</td><td>${a.points}</td><td><span class="${gradeColor(pct)}" style="font-weight:700">${sub.grade}/${a.points} (${pct}%)</span></td></tr>`;
  });

  // Render Quizzes
  quizzes.forEach(q => {
    const sub = q.submission;
    if (!sub) return html += `<tr><td><span class="badge badge-blue">Quiz</span></td><td><strong>${escHtml(q.title)}</strong></td><td>${fmtDate(q.due_date)}</td><td>100</td><td><span class="badge badge-gray">Not taken</span></td></tr>`;
    html += `<tr><td><span class="badge badge-blue">Quiz</span></td><td><strong>${escHtml(q.title)}</strong></td><td>${fmtDate(q.due_date)}</td><td>100</td><td><span class="${gradeColor(sub.grade)}" style="font-weight:700">${Math.round(sub.grade)}%</span></td></tr>`;
  });

  html += `</tbody></table></div></div>`;
  panel.innerHTML = html;
}
// ---- Syllabus ----
// ---- Syllabus ----
async function scLoadSyllabus() {
  const panel = document.getElementById('sc-syllabus');
  if (!panel) return;
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  const syl = await api(`/api/courses/${_scCourseId}/syllabus`);
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

  panel.innerHTML = `<div class="card">
    <div class="card-header"><span class="card-title">📋 Syllabus</span></div>
    <div class="card-body">
      <div class="syllabus-content">${content || '<p class="text-muted">Syllabus not yet published by the teacher.</p>'}</div>
      ${fileHtml}
    </div>
  </div>`;
}