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
  setContent('<div class="loading-state"><div class="edu-loader"></div><p class="mt-16 text-muted font-bold">Loading LankaLearn...</p></div>');

  const stats = await api('/api/admin/stats').catch(() => ({}));
  const users = await api('/api/admin/users').catch(() => []);
  const courses = await api('/api/admin/courses').catch(() => []);

  const recentUsers = users.slice(-5).reverse();

  setContent(`
    <div class="page-header page-header-row">
      <div>
        <h1><i class="fas fa-home" style="color:var(--primary-dark);"></i> Admin Dashboard</h1>
        <p>Welcome back, ${escHtml(currentUser.full_name)}. Here's an overview of LankaLearn.</p>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-primary" style="background:#dc2626;" onclick="manageAlertsModal()"><i class="fas fa-bullhorn"></i> Manage Alerts</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon"><i class="fas fa-user-graduate" style="margin:0; color:var(--primary);"></i></div>
        <div class="stat-value">${stats.students || 0}</div>
        <div class="stat-label">Total Students</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="fas fa-chalkboard-teacher" style="margin:0; color:var(--primary);"></i></div>
        <div class="stat-value">${stats.teachers || 0}</div>
        <div class="stat-label">Total Teachers</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="fas fa-book-open" style="margin:0; color:var(--primary);"></i></div>
        <div class="stat-value">${stats.courses || 0}</div>
        <div class="stat-label">Total Courses</div>
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
    setContent('<div class="loading-state"><div class="edu-loader"></div><p class="mt-16 text-muted font-bold">Loading LankaLearn...</p></div>');
    
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
            <h1><i class="fas fa-chart-line" style="color:var(--primary-dark);"></i> Executive Overview</h1>
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
                <div class="card-header"><span class="card-title"><i class="fas fa-chart-pie" style="color:var(--primary);"></i> Demographics (Click a Grade)</span></div>
                <div class="card-body" style="padding:16px 20px;">${demoHtml}</div>
            </div>
            <div class="card mb-24">
                <div class="card-header"><span class="card-title"><i class="fas fa-wallet" style="color:var(--primary);"></i> Financial Health (Click for Arrears)</span></div>
                <div class="card-body">${finHtml}</div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title"><i class="fas fa-chalkboard-teacher" style="color:var(--primary);"></i> Teacher Workload & Performance</span></div>
            <div class="card-body" style="display:flex; gap:0; flex-wrap:wrap; padding:0;">
                <div style="flex:1; min-width:280px; border-right:1px solid var(--border); background:#fafafa;">
                    ${data.teachers.map((t, idx) => `
                        <div onclick="execShowTeacher(${idx})" style="padding:16px 20px; border-bottom:1px solid var(--border); cursor:pointer; transition:all 0.2s; display:flex; justify-content:space-between; align-items:center;" onmouseover="this.style.background='white'; this.style.paddingLeft='24px';" onmouseout="this.style.background='transparent'; this.style.paddingLeft='20px';">
                            <div>
                                <div style="font-weight:700; color:var(--primary-dark); font-size:14px;">${escHtml(t.name)}</div>
                                <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${t.courses.length} Assigned Course(s)</div>
                            </div>
                            <span style="color:var(--text-light); font-size:12px;"><i class="fas fa-chevron-right"></i></span>
                        </div>
                    `).join('')}
                    ${!data.teachers.length ? '<div style="padding:20px;" class="text-muted">No teachers assigned.</div>' : ''}
                </div>
                <div id="execTeacherDetails" style="flex:2; min-width:300px; padding:24px; background:white;">
                    <div class="empty-state" style="margin-top:20px;"><div class="empty-icon" style="font-size:32px; color:var(--primary);"><i class="fas fa-hand-point-left"></i></div><p>Select a teacher to view details.</p></div>
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
                html += `<tr><td style="padding:12px 16px; border-bottom:1px solid #f1f5f9;"><strong>${escHtml(s.full_name)}</strong><br><span style="font-size:11px;">Adm: ${escHtml(s.admission_number || 'N/A')}</span></td><td style="padding:12px 16px; border-bottom:1px solid #f1f5f9; text-align:center;">${status}</td><td style="padding:12px 16px; border-bottom:1px solid #f1f5f9; text-align:right;"><button class="btn btn-success btn-xs" onclick="window.openPaymentPortal(${s.id}, '${escHtml(s.full_name)}')"><i class="fas fa-coins"></i>&nbsp;Record</button></td></tr>`;
            }
            html += `</tbody></table></div>`;
            document.getElementById('modalBody').innerHTML = html;
        } catch (e) { document.getElementById('modalBody').innerHTML = `<div class="alert alert-error">Error: ${e.message}</div>`; }
    };
}

// ================================================================
// SYSTEM AUDIT LOGS (DEDICATED MENU)
// ================================================================

// ================================================================
// SYSTEM AUDIT LOGS (DEDICATED MENU)
// ================================================================

async function loadAuditLogs() {
  setPageTitle('System Audit Logs');
  setActiveSidebar('logs');
  setContent('<div class="loading-state"><div class="edu-loader"></div><p class="mt-16 text-muted font-bold">Loading LankaLearn...</p></div>');

  const logs = await api('/api/admin/logs').catch(() => []);
  window._allLogs = logs;

  // Extract unique users and actions for the dropdowns (Sorted alphabetically!)
  const uniqueUsers = [...new Set(logs.map(l => l.full_name))].filter(Boolean).sort();
  const uniqueActions = [...new Set(logs.map(l => l.action))].filter(Boolean).sort();

  setContent(`
    <div class="page-header page-header-row">
      <div>
        <h1><i class="fas fa-shield-alt" style="color:var(--primary-dark);"></i> System Audit Logs</h1>
        <p>Track all administrative and teaching actions across LankaLearn.</p>
      </div>
    </div>

    <div class="card mb-24">
      <div class="card-header" style="background:#fafafa; display:flex; gap:12px; flex-wrap:wrap; align-items:center; z-index:10; position:relative;">
        <div style="font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">
            <i class="fas fa-filter"></i> Filters:
        </div>
        
        <select id="logRoleFilter" onchange="filterLogs()" class="form-control" style="width:auto; min-width:160px; padding:8px 12px; font-size:13px;">
          <option value="all">All Roles</option>
          <option value="admin">Admins & Staff</option>
          <option value="teacher">Teachers</option>
        </select>

        <select id="logUserFilter" onchange="filterLogs()" class="form-control" style="width:auto; min-width:160px; padding:8px 12px; font-size:13px;">
          <option value="all">All Users</option>
          ${uniqueUsers.map(u => `<option value="${escHtml(u)}">${escHtml(u)}</option>`).join('')}
        </select>

        <div id="multiSelectContainer" style="position:relative; width:auto; min-width:200px;">
            <div class="form-control" onclick="toggleActionDropdown(event)" style="cursor:pointer; padding:8px 12px; font-size:13px; display:flex; justify-content:space-between; align-items:center; background:white; user-select:none;">
                <span id="actionSelectLabel"><i class="fas fa-bolt" style="color:#f59e0b;"></i> All Actions</span>
                <span style="font-size:10px; color:#94a3b8;"><i class="fas fa-chevron-down"></i></span>
            </div>
            
            <div id="actionDropdown" style="display:none; position:absolute; top:100%; left:0; width:250px; background:white; border:1px solid var(--border); box-shadow:0 10px 25px rgba(0,0,0,0.15); border-radius:8px; max-height:350px; overflow-y:auto; z-index:9999; margin-top:4px;">
                <div style="padding:8px 12px; border-bottom:1px solid var(--border); background:#f8fafc; position:sticky; top:0; z-index:2;">
                    <label style="display:flex; align-items:center; gap:8px; margin:0; cursor:pointer; font-weight:700; font-size:13px; color:var(--primary-dark);">
                        <input type="checkbox" id="chkAllActions" checked onchange="toggleAllLogActions(this.checked)" style="transform:scale(1.1);"> Select / Deselect All
                    </label>
                </div>
                <div id="actionCheckboxes" style="padding:4px 0;">
                    ${uniqueActions.map(a => `
                        <label style="display:flex; align-items:center; gap:8px; padding:8px 12px; margin:0; cursor:pointer; font-size:13px; transition:background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                            <input type="checkbox" class="log-action-chk" value="${escHtml(a)}" checked onchange="updateActionFilter()" style="transform:scale(1.1);"> ${escHtml(a)}
                        </label>
                    `).join('')}
                </div>
            </div>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
            <input type="date" id="logDateFilter" onchange="filterLogs()" class="form-control" style="padding:8px 12px; font-size:13px;">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('logDateFilter').value=''; filterLogs();"><i class="fas fa-times"></i> Clear Date</button>
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

  // --- Multi-Select Dropdown Logic ---
  
  // Close the custom dropdown if the user clicks anywhere outside of it
  document.addEventListener('click', function(event) {
      const container = document.getElementById('multiSelectContainer');
      const dropdown = document.getElementById('actionDropdown');
      if (container && dropdown && !container.contains(event.target)) {
          dropdown.style.display = 'none';
      }
  });

  window.toggleActionDropdown = (e) => {
      e.stopPropagation();
      const drop = document.getElementById('actionDropdown');
      drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
  };

  window.toggleAllLogActions = (checked) => {
      document.querySelectorAll('.log-action-chk').forEach(cb => cb.checked = checked);
      updateActionFilter(true);
  };

  window.updateActionFilter = (skipSelectAllCheck = false) => {
      const cbs = document.querySelectorAll('.log-action-chk');
      const checkedCbs = Array.from(cbs).filter(cb => cb.checked);
      
      if (!skipSelectAllCheck) {
          document.getElementById('chkAllActions').checked = (cbs.length === checkedCbs.length);
      }
      
      const label = document.getElementById('actionSelectLabel');
      if (checkedCbs.length === cbs.length) {
          label.innerHTML = '<i class="fas fa-bolt" style="color:#f59e0b;"></i> All Actions';
      } else if (checkedCbs.length === 0) {
          label.innerHTML = '<i class="fas fa-bolt" style="color:#f59e0b;"></i> None Selected';
      } else {
          label.innerHTML = `<i class="fas fa-bolt" style="color:#f59e0b;"></i> ${checkedCbs.length} Selected`;
      }
      
      filterLogs();
  };

  // --- Filtering Engine ---

  window.filterLogs = () => {
    const r = document.getElementById('logRoleFilter').value;
    const u = document.getElementById('logUserFilter').value;
    const d = document.getElementById('logDateFilter').value; 
    
    // Get array of all currently checked action boxes
    const selectedActions = Array.from(document.querySelectorAll('.log-action-chk:checked')).map(cb => cb.value);

    const filtered = window._allLogs.filter(l => {
      const isTeacherLog = l.role === 'teacher';
      
      // 1. Role Filter
      if (r === 'teacher' && !isTeacherLog) return false;
      if (r === 'admin' && isTeacherLog) return false;
      
      // 2. User & Date Filter
      const logDate = l.created_at ? l.created_at.split('T')[0].split(' ')[0] : '';
      const matchUser = (u === 'all' || l.full_name === u);
      const matchDate = (!d || logDate === d);
      
      // 3. Multi-Action Filter
      const matchAction = selectedActions.includes(l.action);

      return matchUser && matchDate && matchAction;
    });

    const tbody = document.getElementById('auditLogsBody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center; padding:30px;">No logs match your current filters.</td></tr>';
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
// USERS SECTION (With Bulk Select & Filters)
// ================================================================

async function loadAdminUsers(activeTab) {
  if (!activeTab) {
    const cur = document.querySelector('.tab-panel[style*="display: block"], .tab-panel.active:not([style*="display: none"])');
    activeTab = cur ? cur.id : 'tab-teachers';
  }
  setPageTitle('Users');
  setActiveSidebar('users');
  setContent('<div class="loading-state"><div class="edu-loader"></div><p class="mt-16 text-muted font-bold">Loading LankaLearn...</p></div>');
  
  const users = await api('/api/admin/users');
  window._adminUsers = users;

  const teachers  = users.filter(u => u.role === 'teacher');
  const students  = users.filter(u => u.role === 'student');
  const admins    = users.filter(u => u.role === 'admin' || u.role === 'super_admin');
  const subAdmins = users.filter(u => u.role === 'sub_admin');

  function teacherTable(list) {
    if (!list.length) return '<p class="text-muted" style="padding:16px">None</p>';
    return `
      <div class="bulk-toolbar" id="teacherBulkBar" style="display:none; justify-content:space-between; background:#fee2e2; border:1px solid #fca5a5; padding:10px 16px; border-radius:8px; margin-bottom:12px;">
        <div><strong id="teacherSelCount">0</strong> selected</div>
        <button class="btn btn-danger btn-sm" onclick="bulkDeleteUsers('teacher')"><i class="fas fa-trash-alt"></i>&nbsp; Delete Selected</button>
      </div>
      <div class="table-wrapper"><table><thead><tr>
        <th style="width:40px"><input type="checkbox" onchange="toggleSelectAll('teacher', this.checked)"></th>
        <th>Profile</th><th>Details</th><th>Actions</th>
      </tr></thead><tbody>
      ${list.map(u => {
        const isYou = u.id === currentUser.id;
        return `<tr class="user-row-teacher">
          <td>${!isYou ? `<input type="checkbox" class="chk-teacher" value="${u.id}" onchange="updateBulkBar('teacher')">` : ''}</td>
          <td>
            <strong>${escHtml(u.full_name)}</strong>
            <br><code class="row-username">${escHtml(u.username)}</code>
          </td>
          <td>
            ${escHtml(u.phone || '—')}
            <br>
            <span class="badge ${u.employment_status === 'guest' ? 'badge-yellow' : 'badge-green'}" style="margin-top:4px;">
                ${u.employment_status === 'guest' ? 'Guest' : 'Long Term'}
            </span>
          </td>
          <td>
            <div class="flex gap-8 flex-center">
              ${isYou ? '<span class="text-muted">You</span>' : `
                <button class="btn btn-secondary btn-sm" onclick="showEditUser(${u.id},'teacher')">Edit</button>
                <button class="btn btn-secondary btn-sm" onclick="window.printUserProfile(${u.id})" title="Print Profile">🖨️ Profile</button>
                <button class="btn btn-warning btn-sm" onclick="resetUserPassword(${u.id}, '${escHtml(u.full_name)}')">Reset PW</button>
              `}
            </div>
          </td>
        </tr>`}).join('')}
    </tbody></table></div>`;
  }

function studentTable(list) {
    if (!list.length) return '<p class="text-muted" style="padding:16px">None</p>';
    return `
      <div class="bulk-toolbar" id="studentBulkBar" style="display:none; justify-content:space-between; background:#fee2e2; border:1px solid #fca5a5; padding:10px 16px; border-radius:8px; margin-bottom:12px;">
        <div><strong id="studentSelCount">0</strong> selected</div>
        <button class="btn btn-danger btn-sm" onclick="bulkDeleteUsers('student')"><i class="fas fa-trash"></i> Delete Selected</button>
      </div>
      <div class="table-wrapper"><table><thead><tr>
        <th style="width:40px"><input type="checkbox" onchange="toggleSelectAll('student', this.checked)"></th>
        <th>Profile</th><th>Grade</th><th>Actions</th>
      </tr></thead><tbody>
      ${list.map(u => `
      <tr class="user-row-student" data-grade="${escHtml(u.grade || '')}">
        <td><input type="checkbox" class="chk-student" value="${u.id}" onchange="updateBulkBar('student')"></td>
        <td><strong>${escHtml(u.full_name)}</strong><br><code class="row-username">${escHtml(u.username)}</code></td>
        <td><span class="grade-pill">${escHtml(u.grade || '—')}</span></td>
        <td>
          <div class="flex gap-8 flex-center">
            <button class="btn btn-secondary btn-sm" onclick="showEditUser(${u.id},'student')"><i class="fas fa-edit"></i> Edit</button>
            <button class="btn btn-secondary btn-sm" style="background:#e0e7ff;color:#1e40af;border:1px solid #bfdbfe;" onclick="window.manageStudentCourses(${u.id}, '${escHtml(u.full_name)}')"><i class="fas fa-book"></i> Courses</button>
            <button class="btn btn-success btn-sm" style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;" onclick="window.openPaymentPortal(${u.id},'${escHtml(u.full_name)}')"><i class="fas fa-coins"></i> Fees</button>
            <button class="btn btn-secondary btn-sm" style="background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;" onclick="impersonateUser(${u.id}, '${escHtml(u.full_name)}')">🎭 Login As</button>
            <button class="btn btn-secondary btn-sm" onclick="window.printUserProfile(${u.id})" title="Print Profile"><i class="fas fa-print"></i></button>
            <button class="btn btn-warning btn-sm" onclick="resetUserPassword(${u.id}, '${escHtml(u.full_name)}')"><i class="fas fa-key"></i></button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody></table></div>`;
  }

  function adminTable(list, roleLabel) {
    if (!list.length) return '<p class="text-muted" style="padding:16px">None</p>';
    return `<div class="table-wrapper"><table><thead><tr><th>Name</th><th>Role</th><th>Actions</th></tr></thead><tbody>
      ${list.map(u => {
        const isYou = u.id === currentUser.id;
        return `<tr>
          <td><strong>${escHtml(u.full_name)}</strong><br><code>${escHtml(u.username)}</code></td>
          <td><span class="badge badge-purple">${u.role.replace('_', ' ')}</span></td>
          <td>
            <div class="flex gap-8 flex-center">
              ${isYou ? '<span class="text-muted">You</span>' : `
                <button class="btn btn-secondary btn-sm" onclick="showEditUser(${u.id},'${roleLabel}')">Edit</button>
                <button class="btn btn-warning btn-sm" onclick="resetUserPassword(${u.id}, '${escHtml(u.full_name)}')">Reset PW</button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id},'${escHtml(u.full_name)}')">Delete</button>
              `}
            </div>
          </td>
        </tr>`}).join('')}
    </tbody></table></div>`;
  }

  const gradeFilterOptions = GRADE_OPTIONS.map(g => `<option value="${g.value}">${g.label === '— Select Grade (or leave blank) —' ? 'All Grades' : g.label}</option>`).join('');

setContent(`
      <div class="page-header page-header-row">
        <div><h1><i class="fas fa-users" style="color:var(--primary-dark);"></i> Users</h1><p>Manage all accounts in the system</p></div>
      </div>

      <div class="tabs">
        <button class="tab-btn" id="tbtn-tab-teachers" onclick="switchTab(this,'tab-teachers')"><i class="fas fa-chalkboard-teacher"></i> Teachers (${teachers.length})</button>
        <button class="tab-btn" id="tbtn-tab-students" onclick="switchTab(this,'tab-students')"><i class="fas fa-user-graduate"></i> Students (${students.length})</button>
        <button class="tab-btn" id="tbtn-tab-classes" onclick="switchTab(this,'tab-classes')"><i class="fas fa-school"></i> Classes</button>
        <button class="tab-btn" id="tbtn-tab-subadmins" onclick="switchTab(this,'tab-subadmins')"><i class="fas fa-building"></i> Office Staff (${subAdmins.length})</button>
        <button class="tab-btn" id="tbtn-tab-admins" onclick="switchTab(this,'tab-admins')"><i class="fas fa-user-shield"></i> Admins (${admins.length})</button>
      </div>

      <div id="tab-teachers" class="tab-panel card" style="display:none">
        <div class="card-header" style="background:#fafafa;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <input type="text" class="search-box" id="search-teacher" placeholder="Search teachers…" oninput="filterUserTable('teacher')">
          <div style="flex:1"></div>
          <button class="btn btn-primary btn-sm" onclick="showCreateUser('teacher')"><i class="fas fa-plus"></i> Create Teacher</button>
        </div>
        <div class="card-body" style="padding:16px">${teacherTable(teachers)}</div>
      </div>

      <div id="tab-students" class="tab-panel card" style="display:none">
        <div class="card-header" style="background:#fafafa;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <input type="text" class="search-box" id="search-student" placeholder="Search students…" oninput="filterUserTable('student')">
          <select class="form-control" id="filter-grade-student" style="width:160px; padding:7px 14px;" onchange="filterUserTable('student')">
              ${gradeFilterOptions}
          </select>
          <div style="flex:1"></div>
          <button class="btn btn-success btn-sm" onclick="exportToCSV('#tab-students table', 'Student_Directory.csv')"><i class="fas fa-file-excel"></i> Export CSV</button>
          <button class="btn btn-primary btn-sm" onclick="showCreateUser('student')"><i class="fas fa-plus"></i> Create Student</button>
        </div>
        <div class="card-body" style="padding:16px">${studentTable(students)}</div>
      </div>

      <div id="tab-classes" class="tab-panel card" style="display:none">
        <div class="card-header" style="background:#fafafa; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="margin:0; font-size:16px;">Class Directory</h3>
            <p class="text-sm text-muted">Students grouped by Grade Level</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="showBulkPromoteModal()"><i class="fas fa-graduation-cap"></i> Academic Rollover Tool</button>
        </div>
        <div class="card-body" id="classDirectoryBody"></div>
      </div>

      <div id="tab-subadmins" class="tab-panel card" style="display:none">
        <div class="card-header" style="background:#fafafa;display:flex;align-items:center;">
          <h3 style="margin:0; font-size:16px;">Office Staff</h3>
          <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="showCreateUser('sub_admin')"><i class="fas fa-plus"></i> Create Staff</button>
        </div>
        <div class="card-body" style="padding:16px">${adminTable(subAdmins, 'sub_admin')}</div>
      </div>

      <div id="tab-admins" class="tab-panel card" style="display:none">
        <div class="card-header" style="background:#fafafa;display:flex;align-items:center;">
          <h3 style="margin:0; font-size:16px;">Admins</h3>
          <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="showCreateUser('admin')"><i class="fas fa-plus"></i> Create Admin</button>
        </div>
        <div class="card-body" style="padding:16px">${adminTable(admins, 'admin')}</div>
      </div>
    `);

  // Classes grouping
  const classGroups = {};
  students.forEach(s => {
    const g = s.grade || 'Unassigned';
    if (!classGroups[g]) classGroups[g] = [];
    classGroups[g].push(s);
  });
  const sortedGrades = Object.keys(classGroups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const classDirEl = document.getElementById('classDirectoryBody');
  if (classDirEl) {
    classDirEl.innerHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; padding: 10px;">
        ${sortedGrades.map(grade => `<div class="card" style="cursor:pointer; border:1.5px solid var(--border); transition: all 0.2s;" onclick="window.execShowGradeStudents('${escHtml(grade)}')" onmouseover="this.style.transform='translateY(-3px)'; this.style.borderColor='var(--primary)';" onmouseout="this.style.transform='none'; this.style.borderColor='var(--border)';"><div style="padding:20px; text-align:center;"><div style="font-size:24px; margin-bottom:8px;">🏫</div><div style="font-weight:700; color:var(--primary-dark); font-size:15px;">${escHtml(grade)}</div><div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${classGroups[grade].length} Students Enrolled</div></div><div style="background:var(--primary-light); padding:8px; text-align:center; font-size:11px; font-weight:700; color:var(--primary);">VIEW CLASS LIST</div></div>`).join('')}
      </div>`;
  }

  const tabToShow = document.getElementById(activeTab) ? activeTab : 'tab-teachers';
  const btnToActivate = document.getElementById('tbtn-' + tabToShow);
  if (btnToActivate) switchTab(btnToActivate, tabToShow);
}

// Bulk Selection and Filter Helpers
window.toggleSelectAll = (role, checked) => {
    document.querySelectorAll(`.chk-${role}`).forEach(cb => {
        if(cb.closest('tr').style.display !== 'none') cb.checked = checked;
    });
    updateBulkBar(role);
};

window.updateBulkBar = (role) => {
    const count = document.querySelectorAll(`.chk-${role}:checked`).length;
    const bar = document.getElementById(`${role}BulkBar`);
    if(bar) {
        bar.style.display = count > 0 ? 'flex' : 'none';
        document.getElementById(`${role}SelCount`).textContent = count;
    }
};

window.bulkDeleteUsers = async (role) => {
    const checked = Array.from(document.querySelectorAll(`.chk-${role}:checked`)).map(cb => cb.value);
    if (!confirm(`Are you sure you want to completely delete ${checked.length} ${role}(s)? All their data will be wiped.`)) return;
    try {
        await apiJSON('/api/admin/users/bulk-delete', { ids: checked });
        showToast(`Successfully deleted ${checked.length} ${role}(s)`, 'success');
        loadAdminUsers('tab-' + role + 's');
    } catch(e) { showToast(e.message, 'error'); }
};

window.filterUserTable = (role) => {
    const q = document.getElementById(`search-${role}`)?.value.toLowerCase() || '';
    const g = document.getElementById(`filter-grade-${role}`)?.value || '';
    
    document.querySelectorAll(`.user-row-${role}`).forEach(row => {
        const text = row.textContent.toLowerCase();
        const grade = row.dataset.grade || '';
        const matchQ = !q || text.includes(q);
        const matchG = !g || grade === g;
        
        if (matchQ && matchG) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
            const cb = row.querySelector(`.chk-${role}`);
            if(cb) cb.checked = false; // Uncheck hidden rows
        }
    });
    updateBulkBar(role);
};


function roleToTab(role) { 
    return { teacher: 'tab-teachers', student: 'tab-students', sub_admin: 'tab-subadmins', admin: 'tab-admins', super_admin: 'tab-admins' }[role] || 'tab-teachers'; 
}

function switchTab(btn, tabId) {
  // Remove 'active' class from all buttons
  btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  // Hide all tab panels
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  // Activate clicked button and show its panel
  btn.classList.add('active');
  document.getElementById(tabId).style.display = 'block';
}

async function deleteUser(id, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  const cur = document.querySelector('.tab-panel[style*="display: block"], .tab-panel.active:not([style*="display: none"])');
  try { await apiDelete(`/api/admin/users/${id}`); showToast('User deleted', 'success'); loadAdminUsers(cur ? cur.id : 'tab-teachers'); } catch (e) { showToast(e.message, 'error'); }
}

function showCreateUser(role) {
  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
  const gradeField = role === 'student' ? [{ label: 'Grade', name: 'grade', type: 'select', options: GRADE_OPTIONS }] : [];
  const admissionField = role === 'student' ? [{ label: 'Admission Number', name: 'admission_number', placeholder: 'e.g. LL-2026-0001' }] : [];
  const employmentField = role === 'teacher' ? [{ label: 'Employment Status', name: 'employment_status', type: 'select', options: [{value: 'long-term', label: 'Long Term'}, {value: 'guest', label: 'Guest Teacher'}] }] : [];

  openModal(`Create New ${roleTitle}`, modalForm([
    { name: 'role', type: 'hidden', value: role },
    { label: 'Full Name', name: 'full_name', placeholder: 'e.g. Kasun Perera', required: true },
    { label: 'Username', name: 'username', placeholder: 'e.g. kasun.p', required: true },
    { label: 'Password', name: 'password', type: 'password', placeholder: '••••••••', required: true },
    { label: 'Phone Number', name: 'phone', type: 'tel' },
    { label: 'Date of Birth', name: 'dob', type: 'date' },
    { label: 'Address', name: 'address', type: 'textarea' },
    ...gradeField, ...admissionField, ...employmentField, // <--- Updated
    { label: 'Additional Notes', name: 'notes', type: 'textarea' },
    { label: 'Profile Image', name: 'file', type: 'file' }
  ], async (fd) => {
    try { await apiPost('/api/admin/users', fd); closeModal(); showToast(`${roleTitle} created successfully`, 'success'); loadAdminUsers('tab-' + role + 's');
    } catch (e) { showToast(e.message, 'error'); }
  }, `Create ${roleTitle}`));
  if (role === 'student') { api('/api/admin/next-admission').then(res => { const field = document.querySelector('[name="admission_number"]'); if (field && !field.value) field.value = res.admission_number; }).catch(() => {}); }
}

function showEditUser(id, roleLabel) {
  const u = window._adminUsers.find(x => x.id === id);
  const roleTitle = roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1);
  const gradeField = roleLabel === 'student' ? [{ label: 'Grade', name: 'grade', type: 'select', value: u.grade || '', options: GRADE_OPTIONS }] : [];
  const admissionField = roleLabel === 'student' ? [{ label: 'Admission Number', name: 'admission_number', value: u.admission_number || '' }] : [];
  const employmentField = roleLabel === 'teacher' ? [{ label: 'Employment Status', name: 'employment_status', type: 'select', value: u.employment_status || 'long-term', options: [{value: 'long-term', label: 'Long Term'}, {value: 'guest', label: 'Guest Teacher'}] }] : [];

  openModal(`Edit ${roleTitle}: ${u.full_name}`, modalForm([
    { label: 'Full Name', name: 'full_name', value: u.full_name, required: true },
    { label: 'Username', name: 'username', value: u.username, required: true },
    { label: 'New Password (Leave blank to keep current)', name: 'password', type: 'password', placeholder: '••••••••' },
    { label: 'Phone Number', name: 'phone', type: 'tel', value: u.phone || '' },
    { label: 'Date of Birth', name: 'dob', type: 'date', value: u.dob || '' },
    { label: 'Address', name: 'address', type: 'textarea', value: u.address || '' },
    ...gradeField, ...admissionField, ...employmentField, // <--- Updated
    { label: 'Additional Notes', name: 'notes', type: 'textarea', value: u.notes || '' },
    { label: 'Update Profile Image', name: 'file', type: 'file' }
  ], async (fd) => {
    try { await api(`/api/admin/users/${id}`, { method: 'PUT', body: fd }); closeModal(); showToast('User updated!', 'success'); loadAdminUsers('tab-' + roleLabel + 's');
    } catch (e) { showToast(e.message, 'error'); }
  }, 'Save Changes'));
}

// ================================================================
// COURSES SECTION
// ================================================================

// CHANGED: Default is now 'grouped' so you see it immediately!
window._courseViewMode = 'grouped'; 
window._selectedCourseIds = new Set();

async function loadAdminCourses() {
  setPageTitle('Courses');
  setActiveSidebar('courses');
  setContent('<div class="loading-state"><div class="edu-loader"></div><p class="mt-16 text-muted font-bold">Loading LankaLearn...</p></div>');

  const [courses, teachers] = await Promise.all([api('/api/admin/courses'), api('/api/admin/teachers')]);
  window._adminCourses = courses;
  window._adminTeachers = teachers;
  window._selectedCourseIds.clear(); 

  const gradeFilterOptions = GRADE_OPTIONS.map(g => `<option value="${g.value}">${g.label === '— Select Grade (or leave blank) —' ? 'All Grades' : g.label}</option>`).join('');
  const teacherFilterOptions = '<option value="">All Teachers</option>' + teachers.map(t => `<option value="${t.id}">${escHtml(t.full_name)}</option>`).join('');

  setContent(`
    <div class="page-header page-header-row">
        <div><h1><i class="fas fa-book" style="color:var(--primary-dark);"></i> Courses</h1><p>Create and manage all courses</p></div>
        <button class="btn btn-primary" onclick="showCreateCourse()"><i class="fas fa-plus"></i> Create Course</button>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:16px;">
        <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
            <div style="display:flex; gap:10px; align-items:center; background:white; padding:8px 12px; border-radius:8px; border:1px solid var(--border);">
                <input type="checkbox" id="chkSelectAllCourses" onchange="toggleSelectAllCourses(this.checked)" style="transform:scale(1.2); cursor:pointer;" title="Select All Visible">
                <span style="font-size:13px; font-weight:600;">Select All</span>
            </div>
            
            <div style="display:flex; background:#f1f5f9; padding:4px; border-radius:8px; border:1px solid var(--border);">
                <button id="btnViewFlat" class="btn btn-sm ${window._courseViewMode === 'flat' ? 'btn-primary' : 'btn-secondary'}" style="border:none;" onclick="setCourseViewMode('flat')">Show All Courses</button>
                <button id="btnViewGroup" class="btn btn-sm ${window._courseViewMode === 'grouped' ? 'btn-primary' : 'btn-secondary'}" style="border:none;" onclick="setCourseViewMode('grouped')">Categorize by Grade</button>
            </div>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <select class="form-control" id="courseGradeFilter" onchange="renderFilteredCourses()" style="width:160px; padding:7px 14px;">
                ${gradeFilterOptions}
            </select>
            <select class="form-control" id="courseTeacherFilter" onchange="renderFilteredCourses()" style="width:160px; padding:7px 14px;">
                ${teacherFilterOptions}
            </select>
            <input type="text" class="search-box" id="courseSearch" placeholder="Search courses..." oninput="renderFilteredCourses()">
        </div>
    </div>

    <div class="bulk-toolbar" id="courseBulkBar" style="display:none; justify-content:space-between; background:#fee2e2; border:1px solid #fca5a5; padding:10px 16px; border-radius:8px; margin-bottom:20px;">
        <div><strong id="courseSelCount">0</strong> courses selected</div>
        <button class="btn btn-danger btn-sm" onclick="bulkDeleteCourses()"><i class="fas fa-trash"></i> Delete Selected Courses</button>
    </div>

    <div id="adminCourseGridContainer"></div>
  `);

  renderFilteredCourses();
}

window.setCourseViewMode = (mode) => {
    window._courseViewMode = mode;
    document.getElementById('btnViewFlat').className = `btn btn-sm ${mode === 'flat' ? 'btn-primary' : 'btn-secondary'}`;
    document.getElementById('btnViewGroup').className = `btn btn-sm ${mode === 'grouped' ? 'btn-primary' : 'btn-secondary'}`;
    renderFilteredCourses();
};

window.renderFilteredCourses = () => {
    const q = document.getElementById('courseSearch').value.toLowerCase();
    const g = document.getElementById('courseGradeFilter').value;
    const t = document.getElementById('courseTeacherFilter').value; // Restored Teacher filter value

    const filteredCourses = window._adminCourses.filter(c => {
        const text = (c.name + ' ' + c.code + ' ' + (c.teacher_name || '')).toLowerCase();
        const grade = c.grade || '';
        const teacher = c.teacher_id ? c.teacher_id.toString() : ''; // Get the course's teacher ID

        const matchQ = !q || text.includes(q);
        const matchG = !g || grade === g;
        const matchT = !t || teacher === t; // Restored Teacher match check

        return matchQ && matchG && matchT; 
    });

    const container = document.getElementById('adminCourseGridContainer');

    if (filteredCourses.length === 0) {
        container.innerHTML = '<div class="empty-state text-center text-muted" style="padding:40px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">No courses match your filters.</div>';
        updateCourseBulkBar();
        return;
    }

    if (window._courseViewMode === 'flat') {
        container.innerHTML = `<div class="course-grid">${filteredCourses.map(c => generateCourseCardHtml(c)).join('')}</div>`;
    } else {
        const grouped = {};
        filteredCourses.forEach(c => {
            const gradeLabel = c.grade || 'Unassigned';
            if (!grouped[gradeLabel]) grouped[gradeLabel] = [];
            grouped[gradeLabel].push(c);
        });

        const sortedGrades = Object.keys(grouped).sort((a, b) => {
            if (a === 'Unassigned') return 1;
            if (b === 'Unassigned') return -1;
            const numA = parseInt(a.match(/\d+/)) || 0;
            const numB = parseInt(b.match(/\d+/)) || 0;
            if (numA !== numB) return numB - numA;
            return b.localeCompare(a); 
        });

        container.innerHTML = sortedGrades.map(grade => `
            <div class="course-grade-section" style="margin-bottom: 24px;">
                <h3 style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; letter-spacing: -0.3px; color: var(--primary-dark); border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <i class="fas fa-layer-group" style="font-size: 13px; margin-right: 6px; color: var(--primary); opacity: 0.85;"></i>
                        ${escHtml(grade)}
                    </div>
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; background: var(--primary-light); color: var(--primary-dark); padding: 4px 12px; border-radius: 12px; font-weight: 500; letter-spacing: 0;">
                        ${grouped[grade].length} courses
                    </span>
                </h3>
                <div class="course-grid">
                    ${grouped[grade].map(c => generateCourseCardHtml(c)).join('')}
                </div>
            </div>
        `).join('');
    }

    updateCourseBulkBar();
};
window.generateCourseCardHtml = (c) => {
    const isChecked = window._selectedCourseIds.has(c.id) ? 'checked' : '';
    // Use fallback blue banner if courseBannerClass doesn't exist
    const bannerClass = typeof courseBannerClass === 'function' ? courseBannerClass(c.id) : 'bg-blue-500';
    return `
        <div class="course-card course-item-card" style="position:relative;">
            <input type="checkbox" class="chk-course" value="${c.id}" ${isChecked} onchange="handleCourseCheckbox(this, ${c.id})" style="position:absolute; top:12px; right:12px; z-index:10; transform:scale(1.4); cursor:pointer;">
            <div class="course-card-banner ${bannerClass}"></div>
            <div class="course-card-body">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
                <div class="course-card-code">${escHtml(c.code)}</div>
            </div>
            <div class="course-card-name">${escHtml(c.name)}</div>
            <div class="course-card-desc">${escHtml(c.description||'No description')}</div>
            <div class="course-card-footer">
                <div class="course-card-teacher"><i class="fas fa-chalkboard-teacher"></i> ${escHtml(c.teacher_name||'Unassigned')}</div>
                <div class="flex gap-8">
                <button class="btn btn-secondary btn-sm" onclick="manageEnrollments(${c.id},'${escHtml(c.name)}')"><i class="fas fa-users"></i></button>
                <button class="btn btn-secondary btn-sm" onclick="showEditCourse(${c.id})"><i class="fas fa-edit"></i> Edit</button>
                </div>
            </div>
            </div>
        </div>
    `;
};

window.handleCourseCheckbox = (checkbox, id) => {
    if (checkbox.checked) window._selectedCourseIds.add(id);
    else window._selectedCourseIds.delete(id);
    updateCourseBulkBar();
};

window.toggleSelectAllCourses = (checked) => {
    document.querySelectorAll('.chk-course').forEach(cb => {
        cb.checked = checked;
        const id = parseInt(cb.value);
        if (checked) window._selectedCourseIds.add(id);
        else window._selectedCourseIds.delete(id);
    });
    updateCourseBulkBar();
};

window.updateCourseBulkBar = () => {
    const count = window._selectedCourseIds.size;
    const bar = document.getElementById('courseBulkBar');
    if(bar) {
        bar.style.display = count > 0 ? 'flex' : 'none';
        document.getElementById('courseSelCount').textContent = count;
    }
    
    const visibleCheckboxes = document.querySelectorAll('.chk-course');
    const masterChk = document.getElementById('chkSelectAllCourses');
    if (masterChk && visibleCheckboxes.length > 0) {
        masterChk.checked = Array.from(visibleCheckboxes).every(cb => cb.checked);
    } else if (masterChk) {
        masterChk.checked = false;
    }
};

window.bulkDeleteCourses = async () => {
    const checkedIds = Array.from(window._selectedCourseIds);
    if (checkedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${checkedIds.length} course(s)? ALL assignments, quizzes, and enrollments inside them will be destroyed!`)) return;
    
    try {
        await apiJSON('/api/admin/courses/bulk-delete', { ids: checkedIds });
        showToast(`Successfully deleted ${checkedIds.length} course(s)`, 'success');
        loadAdminCourses(); 
    } catch(e) { showToast(e.message, 'error'); }
};// HYBRID DIRECT PAYMENT FEES
// ================================================================

async function loadAdminFees() {
  setPageTitle('Fee Management');
  setActiveSidebar('fees');
  setContent('<div class="loading-state"><div class="edu-loader"></div><p class="mt-16 text-muted font-bold">Loading LankaLearn...</p></div>');
  
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
        <div><h1><i class="fas fa-money-bill-wave" style="color:var(--primary-dark);"></i> Fee Portal</h1><p>Record payments and set grade fees.</p></div>
      </div>
    </div>

    <div class="card mb-24">
      <div class="card-header" style="cursor:pointer;" onclick="document.getElementById('masterFeesBody').style.display = document.getElementById('masterFeesBody').style.display === 'none' ? 'block' : 'none'">
        <span class="card-title"><i class="fas fa-cogs"></i> Master Grade Fees (Click to Expand/Collapse)</span>
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
                <button class="btn btn-secondary btn-xs" onclick="editMasterFee('${escHtml(f.grade_name)}', ${f.monthly_tuition})"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-danger btn-xs" onclick="deleteMasterFee('${escHtml(f.grade_name)}')"><i class="fas fa-trash"></i></button>
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
          <button class="btn btn-primary" onclick="saveMasterGradeFee()"><i class="fas fa-save"></i> Save Fee</button>
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
    </head><body><h2><i class="fas fa-coins"></i>&nbsp;LankaLearn - Master Student List</h2>
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

window.manageAlertsModal = async () => {
    openModal('Manage Active Alerts', '<div class="loading-state"><div class="spinner"></div></div>', 'modal-box-lg');
    try {
        const alerts = await api('/api/admin/broadcasts');
        let html = `
            <button class="btn btn-primary w-full mb-16" onclick="showBroadcastModal()">+ Create New General Alert</button>
            <div class="table-wrapper">
                <table style="width:100%; font-size:13px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc; border-bottom:2px solid var(--border);">
                        <th style="padding:10px;text-align:left;">Title & Message</th>
                        <th style="padding:10px;text-align:left;">Audience</th>
                        <th style="padding:10px;text-align:left;">Expires</th>
                        <th style="padding:10px;text-align:right;">Action</th>
                    </tr></thead>
                    <tbody>
        `;
        
        if (!alerts.length) {
            html += `<tr><td colspan="4" class="text-center text-muted" style="padding:20px;">No active alerts running.</td></tr>`;
        } else {
            alerts.forEach(a => {
                const isSpecific = a.target_audience.startsWith('SPECIFIC:');
                const targetLabel = isSpecific 
                    ? `<span class="badge badge-purple">Targeted (${a.target_audience.split(',').length} users)</span>` 
                    : `<span class="badge badge-blue">${a.target_audience.toUpperCase()}</span>`;
                
                html += `<tr>
                    <td style="padding:10px; border-bottom:1px solid #f1f5f9;"><strong>${escHtml(a.title)}</strong><br><span class="text-muted text-sm">${escHtml(a.message).substring(0, 50)}...</span></td>
                    <td style="padding:10px; border-bottom:1px solid #f1f5f9;">${targetLabel}</td>
                    <td style="padding:10px; border-bottom:1px solid #f1f5f9;">${a.expires_at ? a.expires_at.split(' ')[0] : 'Never'}</td>
                    <td style="padding:10px; border-bottom:1px solid #f1f5f9; text-align:right;"><button class="btn btn-danger btn-xs" onclick="deleteSpecificAlert(${a.id})">🛑 Stop</button></td>
                </tr>`;
            });
        }
        html += `</tbody></table></div>`;
        document.getElementById('modalBody').innerHTML = html;
    } catch (e) {
        document.getElementById('modalBody').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
};

window.deleteSpecificAlert = async (id) => {
    if(!confirm("Stop and remove this alert?")) return;
    try {
        await apiDelete(`/api/admin/broadcasts/${id}`);
        showToast("Alert stopped successfully", "success");
        
        // Ensure the red banner hides immediately if it's currently on the admin's screen
        const firstElement = document.body.firstElementChild;
        if (firstElement && firstElement.innerHTML.includes('🚨')) {
            firstElement.style.display = 'none';
            document.querySelector('.top-header').style.top = '0px';
            document.querySelector('.sidebar').style.top = '64px';
        }
        
        manageAlertsModal(); // Reload the modal to show it disappeared
    } catch (e) { showToast(e.message, 'error'); }
};


// ================================================================
// GLOBAL HELPERS
// ================================================================

window.execShowGradeStudents = async (gradeName) => {
    openModal(`Class Overview: ${gradeName}`, '<div class="loading-state"><div class="spinner"></div></div>', 'modal-box-lg');
    try {
        const [users, classDetails] = await Promise.all([
            api('/api/admin/users'),
            api(`/api/admin/classes/${encodeURIComponent(gradeName)}/details`).catch(() => ({ teacher_name: 'Unassigned' }))
        ]);
        const students = users.filter(u => u.role === 'student' && (u.grade === gradeName || (gradeName === 'Unassigned' && !u.grade)));
        
        let html = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; gap:16px; flex-wrap:wrap;">
            
            <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:16px; border-radius:8px; flex:1; min-width:250px;">
                <div style="font-size:11px; text-transform:uppercase; font-weight:700; color:#1e40af; margin-bottom:8px;">Class Teacher</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:16px; font-weight:700; color:#1e3a8a;">👨‍🏫 ${escHtml(classDetails.teacher_name)}</div>
                    <button class="btn btn-secondary btn-xs" onclick="window.assignClassTeacher('${escHtml(gradeName)}')">Change</button>
                </div>
            </div>

            <div style="background:#f8fafc; border:1px solid var(--border); padding:16px; border-radius:8px; flex:1.2; min-width:280px;">
                <div style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:12px;">Class Operations</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button class="btn btn-primary btn-sm" style="grid-column: span 2;" onclick="window.assignCourseToClass('${escHtml(gradeName)}')">
                        <i class="fas fa-book-open"></i>&nbsp; Assign Course to Class
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.printClassReportCards('${escHtml(gradeName)}')">
                        🖨️ Print Reports
                    </button>
                    <button class="btn btn-primary btn-sm" style="background:#8b5cf6;" onclick="window.manageClassTimetable('${escHtml(gradeName)}')">
                        📅 Timetable
                    </button>
                </div>
            </div>
        </div>

        <div style="margin-bottom:12px;">
            <input type="text" id="classStudentSearch" class="form-control" placeholder="🔍 Search student name or admission number..." oninput="filterClassStudents()">
        </div>
        
        <div class="table-wrapper" style="max-height:400px; overflow-y:auto;">
            <table id="classStudentsTable" style="width:100%; font-size:13.5px; border-collapse:collapse;">
                <thead style="position:sticky; top:0; z-index:2;">
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
                            <button class="btn btn-secondary btn-xs" onclick="window.printUserProfile(${s.id})">👤 Profile</button>
                            <button class="btn btn-success btn-xs" style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;" onclick="window.openPaymentPortal(${s.id}, '${escHtml(s.full_name)}')"><i class="fas fa-coins"></i>&nbsp;Fees</button>
                            <button class="btn btn-secondary btn-xs" onclick="window.printTermReportCard(${s.id}, '${escHtml(s.full_name)}')">📄 Report</button>
                        </div>
                    </td>
                </tr>`;
            });
        }
        
        html += `</tbody></table></div>`;
        document.getElementById('modalBody').innerHTML = html;

        window.filterClassStudents = () => {
            const q = document.getElementById('classStudentSearch').value.toLowerCase();
            document.querySelectorAll('.class-student-row').forEach(row => {
                const name = row.querySelector('.cs-name')?.textContent.toLowerCase() || '';
                const adm = row.querySelector('.cs-adm')?.textContent.toLowerCase() || '';
                row.style.display = (name.includes(q) || adm.includes(q)) ? '' : 'none';
            });
        };

    } catch (e) { document.getElementById('modalBody').innerHTML = `<div class="alert alert-error">Error: ${e.message}</div>`; }
};

window.assignClassTeacher = async (gradeName) => {
    const teachers = window._adminUsers ? window._adminUsers.filter(u => u.role === 'teacher') : await api('/api/admin/teachers');
    
    openModal(`Assign Class Teacher: ${gradeName}`, modalForm([
        { label: 'Select Teacher', name: 'teacher_id', type: 'select', required: true, 
          options: teachers.map(t => ({ value: t.id, label: t.full_name })) }
    ], async (fd) => {
        try {
            await apiPost(`/api/admin/classes/${encodeURIComponent(gradeName)}/teacher`, fd);
            showToast('Class Teacher assigned!', 'success');
            execShowGradeStudents(gradeName); // Reload the modal to show the new teacher
        } catch (e) { showToast(e.message, 'error'); }
    }, 'Assign Teacher'));
};
window.assignCourseToClass = async (gradeName) => {
    // Fetch courses if not already cached
    const courses = window._adminCourses ? window._adminCourses : await api('/api/admin/courses');
    
    // Build the Grade Filter Dropdown
    const gradeFilterOptions = GRADE_OPTIONS.map(g => {
        // Auto-select the matching grade in the dropdown
        const isSelected = g.value === gradeName ? 'selected' : '';
        const label = g.label === '— Select Grade (or leave blank) —' ? 'All Grades' : g.label;
        return `<option value="${g.value}" ${isSelected}>${label}</option>`;
    }).join('');

    // State to hold selected courses
    let selectedCourses = new Set();

    openModal(`Bulk Assign Courses: ${gradeName}`, `
        <div class="alert alert-info mb-16">
            <i class="fas fa-info-circle"></i> Select multiple courses below. Every student in <strong>${escHtml(gradeName)}</strong> will be enrolled into all selected courses at once.
        </div>

        <div style="display:flex; gap:10px; margin-bottom:16px;">
            <input type="text" id="bulkCourseSearch" class="form-control" style="flex: 1;" placeholder="Search by course name or code..." oninput="window.filterBulkCourses()">
            <select id="bulkCourseGrade" class="form-control" style="width:160px;" onchange="window.filterBulkCourses()">
                ${gradeFilterOptions}
            </select>
        </div>

        <div id="bulkCourseList" style="max-height: 350px; overflow-y: auto; padding-right: 8px; margin-bottom: 20px; border-radius: 8px;">
            </div>

        <div class="flex gap-8" style="justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:16px;">
            <div class="text-sm" style="color: var(--primary-dark); font-weight: 600;"><strong id="bulkCourseCount">0</strong> courses selected</div>
            <div class="flex gap-8">
                <button type="button" class="btn btn-secondary" onclick="execShowGradeStudents('${escHtml(gradeName)}')">Cancel</button>
                <button type="button" id="bulkCourseBtn" class="btn btn-primary" disabled onclick="submitBulkCourses('${escHtml(gradeName)}')">
                    <i class="fas fa-check"></i> Assign 0 Course(s)
                </button>
            </div>
        </div>
    `, 'modal-box-lg');

    // Function to render and filter the list
    window.filterBulkCourses = () => {
        const q = document.getElementById('bulkCourseSearch').value.toLowerCase();
        const g = document.getElementById('bulkCourseGrade').value;

        const filtered = courses.filter(c => {
            const matchQ = !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
            const matchG = !g || (c.grade || '') === g;
            return matchQ && matchG;
        });

        const listEl = document.getElementById('bulkCourseList');
        if (filtered.length === 0) {
            listEl.innerHTML = '<div class="empty-state text-center text-muted" style="padding:20px; font-size:13px;">No courses match your search/filter.</div>';
            return;
        }

        listEl.innerHTML = filtered.map(c => {
            const isChecked = selectedCourses.has(c.id) ? 'checked' : '';
            return `
                <label style="display:flex; align-items:center; gap:14px; padding:14px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px; cursor:pointer; background:white; transition:all 0.2s;" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1';" onmouseout="this.style.background='white'; this.style.borderColor='var(--border)';">
                    <input type="checkbox" value="${c.id}" ${isChecked} onchange="toggleBulkCourse(${c.id}, this.checked)" style="transform:scale(1.3); cursor:pointer;">
                    <div style="flex:1;">
                        <div style="font-weight:600; color:var(--text); font-size: 14px;">
                            ${escHtml(c.name)} 
                            <span style="font-size:11px; font-weight:700; color:var(--primary); background:var(--primary-light); padding:3px 8px; border-radius:12px; margin-left:8px;">${escHtml(c.code)}</span>
                        </div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                            <strong>Grade:</strong> ${escHtml(c.grade || 'Unassigned')} &nbsp;|&nbsp; 
                            <strong>Teacher:</strong> ${escHtml(c.teacher_name || 'Unassigned')}
                        </div>
                    </div>
                </label>
            `;
        }).join('');
    };

    // Toggle individual checkbox
    window.toggleBulkCourse = (id, checked) => {
        if (checked) selectedCourses.add(id);
        else selectedCourses.delete(id);
        
        const count = selectedCourses.size;
        document.getElementById('bulkCourseCount').textContent = count;
        
        const btn = document.getElementById('bulkCourseBtn');
        btn.disabled = count === 0;
        btn.innerHTML = `<i class="fas fa-check"></i> Assign ${count} Course(s)`;
    };

    // Initial render
    window.filterBulkCourses();

    // Submission logic (loops through selected courses and hits the endpoint)
    window.submitBulkCourses = async (gName) => {
        if (selectedCourses.size === 0) return;
        
        const btn = document.getElementById('bulkCourseBtn');
        btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Processing...';
        btn.disabled = true;

        try {
            let coursesProcessed = 0;
            
            // Loop through all selected courses and assign the class to them
            for (let cid of selectedCourses) {
                const fd = new FormData();
                fd.append('course_id', cid);
                await apiPost(`/api/admin/classes/${encodeURIComponent(gName)}/enroll`, fd);
                coursesProcessed++;
            }
            
            showToast(`Success! Students enrolled in ${coursesProcessed} course(s).`, 'success');
            execShowGradeStudents(gName); // Return to class overview to see the changes
        } catch (e) { 
            showToast(e.message, 'error'); 
            btn.innerHTML = `<i class="fas fa-check"></i> Assign ${selectedCourses.size} Course(s)`; 
            btn.disabled = false;
        }
    };
};


window.printClassReportCards = async (gradeName) => {
    // Visual feedback so the user knows the system is working
    const btn = document.querySelector('button[onclick*="printClassReportCards"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Generating...';
    btn.disabled = true;

    try {
        // Fetch all students for this grade
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


// ================================================================
// MISSING CONSTANTS & UTILS
// ================================================================

const GRADE_OPTIONS = [
  { value: '', label: '— Select Grade (or leave blank) —' },
  { value: 'Grade 5', label: 'Grade 5' }, { value: 'Grade 6', label: 'Grade 6' }, 
  { value: 'Grade 7', label: 'Grade 7' }, { value: 'Grade 8', label: 'Grade 8' },
  { value: 'Grade 9', label: 'Grade 9' }, { value: 'Grade 10', label: 'Grade 10' }, 
  { value: 'Grade 11 (O/L)', label: 'Grade 11 (O/L)' },
  { value: 'Grade 12 (A/L)', label: 'Grade 12 (A/L)' }, { value: 'Grade 13 (A/L)', label: 'Grade 13 (A/L)' },
  { value: 'Alumni / Graduated', label: '🎓 Alumni / Graduated' } // Added so seniors have somewhere to go
];

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
    } catch (e) { showToast(e.message, 'error'); }
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
  } catch (e) { showToast(e.message, 'error'); }
};

// ================================================================
// FEE MANAGEMENT & PRINTING
// ================================================================

// ================================================================
// FEE MANAGEMENT & PRINTING
// ================================================================

async function loadAdminFees() {
  setPageTitle('Fee Management');
  setActiveSidebar('fees');
  setContent('<div class="loading-state"><div class="edu-loader"></div><p class="mt-16 text-muted font-bold">Loading LankaLearn...</p></div>');
  
  const [users, gradeFees, allPayments] = await Promise.all([
    api('/api/admin/users'),
    api('/api/admin/grade-fees'),
    api('/api/admin/all-fee-payments')
  ]);
  
  const students = users.filter(u => u.role === 'student');
  window._currentGradeFees = gradeFees; 
  window._allFeePayments = allPayments;
  window._arrearsMonths = []; // Initialize empty filter list
  
  const gradeOptionsHtml = GRADE_OPTIONS.map(g => 
      `<option value="${g.value}">${g.label === '— Select Grade (or leave blank) —' ? 'All Grades' : g.label}</option>`
  ).join('');
  
  setContent(`
    <div class="page-header page-header-row">
      <div style="display:flex; justify-content:space-between; width:100%;">
        <div><h1><i class="fas fa-coins"></i>&nbsp;Fee Portal</h1><p>Record payments, set grade fees, and track arrears.</p></div>
      </div>
    </div>

    <div class="card mb-24">
      <div class="card-header" style="cursor:pointer; background:#fafafa;" onclick="document.getElementById('masterFeesBody').style.display = document.getElementById('masterFeesBody').style.display === 'none' ? 'block' : 'none'">
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
             ${gradeOptionsHtml}
          </select>
          <input type="number" id="newGradeFee" class="form-control" placeholder="Amount (LKR)">
          <button class="btn btn-primary" onclick="saveMasterGradeFee()">Save Fee</button>
        </div>
      </div>
    </div>

    <div style="display:flex; gap:16px; align-items:flex-end; margin-bottom:16px; flex-wrap:wrap; background:#f8fafc; padding:16px; border:1px solid var(--border); border-radius:8px;">
        <div class="form-group" style="margin:0;">
            <label>Filter by Grade</label>
            <select id="feeGradeFilter" class="form-control" onchange="filterFeeStudents()">
                ${gradeOptionsHtml}
            </select>
        </div>
        <div class="form-group" style="margin:0;">
            <label>Check Arrears For Month</label>
            <div style="display:flex; gap:8px;">
                <input type="month" id="arrearsMonthPicker" class="form-control">
                <button class="btn btn-secondary" onclick="addArrearsMonth()">Add Filter</button>
            </div>
        </div>
        <div style="flex:1;">
            <label style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Searching for Students Missing:</label>
            <div id="selectedArrearsMonths" style="display:flex; gap:8px; flex-wrap:wrap; min-height:36px; align-items:center;">
                <span class="text-muted text-sm">No months selected (Showing all students)</span>
            </div>
        </div>
        <button class="btn btn-warning" onclick="sendFeeReminders()">🔔 Send Reminders to Filtered</button>
    </div>

    <div class="card">
      <div class="card-header" style="background:#fafafa;">
        <span class="card-title">Student Payment Directory</span>
        <div style="float:right; display:flex; gap:10px;">
            <button class="btn btn-success btn-sm" onclick="exportToCSV('#feeStudentsTable', 'Fee_Status_Report.csv')"><i class="fas fa-file-excel"></i> Export CSV</button>
            <input type="text" id="feeStudentSearch" class="search-box" placeholder="🔍 Search student..." oninput="filterFeeStudents()">
        </div>
      </div>
      <div class="table-wrapper">
        <table id="feeStudentsTable">
          <thead><tr><th>Student</th><th>Admission No.</th><th>Grade</th><th>Actions</th></tr></thead>
          <tbody>
            ${students.map(s => `
              <tr data-sid="${s.id}" data-grade="${escHtml(s.grade || '')}">
                <td class="student-info"><strong>${escHtml(s.full_name)}</strong><br><code class="text-muted">${escHtml(s.username)}</code></td>
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
  
  window.addArrearsMonth = () => {
      const val = document.getElementById('arrearsMonthPicker').value;
      if(!val || window._arrearsMonths.includes(val)) return;
      window._arrearsMonths.push(val);
      renderArrearsMonths();
      filterFeeStudents();
  };

  window.removeArrearsMonth = (val) => {
      window._arrearsMonths = window._arrearsMonths.filter(m => m !== val);
      renderArrearsMonths();
      filterFeeStudents();
  };

  window.renderArrearsMonths = () => {
      const container = document.getElementById('selectedArrearsMonths');
      if(window._arrearsMonths.length === 0) {
          container.innerHTML = '<span class="text-muted text-sm">No months selected (Showing all students)</span>';
          return;
      }
      container.innerHTML = window._arrearsMonths.map(m => `
          <span class="badge badge-red" style="display:inline-flex; align-items:center; gap:6px; font-size:12px; padding:6px 12px;">
              ${m} <span style="cursor:pointer; font-size:16px; margin-left:4px;" onclick="removeArrearsMonth('${m}')">✕</span>
          </span>
      `).join('');
  };

  window.filterFeeStudents = () => {
    const q = document.getElementById('feeStudentSearch').value.toLowerCase();
    const g = document.getElementById('feeGradeFilter').value;
    
    document.querySelectorAll('#feeStudentsTable tbody tr').forEach(row => {
      const text = row.querySelector('.student-info').textContent.toLowerCase();
      const grade = row.dataset.grade || '';
      const sid = parseInt(row.dataset.sid);
      
      let show = true;
      if (q && !text.includes(q)) show = false;
      if (g && grade !== g) show = false;
      
      // If arrears months are selected, check if student is missing ANY of those months
      if (show && window._arrearsMonths.length > 0) {
          const studentPayments = window._allFeePayments.filter(p => p.student_id === sid).map(p => p.fee_month);
          const isMissingAnyRequestedMonth = window._arrearsMonths.some(m => !studentPayments.includes(m));
          if (!isMissingAnyRequestedMonth) show = false; // They paid all requested months, hide them!
      }
      
      row.style.display = show ? '' : 'none';
    });
  };

  window.sendFeeReminders = async () => {
      const visibleRows = Array.from(document.querySelectorAll('#feeStudentsTable tbody tr')).filter(r => r.style.display !== 'none');
      const studentIds = visibleRows.map(r => parseInt(r.dataset.sid));
      
      if(studentIds.length === 0) {
          showToast("No students currently match the filter.", "error");
          return;
      }
      
      openModal('Send Gentle Fee Reminder', modalForm([
          { label: 'Alert Title', name: 'title', value: 'Fee Payment Reminder', required: true },
          { label: 'Message', name: 'message', type: 'textarea', value: 'This is a gentle reminder that your tuition fees are currently overdue based on our records. Please arrange payment with the office as soon as possible. Thank you!', required: true }
      ], async (fd) => {
          const payload = {
              title: fd.get('title'),
              message: fd.get('message'),
              student_ids: studentIds
          };
          
          try {
              const btn = document.querySelector('#modalBox .btn-primary');
              btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Sending...';
              btn.disabled = true;
              
              await apiJSON('/api/admin/broadcasts/specific', payload);
              closeModal();
              showToast(`Reminders sent directly to ${studentIds.length} student(s)!`, 'success');
          } catch(e) { showToast(e.message, 'error'); }
      }, 'Send Reminders'));
  };
}

window.editMasterFee = (gradeName, amount) => {
    document.getElementById('newGradeName').value = gradeName;
    document.getElementById('newGradeFee').value = amount;
    document.getElementById('newGradeFee').focus();
};

window.autoFillMasterFee = (gradeName) => {
    const feeRecord = window._currentGradeFees.find(f => f.grade_name === gradeName);
    document.getElementById('newGradeFee').value = feeRecord ? feeRecord.monthly_tuition : '';
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
        <thead><tr style="background:#f8fafc; border-bottom:2px solid #ddd;">
            <th style="padding:8px;text-align:left;">Date</th>
            <th style="padding:8px;text-align:left;">Fee Month / For</th>
            <th style="padding:8px;text-align:left;">Details</th>
            <th style="padding:8px;text-align:right;">Amount</th>
            <th style="padding:8px;text-align:center;">Action</th>
        </tr></thead>
        <tbody>`;
        
    data.payments.forEach(p => {
        // Explicitly format the new Fee Month column
        const monthFor = p.payment_type === 'monthly' ? `<span class="badge badge-blue" style="font-size:12px;">📅 ${p.fee_month}</span>` : `<span class="badge badge-purple" style="font-size:12px;">🏷️ ${escHtml(p.payment_for)}</span>`;
        
        html += `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${p.paid_date}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${monthFor}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;"><span class="text-muted text-sm">Type: ${p.payment_type.toUpperCase()}<br>Cashier: ${escHtml(p.recorded_by_name || 'Admin')}</span></td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;"><strong>LKR ${p.amount.toLocaleString()}</strong></td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">
                <button class="btn btn-secondary btn-xs" onclick="window.printPaymentReceipt(${p.id}, ${sid})" title="Print Receipt">🖨️</button>
                <button class="btn btn-danger btn-xs" onclick="deletePayment(${p.id}, ${sid})">✕</button>
            </td>
        </tr>`;
    });
    if(!data.payments.length) html += '<tr><td colspan="5" class="text-muted text-center" style="padding:20px;">No payments recorded for this student.</td></tr>';
    html += `</tbody></table>`;
    
    document.getElementById('modalBody').innerHTML = html;
};


// ================================================================
// TRASH BIN SYSTEM
// ================================================================

async function loadTrashBin(activeTab = 'trash-users') {
  setPageTitle('Trash Bin');
  setActiveSidebar('trash');
  setContent('<div class="loading-state"><div class="edu-loader"></div><p class="mt-16 text-muted font-bold">Loading LankaLearn...</p></div>');

  const trash = await api('/api/admin/trash');

  setContent(`
    <div class="page-header page-header-row">
      <div>
        <h1><i class="fas fa-trash-alt"></i>&nbsp; Trash Bin</h1>
        <p>Safely restore accidentally deleted records, or permanently destroy them.</p>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab(this,'trash-users')"><i class="fas fa-users"></i>&nbsp; Users (${trash.users.length})</button>
      <button class="tab-btn" onclick="switchTab(this,'trash-courses')"><i class="fas fa-book-open"></i>&nbsp; Courses (${trash.courses.length})</button>
      <button class="tab-btn" onclick="switchTab(this,'trash-fees')"><i class="fas fa-coins"></i>&nbsp;Student Fees (${trash.fees.length})</button>
      <button class="tab-btn" onclick="switchTab(this,'trash-tsalaries')"><i class="fas fa-file-invoice-dollar"></i>&nbsp;Teacher Salaries (${trash.teacher_salaries.length})</button>
    </div>

    <div id="trash-users" class="tab-panel card" style="display:block">
      <div class="table-wrapper">
        <table style="width:100%; font-size:13px;">
          <thead style="background:#f8fafc;"><tr><th>Name</th><th>Username</th><th>Role</th><th style="text-align:right">Action</th></tr></thead>
          <tbody>
            ${trash.users.map(u => `<tr>
              <td><strong>${escHtml(u.full_name)}</strong></td><td><code>${escHtml(u.username)}</code></td>
              <td><span class="badge badge-gray">${u.role.toUpperCase()}</span></td>
              <td style="text-align:right;">
                <button class="btn btn-success btn-xs" onclick="restoreItem('user', ${u.id})">♻️ Restore</button>
                <button class="btn btn-danger btn-xs" onclick="destroyItem('user', ${u.id})">💥 Destroy</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted" style="padding:20px;">No deleted users.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div id="trash-courses" class="tab-panel card" style="display:none">
      <div class="table-wrapper">
        <table style="width:100%; font-size:13px;">
          <thead style="background:#f8fafc;"><tr><th>Course Name</th><th>Code</th><th style="text-align:right">Action</th></tr></thead>
          <tbody>
            ${trash.courses.map(c => `<tr>
              <td><strong>${escHtml(c.name)}</strong></td><td><span class="badge badge-blue">${escHtml(c.code)}</span></td>
              <td style="text-align:right;">
                <button class="btn btn-success btn-xs" onclick="restoreItem('course', ${c.id})">♻️ Restore</button>
                <button class="btn btn-danger btn-xs" onclick="destroyItem('course', ${c.id})">💥 Destroy</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="3" class="text-center text-muted" style="padding:20px;">No deleted courses.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div id="trash-fees" class="tab-panel card" style="display:none">
      <div class="table-wrapper">
        <table style="width:100%; font-size:13px;">
          <thead style="background:#f8fafc;"><tr><th>Student</th><th>Amount / Type</th><th>Date</th><th style="text-align:right">Action</th></tr></thead>
          <tbody>
            ${trash.fees.map(f => `<tr>
              <td><strong>${escHtml(f.student_name)}</strong></td>
              <td>LKR ${f.amount.toLocaleString()} <span class="badge badge-purple">${f.payment_type}</span></td>
              <td>${f.paid_date}</td>
              <td style="text-align:right;">
                <button class="btn btn-success btn-xs" onclick="restoreItem('fee', ${f.id})">♻️ Restore</button>
                <button class="btn btn-danger btn-xs" onclick="destroyItem('fee', ${f.id})">💥 Destroy</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted" style="padding:20px;">No deleted fees.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div id="trash-tsalaries" class="tab-panel card" style="display:none">
      <div class="table-wrapper">
        <table style="width:100%; font-size:13px;">
          <thead style="background:#f8fafc;"><tr><th>Teacher</th><th>Month</th><th>Amount</th><th style="text-align:right">Action</th></tr></thead>
          <tbody>
            ${trash.teacher_salaries.map(s => `<tr>
              <td><strong>${escHtml(s.teacher_name)}</strong></td>
              <td><span class="badge badge-blue">${s.month}</span></td>
              <td>LKR ${s.amount.toLocaleString()}</td>
              <td style="text-align:right;">
                <button class="btn btn-success btn-xs" onclick="restoreItem('teacher_salary', ${s.id})">♻️ Restore</button>
                <button class="btn btn-danger btn-xs" onclick="destroyItem('teacher_salary', ${s.id})">💥 Destroy</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted" style="padding:20px;">No deleted salaries.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `);

  // Ensure the requested tab opens cleanly when restoring/destroying items
  const tabBtn = document.querySelector(`button[onclick*="'${activeTab}'"]`);
  if (tabBtn) switchTab(tabBtn, activeTab);
}

window.restoreItem = async (type, id) => {
    try {
        await apiJSON('/api/admin/trash/restore', { type, id });
        showToast('Successfully restored!', 'success');
        const activeTab = document.querySelector('.tab-btn.active').getAttribute('onclick').match(/'([^']+)'/)[1];
        loadTrashBin(activeTab);
    } catch(e) { showToast(e.message, 'error'); }
};

window.destroyItem = async (type, id) => {
    if (!confirm('WARNING: Are you sure you want to PERMANENTLY destroy this record? All linked history will be wiped. This CANNOT be undone!')) return;
    try {
        await apiJSON('/api/admin/trash/permanent', { type, id });
        showToast('Record destroyed forever.', 'success');
        const activeTab = document.querySelector('.tab-btn.active').getAttribute('onclick').match(/'([^']+)'/)[1];
        loadTrashBin(activeTab);
    } catch(e) { showToast(e.message, 'error'); }
};
// ================================================================
// TIMETABLE MANAGEMENT
// ================================================================

window.manageClassTimetable = async (gradeName) => {
    openModal(`Weekly Timetable: ${gradeName}`, '<div class="loading-state"><div class="spinner"></div></div>', 'modal-box-lg');
    
    try {
        const data = await api(`/api/classes/${encodeURIComponent(gradeName)}/timetable`);
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
                <p class="text-muted text-sm" style="margin:0;">Click any existing slot to remove it.</p>
                <button class="btn btn-primary btn-sm" onclick="showAddTimetableSlot('${escHtml(gradeName)}')">
                    <span style="margin-right:4px;">➕</span> Add Class Slot
                </button>
            </div>

            <div style="width: 100%; overflow-x: auto; padding-bottom: 12px; border-radius: 8px;">
                <div style="display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 12px; min-height: 400px;">
        `;

        days.forEach(day => {
            const dayEntries = data.entries.filter(e => e.day_of_week === day).sort((a,b) => a.start_time.localeCompare(b.start_time));
            
            html += `
                <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden;">
                    <div style="background: #e2e8f0; color: var(--primary-dark); text-align: center; font-weight: 800; font-size: 12px; text-transform: uppercase; padding: 10px; letter-spacing: 0.5px;">
                        ${day}
                    </div>
                    <div style="padding: 12px; display: flex; flex-direction: column; gap: 10px; flex: 1;">
                        ${dayEntries.length === 0 ? `<div class="text-center text-muted text-sm" style="margin-top:20px;">No Classes</div>` : ''}
                        ${dayEntries.map(e => `
                            <div style="background: white; border: 1px solid var(--border); border-left: 4px solid #8b5cf6; padding: 10px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); cursor: pointer; transition: all 0.2s;" 
                                 onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.08)';" 
                                 onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.02)';"
                                 onclick="deleteTimetableSlot(${e.id}, '${escHtml(gradeName)}')">
                                <div style="font-size: 11px; font-weight: 700; color: #8b5cf6; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                                    🕒 ${e.start_time} - ${e.end_time}
                                </div>
                                <div style="font-size: 13px; font-weight: 700; line-height: 1.3; color: var(--text); margin-bottom: 6px;">
                                    ${escHtml(e.course_name)}
                                </div>
                                <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                                    👨‍🏫 ${escHtml(e.teacher_name || 'TBA')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        });
        
        html += `
                </div>
            </div>
        `;
        window._currentTimetableCourses = data.courses; // Save courses for the dropdown
        document.getElementById('modalBody').innerHTML = html;
        
    } catch(e) { document.getElementById('modalBody').innerHTML = `<div class="alert alert-error">${e.message}</div>`; }
};

window.showAddTimetableSlot = (gradeName) => {
    const courses = window._currentTimetableCourses || [];
    
    // Sort courses nicely, putting ones that match the grade at the top
    const sortedCourses = courses.sort((a, b) => {
        if (a.grade === gradeName && b.grade !== gradeName) return -1;
        if (a.grade !== gradeName && b.grade === gradeName) return 1;
        return a.name.localeCompare(b.name);
    });

    // PRO-UI: Made the form inset and integrated cleanly
    const formHtml = `
        <div id="addSlotFormContainer" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h4 style="margin:0; color:var(--primary-dark); font-size:15px;">➕ Add Class Slot</h4>
                <button class="btn btn-secondary btn-xs" onclick="document.getElementById('addSlotFormContainer').remove()" style="border:none; background:transparent; font-size:16px; cursor:pointer;" title="Close">✕</button>
            </div>
            <div class="form-row form-row-2" style="margin-bottom:16px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:12px; font-weight:600;">Day of Week</label>
                    <select id="ttDay" class="form-control" style="font-size:13px; padding:8px;">
                        <option value="Monday">Monday</option><option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option><option value="Thursday">Thursday</option><option value="Friday">Friday</option>
                    </select>
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:12px; font-weight:600;">Subject / Course</label>
                    <select id="ttCourse" class="form-control" style="font-size:13px; padding:8px;">
                        ${sortedCourses.map(c => `<option value="${c.id}">${c.grade === gradeName ? '⭐ ' : ''}${escHtml(c.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row form-row-2" style="margin-bottom:20px;">
                <div class="form-group" style="margin:0;"><label style="font-size:12px; font-weight:600;">Start Time</label><input type="time" id="ttStart" class="form-control" style="font-size:13px; padding:8px;" step="900" required></div>
                <div class="form-group" style="margin:0;"><label style="font-size:12px; font-weight:600;">End Time</label><input type="time" id="ttEnd" class="form-control" style="font-size:13px; padding:8px;" step="900" required></div>
            </div>
            <div style="display:flex; justify-content:flex-end;">
                <button class="btn btn-primary" onclick="submitTimetableSlot('${escHtml(gradeName)}')" style="padding:8px 24px;">Save Slot</button>
            </div>
        </div>
    `;
    
    const body = document.getElementById('modalBody');
    if (!document.getElementById('addSlotFormContainer')) {
        body.insertAdjacentHTML('afterbegin', formHtml);
    }
};

window.submitTimetableSlot = async (gradeName) => {
    const day = document.getElementById('ttDay').value;
    const courseId = document.getElementById('ttCourse').value;
    const start = document.getElementById('ttStart').value;
    const end = document.getElementById('ttEnd').value;
    
    if(!start || !end) return showToast("Please set both start and end times", "error");
    
    try {
        await apiJSON(`/api/admin/classes/${encodeURIComponent(gradeName)}/timetable`, { day, course_id: courseId, start_time: start, end_time: end });
        showToast("Slot added!", "success");
        manageClassTimetable(gradeName); // Refresh the view
    } catch(e) { showToast(e.message, 'error'); }
};

window.deleteTimetableSlot = async (id, gradeName) => {
    if(!confirm("Remove this class from the timetable?")) return;
    try {
        await apiDelete(`/api/admin/timetable/${id}`);
        manageClassTimetable(gradeName); // Refresh the view
    } catch(e) { showToast(e.message, 'error'); }
};


// ================================================================
// TEACHER SALARY MANAGEMENT (ADMIN)
// ================================================================

async function loadTeacherSalaries() {
    setPageTitle('Teacher Salaries');
    setActiveSidebar('tsalaries');
    setContent('<div class="loading-state"><div class="edu-loader"></div><p class="mt-16 text-muted font-bold">Loading LankaLearn...</p></div>');
    
    // Fetch users and filter teachers
    const users = await api('/api/admin/users').catch(() => []);
    const teachers = users.filter(u => u.role === 'teacher');
    
    setContent(`
      <div class="page-header">
        <h1><i class="fas fa-file-invoice-dollar" style="color:var(--primary-dark);"></i> Teacher Salaries</h1>
        <p>Manage payroll, view history, and issue payslips for teaching staff.</p>
      </div>
  
      <div class="card">
        <div class="card-header" style="background:#fafafa;">
          <span class="card-title">Teaching Staff Payroll Directory</span>
          <input type="text" id="salaryTeacherSearch" class="search-box" style="float:right;" placeholder="🔍 Search teacher..." oninput="filterSalaryTeachers()">
        </div>
        <div class="table-wrapper">
          <table id="salaryTeachersTable">
            <thead><tr><th>Teacher Name</th><th>Username</th><th>Contact</th><th>Actions</th></tr></thead>
            <tbody>
              ${teachers.map(t => `
                <tr class="salary-teacher-row">
                  <td class="st-name"><strong>${escHtml(t.full_name)}</strong></td>
                  <td><code>${escHtml(t.username)}</code></td>
                  <td>${escHtml(t.phone || '—')}</td>
                  <td><button class="btn btn-success btn-sm" onclick="viewTeacherSalary(${t.id}, '${escHtml(t.full_name)}')"><i class="fas fa-money-check-alt"></i> Manage Payroll</button></td>
                </tr>
              `).join('')}
              ${!teachers.length ? '<tr><td colspan="4" class="text-center text-muted" style="padding:20px;">No teachers found in the system.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `);

    window.filterSalaryTeachers = () => {
        const q = document.getElementById('salaryTeacherSearch').value.toLowerCase();
        document.querySelectorAll('.salary-teacher-row').forEach(row => {
            row.style.display = row.querySelector('.st-name').textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    };
}

window.viewTeacherSalary = async (teacherId, teacherName) => {
    openModal(`Payroll Dashboard — ${teacherName}`, '<div class="loading-state"><div class="spinner"></div></div>', 'modal-box-lg');
    
    const history = await api(`/api/admin/teachers/${teacherId}/salary`).catch(() => []);
    window._currentTeacherSalaryHistory = history; // Store for the edit form
    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = new Date().toISOString().split('T')[0];

    let html = `
      <div style="background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:16px; margin-bottom:24px;">
        <h4 style="margin-top:0; margin-bottom:16px; color:var(--primary-dark);">Issue New Salary Payment</h4>
        <div class="form-row form-row-3">
          <div class="form-group"><label>Salary Month</label><input type="month" id="salMonth" class="form-control" value="${currentMonth}"></div>
          <div class="form-group"><label>Payment Date</label><input type="date" id="salDate" class="form-control" value="${today}"></div>
          <div class="form-group"><label>Payment Method</label>
            <select id="salMethod" class="form-control" onchange="document.getElementById('salRef').placeholder = this.value === 'Cheque' ? 'Cheque Number' : 'Transaction ID / Notes'">
              <option value="Bank Transfer">Bank Transfer</option><option value="Cheque">Cheque</option><option value="Cash">Cash</option>
            </select>
          </div>
        </div>
        <div class="form-row form-row-3">
          <div class="form-group"><label>Basic Salary (LKR)</label><input type="number" id="salBasic" class="form-control" value="0" oninput="calculateNetSalary()"></div>
          <div class="form-group"><label>Allowances/Bonus (LKR)</label><input type="number" id="salAllow" class="form-control" value="0" oninput="calculateNetSalary()"></div>
          <div class="form-group"><label>Deductions (LKR)</label><input type="number" id="salDeduct" class="form-control" value="0" oninput="calculateNetSalary()"></div>
        </div>
        <div class="form-row form-row-2" style="align-items:flex-end;">
          <div class="form-group" style="margin:0;"><label>Reference / Cheque Number</label><input type="text" id="salRef" class="form-control" placeholder="Transaction ID / Notes"></div>
          <div style="background:#dbeafe; padding:10px 16px; border-radius:8px; border:1px solid #93c5fd; display:flex; justify-content:space-between; align-items:center;">
             <span style="font-weight:700; color:#1e40af; font-size:12px; text-transform:uppercase;">Net Payable:</span>
             <span id="salNetDisplay" style="font-size:20px; font-weight:800; color:#1e3a8a;">LKR 0</span>
          </div>
        </div>
        <button class="btn btn-primary w-full mt-16" onclick="submitTeacherSalary(${teacherId}, '${escHtml(teacherName)}')"><i class="fas fa-check-circle"></i> Record & Issue Payslip</button>
      </div>

      <h4 style="margin-bottom:12px;">Payment History</h4>
      <div class="table-wrapper">
        <table style="width:100%; font-size:13px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th>Month</th><th>Date & Method</th><th>Breakdown</th><th style="text-align:right;">Net Paid</th><th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${history.map(h => `
              <tr>
                <td><span class="badge badge-blue">📅 ${h.month}</span></td>
                <td>${h.paid_date}<br><span class="text-muted text-sm">${h.method} (${escHtml(h.reference || 'N/A')})</span></td>
                <td style="font-size:11px; color:var(--text-muted);">Basic: ${h.basic.toLocaleString()}<br>+ Allw: ${h.allowances.toLocaleString()}<br>- Ded: ${h.deductions.toLocaleString()}</td>
                <td style="text-align:right;"><strong>LKR ${h.net_paid.toLocaleString()}</strong></td>
                <td style="text-align:center;">
                  <button class="btn btn-secondary btn-xs" onclick="printPayslip('${escHtml(teacherName)}', '${h.month}', ${h.basic}, ${h.allowances}, ${h.deductions}, ${h.net_paid})" title="Print">🖨️</button>
                  <button class="btn btn-primary btn-xs" onclick="editTeacherSalary(${h.id}, ${teacherId}, '${escHtml(teacherName)}')">✏️ Edit</button>
                  <button class="btn btn-danger btn-xs" onclick="deleteTeacherSalary(${h.id}, ${teacherId}, '${escHtml(teacherName)}', '${h.month}')">✕</button>
                </td>
              </tr>
            `).join('')}
            ${!history.length ? '<tr><td colspan="5" class="text-center text-muted" style="padding:15px;">No salary records found.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    `;
    document.getElementById('modalBody').innerHTML = html;
};

// Add these two new functions right underneath calculateNetSalary
window.editTeacherSalary = (salaryId, teacherId, teacherName) => {
    const record = window._currentTeacherSalaryHistory.find(h => h.id === salaryId);
    if (!record) return;

    openModal(`Edit Salary — ${teacherName} (${record.month})`, modalForm([
        { label: 'Payment Date', name: 'paid_date', type: 'date', value: record.paid_date, required: true },
        { label: 'Payment Method', name: 'method', type: 'select', value: record.method, options: [
            {value: 'Bank Transfer', label: 'Bank Transfer'}, {value: 'Cheque', label: 'Cheque'}, {value: 'Cash', label: 'Cash'}
        ]},
        { label: 'Reference / Cheque Number', name: 'reference', value: record.reference || '' },
        { label: 'Basic Salary (LKR)', name: 'basic', type: 'number', value: record.basic, required: true },
        { label: 'Allowances (LKR)', name: 'allowances', type: 'number', value: record.allowances, required: true },
        { label: 'Deductions (LKR)', name: 'deductions', type: 'number', value: record.deductions, required: true }
    ], async (fd) => {
        const basic = parseFloat(fd.get('basic')) || 0;
        const allow = parseFloat(fd.get('allowances')) || 0;
        const deduct = parseFloat(fd.get('deductions')) || 0;
        const net = basic + allow - deduct;

        const payload = {
            paid_date: fd.get('paid_date'),
            method: fd.get('method'),
            reference: fd.get('reference'),
            basic: basic, allowances: allow, deductions: deduct, net_paid: net
        };

        try {
            await fetch(`/api/admin/teachers/salary/${salaryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            showToast('Salary updated successfully!', 'success');
            closeModal();
            viewTeacherSalary(teacherId, teacherName); // Refresh UI
        } catch(e) { showToast(e.message, 'error'); }
    }, 'Update Salary'));
};

window.deleteTeacherSalary = async (salaryId, teacherId, teacherName, month) => {
    if (!confirm(`Are you sure you want to permanently delete the salary record for ${month}?`)) return;
    try {
        await apiDelete(`/api/admin/teachers/salary/${salaryId}`);
        showToast('Salary record deleted.', 'success');
        viewTeacherSalary(teacherId, teacherName); // Refresh UI
    } catch (e) { showToast(e.message, 'error'); }
};

window.calculateNetSalary = () => {
    const basic = parseFloat(document.getElementById('salBasic').value) || 0;
    const allow = parseFloat(document.getElementById('salAllow').value) || 0;
    const deduct = parseFloat(document.getElementById('salDeduct').value) || 0;
    const net = basic + allow - deduct;
    
    document.getElementById('salNetDisplay').textContent = `LKR ${net.toLocaleString()}`;
    if (net < 0) {
        document.getElementById('salNetDisplay').style.color = '#dc2626'; // Red if negative
    } else {
        document.getElementById('salNetDisplay').style.color = '#1e3a8a';
    }
};

window.submitTeacherSalary = async (teacherId, teacherName) => {
    const basic = parseFloat(document.getElementById('salBasic').value) || 0;
    const net = basic + (parseFloat(document.getElementById('salAllow').value) || 0) - (parseFloat(document.getElementById('salDeduct').value) || 0);
    
    if (net <= 0) return showToast("Net payable amount must be greater than 0.", "error");

    const payload = {
        month: document.getElementById('salMonth').value,
        paid_date: document.getElementById('salDate').value,
        method: document.getElementById('salMethod').value,
        reference: document.getElementById('salRef').value,
        basic: basic,
        allowances: parseFloat(document.getElementById('salAllow').value) || 0,
        deductions: parseFloat(document.getElementById('salDeduct').value) || 0,
        net_paid: net
    };

    try {
        await apiJSON(`/api/admin/teachers/${teacherId}/salary`, payload);
        showToast('Salary payment recorded successfully!', 'success');
        viewTeacherSalary(teacherId, teacherName); // Refresh Modal
    } catch(e) { showToast(e.message, 'error'); }
};


// ================================================================
// COURSE CREATION, EDITING & ENROLLMENT (RESTORED)
// ================================================================

window.showCreateCourse = () => {
    const teachers = window._adminTeachers || [];
    
    // Automatically select the grade from the filter if one is active
    const activeGradeFilter = document.getElementById('courseGradeFilter')?.value || '';

    openModal('Create Course', modalForm([
        { label: 'Course Code', name: 'code', placeholder: 'e.g. OL-MATH-11', required: true },
        { label: 'Course Name', name: 'name', placeholder: 'e.g. O/L Mathematics', required: true },
        { label: 'Grade (Categorization)', name: 'grade', type: 'select', value: activeGradeFilter, options: GRADE_OPTIONS },
        { label: 'Description', name: 'description', type: 'textarea' },
        { label: 'Assign Teacher', name: 'teacher_id', type: 'select', required: true,
          options: [{ value: '', label: '— Select a Teacher —' }, ...teachers.map(t => ({ value: t.id, label: t.full_name }))] },
        { label: 'Start Date (Optional)', name: 'start_date', type: 'date' },
        { label: 'End Date (Optional)', name: 'end_date', type: 'date' }
    ], async (fd) => {
        try {
            await apiPost('/api/admin/courses', fd);
            closeModal(); showToast('Course created successfully!', 'success'); loadAdminCourses();
        } catch(e) { showToast(e.message, 'error'); }
    }, 'Create Course'));
};

window.showEditCourse = (cid) => {
    const c = window._adminCourses.find(x => x.id === cid);
    if (!c) return;
    const teachers = window._adminTeachers || [];
    
    openModal(`Edit Course: ${c.code}`, modalForm([
        { label: 'Course Code', name: 'code', value: c.code, required: true },
        { label: 'Course Name', name: 'name', value: c.name, required: true },
        { label: 'Grade (Categorization)', name: 'grade', type: 'select', value: c.grade || '', options: GRADE_OPTIONS },
        { label: 'Description', name: 'description', type: 'textarea', value: c.description || '' },
        { label: 'Assign Teacher', name: 'teacher_id', type: 'select', value: c.teacher_id || '', required: true,
          options: [{ value: '', label: '— Select a Teacher —' }, ...teachers.map(t => ({ value: t.id, label: t.full_name }))] },
        { label: 'Start Date', name: 'start_date', type: 'date', value: c.start_date || '' },
        { label: 'End Date', name: 'end_date', type: 'date', value: c.end_date || '' }
    ], async (fd) => {
        try {
            await api(`/api/admin/courses/${cid}`, { method: 'PUT', body: fd });
            closeModal(); showToast('Course updated!', 'success'); loadAdminCourses();
        } catch(e) { showToast(e.message, 'error'); }
    }, 'Save Changes'));
};

window.manageEnrollments = async (cid, cname) => {
    openModal(`Manage Students: ${cname}`, '<div class="loading-state"><div class="spinner"></div></div>', 'modal-box-lg');
    try {
        const data = await api(`/api/admin/courses/${cid}/students`);
        window._availableStudents = data.available;
        window._selectedStudentIds = new Set();

        const gradeFilterOptions = GRADE_OPTIONS.map(g => `<option value="${g.value}">${g.label === '— Select Grade (or leave blank) —' ? 'All Grades' : g.label}</option>`).join('');

        let html = `
            <div class="tabs mb-16">
                <button class="tab-btn active" id="btnTabEnrolled" onclick="switchEnrollTab('enrolled')">Currently Enrolled (${data.enrolled.length})</button>
                <button class="tab-btn" id="btnTabAvailable" onclick="switchEnrollTab('available')">➕ Add New Students</button>
            </div>

            <div id="enrollTab-enrolled" style="display:block;">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <input type="text" id="enrollSearch" class="form-control" style="width:100%; max-width:300px;" placeholder="🔍 Search enrolled students..." oninput="filterEnrollments()">
                    ${data.enrolled.length > 0 ? `<button class="btn btn-danger btn-sm" onclick="bulkUnenrollStudents(${cid}, '${escHtml(cname)}')"><i class="fas fa-trash-alt"></i> Remove Displayed</button>` : ''}
                </div>
                <div class="table-wrapper" style="max-height: 400px; overflow-y: auto;">
                    <table id="enrollmentTable" style="width:100%; font-size:13.5px;">
                        <thead style="position:sticky; top:0; z-index:1; background:#f8fafc;">
                            <tr>
                                <th style="padding:12px; text-align:left;">Student Name</th>
                                <th style="padding:12px; text-align:left;">Grade</th>
                                <th style="padding:12px; text-align:right;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.enrolled.map(s => `
                                <tr class="enrollment-row" data-sid="${s.id}">
                                    <td class="en-name" style="padding:12px; border-bottom:1px solid #f1f5f9;">
                                        <strong>${escHtml(s.full_name)}</strong><br>
                                        <span class="text-muted text-sm">${escHtml(s.username)}</span>
                                    </td>
                                    <td style="padding:12px; border-bottom:1px solid #f1f5f9;">
                                        <span class="badge badge-gray">${escHtml(s.grade || 'Unassigned')}</span>
                                    </td>
                                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; text-align:right;">
                                        <button class="btn btn-danger btn-sm" onclick="unenrollStudent(${cid}, ${s.id}, '${escHtml(cname)}')"><i class="fas fa-trash"></i> Remove</button>
                                    </td>
                                </tr>
                            `).join('')}
                            ${data.enrolled.length === 0 ? '<tr><td colspan="3" class="text-center text-muted" style="padding:30px;">No students are currently enrolled in this course.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <div id="enrollTab-available" style="display:none;">
                <div style="display:flex; gap:10px; margin-bottom:16px;">
                    <input type="text" id="availStudentSearch" class="form-control" style="flex: 1;" placeholder="Search by name or username..." oninput="filterAvailableStudents()">
                    <select id="availStudentGrade" class="form-control" style="width:160px;" onchange="filterAvailableStudents()">
                        ${gradeFilterOptions}
                    </select>
                </div>

                <div id="availStudentList" style="max-height: 350px; overflow-y: auto; padding-right: 8px; margin-bottom: 20px; border-radius: 8px;">
                    </div>

                <div class="flex gap-8" style="justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:16px;">
                    <div class="text-sm" style="color: var(--primary-dark); font-weight: 600;"><strong id="bulkStudentCount">0</strong> students selected</div>
                    <div class="flex gap-8">
                        <button type="button" class="btn btn-secondary" onclick="toggleSelectAllBulkStudents()">Select All Visible</button>
                        <button type="button" id="bulkEnrollBtn" class="btn btn-primary" disabled onclick="bulkEnrollStudents(${cid}, '${escHtml(cname)}')">
                            <i class="fas fa-user-plus"></i> Enroll 0 Student(s)
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('modalBody').innerHTML = html;

        window.switchEnrollTab = (tab) => {
            document.getElementById('btnTabEnrolled').classList.remove('active');
            document.getElementById('btnTabAvailable').classList.remove('active');
            document.getElementById('enrollTab-enrolled').style.display = 'none';
            document.getElementById('enrollTab-available').style.display = 'none';
            
            if (tab === 'enrolled') {
                document.getElementById('btnTabEnrolled').classList.add('active');
                document.getElementById('enrollTab-enrolled').style.display = 'block';
            } else {
                document.getElementById('btnTabAvailable').classList.add('active');
                document.getElementById('enrollTab-available').style.display = 'block';
                filterAvailableStudents();
            }
        };

        window.filterEnrollments = () => {
            const q = document.getElementById('enrollSearch').value.toLowerCase();
            document.querySelectorAll('.enrollment-row').forEach(row => {
                row.style.display = row.querySelector('.en-name').textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        };

        window.filterAvailableStudents = () => {
            const q = document.getElementById('availStudentSearch').value.toLowerCase();
            const g = document.getElementById('availStudentGrade').value;

            const filtered = window._availableStudents.filter(s => {
                const matchQ = !q || s.full_name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q);
                const matchG = !g || (s.grade || '') === g;
                return matchQ && matchG;
            });

            const listEl = document.getElementById('availStudentList');
            if (filtered.length === 0) {
                listEl.innerHTML = '<div class="empty-state text-center text-muted" style="padding:20px; font-size:13px;">No available students match your criteria.</div>';
                return;
            }

            listEl.innerHTML = filtered.map(s => {
                const isChecked = window._selectedStudentIds.has(s.id) ? 'checked' : '';
                return `
                    <label class="avail-student-row" style="display:flex; align-items:center; gap:14px; padding:12px 14px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px; cursor:pointer; background:white; transition:all 0.2s;" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1';" onmouseout="this.style.background='white'; this.style.borderColor='var(--border)';">
                        <input type="checkbox" class="chk-avail-student" value="${s.id}" ${isChecked} onchange="toggleBulkStudent(${s.id}, this.checked)" style="transform:scale(1.3); cursor:pointer;">
                        <div style="flex:1;">
                            <div style="font-weight:600; color:var(--text); font-size: 14px;">
                                ${escHtml(s.full_name)}
                            </div>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                                <strong>Username:</strong> ${escHtml(s.username)} &nbsp;|&nbsp; 
                                <strong>Grade:</strong> <span class="badge badge-gray" style="font-size:9px; padding:2px 6px;">${escHtml(s.grade || 'Unassigned')}</span>
                            </div>
                        </div>
                    </label>
                `;
            }).join('');
        };

        window.toggleBulkStudent = (id, checked) => {
            if (checked) window._selectedStudentIds.add(id);
            else window._selectedStudentIds.delete(id);
            
            const count = window._selectedStudentIds.size;
            document.getElementById('bulkStudentCount').textContent = count;
            
            const btn = document.getElementById('bulkEnrollBtn');
            btn.disabled = count === 0;
            btn.innerHTML = `<i class="fas fa-user-plus"></i> Enroll ${count} Student(s)`;
        };

        window.toggleSelectAllBulkStudents = () => {
            const checkboxes = document.querySelectorAll('.chk-avail-student');
            if (checkboxes.length === 0) return;
            
            // Check if they are currently all selected
            const allSelected = Array.from(checkboxes).every(cb => cb.checked);
            
            checkboxes.forEach(cb => {
                cb.checked = !allSelected;
                toggleBulkStudent(parseInt(cb.value), !allSelected);
            });
        };

        window.bulkEnrollStudents = async (cId, cName) => {
            if (window._selectedStudentIds.size === 0) return;
            
            const btn = document.getElementById('bulkEnrollBtn');
            btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Enrolling...';
            btn.disabled = true;

            try {
                const idsArray = Array.from(window._selectedStudentIds);
                await apiJSON(`/api/admin/courses/${cId}/enroll/bulk`, { student_ids: idsArray });
                showToast(`Successfully enrolled ${idsArray.length} student(s)!`, 'success');
                
                // Refresh modal
                manageEnrollments(cId, cName);
                // Refresh background grid quietly to update numbers
                api('/api/admin/courses').then(c => { window._adminCourses = c; renderFilteredCourses(); });
            } catch (e) {
                showToast(e.message, 'error');
                btn.innerHTML = `<i class="fas fa-user-plus"></i> Enroll ${window._selectedStudentIds.size} Student(s)`;
                btn.disabled = false;
            }
        };

        window.unenrollStudent = async (cId, sId, cName) => {
            if (!confirm('Are you sure you want to remove this student from the course?')) return;
            try {
                await apiDelete(`/api/admin/courses/${cId}/enroll/${sId}`);
                showToast('Student removed from course.', 'success');
                manageEnrollments(cId, cName);
                api('/api/admin/courses').then(c => { window._adminCourses = c; renderFilteredCourses(); });
            } catch (e) { showToast(e.message, 'error'); }
        };

        window.bulkUnenrollStudents = async (cId, cName) => {
            const visibleRows = Array.from(document.querySelectorAll('.enrollment-row')).filter(row => row.style.display !== 'none');
            const studentIds = visibleRows.map(row => parseInt(row.getAttribute('data-sid')));
            
            if (studentIds.length === 0) return;
            if (!confirm(`Are you sure you want to remove these ${studentIds.length} students from the course?`)) return;

            try {
                await apiJSON(`/api/admin/courses/${cId}/unenroll/bulk`, { student_ids: studentIds });
                showToast(`Successfully removed ${studentIds.length} student(s).`, 'success');
                manageEnrollments(cId, cName);
                api('/api/admin/courses').then(c => { window._adminCourses = c; renderFilteredCourses(); });
            } catch (e) { showToast(e.message, 'error'); }
        };

    } catch (e) {
        document.getElementById('modalBody').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
};


// ================================================================
// ACADEMIC ROLLOVER (BULK PROMOTION TOOL)
// ================================================================

window.showBulkPromoteModal = () => {
    // Re-use your existing global GRADE_OPTIONS
    const gradeOptionsHtml = GRADE_OPTIONS.map(g => `<option value="${g.value}">${g.label === '— Select Grade (or leave blank) —' ? '— Select a Grade —' : g.label}</option>`).join('');
    
    openModal('Academic Rollover Tool', `
        <div class="alert alert-info mb-16">
            <i class="fas fa-info-circle"></i> Use this tool at the end of the academic year to promote an entire class to the next grade level. You can manually uncheck students who are repeating the year or leaving the school.
        </div>

        <div class="form-row form-row-2">
            <div class="form-group">
                <label>Source Grade (Current)</label>
                <select id="promoSource" class="form-control" onchange="loadStudentsForPromotion()">
                    ${gradeOptionsHtml}
                </select>
            </div>
            <div class="form-group">
                <label>Destination Grade (Next Year)</label>
                <select id="promoTarget" class="form-control">
                    ${gradeOptionsHtml}
                </select>
            </div>
        </div>

        <div id="promoStudentList" style="max-height: 350px; overflow-y: auto; padding-right: 8px; margin-bottom: 20px; border-radius: 8px; border: 1px solid var(--border); background: #f8fafc; padding: 12px; display: none;">
            </div>

        <div class="flex gap-8" style="justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:16px;">
            <div class="text-sm text-muted">Ensure all checkboxes are correct before proceeding.</div>
            <div class="flex gap-8">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="button" id="promoSubmitBtn" class="btn btn-primary" disabled onclick="submitBulkPromotion()">
                     Promote Selected Students
                </button>
            </div>
        </div>
    `, 'modal-box-lg');
};

window.loadStudentsForPromotion = async () => {
    const source = document.getElementById('promoSource').value;
    const listEl = document.getElementById('promoStudentList');
    const submitBtn = document.getElementById('promoSubmitBtn');
    
    if (!source) {
        listEl.style.display = 'none';
        submitBtn.disabled = true;
        return;
    }

    listEl.style.display = 'block';
    listEl.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    
    // Ensure we have users cached
    if (!window._adminUsers) {
        window._adminUsers = await api('/api/admin/users');
    }
    
    const promoStudents = window._adminUsers.filter(u => u.role === 'student' && (u.grade === source || (source === 'Unassigned' && !u.grade)));
    
    if (promoStudents.length === 0) {
        listEl.innerHTML = '<div class="empty-state text-muted" style="padding:20px;">No students found in this grade.</div>';
        submitBtn.disabled = true;
        return;
    }

    let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid #e2e8f0;">
        <label style="font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="chkPromoAll" checked onchange="togglePromoAll(this.checked)" style="transform:scale(1.2);"> 
            Select All (${promoStudents.length} Students)
        </label>
    </div>`;

    html += promoStudents.map(s => `
        <label style="display:flex; align-items:center; gap:14px; padding:10px; border-bottom:1px solid #e2e8f0; cursor:pointer; background:white; transition:all 0.15s;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='white'">
            <input type="checkbox" class="chk-promo-student" value="${s.id}" checked onchange="updatePromoBtn()" style="transform:scale(1.2);">
            <div style="flex:1;">
                <div style="font-weight:600; font-size: 14px; color:var(--text);">${escHtml(s.full_name)}</div>
                <div style="font-size:11px; color:var(--text-muted);">${s.admission_number ? escHtml(s.admission_number) : escHtml(s.username)}</div>
            </div>
        </label>
    `).join('');

    listEl.innerHTML = html;
    updatePromoBtn();
};

window.togglePromoAll = (checked) => {
    document.querySelectorAll('.chk-promo-student').forEach(cb => cb.checked = checked);
    updatePromoBtn();
};

window.updatePromoBtn = () => {
    const checkedCount = document.querySelectorAll('.chk-promo-student:checked').length;
    const btn = document.getElementById('promoSubmitBtn');
    const chkAll = document.getElementById('chkPromoAll');
    
    btn.disabled = checkedCount === 0;
    btn.innerHTML = `🚀 Promote ${checkedCount} Student(s)`;
    
    if (chkAll) {
        chkAll.checked = checkedCount === document.querySelectorAll('.chk-promo-student').length;
    }
};

window.submitBulkPromotion = async () => {
    const target = document.getElementById('promoTarget').value;
    const source = document.getElementById('promoSource').value;
    
    if (!target) return showToast("Please select a Destination Grade.", "error");
    if (target === source) return showToast("Destination Grade must be different from Source Grade.", "error");

    const checkedIds = Array.from(document.querySelectorAll('.chk-promo-student:checked')).map(cb => parseInt(cb.value));
    if (checkedIds.length === 0) return;

    // --- NEW: COLLISION DETECTOR ---
    // Check if the destination grade already has students sitting in it!
    const existingInTarget = window._adminUsers.filter(u => u.role === 'student' && u.grade === target).length;

    if (existingInTarget > 0 && !target.includes('Alumni')) {
        const warningMsg = `⚠️ CRITICAL COLLISION DETECTED ⚠️\n\nThere are ALREADY ${existingInTarget} students sitting in ${target}!\n\nIf you proceed, the students from ${source} will permanently mix with the existing ${target} students.\n\nRULE: You must promote ${target} to their next grade FIRST to clear the space.\n\nAre you absolutely sure you want to force this and mix the students together?`;
        
        if (!confirm(warningMsg)) return; // Stops the process if they click cancel
    } else {
        if (!confirm(`Are you sure you want to promote ${checkedIds.length} students to ${target}?`)) return;
    }
    // ---------------------------------

    const btn = document.getElementById('promoSubmitBtn');
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Processing...';
    btn.disabled = true;

    try {
        await apiJSON('/api/admin/bulk-promote', { student_ids: checkedIds, new_grade: target });
        showToast(`Successfully promoted ${checkedIds.length} students to ${target}!`, 'success');
        closeModal();
        
        // Force refresh the UI to show the new class sizes
        window._adminUsers = await api('/api/admin/users'); 
        loadAdminUsers('tab-classes');
    } catch(e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        updatePromoBtn(); 
    }
};


window.impersonateUser = async (uid, name) => {
    if(!confirm(`Are you sure you want to login as ${name}? Anything you do will be recorded under their account.`)) return;
    try {
        await apiPost(`/api/admin/impersonate/${uid}`);
        window.location.href = '/dashboard';
    } catch(e) { showToast(e.message, 'error'); }
};


// ================================================================
// STUDENT-CENTRIC COURSE MANAGEMENT
// ================================================================

window.manageStudentCourses = async (sid, studentName) => {
    openModal(`Manage Courses: ${studentName}`, '<div class="loading-state"><div class="spinner"></div></div>', 'modal-box-lg');
    try {
        const data = await api(`/api/admin/students/${sid}/courses`);
        window._availableCoursesForStudent = data.available;
        window._selectedCourseIdsForStudent = new Set();

        const gradeFilterOptions = GRADE_OPTIONS.map(g => `<option value="${g.value}">${g.label === '— Select Grade (or leave blank) —' ? 'All Grades' : g.label}</option>`).join('');

        let html = `
            <div class="tabs mb-16">
                <button class="tab-btn active" id="btnTabStudentEnrolled" onclick="switchStudentCourseTab('enrolled')">Currently Enrolled (${data.enrolled.length})</button>
                <button class="tab-btn" id="btnTabStudentAvailable" onclick="switchStudentCourseTab('available')">➕ Add New Courses</button>
            </div>

            <div id="studentCourseTab-enrolled" style="display:block;">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <input type="text" id="studentCourseSearch" class="form-control" style="width:100%; max-width:300px;" placeholder="🔍 Search enrolled courses..." oninput="filterStudentEnrolledCourses()">
                    ${data.enrolled.length > 0 ? `<button class="btn btn-danger btn-sm" onclick="bulkUnenrollStudentCourses(${sid}, '${escHtml(studentName)}')"><i class="fas fa-trash-alt"></i> Remove Displayed</button>` : ''}
                </div>
                <div class="table-wrapper" style="max-height: 400px; overflow-y: auto;">
                    <table id="studentCourseTable" style="width:100%; font-size:13.5px;">
                        <thead style="position:sticky; top:0; z-index:1; background:#f8fafc;">
                            <tr>
                                <th style="padding:12px; text-align:left;">Course Name</th>
                                <th style="padding:12px; text-align:left;">Teacher</th>
                                <th style="padding:12px; text-align:right;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.enrolled.map(c => `
                                <tr class="student-course-row" data-cid="${c.id}">
                                    <td class="sc-name" style="padding:12px; border-bottom:1px solid #f1f5f9;">
                                        <strong>${escHtml(c.name)}</strong> <span class="badge badge-blue">${escHtml(c.code)}</span><br>
                                        <span class="text-muted text-sm">${escHtml(c.grade || 'Unassigned')}</span>
                                    </td>
                                    <td style="padding:12px; border-bottom:1px solid #f1f5f9;">
                                        ${escHtml(c.teacher_name || 'Unassigned')}
                                    </td>
                                    <td style="padding:12px; border-bottom:1px solid #f1f5f9; text-align:right;">
                                        <button class="btn btn-danger btn-sm" onclick="unenrollStudentFromCourse(${sid}, ${c.id}, '${escHtml(studentName)}')"><i class="fas fa-trash"></i> Remove</button>
                                    </td>
                                </tr>
                            `).join('')}
                            ${data.enrolled.length === 0 ? '<tr><td colspan="3" class="text-center text-muted" style="padding:30px;">Student is not enrolled in any courses.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <div id="studentCourseTab-available" style="display:none;">
                <div style="display:flex; gap:10px; margin-bottom:16px;">
                    <input type="text" id="availCourseSearch" class="form-control" style="flex: 1;" placeholder="Search by course name or code..." oninput="filterAvailableCoursesForStudent()">
                    <select id="availCourseGrade" class="form-control" style="width:160px;" onchange="filterAvailableCoursesForStudent()">
                        ${gradeFilterOptions}
                    </select>
                </div>

                <div id="availCourseList" style="max-height: 350px; overflow-y: auto; padding-right: 8px; margin-bottom: 20px; border-radius: 8px;">
                    </div>

                <div class="flex gap-8" style="justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:16px;">
                    <div class="text-sm" style="color: var(--primary-dark); font-weight: 600;"><strong id="bulkStudentCourseCount">0</strong> courses selected</div>
                    <div class="flex gap-8">
                        <button type="button" class="btn btn-secondary" onclick="toggleSelectAllBulkStudentCourses()">Select All Visible</button>
                        <button type="button" id="bulkEnrollCourseBtn" class="btn btn-primary" disabled onclick="bulkEnrollStudentCourses(${sid}, '${escHtml(studentName)}')">
                            <i class="fas fa-plus"></i> Enroll in 0 Course(s)
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('modalBody').innerHTML = html;

        // Try to auto-select the student's grade in the available tab to speed up workflows
        const student = window._adminUsers.find(u => u.id === sid);
        if (student && student.grade) {
            const gradeDropdown = document.getElementById('availCourseGrade');
            if (gradeDropdown) gradeDropdown.value = student.grade;
        }

        window.switchStudentCourseTab = (tab) => {
            document.getElementById('btnTabStudentEnrolled').classList.remove('active');
            document.getElementById('btnTabStudentAvailable').classList.remove('active');
            document.getElementById('studentCourseTab-enrolled').style.display = 'none';
            document.getElementById('studentCourseTab-available').style.display = 'none';
            
            if (tab === 'enrolled') {
                document.getElementById('btnTabStudentEnrolled').classList.add('active');
                document.getElementById('studentCourseTab-enrolled').style.display = 'block';
            } else {
                document.getElementById('btnTabStudentAvailable').classList.add('active');
                document.getElementById('studentCourseTab-available').style.display = 'block';
                filterAvailableCoursesForStudent();
            }
        };

        window.filterStudentEnrolledCourses = () => {
            const q = document.getElementById('studentCourseSearch').value.toLowerCase();
            document.querySelectorAll('.student-course-row').forEach(row => {
                row.style.display = row.querySelector('.sc-name').textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        };

        window.filterAvailableCoursesForStudent = () => {
            const q = document.getElementById('availCourseSearch').value.toLowerCase();
            const g = document.getElementById('availCourseGrade').value;

            const filtered = window._availableCoursesForStudent.filter(c => {
                const matchQ = !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
                const matchG = !g || (c.grade || '') === g;
                return matchQ && matchG;
            });

            const listEl = document.getElementById('availCourseList');
            if (filtered.length === 0) {
                listEl.innerHTML = '<div class="empty-state text-center text-muted" style="padding:20px; font-size:13px;">No available courses match your criteria.</div>';
                return;
            }

            listEl.innerHTML = filtered.map(c => {
                const isChecked = window._selectedCourseIdsForStudent.has(c.id) ? 'checked' : '';
                return `
                    <label class="avail-course-row" style="display:flex; align-items:center; gap:14px; padding:12px 14px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px; cursor:pointer; background:white; transition:all 0.2s;" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1';" onmouseout="this.style.background='white'; this.style.borderColor='var(--border)';">
                        <input type="checkbox" class="chk-avail-course" value="${c.id}" ${isChecked} onchange="toggleBulkStudentCourse(${c.id}, this.checked)" style="transform:scale(1.3); cursor:pointer;">
                        <div style="flex:1;">
                            <div style="font-weight:600; color:var(--text); font-size: 14px;">
                                ${escHtml(c.name)} <span class="badge badge-blue" style="font-size:9px; padding:2px 6px; margin-left:6px;">${escHtml(c.code)}</span>
                            </div>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                                <strong>Teacher:</strong> ${escHtml(c.teacher_name || 'Unassigned')} &nbsp;|&nbsp; 
                                <strong>Grade:</strong> ${escHtml(c.grade || 'Unassigned')}
                            </div>
                        </div>
                    </label>
                `;
            }).join('');
        };

        window.toggleBulkStudentCourse = (id, checked) => {
            if (checked) window._selectedCourseIdsForStudent.add(id);
            else window._selectedCourseIdsForStudent.delete(id);
            
            const count = window._selectedCourseIdsForStudent.size;
            document.getElementById('bulkStudentCourseCount').textContent = count;
            
            const btn = document.getElementById('bulkEnrollCourseBtn');
            btn.disabled = count === 0;
            btn.innerHTML = `<i class="fas fa-plus"></i> Enroll in ${count} Course(s)`;
        };

        window.toggleSelectAllBulkStudentCourses = () => {
            const checkboxes = document.querySelectorAll('.chk-avail-course');
            if (checkboxes.length === 0) return;
            
            const allSelected = Array.from(checkboxes).every(cb => cb.checked);
            
            checkboxes.forEach(cb => {
                cb.checked = !allSelected;
                toggleBulkStudentCourse(parseInt(cb.value), !allSelected);
            });
        };

        window.bulkEnrollStudentCourses = async (sId, sName) => {
            if (window._selectedCourseIdsForStudent.size === 0) return;
            
            const btn = document.getElementById('bulkEnrollCourseBtn');
            btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></div> Enrolling...';
            btn.disabled = true;

            try {
                const idsArray = Array.from(window._selectedCourseIdsForStudent);
                await apiJSON(`/api/admin/students/${sId}/courses/enroll/bulk`, { course_ids: idsArray });
                showToast(`Successfully enrolled in ${idsArray.length} course(s)!`, 'success');
                
                manageStudentCourses(sId, sName); // Refresh modal
            } catch (e) {
                showToast(e.message, 'error');
                btn.innerHTML = `<i class="fas fa-plus"></i> Enroll in ${window._selectedCourseIdsForStudent.size} Course(s)`;
                btn.disabled = false;
            }
        };

        window.unenrollStudentFromCourse = async (sId, cId, sName) => {
            if (!confirm('Are you sure you want to remove this course from the student?')) return;
            try {
                await apiDelete(`/api/admin/students/${sId}/courses/${cId}/unenroll`);
                showToast('Course removed successfully.', 'success');
                manageStudentCourses(sId, sName); // Refresh modal
            } catch (e) { showToast(e.message, 'error'); }
        };

        window.bulkUnenrollStudentCourses = async (sId, sName) => {
            const visibleRows = Array.from(document.querySelectorAll('.student-course-row')).filter(row => row.style.display !== 'none');
            const courseIds = visibleRows.map(row => parseInt(row.getAttribute('data-cid')));
            
            if (courseIds.length === 0) return;
            if (!confirm(`Are you sure you want to remove these ${courseIds.length} courses from the student?`)) return;

            try {
                await apiJSON(`/api/admin/students/${sId}/courses/unenroll/bulk`, { course_ids: courseIds });
                showToast(`Successfully removed ${courseIds.length} course(s).`, 'success');
                manageStudentCourses(sId, sName); // Refresh modal
            } catch (e) { showToast(e.message, 'error'); }
        };

    } catch (e) {
        document.getElementById('modalBody').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    }
};