/* ============================================================
   admin.js — Executive Dash, Audit Logs, Users, Courses, Fees
   ============================================================ */

// ================================================================
// EXECUTIVE DASHBOARD
// ================================================================


// ================================================================
// MAIN ADMIN DASHBOARD
// ================================================================

async function loadAdminDashboard() {
  setPageTitle('Dashboard');
  setActiveSidebar('dash');
  setContent('<div class="loading-state"><div class="spinner"></div></div>');

  const stats = await api('/api/admin/stats').catch(() => ({}));
  const users = await api('/api/admin/users').catch(() => []);
  const courses = await api('/api/admin/courses').catch(() => []);

  const recentUsers = users.slice(-5).reverse();

  setContent(`
    <div class="page-header page-header-row">
      <div>
        <h1>🏠 Admin Dashboard</h1>
        <p>Welcome back, ${escHtml(currentUser.full_name)}. Here's an overview of LankaLearn.</p>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary" onclick="clearActiveBroadcast()">🛑 Clear Alert</button>
        <button class="btn btn-danger" onclick="showBroadcastModal()">🚨 Send School Alert</button>
      </div>
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
              <td><span class="badge ${roleBadge(u.role)}">${u.role.replace('_', ' ')}</span></td>
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


async function loadExecutiveDashboard() {
    setPageTitle('Executive Dashboard');
    setActiveSidebar('exec');
    setContent('<div class="loading-state"><div class="spinner"></div></div>');
    
    const data = await api('/api/admin/executive-dashboard');
    const fmt = n => `LKR ${Number(n).toLocaleString('en-LK')}`;
    
    // Calculate School-Wide Totals
    let totalExpected = 0, totalCollected = 0, totalStudents = 0;
    data.financials.forEach(f => { totalExpected += f.expected; totalCollected += f.collected; });
    data.demographics.forEach(d => { totalStudents += d.student_count; });
    const collectionPct = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

    // Generate INTERACTIVE Demographic HTML Bars
    const maxStudents = Math.max(...data.demographics.map(d => d.student_count), 1);
    const demoHtml = data.demographics.map(d => {
        const pct = (d.student_count / maxStudents) * 100;
        return `
            <div style="margin-bottom:14px; cursor:pointer; padding:6px; border-radius:6px; transition:all 0.2s; border:1px solid transparent;" 
                 onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0';" 
                 onmouseout="this.style.background='transparent'; this.style.borderColor='transparent';"
                 onclick="execShowGradeStudents('${escHtml(d.grade)}')">
                <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; margin-bottom:6px; color:var(--text);">
                    <span>${escHtml(d.grade)}</span>
                    <span style="color:var(--primary);">${d.student_count} Students <span style="font-size:10px; margin-left:4px;">▶</span></span>
                </div>
                <div style="width:100%; background:#e2e8f0; border-radius:6px; height:14px; overflow:hidden;">
                    <div style="width:${pct}%; background:linear-gradient(90deg, var(--primary-dark), var(--primary-mid)); height:100%; border-radius:6px;"></div>
                </div>
            </div>`;
    }).join('');

    // Generate Financial HTML Bars with Drilldown
    const maxFin = Math.max(...data.financials.map(f => Math.max(f.expected, f.collected)), 1);
    const finHtml = data.financials.map(f => {
        const expPct = (f.expected / maxFin) * 100;
        const colPct = (f.collected / maxFin) * 100;
        return `
            <div style="margin-bottom:16px; cursor:pointer; padding:8px; border-radius:8px; transition:all 0.2s;" 
                 onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'"
                 onclick="execShowFinancialDrilldown('${escHtml(f.grade)}')">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div style="font-size:12px; font-weight:700;">${escHtml(f.grade)}</div>
                    <span style="font-size:10px; color:var(--primary); font-weight:600;">View Arrears List ▶</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <div style="width:60px; font-size:10px; color:var(--text-muted);">Expected</div>
                    <div style="flex:1; background:#f1f5f9; height:8px; border-radius:4px; overflow:hidden;">
                        <div style="width:${expPct}%; background:#94a3b8; height:100%;"></div>
                    </div>
                    <div style="width:80px; text-align:right; font-size:11px;">${fmt(f.expected)}</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:60px; font-size:10px; color:var(--text-muted);">Collected</div>
                    <div style="flex:1; background:#f1f5f9; height:8px; border-radius:4px; overflow:hidden;">
                        <div style="width:${colPct}%; background:#16a34a; height:100%;"></div>
                    </div>
                    <div style="width:80px; text-align:right; font-size:11px; font-weight:700; color:#15803d;">${fmt(f.collected)}</div>
                </div>
            </div>`;
    }).join('') || '<p class="text-muted">No financial data for current month.</p>';

    window._execTeachers = data.teachers;

    setContent(`
        <div class="page-header">
            <h1>📈 Executive Overview</h1>
            <p>School-wide analytics for administration.</p>
        </div>
        <div class="stat-grid" style="margin-bottom:24px;">
            <div class="stat-card" style="background:#f8fafc; border-bottom:3px solid var(--primary);">
                <div class="stat-label">Total Enrollment</div>
                <div class="stat-value">${totalStudents}</div>
            </div>
            <div class="stat-card" style="background:#f8fafc; border-bottom:3px solid #16a34a;">
                <div class="stat-label">Monthly Collection Rate</div>
                <div class="stat-value text-green">${collectionPct}%</div>
            </div>
            <div class="stat-card" style="background:#f8fafc; border-bottom:3px solid #dc2626;">
                <div class="stat-label">Monthly Deficit</div>
                <div class="stat-value text-red">${fmt(totalExpected - totalCollected)}</div>
            </div>
        </div>
        <div class="form-row form-row-2">
            <div class="card mb-24">
                <div class="card-header"><span class="card-title">📊 Demographics (Click a Grade)</span></div>
                <div class="card-body" style="padding:16px 20px;">${demoHtml}</div>
            </div>
            <div class="card mb-24">
                <div class="card-header"><span class="card-title">💰 Financial Health (Click for Arrears)</span></div>
                <div class="card-body">${finHtml}</div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">👨‍🏫 Teacher Workload & Performance</span></div>
            <div class="card-body" style="display:flex; gap:0; flex-wrap:wrap; padding:0;">
                <div style="flex:1; min-width:280px; border-right:1px solid var(--border); background:#fafafa;">
                    ${data.teachers.map((t, idx) => `
                        <div onclick="execShowTeacher(${idx})" style="padding:16px 20px; border-bottom:1px solid var(--border); cursor:pointer; transition:all 0.2s; display:flex; justify-content:space-between; align-items:center;" onmouseover="this.style.background='white'; this.style.paddingLeft='24px';" onmouseout="this.style.background='transparent'; this.style.paddingLeft='20px';">
                            <div>
                                <div style="font-weight:700; color:var(--primary-dark); font-size:14px;">${escHtml(t.name)}</div>
                                <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${t.courses.length} Assigned Course(s)</div>
                            </div>
                            <span style="color:var(--text-light); font-size:12px;">▶</span>
                        </div>
                    `).join('')}
                    ${!data.teachers.length ? '<div style="padding:20px;" class="text-muted">No teachers assigned.</div>' : ''}
                </div>
                <div id="execTeacherDetails" style="flex:2; min-width:300px; padding:24px; background:white;">
                    <div class="empty-state" style="margin-top:20px;"><div class="empty-icon" style="font-size:32px;">👈</div><p>Select a teacher to view details.</p></div>
                </div>
            </div>
        </div>
    `);

    // --- Helper Functions ---
    window.execShowTeacher = (idx) => {
        const t = window._execTeachers[idx];
        const container = document.getElementById('execTeacherDetails');
        let html = `<div style="display:flex; align-items:center; gap:12px; margin-bottom:20px; border-bottom:2px solid var(--primary-light); padding-bottom:12px;"><div class="user-avatar" style="width:48px;height:48px;font-size:20px;">${t.name.charAt(0)}</div><div><h3 style="margin:0; color:var(--text); font-size:18px;">${escHtml(t.name)}</h3><div class="text-sm text-muted">Academic Performance</div></div></div>`;
        html += `<table style="width:100%; font-size:13.5px; border-collapse:collapse;"><thead><tr style="background:#f8fafc; border-bottom:2px solid var(--border);"><th style="padding:12px 10px;text-align:left;">Course</th><th style="padding:12px 10px;text-align:center;">Students</th><th style="padding:12px 10px;text-align:center;">Avg. Grade</th></tr></thead><tbody>`;
        t.courses.forEach(c => {
            const gradeBadge = c.avg !== null ? `<span class="badge ${c.avg >= 75 ? 'badge-green' : c.avg >= 50 ? 'badge-blue' : 'badge-red'}">${c.avg}%</span>` : '<span class="text-muted">N/A</span>';
            html += `<tr><td style="padding:14px 10px; border-bottom:1px solid #f1f5f9;"><strong>${escHtml(c.course)}</strong></td><td style="padding:14px 10px; border-bottom:1px solid #f1f5f9; text-align:center;">${c.students}</td><td style="padding:14px 10px; border-bottom:1px solid #f1f5f9; text-align:center;">${gradeBadge}</td></tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    };

    window.execShowGradeStudents = async (gradeName) => {
        openModal(`Students in ${gradeName}`, '<div class="loading-state"><div class="spinner"></div></div>', 'modal-box-lg');
        try {
            const users = await api('/api/admin/users');
            const students = users.filter(u => u.role === 'student' && (u.grade === gradeName || (gradeName === 'Unassigned' && !u.grade)));
            let html = `<div class="table-wrapper"><table style="width:100%; font-size:13.5px; border-collapse:collapse;"><thead><tr style="background:#f8fafc; border-bottom:2px solid var(--border);"><th style="padding:12px 16px;text-align:left;">Name</th><th style="padding:12px 16px;text-align:left;">Adm No.</th><th style="padding:12px 16px;text-align:center;">Actions</th></tr></thead><tbody>`;
            if (!students.length) html += `<tr><td colspan="3" class="text-center text-muted" style="padding:30px;">No students found.</td></tr>`;
            else {
                students.forEach(s => {
                    html += `<tr onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'"><td style="padding:14px 16px; border-bottom:1px solid #f1f5f9;"><strong>${escHtml(s.full_name)}</strong><br><span class="text-muted text-sm">${escHtml(s.username)}</span></td><td style="padding:14px 16px; border-bottom:1px solid #f1f5f9;">${s.admission_number ? `<code class="adm-number">${escHtml(s.admission_number)}</code>` : '—'}</td><td style="padding:14px 16px; border-bottom:1px solid #f1f5f9; text-align:center;"><div class="flex gap-8 flex-center" style="justify-content:center;"><button class="btn btn-secondary btn-sm" onclick="window.printUserProfile(${s.id})">👤 Profile</button><button class="btn btn-success btn-sm" style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;" onclick="window.openPaymentPortal(${s.id}, '${escHtml(s.full_name)}')">💰 Fees</button><button class="btn btn-secondary btn-sm" onclick="window.printTermReportCard(${s.id}, '${escHtml(s.full_name)}')">📄 Report</button></div></td></tr>`;
                });
            }
            html += `</tbody></table></div>`;
            document.getElementById('modalBody').innerHTML = html;
        } catch (e) { document.getElementById('modalBody').innerHTML = `<div class="alert alert-error">Error: ${e.message}</div>`; }
    };

    window.execShowFinancialDrilldown = async (gradeName) => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        openModal(`Arrears Report: ${gradeName} (${currentMonth})`, '<div class="loading-state"><div class="spinner"></div></div>', 'modal-box-lg');
        try {
            const [users, gradeFees] = await Promise.all([api('/api/admin/users'), api('/api/admin/grade-fees')]);
            const students = users.filter(u => u.role === 'student' && (u.grade === gradeName || (gradeName === 'Unassigned' && !u.grade)));
            const masterFee = gradeFees.find(f => f.grade_name === gradeName)?.monthly_tuition || 0;
            let html = `<div style="display:flex; gap:16px; margin-bottom:20px; background:#f1f5f9; padding:15px; border-radius:10px;"><div style="flex:1; text-align:center; border-right:1px solid #cbd5e1;"><div style="font-size:10px; font-weight:700;">Standard Fee</div><div style="font-size:18px; font-weight:800;">LKR ${masterFee.toLocaleString()}</div></div><div style="flex:1; text-align:center;"><div style="font-size:10px; font-weight:700;">Target Students</div><div style="font-size:18px; font-weight:800;">${students.length}</div></div></div><div class="table-wrapper"><table style="width:100%; font-size:13px; border-collapse:collapse;"><thead><tr style="background:#f8fafc; border-bottom:2px solid var(--border);"><th style="padding:12px 16px; text-align:left;">Student</th><th style="padding:12px 16px; text-align:center;">Status</th><th style="padding:12px 16px; text-align:right;">Action</th></tr></thead><tbody>`;
            
            for (const s of students) {
                const feeData = await api(`/api/admin/students/${s.id}/fees`);
                const paid = feeData.payments.find(p => p.payment_type === 'monthly' && p.fee_month === currentMonth);
                const status = paid ? `<span class="badge badge-green">✅ PAID</span>` : `<span class="badge badge-red">❌ UNPAID</span>`;
                html += `<tr><td style="padding:12px 16px; border-bottom:1px solid #f1f5f9;"><strong>${escHtml(s.full_name)}</strong><br><span style="font-size:11px;">Adm: ${escHtml(s.admission_number || 'N/A')}</span></td><td style="padding:12px 16px; border-bottom:1px solid #f1f5f9; text-align:center;">${status}</td><td style="padding:12px 16px; border-bottom:1px solid #f1f5f9; text-align:right;"><button class="btn btn-success btn-xs" onclick="window.openPaymentPortal(${s.id}, '${escHtml(s.full_name)}')">💰 Record</button></td></tr>`;
            }
            html += `</tbody></table></div>`;
            document.getElementById('modalBody').innerHTML = html;
        } catch (e) { document.getElementById('modalBody').innerHTML = `<div class="alert alert-error">Error: ${e.message}</div>`; }
    };
}

// ================================================================
// SYSTEM AUDIT LOGS (DEDICATED MENU)
// ================================================================

async function loadAuditLogs() {
  setPageTitle('System Audit Logs');
  setActiveSidebar('logs');
  setContent('<div class="loading-state"><div class="spinner"></div></div>');

  const logs = await api('/api/admin/logs').catch(() => []);
  window._allLogs = logs;

  // Extract unique users and actions for the dropdowns
  const uniqueUsers = [...new Set(logs.map(l => l.full_name))].filter(Boolean);
  const uniqueActions = [...new Set(logs.map(l => l.action))].filter(Boolean);

  setContent(`
    <div class="page-header page-header-row">
      <div>
        <h1>🛡️ System Audit Logs</h1>
        <p>Track all administrative and teaching actions across LankaLearn.</p>
      </div>
    </div>

    <div class="card mb-24">
      <div class="card-header" style="background:#fafafa; display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
        <div class="tabs" style="margin:0; border:none; background:transparent; padding:0;">
          <button class="tab-btn active" id="logTab-admin" onclick="switchLogTab('admin')">🔐 Admins & Staff</button>
          <button class="tab-btn" id="logTab-teacher" onclick="switchLogTab('teacher')">👨‍🏫 Teachers</button>
        </div>
        <div style="flex:1"></div>
        <div style="display:flex; gap:8px; align-items:center;">
          <select id="logUserFilter" onchange="filterLogs()" class="form-control" style="min-width:150px; font-size:13px; padding:6px 10px;">
            <option value="all">👥 All Users</option>
            ${uniqueUsers.map(u => `<option value="${escHtml(u)}">${escHtml(u)}</option>`).join('')}
          </select>
          <select id="logActionFilter" onchange="filterLogs()" class="form-control" style="min-width:150px; font-size:13px; padding:6px 10px;">
            <option value="all">⚡ All Actions</option>
            ${uniqueActions.map(a => `<option value="${escHtml(a)}">${escHtml(a)}</option>`).join('')}
          </select>
          <input type="date" id="logDateFilter" onchange="filterLogs()" class="form-control" style="font-size:13px; padding:6px 10px;">
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('logDateFilter').value=''; filterLogs();">Clear Date</button>
        </div>
      </div>
      
      <div class="table-wrapper" style="max-height: 600px; overflow-y: auto;">
        <table style="width:100%; font-size:13px; border-collapse: collapse;">
          <thead style="position:sticky; top:0; background:#f8fafc; z-index:1; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
            <tr>
              <th style="padding:12px; text-align:left;">Date & Time</th>
              <th style="padding:12px; text-align:left;">User</th>
              <th style="padding:12px; text-align:left;">Action</th>
              <th style="padding:12px; text-align:left;">Specific Details</th>
            </tr>
          </thead>
          <tbody id="auditLogsBody">
            <tr><td colspan="4" style="text-align:center; padding:20px;">Loading logs...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `);

  window._currentLogRole = 'admin'; // Default tab

  window.switchLogTab = (roleType) => {
    document.getElementById('logTab-admin').classList.remove('active');
    document.getElementById('logTab-teacher').classList.remove('active');
    document.getElementById(`logTab-${roleType}`).classList.add('active');
    window._currentLogRole = roleType;
    filterLogs();
  };

  window.filterLogs = () => {
    const u = document.getElementById('logUserFilter').value;
    const a = document.getElementById('logActionFilter').value;
    const d = document.getElementById('logDateFilter').value; 

    const filtered = window._allLogs.filter(l => {
      const isTeacherLog = l.role === 'teacher';
      if (window._currentLogRole === 'teacher' && !isTeacherLog) return false;
      if (window._currentLogRole === 'admin' && isTeacherLog) return false;
      const logDate = l.created_at ? l.created_at.split('T')[0].split(' ')[0] : '';
      return (u === 'all' || l.full_name === u) && (a === 'all' || l.action === a) && (!d || logDate === d);
    });

    const tbody = document.getElementById('auditLogsBody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center; padding:30px;">No logs match your filters.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(l => `
      <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
        <td style="white-space:nowrap; color:#64748b; padding:12px;">
          <strong>${new Date(l.created_at).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}</strong><br>
          <span style="font-size:11px;">${new Date(l.created_at).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})}</span>
        </td>
        <td style="padding:12px;">
          <div style="font-weight:600; color:#0f172a;">${escHtml(l.full_name || 'System')}</div>
          <span class="badge ${l.role === 'teacher' ? 'badge-purple' : 'badge-red'}" style="font-size:10px; padding:2px 6px;">${(l.role || 'system').replace('_', ' ')}</span>
        </td>
        <td style="padding:12px;">
          <span style="font-weight:600; color:#1e40af; background:#eff6ff; padding:4px 8px; border-radius:6px; font-size:12px; border:1px solid #bfdbfe;">
            ${escHtml(l.action)}
          </span>
        </td>
        <td style="color:#334155; line-height:1.4; padding:12px;">${escHtml(l.details)}</td>
      </tr>
    `).join('');
  };
  filterLogs();
}

// ================================================================
// USERS SECTION
// ================================================================

async function loadAdminUsers(activeTab) {
  if (!activeTab) {
    const cur = document.querySelector('.tab-panel[style*="display: block"], .tab-panel.active:not([style*="display: none"])');
    activeTab = cur ? cur.id : 'tab-teachers';
  }
  setPageTitle('Users');
  setActiveSidebar('users');
  setContent('<div class="loading-state"><div class="spinner"></div></div>');
  
  const users = await api('/api/admin/users');
  window._adminUsers = users;

  const teachers  = users.filter(u => u.role === 'teacher');
  const students  = users.filter(u => u.role === 'student');
  const admins    = users.filter(u => u.role === 'admin' || u.role === 'super_admin');
  const subAdmins = users.filter(u => u.role === 'sub_admin');

  function teacherTable(list) {
    if (!list.length) return '<p class="text-muted" style="padding:16px">None</p>';
    return `<table><thead><tr><th>Profile</th><th>Details</th><th>Actions</th></tr></thead><tbody>
      ${list.map(u => {
        const isYou = u.id === currentUser.id;
        return `<tr>
          <td><strong>${escHtml(u.full_name)}</strong><br><code>${escHtml(u.username)}</code></td>
          <td>${escHtml(u.phone || '—')}</td>
          <td>
            <div class="flex gap-8 flex-center">
              ${isYou ? '<span class="text-muted">You</span>' : `
                <button class="btn btn-secondary btn-sm" onclick="showEditUser(${u.id},'teacher')">Edit</button>
                <button class="btn btn-secondary btn-sm" onclick="window.printUserProfile(${u.id})" title="Print Profile">🖨️ Profile</button>
                <button class="btn btn-warning btn-sm" onclick="resetUserPassword(${u.id}, '${escHtml(u.full_name)}')">Reset PW</button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id},'${escHtml(u.full_name)}')">Delete</button>
              `}
            </div>
          </td>
        </tr>`}).join('')}
    </tbody></table>`;
  }

  function studentTable(list) {
    if (!list.length) return '<p class="text-muted" style="padding:16px">None</p>';
    return `<table><thead><tr><th>Profile</th><th>Grade</th><th>Actions</th></tr></thead><tbody>
      ${list.map(u => `<tr>
        <td><strong>${escHtml(u.full_name)}</strong><br><code>${escHtml(u.username)}</code></td>
        <td><span class="grade-pill">${escHtml(u.grade || '—')}</span></td>
        <td>
          <div class="flex gap-8 flex-center">
            <button class="btn btn-secondary btn-sm" onclick="showEditUser(${u.id},'student')">Edit</button>
            <button class="btn btn-success btn-sm" style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;" onclick="window.openPaymentPortal(${u.id},'${escHtml(u.full_name)}')">💰 Fees</button>
            <button class="btn btn-secondary btn-sm" onclick="window.printUserProfile(${u.id})" title="Print Profile">🖨️ Profile</button>
            <button class="btn btn-secondary btn-sm" onclick="window.printTermReportCard(${u.id}, '${escHtml(u.full_name)}')">📄 Report</button>
            <button class="btn btn-warning btn-sm" onclick="resetUserPassword(${u.id}, '${escHtml(u.full_name)}')">Reset PW</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id},'${escHtml(u.full_name)}')">Delete</button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
  }

  function adminTable(list, roleLabel) {
    if (!list.length) return '<p class="text-muted" style="padding:16px">None</p>';
    return `<table><thead><tr><th>Name</th><th>Role</th><th>Actions</th></tr></thead><tbody>
      ${list.map(u => {
        const isYou = u.id === currentUser.id;
        return `<tr>
          <td><strong>${escHtml(u.full_name)}</strong><br><code>${escHtml(u.username)}</code></td>
          <td><span class="badge badge-purple">${u.role.replace('_', ' ')}</span></td>
          <td>
            <div class="flex gap-8 flex-center">
              ${isYou ? '<span class="text-muted">You</span>' : `
                <button class="btn btn-secondary btn-sm" onclick="showEditUser(${u.id},'${roleLabel}')">Edit</button>
                <button class="btn btn-secondary btn-sm" onclick="window.printUserProfile(${u.id})" title="Print Profile">🖨️ Profile</button>
                <button class="btn btn-warning btn-sm" onclick="resetUserPassword(${u.id}, '${escHtml(u.full_name)}')">Reset PW</button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id},'${escHtml(u.full_name)}')">Delete</button>
              `}
            </div>
          </td>
        </tr>`}).join('')}
    </tbody></table>`;
  }

  setContent(`
    <div class="page-header page-header-row">
      <div><h1>👥 Users</h1><p>Manage all accounts in the system</p></div>
    </div>

    <div class="tabs">
      <button class="tab-btn" id="tbtn-tab-teachers" onclick="switchTab(this,'tab-teachers')">👨‍🏫 Teachers (${teachers.length})</button>
      <button class="tab-btn" id="tbtn-tab-students" onclick="switchTab(this,'tab-students')">🎒 Students (${students.length})</button>
      <button class="tab-btn" id="tbtn-tab-classes" onclick="switchTab(this,'tab-classes')">🏫 Classes</button>
      <button class="tab-btn" id="tbtn-tab-subadmins" onclick="switchTab(this,'tab-subadmins')">🏢 Office Staff (${subAdmins.length})</button>
      <button class="tab-btn" id="tbtn-tab-admins" onclick="switchTab(this,'tab-admins')">🔐 Admins (${admins.length})</button>
    </div>

    <div id="tab-teachers" class="tab-panel card" style="display:none">
      <div class="card-header" style="background:#fafafa;display:flex;align-items:center;gap:10px;">
        <input type="text" class="search-box" placeholder="🔍 Search teachers…" oninput="filterTeachersSearch()">
        <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="showCreateUser('teacher')">+ Create Teacher</button>
      </div>
      <div class="card-body" style="padding:0">${teacherTable(teachers)}</div>
    </div>

    <div id="tab-students" class="tab-panel card" style="display:none">
      <div class="card-header" style="background:#fafafa;display:flex;align-items:center;gap:10px;">
        <input type="text" class="search-box" placeholder="🔍 Search students…" oninput="filterStudentsSearch()">
        <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="showCreateUser('student')">+ Create Student</button>
      </div>
      <div class="card-body" style="padding:0">${studentTable(students)}</div>
    </div>

    <div id="tab-classes" class="tab-panel card" style="display:none">
      <div class="card-header" style="background:#fafafa;">
        <h3 style="margin:0; font-size:16px;">Class Directory</h3>
        <p class="text-sm text-muted">Students grouped by Grade Level</p>
      </div>
      <div class="card-body" id="classDirectoryBody"></div>
    </div>

    <div id="tab-subadmins" class="tab-panel card" style="display:none">
      <div class="card-header" style="background:#fafafa;display:flex;align-items:center;">
        <h3 style="margin:0; font-size:16px;">Office Staff</h3>
        <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="showCreateUser('sub_admin')">+ Create Staff</button>
      </div>
      <div class="card-body" style="padding:0">${adminTable(subAdmins, 'sub_admin')}</div>
    </div>

    <div id="tab-admins" class="tab-panel card" style="display:none">
      <div class="card-header" style="background:#fafafa;display:flex;align-items:center;">
        <h3 style="margin:0; font-size:16px;">Admins</h3>
        <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="showCreateUser('admin')">+ Create Admin</button>
      </div>
      <div class="card-body" style="padding:0">${adminTable(admins, 'admin')}</div>
    </div>
  `);

  const classGroups = {};
  students.forEach(s => {
    const g = s.grade || 'Unassigned';
    if (!classGroups[g]) classGroups[g] = [];
    classGroups[g].push(s);
  });

  const sortedGrades = Object.keys(classGroups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const classDirEl = document.getElementById('classDirectoryBody');
  if (classDirEl) {
    classDirEl.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; padding: 10px;">
        ${sortedGrades.map(grade => `
          <div class="card" style="cursor:pointer; border:1.5px solid var(--border); transition: all 0.2s;" 
               onclick="window.execShowGradeStudents('${escHtml(grade)}')"
               onmouseover="this.style.transform='translateY(-3px)'; this.style.borderColor='var(--primary)';"
               onmouseout="this.style.transform='none'; this.style.borderColor='var(--border)';">
            <div style="padding:20px; text-align:center;">
              <div style="font-size:24px; margin-bottom:8px;">🏫</div>
              <div style="font-weight:700; color:var(--primary-dark); font-size:15px;">${escHtml(grade)}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${classGroups[grade].length} Students Enrolled</div>
            </div>
            <div style="background:var(--primary-light); padding:8px; text-align:center; font-size:11px; font-weight:700; color:var(--primary);">
              VIEW CLASS LIST
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  const tabToShow = document.getElementById(activeTab) ? activeTab : 'tab-teachers';
  const btnToActivate = document.getElementById('tbtn-' + tabToShow);
  if (btnToActivate) switchTab(btnToActivate, tabToShow);
}

function roleToTab(role) { return { teacher: 'tab-teachers', student: 'tab-students', sub_admin: 'tab-subadmins', admin: 'tab-admins', super_admin: 'tab-admins' }[role] || 'tab-teachers'; }
function switchTab(btn, tabId) {
  btn.closest('.tabs').parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  btn.classList.add('active');
  document.getElementById(tabId).style.display = 'block';
}

function filterTeachersSearch() {
  const q = (document.querySelector('#tab-teachers .search-box')?.value || '').toLowerCase();
  document.querySelectorAll('#tab-teachers tbody tr').forEach(row => { row.style.display = (!q || row.textContent.toLowerCase().includes(q)) ? '' : 'none'; });
}

function filterStudentsSearch() {
  const q = (document.querySelector('#tab-students .search-box')?.value || '').toLowerCase();
  document.querySelectorAll('#tab-students tbody tr').forEach(row => { row.style.display = (!q || row.textContent.toLowerCase().includes(q)) ? '' : 'none'; });
}

const GRADE_OPTIONS = [
  { value: '', label: '— Select Grade —' },
  { value: 'Grade 6', label: 'Grade 6' }, { value: 'Grade 7', label: 'Grade 7' }, { value: 'Grade 8', label: 'Grade 8' },
  { value: 'Grade 9', label: 'Grade 9' }, { value: 'Grade 10', label: 'Grade 10' }, { value: 'Grade 11 (O/L)', label: 'Grade 11 (O/L)' },
  { value: 'Grade 12 (A/L)', label: 'Grade 12 (A/L)' }, { value: 'Grade 13 (A/L)', label: 'Grade 13 (A/L)' },
];

function showCreateUser(role) {
  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
  const gradeField = role === 'student' ? [{ label: 'Grade', name: 'grade', type: 'select', options: GRADE_OPTIONS }] : [];
  const admissionField = role === 'student' ? [{ label: 'Admission Number', name: 'admission_number', placeholder: 'e.g. LL-2026-0001' }] : [];
  openModal(`Create New ${roleTitle}`, modalForm([
    { name: 'role', type: 'hidden', value: role },
    { label: 'Full Name', name: 'full_name', placeholder: 'e.g. Kasun Perera', required: true },
    { label: 'Username', name: 'username', placeholder: 'e.g. kasun.p', required: true },
    { label: 'Password', name: 'password', type: 'password', placeholder: '••••••••', required: true },
    { label: 'Phone Number', name: 'phone', type: 'tel' },
    { label: 'Date of Birth', name: 'dob', type: 'date' },
    { label: 'Address', name: 'address', type: 'textarea' },
    ...gradeField, ...admissionField,
    { label: 'Additional Notes', name: 'notes', type: 'textarea' },
    { label: 'Profile Image', name: 'file', type: 'file' }
  ], async (fd) => {
    try { await apiPost('/api/admin/users', fd); closeModal(); showToast(`${roleTitle} created successfully`, 'success'); loadAdminUsers(roleToTab(role));
    } catch (e) { showToast(e.message, 'error'); }
  }, `Create ${roleTitle}`));
  if (role === 'student') { api('/api/admin/next-admission').then(res => { const field = document.querySelector('[name="admission_number"]'); if (field && !field.value) field.value = res.admission_number; }).catch(() => {}); }
}

function showEditUser(id, roleLabel) {
  const u = window._adminUsers.find(x => x.id === id);
  const roleTitle = roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1);
  const gradeField = roleLabel === 'student' ? [{ label: 'Grade', name: 'grade', type: 'select', value: u.grade || '', options: GRADE_OPTIONS }] : [];
  const admissionField = roleLabel === 'student' ? [{ label: 'Admission Number', name: 'admission_number', value: u.admission_number || '' }] : [];
  openModal(`Edit ${roleTitle}: ${u.full_name}`, modalForm([
    { label: 'Full Name', name: 'full_name', value: u.full_name, required: true },
    { label: 'Username', name: 'username', value: u.username, required: true },
    { label: 'New Password (Leave blank to keep current)', name: 'password', type: 'password', placeholder: '••••••••' },
    { label: 'Phone Number', name: 'phone', type: 'tel', value: u.phone || '' },
    { label: 'Date of Birth', name: 'dob', type: 'date', value: u.dob || '' },
    { label: 'Address', name: 'address', type: 'textarea', value: u.address || '' },
    { label: 'Additional Notes', name: 'notes', type: 'textarea', value: u.notes || '' },
    ...gradeField, ...admissionField,
    { label: 'Update Profile Image', name: 'file', type: 'file' }
  ], async (fd) => {
    try { await api(`/api/admin/users/${id}`, { method: 'PUT', body: fd }); closeModal(); showToast('User updated!', 'success'); loadAdminUsers(roleToTab(roleLabel));
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Save Changes'));
}

async function deleteUser(id, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  const cur = document.querySelector('.tab-panel[style*="display: block"], .tab-panel.active:not([style*="display: none"])');
  try { await apiDelete(`/api/admin/users/${id}`); showToast('User deleted', 'success'); loadAdminUsers(cur ? cur.id : 'tab-teachers'); } catch (e) { showToast(e.message, 'error'); }
}

// ================================================================
// COURSES SECTION
// ================================================================

async function loadAdminCourses() {
  setPageTitle('Courses');
  setActiveSidebar('courses');
  setContent('<div class="loading-state"><div class="spinner"></div></div>');

  const [courses, teachers] = await Promise.all([api('/api/admin/courses'), api('/api/admin/teachers')]);
  window._adminCourses = courses; window._adminTeachers = teachers;

  setContent(`
    <div class="page-header page-header-row"><div><h1>📚 Courses</h1><p>Create and manage all courses</p></div><button class="btn btn-primary" onclick="showCreateCourse()">+ Create Course</button></div>
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
    { label: 'Teacher', name: 'teacher_id', type: 'select', value: c.teacher_id, required: true, options: teachers.map(t => ({ value: t.id, label: t.full_name })) },
  ], async (fd) => {
    try { await api(`/api/admin/courses/${id}`, { method: 'PUT', body: fd }); closeModal(); showToast('Course updated!', 'success'); loadAdminCourses();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Save Changes'));
}

function showCreateCourse() {
  const teachers = window._adminTeachers || [];
  openModal('Create New Course', modalForm([
    { label: 'Course Code', name: 'code', placeholder: 'e.g. OL-MATH-11', required: true },
    { label: 'Course Name', name: 'name', placeholder: 'e.g. O/L Mathematics', required: true },
    { label: 'Description', name: 'description', type: 'textarea' },
    { label: 'Start Date', name: 'start_date', type: 'date', required: true },
    { label: 'End Date', name: 'end_date', type: 'date', required: true },
    { label: 'Teacher', name: 'teacher_id', type: 'select', required: true, options: teachers.map(t => ({ value: t.id, label: t.full_name })) },
  ], async (fd) => {
    try { await apiPost('/api/admin/courses', fd); closeModal(); showToast('Course created!', 'success'); loadAdminCourses();
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Create Course'));
}

async function deleteCourse(id, name) {
  if (!confirm(`Delete course "${name}"? This cannot be undone.`)) return;
  try { await apiDelete(`/api/admin/courses/${id}`); showToast('Course deleted', 'success'); loadAdminCourses(); } catch (e) { showToast(e.message, 'error'); }
}

async function manageEnrollments(courseId, courseName) {
  const data = await api(`/api/admin/courses/${courseId}/students`);
  let html = `
    <div style="display:flex; gap:20px; align-items:flex-start;">
      <div style="flex:1; border:1px solid var(--border); border-radius:8px; padding:16px; background:#fafafa;">
        <div style="display:flex; justify-content:space-between; margin-bottom:12px;"><h4 style="margin:0">Enrolled (${data.enrolled.length})</h4><button class="btn btn-danger btn-xs" onclick="bulkUnenroll(${courseId})">Remove Selected</button></div>
        <div style="max-height:300px; overflow-y:auto; border:1px solid #e2e8f0; background:white;">
          <table style="width:100%; font-size:13px;"><thead style="position:sticky; top:0; background:#f8fafc; z-index:1;"><tr><th style="padding:8px"><input type="checkbox" onchange="document.querySelectorAll('.unenroll-chk').forEach(c => c.checked = this.checked)"></th><th style="padding:8px">Student</th></tr></thead>
          <tbody>${data.enrolled.map(s => `<tr><td style="padding:8px; border-bottom:1px solid #eee;"><input type="checkbox" class="unenroll-chk" value="${s.id}"></td><td style="padding:8px; border-bottom:1px solid #eee;">${escHtml(s.full_name)} <span class="text-muted">(${s.username})</span></td></tr>`).join('')}</tbody></table>
        </div>
      </div>
      <div style="flex:1; border:1px solid var(--border); border-radius:8px; padding:16px; background:#fafafa;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"><h4 style="margin:0">Add Students</h4><button class="btn btn-primary btn-xs" onclick="bulkEnroll(${courseId})">+ Enroll Selected</button></div>
        <input type="text" id="addStudentSearch" class="form-control mb-8" style="padding:6px; font-size:12px;" placeholder="Search name..." oninput="filterAddStudents()">
        <div style="max-height:265px; overflow-y:auto; border:1px solid #e2e8f0; background:white;">
          <table style="width:100%; font-size:13px;" id="addStudentsTable"><thead style="position:sticky; top:0; background:#f8fafc; z-index:1;"><tr><th style="padding:8px"><input type="checkbox" onchange="document.querySelectorAll('.enroll-chk:not([style*=\\'display: none\\'])').forEach(c => c.checked = this.checked)"></th><th style="padding:8px">Available</th></tr></thead>
          <tbody>${data.available.map(s => `<tr><td style="padding:8px; border-bottom:1px solid #eee;"><input type="checkbox" class="enroll-chk" value="${s.id}"></td><td style="padding:8px; border-bottom:1px solid #eee;" class="stu-name">${escHtml(s.full_name)}</td></tr>`).join('')}</tbody></table>
        </div>
      </div>
    </div>`;
  window.filterAddStudents = () => { const q = document.getElementById('addStudentSearch').value.toLowerCase(); document.querySelectorAll('#addStudentsTable tbody tr').forEach(row => { row.style.display = row.querySelector('.stu-name').textContent.toLowerCase().includes(q) ? '' : 'none'; if(row.style.display === 'none') row.querySelector('.enroll-chk').checked = false; }); };
  window.bulkEnroll = async (cid) => { const ids = Array.from(document.querySelectorAll('.enroll-chk:checked')).map(c => parseInt(c.value)); if(!ids.length) return; await apiJSON(`/api/admin/courses/${cid}/enroll/bulk`, { student_ids: ids }); manageEnrollments(cid, courseName); };
  window.bulkUnenroll = async (cid) => { const ids = Array.from(document.querySelectorAll('.unenroll-chk:checked')).map(c => parseInt(c.value)); if(!ids.length) return; await apiJSON(`/api/admin/courses/${cid}/unenroll/bulk`, { student_ids: ids }); manageEnrollments(cid, courseName); };
  openModal(`Students — ${courseName}`, html, 'modal-box-lg');
}

// ================================================================
// HYBRID DIRECT PAYMENT FEES
// ================================================================

async function loadAdminFees() {
  setPageTitle('Fee Management');
  setActiveSidebar('fees');
  setContent('<div class="loading-state"><div class="spinner"></div></div>');
  
  const [users, gradeFees] = await Promise.all([
    api('/api/admin/users'),
    api('/api/admin/grade-fees')
  ]);
  
  const students = users.filter(u => u.role === 'student');
  window._currentGradeFees = gradeFees; // Store for quick lookups
  
  // Re-use your existing GRADE_OPTIONS from the Users tab
  const gradeOptionsHtml = GRADE_OPTIONS.filter(g => g.value !== '').map(g => 
      `<option value="${escHtml(g.value)}">${escHtml(g.label)}</option>`
  ).join('');
  
  setContent(`
    <div class="page-header page-header-row">
      <div style="display:flex; justify-content:space-between; width:100%;">
        <div><h1>💰 Fee Portal</h1><p>Record payments and set grade fees.</p></div>
      </div>
    </div>

    <div class="card mb-24">
      <div class="card-header" style="cursor:pointer;" onclick="document.getElementById('masterFeesBody').style.display = document.getElementById('masterFeesBody').style.display === 'none' ? 'block' : 'none'">
        <span class="card-title">⚙️ Master Grade Fees (Click to Expand/Collapse)</span>
      </div>
      <div class="card-body" id="masterFeesBody" style="display:none;">
        <table style="width:100%; font-size:13px; margin-bottom:16px;">
          <thead><tr>
            <th style="text-align:left; padding-bottom:8px;">Grade</th>
            <th style="text-align:right; padding-bottom:8px;">Monthly Tuition (LKR)</th>
            <th style="text-align:right; padding-bottom:8px;">Action</th>
          </tr></thead>
          <tbody>
            ${gradeFees.map(f => `<tr>
              <td style="padding:6px 0; border-top:1px solid #eee;"><strong>${escHtml(f.grade_name)}</strong></td>
              <td style="text-align:right; padding:6px 0; border-top:1px solid #eee;">${f.monthly_tuition.toLocaleString()}</td>
              <td style="text-align:right; padding:6px 0; border-top:1px solid #eee;">
                <button class="btn btn-secondary btn-xs" onclick="editMasterFee('${escHtml(f.grade_name)}', ${f.monthly_tuition})">Edit</button>
                <button class="btn btn-danger btn-xs" onclick="deleteMasterFee('${escHtml(f.grade_name)}')">✕</button>
              </td>
            </tr>`).join('')}
            ${!gradeFees.length ? '<tr><td colspan="3" class="text-muted text-center" style="padding:10px;">No master fees set.</td></tr>' : ''}
          </tbody>
        </table>
        
        <div style="display:flex; gap:8px; align-items:center; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid var(--border);">
          <select id="newGradeName" class="form-control" onchange="autoFillMasterFee(this.value)">
             <option value="">-- Select Grade --</option>
             ${gradeOptionsHtml}
          </select>
          <input type="number" id="newGradeFee" class="form-control" placeholder="Amount (LKR)">
          <button class="btn btn-primary" onclick="saveMasterGradeFee()">Save Fee</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="background:#fafafa;">
        <span class="card-title">Select Student to Record Payment</span>
        <input type="text" id="feeStudentSearch" class="search-box" style="float:right;" placeholder="🔍 Search student..." oninput="filterFeeStudents()">
      </div>
      <div class="table-wrapper">
        <table id="feeStudentsTable">
          <thead><tr><th>Student</th><th>Admission No.</th><th>Grade</th><th>Actions</th></tr></thead>
          <tbody>
            ${students.map(s => `
              <tr>
                <td><strong>${escHtml(s.full_name)}</strong><br><code class="text-muted">${escHtml(s.username)}</code></td>
                <td>${s.admission_number ? `<code class="adm-number">${escHtml(s.admission_number)}</code>` : '—'}</td>
                <td><span class="grade-pill">${escHtml(s.grade || 'Unassigned')}</span></td>
                <td><button class="btn btn-success btn-sm" onclick="window.openPaymentPortal(${s.id},'${escHtml(s.full_name)}')">Open Portal</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);
  
  window.filterFeeStudents = () => {
    const q = document.getElementById('feeStudentSearch').value.toLowerCase();
    document.querySelectorAll('#feeStudentsTable tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  };
}

window.editMasterFee = (gradeName, amount) => {
    document.getElementById('newGradeName').value = gradeName;
    document.getElementById('newGradeFee').value = amount;
    document.getElementById('newGradeFee').focus();
};

window.autoFillMasterFee = (gradeName) => {
    const feeRecord = window._currentGradeFees.find(f => f.grade_name === gradeName);
    if (feeRecord) {
        document.getElementById('newGradeFee').value = feeRecord.monthly_tuition;
    } else {
        document.getElementById('newGradeFee').value = '';
    }
};

window.saveMasterGradeFee = async () => {
  const grade = document.getElementById('newGradeName').value;
  const amount = document.getElementById('newGradeFee').value;
  if(!grade || !amount) return showToast("Select a grade and enter an amount", "error");
  
  const fd = new FormData(); 
  fd.append('grade_name', grade); 
  fd.append('monthly_tuition', amount);
  
  try {
      await apiPost('/api/admin/grade-fees', fd); 
      showToast("Fee updated!", "success"); 
      loadAdminFees();
  } catch(e) { showToast(e.message, "error"); }
};

window.deleteMasterFee = async (gradeName) => {
    if (!confirm(`Are you sure you want to delete the master fee for ${gradeName}?`)) return;
    try {
        await apiDelete(`/api/admin/grade-fees/${encodeURIComponent(gradeName)}`);
        showToast("Master fee deleted", "success");
        loadAdminFees();
    } catch (e) { showToast(e.message, "error"); }
};

window.openPaymentPortal = async (sid, name) => {
    openModal(`Payment Portal — ${name}`, '<div class="loading-state"><div class="spinner"></div></div>', 'modal-box-lg');
    const data = await api(`/api/admin/students/${sid}/fees`);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = new Date().toISOString().split('T')[0];
    
    // Auto-fill amount based on master fee
    const autoAmount = data.master_fee > 0 ? data.master_fee : '';
    
    let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div><strong>Grade:</strong> <span class="grade-pill">${escHtml(data.student.grade || 'Unassigned')}</span></div>
      <div><strong>Standard Monthly Fee:</strong> <span class="badge badge-blue">LKR ${data.master_fee.toLocaleString()}</span></div>
    </div>

    <div style="background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:16px; margin-bottom:24px;">
      <h4 style="margin-top:0; margin-bottom:12px;">Record New Payment</h4>
      <div class="form-row form-row-2">
        <div class="form-group">
          <label>Payment Type</label>
          <select id="payType" class="form-control" onchange="togglePayFields(${data.master_fee})">
            <option value="monthly">Monthly Tuition</option>
            <option value="extra">Other / Extra Fee</option>
          </select>
        </div>
        <div class="form-group" id="payMonthWrap">
          <label>Which Month?</label>
          <input type="month" id="payMonth" class="form-control" value="${currentMonth}">
        </div>
        <div class="form-group" id="payDescWrap" style="display:none;">
          <label>Description</label>
          <input type="text" id="payDesc" class="form-control" placeholder="e.g. Exam Fee, Uniform">
        </div>
      </div>
      <div class="form-row form-row-3">
        <div class="form-group">
          <label>Amount (LKR)</label>
          <input type="number" id="payAmount" class="form-control" value="${autoAmount}" required>
        </div>
        <div class="form-group"><label>Date</label><input type="date" id="payDate" class="form-control" value="${today}"></div>
        <div class="form-group"><label>Receipt #</label><input type="text" id="payReceipt" class="form-control" placeholder="Optional"></div>
      </div>
      <button class="btn btn-primary w-full" onclick="processDirectPayment(${sid})">Submit Payment</button>
    </div>

    <h4>Payment History</h4>
    <table style="width:100%; font-size:13px; border-collapse:collapse;">
        <thead><tr style="background:#f8fafc; border-bottom:2px solid #ddd;"><th style="padding:8px;text-align:left;">Date</th><th style="padding:8px;text-align:left;">Details</th><th style="padding:8px;text-align:right;">Amount</th><th style="padding:8px;text-align:center;">Action</th></tr></thead>
        <tbody>`;
        
    data.payments.forEach(p => {
        const details = p.payment_type === 'monthly' ? `<span class="badge badge-blue">Monthly: ${p.fee_month}</span>` : `<span class="badge badge-purple">Other: ${p.payment_for}</span>`;
        html += `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${p.paid_date}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${details}<br><span class="text-muted text-sm">Cashier: ${escHtml(p.recorded_by_name || 'Admin')}</span></td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;"><strong>LKR ${p.amount.toLocaleString()}</strong></td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">
                <button class="btn btn-secondary btn-xs" onclick="window.printPaymentReceipt(${p.id}, ${sid})" title="Print Receipt">🖨️</button>
                <button class="btn btn-danger btn-xs" onclick="deletePayment(${p.id}, ${sid})">✕</button>
            </td>
        </tr>`;
    });
    if(!data.payments.length) html += '<tr><td colspan="4" class="text-muted text-center" style="padding:10px;">No payments recorded.</td></tr>';
    html += `</tbody></table>`;
    
    document.getElementById('modalBody').innerHTML = html;
};

// UI Toggle Logic
window.togglePayFields = (masterFee) => {
    const type = document.getElementById('payType').value;
    if (type === 'monthly') {
        document.getElementById('payMonthWrap').style.display = 'block';
        document.getElementById('payDescWrap').style.display = 'none';
        document.getElementById('payAmount').value = masterFee > 0 ? masterFee : '';
    } else {
        document.getElementById('payMonthWrap').style.display = 'none';
        document.getElementById('payDescWrap').style.display = 'block';
        document.getElementById('payAmount').value = '';
    }
};

window.processDirectPayment = async (sid) => {
    const type = document.getElementById('payType').value;
    const amount = document.getElementById('payAmount').value;
    const date = document.getElementById('payDate').value;
    const receipt = document.getElementById('payReceipt').value;
    
    const fd = new FormData();
    fd.append('amount', amount);
    fd.append('paid_date', date);
    fd.append('receipt_number', receipt);
    fd.append('payment_type', type);
    
    if (type === 'monthly') {
        const monthVal = document.getElementById('payMonth').value;
        if (!monthVal) return showToast('Please select a month', 'error');
        fd.append('fee_month', monthVal);
        fd.append('payment_for', 'Monthly Tuition');
    } else {
        const descVal = document.getElementById('payDesc').value;
        if (!descVal) return showToast('Please enter a description', 'error');
        fd.append('payment_for', descVal);
        fd.append('fee_month', '');
    }

    try {
        await apiPost(`/api/admin/students/${sid}/fee-payments`, fd);
        showToast('Payment recorded successfully!', 'success');
        window.openPaymentPortal(sid, document.getElementById('modalTitle').textContent.split(' — ')[1]);
    } catch(e) { showToast(e.message, 'error'); }
};

window.deletePayment = async (pid, sid) => {
    if(!confirm("Delete this payment record permanently?")) return;
    try {
        await apiDelete(`/api/admin/fee-payments/${pid}`);
        showToast('Deleted', 'success');
        window.openPaymentPortal(sid, document.getElementById('modalTitle').textContent.split(' — ')[1]);
    } catch(e) { showToast(e.message, 'error'); }
};

// ================================================================
// GLOBAL PRINTING HELPERS
// ================================================================

window.printTermReportCard = async (studentId, studentName) => {
    // Open a blank window immediately to prevent pop-up blockers
    const win = window.open('', '_blank');
    win.document.write('<div style="font-family:sans-serif; padding:40px;"><h2>Generating official report card...</h2></div>');
    
    try {
        // Fetch the real data from the database
        const data = await api(`/api/admin/students/${studentId}/report-card`);
        const today = new Date().toLocaleDateString('en-LK', { year:'numeric', month:'long', day:'numeric' });
        
        let rowsHtml = '';
        if (data.results.length === 0) {
            rowsHtml = '<tr><td colspan="3" style="padding:20px; color:#666;">Student is not currently enrolled in any courses.</td></tr>';
        } else {
            rowsHtml = data.results.map(r => `
                <tr>
                    <td class="subject-name">${escHtml(r.course_name)}</td>
                    <td>${r.percentage !== null ? `<strong>${r.percentage}%</strong>` : '<span style="color:#999">—</span>'}</td>
                    <td>${r.remarks}</td>
                </tr>
            `).join('');
        }
        
        const finalHtml = `<!DOCTYPE html><html><head>
            <title>Term Report — ${escHtml(studentName)}</title>
            <style>
                body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; max-width: 800px; margin: 0 auto; }
                .school-header { text-align: center; border-bottom: 4px double #800000; padding-bottom: 20px; margin-bottom: 30px; }
                .school-header h1 { color: #800000; font-size: 32px; margin: 0; text-transform: uppercase; letter-spacing: 2px;}
                .school-header h3 { color: #555; margin: 5px 0 0 0; font-weight: normal; }
                .student-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 30px; border: 1px solid #000; padding: 15px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { border: 1px solid #000; padding: 10px; text-align: center; }
                th { background-color: #f0f0f0; text-transform: uppercase; font-size: 12px; }
                td.subject-name { text-align: left; font-weight: bold; }
                .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
                .sig-line { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; font-size: 14px; }
            </style>
        </head><body>
            <div class="school-header">
                <h1>Wesswood International College</h1>
                <h3>Official End-of-Term Academic Report</h3>
                <p>Term 1 - ${new Date().getFullYear()}</p>
            </div>
            <div class="student-details">
                <div><strong>Student Name:</strong> ${escHtml(data.student.full_name)}</div>
                <div><strong>Admission No:</strong> ${escHtml(data.student.admission_number || 'N/A')}</div>
                <div><strong>Grade:</strong> ${escHtml(data.student.grade || 'N/A')}</div>
                <div><strong>Date Issued:</strong> ${today}</div>
            </div>
            <table>
                <thead><tr><th style="width: 50%;">Subject</th><th>Term Grade</th><th>Remarks</th></tr></thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
            <div class="signatures">
                <div class="sig-line">Class Teacher</div>
                <div class="sig-line">Principal</div>
            </div>
            <script>
                // Slight delay to ensure fonts render before the print dialog opens
                setTimeout(() => { window.print(); }, 300);
            </script>
        </body></html>`;
        
        // Write the final HTML over the loading message
        win.document.open();
        win.document.write(finalHtml);
        win.document.close();
        
    } catch(e) {
        win.document.body.innerHTML = `<div style="font-family:sans-serif; padding:40px; color:red;">
            <h2>Failed to load report card</h2>
            <p>${escHtml(e.message)}</p>
        </div>`;
    }
};

window.printPaymentReceipt = async (pid, sid) => {
    const data = await api(`/api/admin/students/${sid}/fees`);
    const p = data.payments.find(x => x.id === pid);
    if(!p) return;
    
    const win = window.open('', '_blank');
    const displayType = p.payment_type === 'monthly' ? `Monthly Fee (${p.fee_month})` : p.payment_for;
    
    win.document.write(`
        <html><head><title>Receipt - ${p.receipt_number || p.id}</title>
        <style>
            body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; }
            .receipt-box { border: 1px solid #000; padding: 30px; max-width: 450px; margin: 0 auto; border-radius: 8px; }
            .school-name { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 5px; color: #1e3a8a; font-family: Arial, sans-serif; }
            .header-title { text-align: center; text-decoration: underline; margin-bottom: 20px; font-family: Arial, sans-serif; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px; }
            .row span:first-child { font-weight: bold; }
            hr { border-top: 1px dashed #ccc; margin: 20px 0; }
        </style>
        </head><body>
        <div class="receipt-box">
            <div class="school-name">Wesswood International College</div>
            <div class="header-title">OFFICIAL PAYMENT RECEIPT</div>
            
            <div class="row"><span>Receipt No:</span> <span>${p.receipt_number || 'SYS-' + p.id}</span></div>
            <div class="row"><span>Date:</span> <span>${p.paid_date}</span></div>
            <hr>
            <div class="row"><span>Student Name:</span> <span>${escHtml(data.student.full_name)}</span></div>
            <div class="row"><span>Admission No:</span> <span>${escHtml(data.student.admission_number || 'N/A')}</span></div>
            <div class="row"><span>Payment For:</span> <span>${escHtml(displayType)}</span></div>
            <hr>
            <div class="row" style="font-size: 18px;"><span>Total Paid:</span> <span>LKR ${p.amount.toLocaleString()}</span></div>
            <hr>
            <div class="row"><span>Cashier:</span> <span>${escHtml(p.recorded_by_name || 'Admin')}</span></div>
            
            <div style="text-align:center; font-size:13px; margin-top:30px; color:#555;">
                Thank you for your payment.<br>This is a computer-generated receipt.
            </div>
        </div>
        <script>window.onload=()=>window.print()</script></body></html>
    `);
    win.document.close();
};

window.printUserProfile = (uid) => {
  const u = window._adminUsers.find(x => x.id === uid);
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Profile - ${u.full_name}</title>
    <style>body{font-family:Arial; padding:40px; line-height:1.6;} .box{border:1px solid #ccc; padding:20px; border-radius:8px;}</style>
    </head><body>
    <h2>🎓 LankaLearn User Profile</h2><div class="box">
    <p><strong>Name:</strong> ${u.full_name}</p>
    <p><strong>Username:</strong> ${u.username}</p>
    <p><strong>Role:</strong> <span style="text-transform:uppercase">${u.role}</span></p>
    <p><strong>Phone:</strong> ${u.phone || 'N/A'}</p>
    <p><strong>DOB:</strong> ${u.dob || 'N/A'}</p>
    <p><strong>Address:</strong> ${u.address || 'N/A'}</p>
    ${u.role === 'student' ? `<p><strong>Grade:</strong> ${u.grade || 'N/A'}</p><p><strong>Adm. No:</strong> ${u.admission_number || 'N/A'}</p>` : ''}
    <p><strong>Internal Notes:</strong> ${u.notes || 'None'}</p>
    </div><script>window.onload=()=>window.print()</script></body></html>
  `);
  win.document.close();
};

window.printMasterFeeReport = async () => {
  const users = await api('/api/admin/users');
  const students = users.filter(u => u.role === 'student');
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Master Fee Report</title>
    <style>body{font-family:Arial; padding:20px;} table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px;} th,td{padding:8px;border:1px solid #ddd;text-align:left;} th{background:#1e3a8a;color:white;}</style>
    </head><body><h2>💰 LankaLearn - Master Student List</h2>
    <table><tr><th>Student Name</th><th>Adm. No</th><th>Grade</th><th>Contact</th></tr>
    ${students.map(s => `<tr><td>${s.full_name}</td><td>${s.admission_number||'-'}</td><td>${s.grade||'-'}</td><td>${s.phone||'-'}</td></tr>`).join('')}
    </table><script>window.onload=()=>window.print()</script></body></html>`);
  win.document.close();
};

// ================================================================
// MISC & UTILS
// ================================================================

function roleBadge(role) {
  if (role === 'admin' || role === 'super_admin') return 'badge-red';
  if (role === 'sub_admin') return 'badge-blue';
  if (role === 'teacher') return 'badge-purple';
  return 'badge-blue'; 
}

async function resetUserPassword(uid, name) {
    if (!confirm(`Reset password for ${name}? This will generate a new temporary password.`)) return;
    try {
        const res = await apiPost(`/api/admin/users/${uid}/reset-password`);
        openModal('Password Reset Successful', `
            <div class="alert alert-success">
                <strong>Temporary Password for ${escHtml(name)}:</strong><br>
                <code style="font-size:24px; display:block; margin:10px 0;">${res.temp_password}</code>
                Please copy this and give it to the user. They will be forced to change it upon login.
            </div>
            <button class="btn btn-primary w-full" onclick="closeModal()">Done</button>
        `);
    } catch (e) { showToast(e.message, 'error'); }
}

window.showBroadcastModal = () => {
  openModal('Send School-Wide Alert', modalForm([
    { label: 'Alert Title', name: 'title', placeholder: 'e.g. Unexpected School Closure', required: true },
    { label: 'Message', name: 'message', type: 'textarea', placeholder: 'Details of the announcement...', required: true },
    { label: 'Target Audience', name: 'target', type: 'select', options: [
        {value: 'all', label: 'Everyone'},
        {value: 'students', label: 'Students Only'},
        {value: 'teachers', label: 'Teachers Only'}
    ]},
    { label: 'Expires In (Hours)', name: 'hours', type: 'number', value: '24', required: true }
  ], async (fd) => {
    try {
      await apiPost('/api/admin/broadcasts', fd);
      closeModal();
      showToast('Broadcast sent!', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) { 
      showToast(e.message, 'error'); 
    }
  }, 'Send Alert'));
};

window.clearActiveBroadcast = async () => {
  if (!confirm("Are you sure you want to remove the active alert for all users?")) return;
  
  try {
    await apiDelete('/api/admin/broadcasts/active');
    
    const firstElement = document.body.firstElementChild;
    if (firstElement && firstElement.innerHTML.includes('🚨')) {
        firstElement.style.display = 'none';
        document.querySelector('.top-header').style.top = '0px';
        document.querySelector('.sidebar').style.top = '64px';
    }
    
    showToast('Active alert cleared successfully!', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
};


// ================================================================
// GLOBAL HELPERS
// ================================================================

// ================================================================
// GLOBAL HELPERS
// ================================================================

window.execShowGradeStudents = async (gradeName) => {
    openModal(`Students in ${gradeName}`, '<div class="loading-state"><div class="spinner"></div></div>', 'modal-box-lg');
    try {
        const users = await api('/api/admin/users');
        const students = users.filter(u => u.role === 'student' && (u.grade === gradeName || (gradeName === 'Unassigned' && !u.grade)));
        
        // Add the new Top Bar with Search and Print All buttons
        let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding:10px; background:#f8fafc; border-radius:8px; border:1px solid var(--border);">
            <div style="display:flex; align-items:center; gap:8px; flex:1;">
                <span style="font-size:16px;">🔍</span>
                <input type="text" id="classStudentSearch" class="form-control" placeholder="Search name or admission number..." style="max-width:300px; margin:0;" oninput="filterClassStudents()">
            </div>
            <button class="btn btn-primary" onclick="window.printClassReportCards('${escHtml(gradeName)}')">🖨️ Print All Reports</button>
        </div>
        
        <div class="table-wrapper">
            <table id="classStudentsTable" style="width:100%; font-size:13.5px; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid var(--border);">
                        <th style="padding:12px 16px;text-align:left;">Name</th>
                        <th style="padding:12px 16px;text-align:left;">Adm No.</th>
                        <th style="padding:12px 16px;text-align:center;">Actions</th>
                    </tr>
                </thead>
                <tbody>`;
        
        if (!students.length) {
            html += `<tr><td colspan="3" class="text-center text-muted" style="padding:30px;">No students found.</td></tr>`;
        } else {
            students.forEach(s => {
                html += `<tr class="class-student-row" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:14px 16px; border-bottom:1px solid #f1f5f9;">
                        <strong class="cs-name">${escHtml(s.full_name)}</strong><br>
                        <span class="text-muted text-sm cs-username">${escHtml(s.username)}</span>
                    </td>
                    <td style="padding:14px 16px; border-bottom:1px solid #f1f5f9;" class="cs-adm">
                        ${s.admission_number ? `<code class="adm-number">${escHtml(s.admission_number)}</code>` : '—'}
                    </td>
                    <td style="padding:14px 16px; border-bottom:1px solid #f1f5f9; text-align:center;">
                        <div class="flex gap-8 flex-center" style="justify-content:center;">
                            <button class="btn btn-secondary btn-sm" onclick="window.printUserProfile(${s.id})">👤 Profile</button>
                            <button class="btn btn-success btn-sm" style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;" onclick="window.openPaymentPortal(${s.id}, '${escHtml(s.full_name)}')">💰 Fees</button>
                            <button class="btn btn-secondary btn-sm" onclick="window.printTermReportCard(${s.id}, '${escHtml(s.full_name)}')">📄 Report</button>
                        </div>
                    </td>
                </tr>`;
            });
        }
        
        html += `</tbody></table></div>`;
        document.getElementById('modalBody').innerHTML = html;

        // Make the search logic available globally to filter rows
        window.filterClassStudents = () => {
            const q = document.getElementById('classStudentSearch').value.toLowerCase();
            document.querySelectorAll('.class-student-row').forEach(row => {
                const name = row.querySelector('.cs-name')?.textContent.toLowerCase() || '';
                const adm = row.querySelector('.cs-adm')?.textContent.toLowerCase() || '';
                if (name.includes(q) || adm.includes(q)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        };

    } catch (e) { document.getElementById('modalBody').innerHTML = `<div class="alert alert-error">Error: ${e.message}</div>`; }
};

window.printClassReportCards = async (gradeName) => {
    // Visual feedback so the user knows the system is working
    const btn = document.querySelector('#modalBody .btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Generating...';
    btn.disabled = true;

    try {
        // Fetch all students for this grade
        const users = await api('/api/admin/users');
        const students = users.filter(u => u.role === 'student' && (u.grade === gradeName || (gradeName === 'Unassigned' && !u.grade)));
        
        if (!students.length) {
            showToast('No students available to print.', 'error');
            btn.innerHTML = originalText; btn.disabled = false;
            return;
        }

        // Fetch all their report cards concurrently for speed
        const reportPromises = students.map(s => api(`/api/admin/students/${s.id}/report-card`).then(res => ({ student: s, data: res })).catch(() => ({ student: s, error: true })));
        const reports = await Promise.all(reportPromises);

        const today = new Date().toLocaleDateString('en-LK', { year:'numeric', month:'long', day:'numeric' });
        
        let combinedHtml = `<!DOCTYPE html><html><head>
            <title>Class Reports — ${escHtml(gradeName)}</title>
            <style>
                body { font-family: 'Times New Roman', serif; padding: 0; color: #000; margin: 0; background: #525659; }
                /* Create physical page breaks between each student's report */
                .report-page { padding: 40px; max-width: 800px; margin: 20px auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.5); page-break-after: always; }
                .report-page:last-child { page-break-after: auto; }
                .school-header { text-align: center; border-bottom: 4px double #800000; padding-bottom: 20px; margin-bottom: 30px; }
                .school-header h1 { color: #800000; font-size: 32px; margin: 0; text-transform: uppercase; letter-spacing: 2px;}
                .school-header h3 { color: #555; margin: 5px 0 0 0; font-weight: normal; }
                .student-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 30px; border: 1px solid #000; padding: 15px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { border: 1px solid #000; padding: 10px; text-align: center; }
                th { background-color: #f0f0f0; text-transform: uppercase; font-size: 12px; }
                td.subject-name { text-align: left; font-weight: bold; }
                .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
                .sig-line { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; font-size: 14px; }
                
                @media print {
                    body { background: white; }
                    .report-page { margin: 0; box-shadow: none; border: none; }
                }
            </style>
        </head><body>`;

        reports.forEach(r => {
            if (r.error) {
                combinedHtml += `<div class="report-page"><h2 style="color:red; text-align:center;">Failed to generate report for ${escHtml(r.student.full_name)}</h2></div>`;
                return;
            }
            
            let rowsHtml = '';
            if (r.data.results.length === 0) {
                rowsHtml = '<tr><td colspan="3" style="padding:20px; color:#666;">Student is not currently enrolled in any courses.</td></tr>';
            } else {
                rowsHtml = r.data.results.map(res => `
                    <tr>
                        <td class="subject-name">${escHtml(res.course_name)}</td>
                        <td>${res.percentage !== null ? `<strong>${res.percentage}%</strong>` : '<span style="color:#999">—</span>'}</td>
                        <td>${res.remarks}</td>
                    </tr>
                `).join('');
            }

            combinedHtml += `
            <div class="report-page">
                <div class="school-header">
                    <h1>Wesswood International College</h1>
                    <h3>Official End-of-Term Academic Report</h3>
                    <p>Term 1 - ${new Date().getFullYear()}</p>
                </div>
                <div class="student-details">
                    <div><strong>Student Name:</strong> ${escHtml(r.data.student.full_name)}</div>
                    <div><strong>Admission No:</strong> ${escHtml(r.data.student.admission_number || 'N/A')}</div>
                    <div><strong>Grade:</strong> ${escHtml(r.data.student.grade || 'N/A')}</div>
                    <div><strong>Date Issued:</strong> ${today}</div>
                </div>
                <table>
                    <thead><tr><th style="width: 50%;">Subject</th><th>Term Grade</th><th>Remarks</th></tr></thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <div class="signatures">
                    <div class="sig-line">Class Teacher</div>
                    <div class="sig-line">Principal</div>
                </div>
            </div>`;
        });

        combinedHtml += `
            <script>
                // Ensure fonts load completely before prompting print
                setTimeout(() => { window.print(); }, 600);
            </script>
        </body></html>`;

        const win = window.open('', '_blank');
        win.document.open();
        win.document.write(combinedHtml);
        win.document.close();

        // Restore button state
        btn.innerHTML = originalText;
        btn.disabled = false;

    } catch (e) {
        showToast(e.message, 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};