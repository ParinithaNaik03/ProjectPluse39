// ProjectPulse – Main Application Logic
// All data is demo/sample data only. Not verified government records.

window.PP = (() => {
  'use strict';

  // ===================== STATE =====================
  let state = {
    currentPage: 'dashboard',
    currentUser: null,
    activeCategory: 'all',
    map: null,
    mapMarkers: [],
    twinScene: null,
    twinRenderer: null,
    twinCamera: null,
    twinAnimFrame: null,
    twinMeshes: {},
    spatialScene: null,
    spatialRenderer: null,
    spatialCamera: null,
    spatialAnimFrame: null,
    charts: {},
    currentMonitorProject: null,
    editingProjectId: null,
    deletingProjectId: null,
    sidebarOpen: window.innerWidth >= 769,
  };

  // ===================== UTILS =====================
  const fmtMoney = (n) => {
    if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n/1e3).toFixed(0)}K`;
    return `$${n}`;
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const statusLabel = {
    on_track: 'On Track',
    under_review: 'Under Review',
    critical: 'Critical',
    completed: 'Completed',
    assigned: 'Assigned',
    resolved: 'Resolved',
  };

  const statusPill = (s) => {
    const map = {
      on_track: 'pill-on-track',
      under_review: 'pill-review',
      critical: 'pill-critical',
      completed: 'pill-completed',
      assigned: 'pill-assigned',
      resolved: 'pill-on-track',
    };
    return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${map[s]||'pill-review'}">
      <span class="w-1.5 h-1.5 rounded-full ${s==='critical'?'pulse-dot':''}" style="background:currentColor"></span>
      ${statusLabel[s]||s}
    </span>`;
  };

  const catIcon = { transit:'train', bridges:'architecture', water:'water_drop', parks:'park', public_facilities:'local_hospital' };
  const catLabel = { transit:'Transit', bridges:'Roads & Bridges', water:'Water & Utilities', parks:'Parks & Civic', public_facilities:'Public Facilities' };
  const catColor = { transit:'#6366f1', bridges:'#f59e0b', water:'#0ea5e9', parks:'#22c55e', public_facilities:'#ec4899' };
  const markerColor = { on_track:'#14b8a6', under_review:'#f59e0b', critical:'#ef4444', completed:'#06b6d4' };

  const toast = (msg, duration=3000) => {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
  };

  const generateId = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;

  // ===================== AUTH & SESSION MANAGEMENT =====================
  let googleClientId = '';

  const formatNameFromEmail = (email) => {
    if (!email) return 'User';
    const localPart = email.split('@')[0];
    const cleaned = localPart.replace(/[._+\d-]+/g, ' ').trim();
    if (!cleaned) return localPart.toUpperCase();
    return cleaned.split(' ').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const computeInitials = (name) => {
    if (!name) return 'U';
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const defaultRoleEmails = {
    admin: 's.blake@citygov.org',
    field_inspector: 'd.chen@citygov.org',
    contractor: 'm.lopez@skanska-apex.com',
    citizen: 'citizen@email.com'
  };

  const handleRoleChange = (role) => {
    const emailInput = document.getElementById('auth-email');
    if (!emailInput) return;
    const currentVal = emailInput.value.trim();
    const isDefault = Object.values(defaultRoleEmails).includes(currentVal) || !currentVal;
    if (isDefault && defaultRoleEmails[role]) {
      emailInput.value = defaultRoleEmails[role];
    }
  };

  const initGoogleAuth = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const cfg = await res.json();
        googleClientId = cfg.googleClientId || '';
        const statusEl = document.getElementById('google-auth-status');

        if (googleClientId && !googleClientId.startsWith('YOUR_') && window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
            prompt_parent_id: 'google-btn-container'
          });
          const container = document.getElementById('google-btn-container');
          const customBtn = document.getElementById('google-signin-btn-custom');
          if (container) {
            window.google.accounts.id.renderButton(container, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 320
            });
            if (customBtn) customBtn.style.display = 'none';
          }
          if (statusEl) statusEl.textContent = 'Official Google Identity Services Active';
        } else {
          if (statusEl) {
            statusEl.innerHTML = '<span class="text-teal-700 font-medium">Ready for Google OAuth.</span> <span class="text-slate-400">Configure GOOGLE_CLIENT_ID in .env for live accounts.</span>';
          }
        }
      }
    } catch (e) {
      console.warn('Config fetch notice:', e);
    }
  };

  const handleGoogleCredentialResponse = async (response) => {
    if (!response || !response.credential) {
      toast('Google authentication failed: no credential received.');
      return;
    }
    toast('Verifying Google credentials with backend...');
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        applyUserSession(data.user);
        toast(`Welcome, ${data.user.name}! Authenticated via Google.`);
      } else {
        toast(`Authentication error: ${data.error || 'Verification failed'}`);
      }
    } catch (err) {
      toast('Backend verification request failed.');
    }
  };

  const triggerGoogleLogin = () => {
    if (googleClientId && !googleClientId.startsWith('YOUR_') && window.google?.accounts?.oauth2) {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'email profile openid',
        prompt: 'select_account',
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            try {
              const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              const uData = await uRes.json();
              const res = await fetch('/api/auth/demo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: uData.email,
                  name: uData.name,
                  avatar: uData.picture,
                  role: document.getElementById('auth-role')?.value || 'citizen'
                })
              });
              const loginData = await res.json();
              if (loginData.user) {
                applyUserSession(loginData.user);
                toast(`Welcome back, ${loginData.user.name}!`);
              }
            } catch (e) {
              toast('Could not retrieve Google profile.');
            }
          }
        }
      });
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } else {
      const customEmail = prompt(
        'Google OAuth 2.0 Web Client ID Setup:\n\n' +
        'To connect your live Google account selection popup, paste your GOOGLE_CLIENT_ID in .env.\n\n' +
        'For immediate sign-in with any Gmail ID, enter your email below:',
        'sarah.blake@gmail.com'
      );
      if (customEmail && customEmail.trim() && customEmail.includes('@')) {
        const emailInput = document.getElementById('auth-email');
        if (emailInput) emailInput.value = customEmail.trim();
        login();
      }
    }
  };

  const applyUserSession = (user) => {
    state.currentUser = user;

    const authScreen = document.getElementById('auth-screen');
    if (authScreen) {
      authScreen.classList.add('hidden');
      authScreen.style.setProperty('display', 'none', 'important');
      authScreen.style.display = 'none';
    }

    const sidebarName = document.getElementById('sidebar-name');
    if (sidebarName) sidebarName.textContent = user.name;
    const sidebarRole = document.getElementById('sidebar-role');
    if (sidebarRole) sidebarRole.textContent = (user.role || 'citizen').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    if (sidebarAvatar) {
      if (user.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://'))) {
        sidebarAvatar.innerHTML = `<img src="${user.avatar}" class="w-full h-full rounded-full object-cover"/>`;
      } else {
        sidebarAvatar.textContent = user.avatar || 'U';
      }
    }
    const topbarAvatar = document.getElementById('topbar-avatar');
    if (topbarAvatar) {
      if (user.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://'))) {
        topbarAvatar.innerHTML = `<img src="${user.avatar}" class="w-full h-full rounded-full object-cover"/>`;
      } else {
        topbarAvatar.textContent = user.avatar || 'U';
      }
    }

    // Adjust nav based on role
    const isAdmin = user.role === 'admin';
    const adminLabel = document.getElementById('admin-nav-label');
    const adminItems = document.getElementById('admin-nav-items');
    const adminActions = document.getElementById('admin-actions-row');
    if (adminLabel) adminLabel.style.display = isAdmin ? '' : 'none';
    if (adminItems) adminItems.style.display = isAdmin ? '' : 'none';
    if (adminActions) adminActions.style.display = isAdmin ? '' : 'none';

    try {
      localStorage.setItem('pp_session', JSON.stringify(user));
    } catch (e) {}

    initApp();
    loadDatabaseData();
  };

  const login = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const role = document.getElementById('auth-role')?.value || 'citizen';
    const emailInput = document.getElementById('auth-email');
    const email = emailInput?.value.trim() || '';

    if (!email || !email.includes('@')) {
      toast('Please enter a valid email address (e.g. name@gmail.com)');
      emailInput?.focus();
      return;
    }

    const derivedName = formatNameFromEmail(email);
    const initials = computeInitials(derivedName);

    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, email, name: derivedName, avatar: initials })
      });
      const data = await res.json();
      if (res.ok && data.user) {
        applyUserSession(data.user);
        toast(`Welcome, ${data.user.name}! Signed in as ${data.user.role.replace(/_/g, ' ')}`);
        return;
      }
    } catch (err) {
      console.warn('Backend login fallback to local session', err);
    }

    // Fallback if backend offline
    let user = PP_DATA.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      user.role = role;
    } else {
      user = {
        id: PP_DATA.users.length + 1,
        name: derivedName,
        role: role,
        email: email,
        ward: 4,
        avatar: initials
      };
      PP_DATA.users.push(user);
    }
    applyUserSession(user);
    toast(`Welcome, ${user.name}! Signed in as ${user.role.replace(/_/g, ' ')}`);
  };

  const logout = async () => {
    if (confirm('Sign out of ProjectPulse?')) {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (e) {}
      try { localStorage.removeItem('pp_session'); } catch (e) {}
      location.reload();
    }
  };

  // Central Database Loader
  const loadDatabaseData = async () => {
    try {
      const [projRes, repRes, userRes, notifRes] = await Promise.all([
        fetch('/api/projects').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/reports').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/users').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/notifications').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (projRes && Array.isArray(projRes) && projRes.length > 0) {
        PP_DATA.projects = projRes;
      }
      if (repRes && Array.isArray(repRes)) {
        PP_DATA.citizenReports = repRes;
      }
      if (userRes && Array.isArray(userRes)) {
        PP_DATA.users = userRes;
      }
      if (notifRes && Array.isArray(notifRes)) {
        PP_DATA.notifications = notifRes;
      }

      updateDashboard();
      if (state.currentPage === 'projects') filterProjectsList();
      if (state.currentPage === 'map') updateMapMarkers();
      if (state.currentPage === 'reports') renderReports();
      if (state.currentPage === 'users') renderUsersTable();
    } catch (err) {
      console.warn('API sync notice:', err);
    }
  };

  // ===================== NAVIGATION =====================
  const navigate = (page) => {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });
    document.querySelectorAll('.mobile-nav-item').forEach(a => {
      const isActive = a.dataset.page === page;
      a.classList.toggle('text-secondary', isActive);
      a.classList.toggle('text-on-surface-variant', !isActive);
    });

    state.currentPage = page;
    const titles = {
      dashboard: 'Admin Dashboard',
      projects: 'All Projects',
      map: 'Project Map',
      monitoring: 'Progress Monitoring',
      'digital-twin': '3D Digital Twin',
      spatial: 'Spatial Dashboard',
      reports: 'Citizen Reports',
      users: 'User Management',
    };
    document.getElementById('page-title').textContent = titles[page] || page;

    // Lazy init page-specific components
    if (page === 'map') initMap();
    if (page === 'digital-twin') initDigitalTwin();
    if (page === 'spatial') initSpatialDashboard();
    if (page === 'monitoring') loadMonitoringProject(state.currentMonitorProject || PP_DATA.projects[0].id);
    if (page === 'projects') renderProjectGrid();
    if (page === 'reports') renderReports();
    if (page === 'users') renderUsersTable();
    if (page === 'dashboard') updateDashboard();
  };

  const toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (window.innerWidth < 769) {
      sidebar.classList.toggle('mobile-open');
      overlay.classList.toggle('show', sidebar.classList.contains('mobile-open'));
    } else {
      state.sidebarOpen = !state.sidebarOpen;
      sidebar.classList.toggle('collapsed', !state.sidebarOpen);
      document.getElementById('main-content').classList.toggle('expanded', !state.sidebarOpen);
    }
  };

  const closeSidebar = () => {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  };

  // ===================== DASHBOARD =====================
  const updateDashboard = () => {
    const projects = PP_DATA.projects;
    document.getElementById('kpi-total').textContent = projects.length;
    document.getElementById('kpi-ontrack').textContent = projects.filter(p => p.status === 'on_track').length;
    document.getElementById('kpi-review').textContent = projects.filter(p => p.status === 'under_review').length;
    document.getElementById('kpi-critical').textContent = projects.filter(p => p.status === 'critical').length;

    // Recent activity
    const actEl = document.getElementById('recent-activity-list');
    if (actEl) {
      actEl.innerHTML = projects.slice(0, 4).map(p => `
        <div class="flex items-center gap-3 cursor-pointer hover:bg-surface-container-low rounded-lg p-2 -mx-2 transition-colors" onclick="PP.openProject('${p.id}')">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background:${catColor[p.category]}20">
            <span class="material-symbols-outlined text-sm" style="color:${catColor[p.category]}">${catIcon[p.category]||'domain'}</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold text-on-surface truncate">${p.name}</div>
            <div class="text-xs text-on-surface-variant">Ward ${p.ward} · ${fmtMoney(p.budget)}</div>
          </div>
          ${statusPill(p.status)}
        </div>
      `).join('');
    }

    // Citizen reports summary
    const crEl = document.getElementById('citizen-reports-summary');
    if (crEl) {
      crEl.innerHTML = PP_DATA.citizenReports.slice(0, 3).map(r => `
        <div class="flex items-center gap-3 cursor-pointer hover:bg-surface-container-low rounded-lg p-2 -mx-2 transition-colors" onclick="PP.openReport('${r.id}')">
          <span class="w-2 h-2 rounded-full shrink-0 ${r.status==='critical'?'bg-error pulse-dot':r.status==='resolved'?'bg-teal-500':'bg-amber-500'}"></span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-on-surface truncate">${r.title}</div>
            <div class="text-xs text-on-surface-variant">${r.location}</div>
          </div>
          <span class="label-caps text-[10px] ${r.priority==='critical'?'text-error':r.priority==='high'?'text-amber-700':'text-on-surface-variant'}">${r.priority}</span>
        </div>
      `).join('');
    }

    // Infrastructure alerts
    const alertEl = document.getElementById('infra-alerts-list');
    if (alertEl) {
      const critProjects = projects.filter(p => p.status === 'critical');
      alertEl.innerHTML = critProjects.map(p => `
        <div class="bg-red-50 border border-red-100 rounded-lg p-2.5 cursor-pointer hover:bg-red-100 transition-colors" onclick="PP.openProject('${p.id}')">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-error truncate">${p.name}</span>
            <span class="label-caps text-error shrink-0">${p.scheduleVariance}d</span>
          </div>
          <div class="text-xs text-on-surface-variant mt-0.5">Ward ${p.ward} · ${p.contractor}</div>
        </div>
      `).join('') || '<div class="text-sm text-on-surface-variant">No critical alerts</div>';
    }

    // Charts
    renderDashboardCharts();
  };

  const renderDashboardCharts = () => {
    // Budget Burn Rate chart
    const budgetCtx = document.getElementById('chart-budget');
    if (budgetCtx && !state.charts.budget) {
      state.charts.budget = new Chart(budgetCtx, {
        type: 'bar',
        data: {
          labels: ['May','Jun','Jul','Aug','Sep','Oct'],
          datasets: [{
            label: 'Budget Disbursed ($M)',
            data: [42, 55, 68, 82, 95, 107],
            backgroundColor: '#14b8a6',
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, callback: v => `$${v}M` } }
          }
        }
      });
    }

    // Health donut
    const healthCtx = document.getElementById('chart-health');
    if (healthCtx && !state.charts.health) {
      const projects = PP_DATA.projects;
      const onTrack = projects.filter(p=>p.status==='on_track').length;
      const review = projects.filter(p=>p.status==='under_review').length;
      const critical = projects.filter(p=>p.status==='critical').length;
      state.charts.health = new Chart(healthCtx, {
        type: 'doughnut',
        data: {
          labels: ['On Track','Review','Critical'],
          datasets: [{
            data: [onTrack, review, critical],
            backgroundColor: ['#14b8a6','#f59e0b','#ef4444'],
            borderWidth: 0,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } }
          },
          cutout: '65%',
        }
      });
    }

    // Capital Velocity
    const velCtx = document.getElementById('chart-velocity');
    if (velCtx && !state.charts.velocity) {
      state.charts.velocity = new Chart(velCtx, {
        type: 'line',
        data: {
          labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'],
          datasets: [
            {
              label: 'Planned ($M)',
              data: [45,52,60,70,80,92,105,118,128,135],
              borderColor: '#94a3b8',
              borderDash: [4,4],
              pointRadius: 0,
              tension: 0.4,
            },
            {
              label: 'Actual ($M)',
              data: [42,49,57,67,78,89,102,112,121,129],
              borderColor: '#14b8a6',
              backgroundColor: 'rgba(20,184,166,0.08)',
              pointRadius: 3,
              tension: 0.4,
              fill: true,
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { font: { size: 10 }, boxWidth: 20 } } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, callback: v => `$${v}M` } }
          }
        }
      });
    }
  };

  // ===================== PROJECTS LIST =====================
  let projectCategory = 'all';

  const setCategoryFilter = (cat, btn) => {
    projectCategory = cat;
    document.querySelectorAll('.filter-chip').forEach(c => {
      c.classList.remove('bg-[#0f172a]','text-white');
      c.classList.add('bg-white','border','border-outline-variant','text-on-surface-variant');
    });
    btn.classList.add('bg-[#0f172a]','text-white');
    btn.classList.remove('bg-white','border','border-outline-variant','text-on-surface-variant');
    filterProjectsList();
  };

  const filterProjectsList = () => {
    const search = (document.getElementById('project-search')?.value||'').toLowerCase();
    const statusF = document.getElementById('status-filter')?.value||'';
    const wardF = document.getElementById('ward-filter')?.value||'';
    const sort = document.getElementById('sort-projects')?.value||'budget-desc';

    let list = PP_DATA.projects.filter(p => {
      const matchSearch = !search || 
        p.name.toLowerCase().includes(search) ||
        p.contractor.toLowerCase().includes(search) ||
        String(p.ward).includes(search) ||
        p.id.toLowerCase().includes(search);
      const matchCat = projectCategory === 'all' || p.category === projectCategory;
      const matchStatus = !statusF || p.status === statusF;
      const matchWard = !wardF || String(p.ward) === wardF;
      return matchSearch && matchCat && matchStatus && matchWard;
    });

    // Sort
    list = list.sort((a,b) => {
      if (sort === 'budget-desc') return b.budget - a.budget;
      if (sort === 'budget-asc') return a.budget - b.budget;
      if (sort === 'progress-desc') return b.actualProgress - a.actualProgress;
      if (sort === 'progress-asc') return a.actualProgress - b.actualProgress;
      if (sort === 'deadline') return new Date(a.deadline) - new Date(b.deadline);
      return 0;
    });

    // Update count chip
    const countEl = document.getElementById('chip-count-all');
    if (countEl) countEl.textContent = list.length;

    const resultsEl = document.getElementById('project-results-count');
    if (resultsEl) resultsEl.textContent = `Showing ${list.length} project${list.length!==1?'s':''}`;

    const grid = document.getElementById('projects-grid');
    const empty = document.getElementById('projects-empty');
    if (!grid) return;

    if (list.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
    } else {
      if (empty) empty.classList.add('hidden');
      grid.innerHTML = list.map(p => renderProjectCard(p)).join('');
    }

    // Clear btn
    const clearBtn = document.getElementById('project-search-clear');
    if (clearBtn) clearBtn.classList.toggle('hidden', !search);
  };

  const clearProjectSearch = () => {
    document.getElementById('project-search').value = '';
    filterProjectsList();
  };

  const clearAllFilters = () => {
    document.getElementById('project-search').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('ward-filter').value = '';
    document.getElementById('sort-projects').value = 'budget-desc';
    projectCategory = 'all';
    document.querySelectorAll('.filter-chip').forEach((c,i) => {
      if (i===0) {
        c.classList.add('bg-[#0f172a]','text-white');
        c.classList.remove('bg-white','border','border-outline-variant','text-on-surface-variant');
      } else {
        c.classList.remove('bg-[#0f172a]','text-white');
        c.classList.add('bg-white','border','border-outline-variant','text-on-surface-variant');
      }
    });
    filterProjectsList();
  };

  const filterProjects = (status) => {
    navigate('projects');
    setTimeout(() => {
      const sel = document.getElementById('status-filter');
      if (sel) { sel.value = status; filterProjectsList(); }
    }, 100);
  };

  const renderProjectCard = (p) => {
    const variance = p.actualProgress - p.plannedProgress;
    const varianceColor = variance >= 0 ? 'text-secondary' : 'text-error';
    const varianceTxt = variance >= 0 ? `+${variance}% ahead` : `${variance}% behind`;
    const milestonesDone = p.milestones.filter(m=>m.completed).length;
    const isAdmin = state.currentUser?.role === 'admin';

    return `
    <article class="card p-4 hover:shadow-lg transition-all flex flex-col cursor-pointer hover:-translate-y-0.5 group" onclick="PP.openProject('${p.id}')">
      <!-- Top meta -->
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="bg-surface-container label-caps text-on-surface-variant px-2 py-0.5 rounded">WARD ${p.ward}</span>
          <span class="text-xs text-on-surface-variant truncate max-w-[140px]">${p.department}</span>
        </div>
        ${statusPill(p.status)}
      </div>
      <!-- Title & image -->
      <div class="flex items-start gap-3 mb-3">
        <div class="flex-1 min-w-0">
          <h2 class="font-jakarta font-semibold text-sm text-on-surface leading-tight group-hover:text-teal-600 transition-colors">${p.name}</h2>
          <p class="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
            <span class="material-symbols-outlined text-xs text-outline">engineering</span>
            <span class="truncate">${p.contractor}</span>
          </p>
          <p class="label-caps text-outline mt-1">${p.id}</p>
        </div>
        <div class="w-14 h-14 rounded-lg bg-surface-container flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <span class="material-symbols-outlined text-2xl" style="color:${catColor[p.category]}">${catIcon[p.category]||'domain'}</span>
        </div>
      </div>
      <!-- Progress -->
      <div class="bg-surface-container-low rounded-lg p-2.5 mb-3">
        <div class="flex items-center justify-between label-caps text-[11px] mb-1.5">
          <div class="flex items-center gap-1.5">
            <span class="text-on-surface font-bold">Actual: ${p.actualProgress}%</span>
            <span class="${varianceColor} font-semibold">(${varianceTxt})</span>
          </div>
          <span class="text-on-surface-variant">Target: ${p.plannedProgress}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-actual ${p.status==='critical'?'bg-error':p.status==='under_review'?'bg-amber-500':'bg-secondary'}" style="width:${p.actualProgress}%"></div>
          <div class="progress-marker" style="left:${p.plannedProgress}%"></div>
        </div>
      </div>
      <!-- Financials -->
      <div class="grid grid-cols-2 gap-2 mb-3">
        <div class="bg-surface-container-low/50 p-2 rounded">
          <div class="label-caps text-outline text-[10px]">Total Allocation</div>
          <div class="font-jakarta font-semibold text-sm text-on-surface">${fmtMoney(p.budget)}</div>
          <div class="text-xs text-on-surface-variant">${fmtMoney(p.disbursed)} disbursed</div>
        </div>
        <div class="bg-surface-container-low/50 p-2 rounded">
          <div class="label-caps text-outline text-[10px]">Contract Deadline</div>
          <div class="font-jakarta font-semibold text-sm text-on-surface">${fmtDate(p.deadline)}</div>
          <div class="text-xs ${p.scheduleVariance < 0 ? 'text-error' : 'text-secondary'} font-medium">${p.scheduleVariance < 0 ? Math.abs(p.scheduleVariance)+'d delay' : p.scheduleVariance+'d ahead'}</div>
        </div>
      </div>
      <!-- Footer -->
      <div class="flex items-center justify-between mt-auto pt-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container-high label-caps text-[10px] text-on-surface font-semibold">
            <span class="material-symbols-outlined text-xs text-secondary">flag</span>
            ${milestonesDone}/${p.milestones.length} Milestones
          </span>
          <span class="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container-high label-caps text-[10px] text-on-surface font-semibold">
            <span class="material-symbols-outlined text-xs text-secondary">fact_check</span>
            ${p.inspections.length} Inspections
          </span>
        </div>
        <div class="flex items-center gap-1.5" onclick="event.stopPropagation()">
          ${isAdmin ? `<button onclick="event.stopPropagation(); PP.openEditProject('${p.id}')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors" title="Edit Project">
            <span class="material-symbols-outlined text-sm">edit</span>
          </button>
          <button onclick="event.stopPropagation(); PP.confirmDelete('${p.id}')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-on-surface-variant hover:text-error transition-colors" title="Delete Project">
            <span class="material-symbols-outlined text-sm">delete</span>
          </button>` : ''}
          <button onclick="event.stopPropagation(); PP.openProject('${p.id}')" class="btn-primary text-xs py-1.5 px-3">
            View <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>
    </article>`;
  };

  const renderProjectGrid = () => {
    // Populate dept dropdown
    const deptSel = document.getElementById('pf-department');
    if (deptSel && deptSel.options.length <= 1) {
      PP_DATA.departments.forEach(d => {
        const o = document.createElement('option');
        o.value = d; o.textContent = d;
        deptSel.appendChild(o);
      });
    }
    // Populate monitor selects
    ['monitor-project-select','twin-project-select'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel && sel.options.length === 0) {
        PP_DATA.projects.forEach(p => {
          const o = document.createElement('option');
          o.value = p.id; o.textContent = `${p.id} – ${p.name}`;
          sel.appendChild(o);
        });
      }
    });
    filterProjectsList();
  };

  // ===================== PROJECT DETAIL =====================
  const openProject = (id) => {
    const p = PP_DATA.projects.find(x => x.id === id);
    if (!p) return;
    state.currentMonitorProject = id;
    const drawer = document.getElementById('project-detail-drawer');
    const content = document.getElementById('project-detail-content');
    const milestonesDone = p.milestones.filter(m=>m.completed).length;
    const isAdmin = state.currentUser?.role === 'admin';

    content.innerHTML = `
      <!-- Header -->
      <div class="bg-gradient-to-br from-[#0f172a] to-[#1e3a5f] p-4 relative">
        <button onclick="PP.closeDrawer('project-detail-drawer')" class="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20">
          <span class="material-symbols-outlined text-xl">close</span>
        </button>
        <div class="pr-10">
          <div class="label-caps text-teal-400 mb-1">${p.id}</div>
          <h2 class="font-jakarta font-bold text-white text-base leading-tight">${p.name}</h2>
          <div class="flex items-center gap-2 mt-2 flex-wrap">
            <span class="label-caps text-slate-400 bg-white/10 px-2 py-0.5 rounded">Ward ${p.ward}</span>
            <span class="label-caps text-slate-400">${catLabel[p.category]||p.category}</span>
            <div class="mt-0 ml-auto">${statusPill(p.status)}</div>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="p-4 space-y-4">
        <!-- Description -->
        <p class="text-sm text-on-surface-variant">${p.description}</p>

        <!-- Progress -->
        <div class="card p-3">
          <div class="section-title mb-2">Progress Overview</div>
          <div class="bg-surface-container-low rounded-lg p-2.5 mb-2">
            <div class="flex justify-between label-caps text-[11px] mb-1.5">
              <span class="font-bold text-on-surface">Actual: ${p.actualProgress}%</span>
              <span class="text-on-surface-variant">Planned: ${p.plannedProgress}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-actual ${p.status==='critical'?'bg-error':p.status==='under_review'?'bg-amber-500':'bg-secondary'}" style="width:${p.actualProgress}%"></div>
              <div class="progress-marker" style="left:${p.plannedProgress}%"></div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="text-center">
              <div class="text-lg font-bold ${p.scheduleVariance < 0 ? 'text-error' : 'text-secondary'}">${p.scheduleVariance > 0 ? '+' : ''}${p.scheduleVariance}d</div>
              <div class="label-caps text-on-surface-variant">Schedule</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-on-surface">${milestonesDone}/${p.milestones.length}</div>
              <div class="label-caps text-on-surface-variant">Milestones</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-on-surface">${Math.round(p.disbursed/p.budget*100)}%</div>
              <div class="label-caps text-on-surface-variant">Budget Used</div>
            </div>
          </div>
        </div>

        <!-- Budget -->
        <div class="card p-3">
          <div class="section-title mb-2">Budget & Finance</div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="label-caps text-on-surface-variant">Total Allocation</div>
              <div class="font-jakarta font-bold text-on-surface">${fmtMoney(p.budget)}</div>
            </div>
            <div>
              <div class="label-caps text-on-surface-variant">Disbursed</div>
              <div class="font-jakarta font-bold text-on-surface">${fmtMoney(p.disbursed)}</div>
            </div>
            <div>
              <div class="label-caps text-on-surface-variant">Start Date</div>
              <div class="text-sm font-medium text-on-surface">${fmtDate(p.startDate)}</div>
            </div>
            <div>
              <div class="label-caps text-on-surface-variant">Deadline</div>
              <div class="text-sm font-medium text-on-surface">${fmtDate(p.deadline)}</div>
            </div>
          </div>
        </div>

        <!-- Contractor -->
        <div class="card p-3">
          <div class="section-title mb-2">Contractor Info</div>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center">
              <span class="material-symbols-outlined text-on-surface-variant">engineering</span>
            </div>
            <div>
              <div class="font-semibold text-sm text-on-surface">${p.contractor}</div>
              <div class="text-xs text-on-surface-variant">${p.department}</div>
              <div class="text-xs text-on-surface-variant">${p.location}</div>
            </div>
          </div>
        </div>

        <!-- Milestones -->
        <div class="card p-3">
          <div class="section-title mb-3">Milestones</div>
          <div class="space-y-2">
            ${p.milestones.map((m,i) => `
              <div class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${m.completed ? 'bg-secondary text-white' : 'border-2 border-outline-variant bg-white'}">
                  ${m.completed ? '<span class="material-symbols-outlined text-sm">check</span>' : `<span class="text-xs text-on-surface-variant font-bold">${i+1}</span>`}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-on-surface">${m.name}</div>
                  <div class="text-xs text-on-surface-variant">${m.completed ? `Done: ${m.completedDate}` : `Target: ${m.date}`}</div>
                </div>
                <span class="label-caps ${m.completed ? 'text-secondary' : 'text-on-surface-variant'}">${m.completed ? 'Done' : 'Pending'}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Inspections -->
        ${p.inspections.length > 0 ? `
        <div class="card p-3">
          <div class="section-title mb-2">Field Inspection Records</div>
          <div class="space-y-2">
            ${p.inspections.map(insp => `
              <div class="border border-outline-variant rounded-lg p-2.5">
                <div class="flex items-center justify-between gap-2 mb-1">
                  <span class="text-sm font-semibold text-on-surface">${insp.type} Inspection</span>
                  <span class="label-caps ${insp.result==='Pass'?'text-secondary':'text-amber-600'} bg-${insp.result==='Pass'?'teal':'amber'}-50 px-2 py-0.5 rounded">${insp.result}</span>
                </div>
                <div class="text-xs text-on-surface-variant">${insp.date} · ${insp.inspector}</div>
                <div class="text-xs text-on-surface mt-1">${insp.notes}</div>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        <!-- AI Risk Analysis -->
        <div class="card p-3 border border-teal-200 bg-gradient-to-br from-white to-teal-50/20">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-teal-600 text-sm">smart_toy</span>
              <span class="section-title text-xs font-bold text-slate-800">Gemini 3.5 Risk Assessment</span>
            </div>
            <span class="label-caps text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded font-bold">AI Advisory</span>
          </div>
          <div class="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded p-2 mb-2">
            ⚠️ AI-generated analysis based on demo data. Not verified government records.
          </div>
          <div id="live-risk-result-${p.id}" class="mb-2">
            ${generateAIRiskAnalysis(p)}
          </div>
          <button id="btn-run-risk-${p.id}" onclick="PP.runLiveProjectRiskAnalysis('${p.id}')" class="w-full btn-secondary text-xs py-1.5 justify-center bg-teal-50/60 hover:bg-teal-100 text-teal-800 border-teal-200 font-semibold transition-all">
            <span class="material-symbols-outlined text-sm text-teal-600">auto_awesome</span>
            Run Deep Gemini Risk Assessment
          </button>
        </div>

        <!-- Admin Actions -->
        ${isAdmin ? `
        <div class="grid grid-cols-2 gap-2">
          <button onclick="PP.openAddNote()" class="btn-secondary justify-center">
            <span class="material-symbols-outlined text-sm">post_add</span>Add Note
          </button>
          <button onclick="PP.exportProjectPDF('${p.id}')" class="btn-secondary justify-center">
            <span class="material-symbols-outlined text-sm">file_download</span>Export PDF
          </button>
          <button onclick="PP.openEditProject('${p.id}');PP.closeDrawer('project-detail-drawer')" class="btn-secondary justify-center">
            <span class="material-symbols-outlined text-sm">edit</span>Edit
          </button>
          <button onclick="PP.navigate('monitoring');PP.loadMonitoringProject('${p.id}');PP.closeDrawer('project-detail-drawer')" class="btn-primary justify-center">
            <span class="material-symbols-outlined text-sm">monitoring</span>Monitor
          </button>
        </div>` : `
        <button onclick="PP.navigate('monitoring');PP.loadMonitoringProject('${p.id}');PP.closeDrawer('project-detail-drawer')" class="btn-primary w-full justify-center">
          <span class="material-symbols-outlined text-sm">monitoring</span>View Monitoring
        </button>`}
      </div>
    `;

    openDrawer('project-detail-drawer');
  };

  const generateAIRiskAnalysis = (p) => {
    const variance = p.actualProgress - p.plannedProgress;
    const budgetPct = Math.round(p.disbursed/p.budget*100);
    const risks = [];
    if (variance < -10) risks.push('Significant schedule delay detected. Consider contractor performance review.');
    if (variance < 0 && variance > -10) risks.push('Minor schedule deviation. Monitor closely.');
    if (budgetPct > 80 && p.actualProgress < 70) risks.push('Budget utilization high relative to progress. Potential cost overrun risk.');
    if (p.inspections.some(i => i.result !== 'Pass')) risks.push('Outstanding inspection issues require resolution before next phase.');
    if (risks.length === 0) risks.push('No significant risks identified based on available demo data.');

    return risks.map(r => `
      <div class="flex items-start gap-2 mb-2">
        <span class="material-symbols-outlined text-amber-600 text-sm mt-0.5">lightbulb</span>
        <span class="text-xs text-on-surface">${r}</span>
      </div>
    `).join('');
  };

  // ===================== MAP & TILE MANAGEMENT =====================
  //
  // DIAGNOSIS OF THE 403 ERRORS:
  // 1. tile.openstreetmap.org is operated by volunteer donations with a strict Tile Usage Policy:
  //    https://operations.osmfoundation.org/policies/tiles/
  // 2. The volunteer servers actively rate-limit and IP-block unauthenticated browser requests
  //    originating from http://localhost or applications without a recognized User-Agent whitelist.
  // 3. When triggered, the server serves an automated 403 error tile ("http://osm.wiki/Blocked").
  //
  // RESOLUTION:
  // We use authorized, high-availability Leaflet-compatible providers:
  // 1. OpenStreetMap Humanitarian (HOT) via OSM France (tile.openstreetmap.fr/hot)
  //    — 100% genuine OpenStreetMap data, high contrast civic styling, HTTP 200, no volunteer IP block.
  // 2. ESRI World Street Map (server.arcgisonline.com)
  //    — High-resolution global street map with municipal and infrastructure details, no key needed.
  // 3. CARTO Voyager (basemaps.cartocdn.com/rastertiles/voyager)
  //    — Authorized OpenStreetMap-based civic & road cartography.
  // 4. CARTO Positron (basemaps.cartocdn.com/light_all)
  //    — Clean minimalist light theme.
  //
  const tileProviders = {
    osm_hot: {
      name: 'OpenStreetMap (Civic Standard)',
      url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      subdomains: 'abc',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, Tiles courtesy of <a href="https://hot.openstreetmap.org/" target="_blank">Humanitarian OpenStreetMap Team</a>',
      maxZoom: 19
    },
    esri_world: {
      name: 'ESRI World Street Map',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      subdomains: '',
      attribution: 'Tiles &copy; <a href="https://www.esri.com/" target="_blank">Esri</a> &mdash; Sources: Esri, DeLorme, NAVTEQ, USGS, Intermap, TomTom',
      maxZoom: 18
    },
    carto_voyager: {
      name: 'CARTO Voyager (Civic Theme)',
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      maxZoom: 20
    },
    carto_positron: {
      name: 'CARTO Positron (Clean Light)',
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      maxZoom: 20
    }
  };

  let currentTileKey = 'esri_world';
  let activeTileLayer = null;

  const initMap = () => {
    if (state.map) {
      state.map.invalidateSize();
      updateMapMarkers();
      return;
    }

    const mapEl = document.getElementById('map-container');
    if (!mapEl) return;

    state.map = L.map('map-container', {
      zoomControl: true,
      // Prevent duplicate initialization side-effects
      preferCanvas: false
    }).setView([37.79, -122.38], 12);

    const provider = tileProviders[currentTileKey] || tileProviders.osm_hot;
    activeTileLayer = L.tileLayer(provider.url, {
      subdomains: provider.subdomains || '',
      attribution: provider.attribution,
      maxZoom: provider.maxZoom || 19,
      tileSize: 256,
      zoomOffset: 0
    }).addTo(state.map);

    updateMapMarkers();
    renderMapProjectList();

    // Allow the DOM to fully render before computing size
    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
    }, 250);
  };

  const toggleMapLayer = () => {
    if (!state.map) return;
    const keys = Object.keys(tileProviders);
    const nextIdx = (keys.indexOf(currentTileKey) + 1) % keys.length;
    currentTileKey = keys[nextIdx];
    const nextProvider = tileProviders[currentTileKey];

    if (activeTileLayer) {
      state.map.removeLayer(activeTileLayer);
    }
    activeTileLayer = L.tileLayer(nextProvider.url, {
      subdomains: nextProvider.subdomains || '',
      attribution: nextProvider.attribution,
      maxZoom: nextProvider.maxZoom || 19,
      tileSize: 256,
      zoomOffset: 0
    }).addTo(state.map);

    toast(`Map style: ${nextProvider.name}`);
  };

  const createMarkerIcon = (color, size = 16) => L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  const updateMapMarkers = () => {
    if (!state.map) return;
    state.mapMarkers.forEach(m => m.remove());
    state.mapMarkers = [];

    const catF = document.getElementById('map-cat-filter')?.value || '';
    const statF = document.getElementById('map-status-filter')?.value || '';

    // Projects Markers
    PP_DATA.projects.filter(p => (!catF || p.category === catF) && (!statF || p.status === statF))
      .forEach(p => {
        const color = markerColor[p.status] || '#64748b';
        const marker = L.marker([p.lat, p.lng], { icon: createMarkerIcon(color, 18) })
          .addTo(state.map)
          .bindPopup(createProjectPopup(p), { maxWidth: 280, minWidth: 240 });
        state.mapMarkers.push(marker);
      });

    // Citizen Report Markers
    PP_DATA.citizenReports.filter(r => r.status !== 'resolved').forEach(r => {
      const repColor = r.priority === 'critical' ? '#ef4444' : r.priority === 'high' ? '#f59e0b' : '#3b82f6';
      const marker = L.marker([r.lat, r.lng], { icon: createMarkerIcon(repColor, 14) })
        .addTo(state.map)
        .bindPopup(`<div style="font-family:Inter,sans-serif;padding:8px">
          <div style="font-size:10px;font-weight:700;color:${repColor};text-transform:uppercase;letter-spacing:.06em">Citizen Report · ${r.priority}</div>
          <div style="font-weight:600;font-size:13px;margin:4px 0">${r.title}</div>
          <div style="font-size:11px;color:#45464d">${r.location}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px">${r.status.replace(/_/g, ' ').toUpperCase()}</div>
        </div>`);
      state.mapMarkers.push(marker);
    });
  };

  const createProjectPopup = (p) => {
    const variance = p.actualProgress - p.plannedProgress;
    return `<div style="font-family:Inter,sans-serif;padding:0;border-radius:10px;overflow:hidden">
      <div style="background:#0f172a;padding:12px;color:white">
        <div style="font-size:10px;font-weight:700;letter-spacing:.06em;color:#14b8a6;margin-bottom:4px">${p.id} · Ward ${p.ward}</div>
        <div style="font-weight:700;font-size:13px;line-height:1.3">${p.name}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">${p.contractor}</div>
      </div>
      <div style="padding:12px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div><div style="font-size:10px;font-weight:700;letter-spacing:.06em;color:#76777d;text-transform:uppercase">Budget</div><div style="font-weight:700;font-size:13px">${fmtMoney(p.budget)}</div></div>
          <div><div style="font-size:10px;font-weight:700;letter-spacing:.06em;color:#76777d;text-transform:uppercase">Progress</div><div style="font-weight:700;font-size:13px;color:${variance<0?'#ef4444':'#14b8a6'}">${p.actualProgress}% <span style="font-size:11px">(${variance>0?'+':''}${variance}%)</span></div></div>
        </div>
        <div style="background:#f1f5f9;border-radius:4px;height:6px;margin-bottom:10px;position:relative;overflow:hidden">
          <div style="height:100%;background:${markerColor[p.status]};border-radius:4px;width:${p.actualProgress}%"></div>
          <div style="position:absolute;top:0;bottom:0;left:${p.plannedProgress}%;width:2px;background:#0f172a"></div>
        </div>
        <button onclick="PP.openProject('${p.id}')" style="width:100%;background:#0f172a;color:white;border:none;padding:8px;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px">
          View Details →
        </button>
      </div>
    </div>`;
  };

  const renderMapProjectList = () => {
    const el = document.getElementById('map-project-list');
    if (!el) return;
    el.innerHTML = PP_DATA.projects.map(p => `
      <div class="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors" onclick="PP.flyToProject('${p.id}')">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${markerColor[p.status]}"></span>
        <div class="min-w-0">
          <div class="text-xs font-semibold text-on-surface truncate">${p.name}</div>
          <div class="text-xs text-on-surface-variant">Ward ${p.ward} · ${p.actualProgress}%</div>
        </div>
      </div>
    `).join('');
  };

  const flyToProject = (id) => {
    const p = PP_DATA.projects.find(x => x.id === id);
    if (!p || !state.map) return;
    state.map.flyTo([p.lat, p.lng], 15, { animate: true, duration: 1 });
  };

  const centerMap = () => {
    if (state.map) state.map.flyTo([37.79, -122.38], 12, { animate: true });
  };

  // ===================== PROGRESS MONITORING =====================
  const loadMonitoringProject = (id) => {
    if (!id) return;
    const p = PP_DATA.projects.find(x => x.id === id);
    if (!p) return;
    state.currentMonitorProject = id;

    const sel = document.getElementById('monitor-project-select');
    if (sel) sel.value = id;

    const container = document.getElementById('monitoring-content');
    if (!container) return;

    const milestonesDone = p.milestones.filter(m=>m.completed).length;
    const variance = p.actualProgress - p.plannedProgress;
    const budgetPct = Math.round(p.disbursed/p.budget*100);

    container.innerHTML = `
      <!-- Project header card -->
      <div class="bg-gradient-to-r from-[#0f172a] to-[#1e3a5f] rounded-xl p-4 mb-4 text-white relative overflow-hidden">
        <div class="relative">
          <div class="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div class="label-caps text-teal-400 mb-1">${p.id} · Ward ${p.ward}</div>
              <h2 class="font-jakarta font-bold text-lg leading-tight">${p.name}</h2>
              <div class="text-slate-400 text-sm mt-1 flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">engineering</span>${p.contractor}
              </div>
            </div>
            ${statusPill(p.status)}
          </div>
        </div>
      </div>

      <!-- KPI row -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="card p-3 text-center">
          <div class="text-2xl font-bold ${variance<0?'text-error':'text-secondary'}">${p.actualProgress}%</div>
          <div class="label-caps text-on-surface-variant mt-1">Actual Progress</div>
        </div>
        <div class="card p-3 text-center">
          <div class="text-2xl font-bold text-on-surface">${p.plannedProgress}%</div>
          <div class="label-caps text-on-surface-variant mt-1">Target Progress</div>
        </div>
        <div class="card p-3 text-center">
          <div class="text-2xl font-bold ${variance<0?'text-error':'text-secondary'}">${variance>0?'+':''}${variance}%</div>
          <div class="label-caps text-on-surface-variant mt-1">Schedule Variance</div>
        </div>
        <div class="card p-3 text-center">
          <div class="text-2xl font-bold text-on-surface">${budgetPct}%</div>
          <div class="label-caps text-on-surface-variant mt-1">Budget Utilized</div>
        </div>
      </div>

      <!-- Charts row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <!-- Progress history chart -->
        <div class="card p-4">
          <div class="section-title mb-3">Planned vs Actual Progress</div>
          <div class="chart-container" style="height:200px">
            <canvas id="chart-progress-history"></canvas>
          </div>
        </div>
        <!-- Budget utilization -->
        <div class="card p-4">
          <div class="section-title mb-3">Budget Utilization</div>
          <div class="space-y-3">
            <div>
              <div class="flex justify-between label-caps text-[11px] mb-1">
                <span class="text-on-surface">Disbursed</span>
                <span class="text-secondary font-bold">${fmtMoney(p.disbursed)} / ${fmtMoney(p.budget)}</span>
              </div>
              <div class="progress-track">
                <div class="progress-actual bg-secondary" style="width:${budgetPct}%"></div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 mt-3">
              <div class="bg-surface-container-low rounded-lg p-2.5 text-center">
                <div class="font-bold text-lg text-on-surface">${fmtMoney(p.budget - p.disbursed)}</div>
                <div class="label-caps text-on-surface-variant">Remaining</div>
              </div>
              <div class="bg-surface-container-low rounded-lg p-2.5 text-center">
                <div class="font-bold text-lg text-on-surface">${fmtDate(p.estimatedCompletion)}</div>
                <div class="label-caps text-on-surface-variant">Est. Completion</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Milestones / Gantt -->
      <div class="card p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <span class="section-title">Project Timeline</span>
          <span class="label-caps text-secondary">${milestonesDone}/${p.milestones.length} Complete</span>
        </div>
        <div class="space-y-2.5">
          ${p.milestones.map((m, i) => {
            const isComplete = m.completed;
            const totalMs = p.milestones.length;
            const pct = ((i+1)/totalMs)*100;
            return `
            <div class="flex items-center gap-3">
              <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isComplete ? 'bg-secondary' : i === milestonesDone ? 'ring-2 ring-secondary bg-white' : 'border-2 border-outline-variant bg-white'}">
                ${isComplete ? '<span class="material-symbols-outlined text-white text-sm">check</span>' : `<span class="text-xs font-bold ${i===milestonesDone?'text-secondary':'text-on-surface-variant'}">${i+1}</span>`}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-medium text-on-surface">${m.name}</span>
                  <div class="shrink-0">
                    <span class="gantt-bar ${isComplete ? 'bg-secondary' : i===milestonesDone ? 'bg-amber-500' : 'bg-slate-200 text-slate-500'}" style="min-width:80px; max-width:120px">
                      ${isComplete ? '✓ Done' : i===milestonesDone ? '⟳ Active' : 'Pending'}
                    </span>
                  </div>
                </div>
                <div class="text-xs text-on-surface-variant">${isComplete ? `Completed ${m.completedDate}` : `Target: ${m.date}`}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Inspections -->
      <div class="card p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <span class="section-title">Field Inspection Records</span>
          <button onclick="PP.openAddInspection('${p.id}')" class="btn-secondary text-xs py-1.5 px-3">
            <span class="material-symbols-outlined text-sm">add</span>Add Inspection
          </button>
        </div>
        ${p.inspections.length > 0 ? p.inspections.map(insp => `
          <div class="border border-outline-variant rounded-lg p-3 mb-2">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined ${insp.result==='Pass'?'text-secondary':'text-amber-600'} text-lg">assignment_turned_in</span>
                <span class="font-semibold text-sm">${insp.type} Inspection</span>
              </div>
              <span class="label-caps ${insp.result==='Pass'?'pill-on-track':'pill-review'} px-2 py-0.5 rounded-full">${insp.result}</span>
            </div>
            <div class="text-xs text-on-surface-variant mb-1">${insp.date} · Inspector: ${insp.inspector}</div>
            <div class="text-sm text-on-surface bg-surface-container-low rounded-lg px-3 py-2">${insp.notes}</div>
          </div>
        `).join('') : '<div class="text-sm text-on-surface-variant text-center py-6">No inspection records yet</div>'}
      </div>

      <!-- Delay Diagnosis -->
      ${variance < 0 ? `
      <div class="card p-4 mb-4 border-l-4 border-amber-400">
        <div class="flex items-center justify-between mb-2">
          <span class="section-title">Delay Diagnosis</span>
          <span class="label-caps text-amber-600">Analysis Based on Available Data</span>
        </div>
        <div class="space-y-2">
          <div class="flex items-start gap-2">
            <span class="material-symbols-outlined text-amber-600 text-base mt-0.5">warning</span>
            <div>
              <div class="text-sm font-semibold text-on-surface">Schedule Deviation: ${Math.abs(variance)}% behind plan</div>
              <div class="text-xs text-on-surface-variant mt-0.5">Project is tracking ${Math.abs(p.scheduleVariance)} days behind contractual deadline.</div>
            </div>
          </div>
          ${p.inspections.filter(i=>i.result!=='Pass').map(i => `
          <div class="flex items-start gap-2">
            <span class="material-symbols-outlined text-amber-600 text-base mt-0.5">error_outline</span>
            <div>
              <div class="text-sm font-semibold text-on-surface">Unresolved Inspection Issue: ${i.type}</div>
              <div class="text-xs text-on-surface-variant mt-0.5">${i.notes}</div>
            </div>
          </div>`).join('')}
        </div>
        <div class="mt-3 bg-amber-50 border border-amber-100 rounded-lg p-3">
          <div class="label-caps text-amber-800 mb-1">Recommended Administrative Actions</div>
          <ul class="text-xs text-amber-900 space-y-1 list-disc list-inside">
            <li>Schedule emergency project review meeting with contractor</li>
            <li>Issue formal delay notice as per contract clause 8.3</li>
            <li>Review and resolve outstanding inspection sign-offs</li>
            <li>Assess feasibility of revised completion schedule</li>
          </ul>
          <div class="label-caps text-amber-600 mt-2">⚠️ AI-generated suggestions – verify with actual project documentation</div>
        </div>
      </div>` : ''}

      <!-- Live Gemini 3.5 Flash Deep Risk Assessment -->
      <div class="card p-4 mb-4 border border-teal-200 bg-gradient-to-br from-white to-teal-50/20 shadow-sm">
        <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 bg-teal-600 rounded-lg flex items-center justify-center text-white">
              <span class="material-symbols-outlined text-sm">smart_toy</span>
            </div>
            <div>
              <span class="section-title text-sm font-bold text-slate-800">Gemini 3.5 Structural & Financial Risk Analysis</span>
              <span class="label-caps text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded text-[10px] ml-2 font-bold">Live AI Advisory</span>
            </div>
          </div>
          <button id="btn-run-monitoring-risk" onclick="PP.runLiveProjectRiskAnalysis('${p.id}')" class="btn-primary text-xs py-1.5 px-3 bg-teal-800 hover:bg-teal-900 shadow-sm flex items-center gap-1.5 cursor-pointer">
            <span class="material-symbols-outlined text-sm text-teal-300">auto_awesome</span>
            Run Deep Gemini Analysis
          </button>
        </div>
        <p class="text-xs text-on-surface-variant mb-2">Evaluates schedule variances, milestone roadblocks, budget burn velocity, and field inspections in real time.</p>
        <div id="monitoring-live-risk-container">
          <div class="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
            Click <strong>"Run Deep Gemini Analysis"</strong> to evaluate ${p.name} with live Gemini 3.5 Flash intelligence.
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex flex-wrap gap-2">
        <button onclick="PP.openProject('${p.id}')" class="btn-secondary text-sm">
          <span class="material-symbols-outlined text-sm">info</span>Details
        </button>
        <button onclick="PP.navigate('digital-twin')" class="btn-secondary text-sm">
          <span class="material-symbols-outlined text-sm">view_in_ar</span>3D Twin
        </button>
        <button onclick="PP.showAIAssistant()" class="btn-secondary text-sm">
          <span class="material-symbols-outlined text-sm">smart_toy</span>AI Assistant
        </button>
        <button onclick="PP.exportProjectPDF('${p.id}')" class="btn-primary text-sm">
          <span class="material-symbols-outlined text-sm">file_download</span>Export PDF
        </button>
      </div>
    `;

    // Render progress history chart
    setTimeout(() => {
      const ctx = document.getElementById('chart-progress-history');
      if (!ctx) return;
      if (state.charts.progressHistory) state.charts.progressHistory.destroy();
      state.charts.progressHistory = new Chart(ctx, {
        type: 'line',
        data: {
          labels: p.progressHistory.map(h => h.month),
          datasets: [
            {
              label: 'Planned %',
              data: p.progressHistory.map(h => h.planned),
              borderColor: '#94a3b8',
              borderDash: [4,4],
              pointRadius: 3,
              tension: 0.4,
            },
            {
              label: 'Actual %',
              data: p.progressHistory.map(h => h.actual),
              borderColor: p.status === 'critical' ? '#ef4444' : '#14b8a6',
              backgroundColor: p.status === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(20,184,166,0.08)',
              pointRadius: 4,
              tension: 0.4,
              fill: true,
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { font: { size: 10 }, boxWidth: 20 } } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { 
              grid: { color: '#f1f5f9' }, 
              min: 0, max: 100,
              ticks: { font: { size: 10 }, callback: v => `${v}%` }
            }
          }
        }
      });
    }, 100);
  };

  const openAddInspection = (projectId) => {
    const p = PP_DATA.projects.find(x => x.id === projectId);
    if (!p) return;
    // Simple inspection form via prompt-style flow (modal could be added)
    const type = prompt('Inspection type (e.g. Structural, Safety, Environmental):');
    if (!type) return;
    const result = prompt('Result (Pass / Needs Attention / Fail):');
    if (!result) return;
    const notes = prompt('Inspector notes:');
    const inspector = state.currentUser?.name || 'Inspector';
    p.inspections.unshift({
      date: new Date().toISOString().split('T')[0],
      inspector,
      type,
      result,
      notes: notes || 'No notes.'
    });
    toast('Inspection record added!');
    loadMonitoringProject(projectId);
  };

  // ===================== 3D DIGITAL TWIN =====================
  const initDigitalTwin = () => {
    const canvas = document.getElementById('digital-twin-canvas');
    if (!canvas || state.twinRenderer) return;

    const projectId = document.getElementById('twin-project-select')?.value || PP_DATA.projects[0].id;
    loadTwinProject(projectId);
  };

  const loadTwinProject = (id) => {
    const p = PP_DATA.projects.find(x => x.id === id);
    if (!p) return;

    const canvas = document.getElementById('digital-twin-canvas');
    if (!canvas) return;

    // Cleanup previous
    if (state.twinAnimFrame) cancelAnimationFrame(state.twinAnimFrame);
    if (state.twinRenderer) {
      state.twinRenderer.dispose();
      state.twinRenderer = null;
    }

    // Setup Three.js
    const W = canvas.clientWidth || 600;
    const H = canvas.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    state.twinScene = scene;

    // Lighting
    const ambient = new THREE.AmbientLight(0x334155, 0.8);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0x94a3b8, 1.2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0x14b8a6, 1, 50);
    pointLight.position.set(-5, 8, -5);
    scene.add(pointLight);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 1000);
    camera.position.set(10, 8, 12);
    camera.lookAt(0, 2, 0);
    state.twinCamera = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    state.twinRenderer = renderer;

    // Build scene based on project category
    buildTwinScene(p, scene);

    // Mouse controls
    let isDragging = false, prevX = 0, prevY = 0;
    let rotX = 0, rotY = 0;
    const group = scene.children.find(c => c.isGroup);

    canvas.addEventListener('mousedown', e => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
    canvas.addEventListener('touchstart', e => { isDragging = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY; });
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('touchend', () => isDragging = false);
    canvas.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const dx = e.clientX - prevX, dy = e.clientY - prevY;
      rotY += dx * 0.005; rotX += dy * 0.005;
      rotX = Math.max(-0.6, Math.min(0.6, rotX));
      if (group) { group.rotation.y = rotY; group.rotation.x = rotX; }
      prevX = e.clientX; prevY = e.clientY;
    });
    canvas.addEventListener('touchmove', e => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - prevX, dy = e.touches[0].clientY - prevY;
      rotY += dx * 0.005; rotX += dy * 0.005;
      rotX = Math.max(-0.6, Math.min(0.6, rotX));
      if (group) { group.rotation.y = rotY; group.rotation.x = rotX; }
      prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
    });
    canvas.addEventListener('wheel', e => {
      camera.position.z = Math.max(5, Math.min(25, camera.position.z + e.deltaY * 0.02));
    });

    // Animate
    const animate = () => {
      state.twinAnimFrame = requestAnimationFrame(animate);
      if (group) group.rotation.y += 0.002;
      renderer.render(scene, camera);
    };
    animate();

    // Update side panels
    renderTwinPanels(p);
  };

  const buildTwinScene = (p, scene) => {
    const group = new THREE.Group();
    scene.add(group);

    const matMap = {
      concrete: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2 }),
      teal: new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.5 }),
      amber: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 }),
      error: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5, emissive: 0xef4444, emissiveIntensity: 0.2 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.4, roughness: 0 }),
      green: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 }),
    };

    // Grid floor
    const gridHelper = new THREE.GridHelper(20, 20, 0x1e293b, 0x1e293b);
    group.add(gridHelper);

    if (p.category === 'transit' || p.category === 'bridges') {
      // Transit Hub / Bridge: Structural pillars + deck
      for (let i = -3; i <= 3; i += 2) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 4), matMap.concrete);
        pillar.position.set(i, 2, 0);
        group.add(pillar);
        const pillar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 4), matMap.concrete);
        pillar2.position.set(i, 2, 3);
        group.add(pillar2);
      }
      // Deck
      const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 4), matMap.steel);
      deck.position.set(0, 4, 1.5);
      group.add(deck);
      // Roof
      const roofGeo = new THREE.CylinderGeometry(0, 4, 2.5, 4);
      const roof = new THREE.Mesh(roofGeo, matMap.teal);
      roof.position.set(0, 5.5, 1.5);
      group.add(roof);
      // Delay marker
      if (p.status === 'critical') {
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.3), matMap.error);
        marker.position.set(2, 4.3, 0);
        group.add(marker);
      }
    } else if (p.category === 'water') {
      // Water facility: tanks + pipes
      for (let i = 0; i < 3; i++) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3, 16), matMap.concrete);
        tank.position.set(i * 3 - 3, 1.5, 0);
        group.add(tank);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 16), matMap.steel);
        lid.position.set(i * 3 - 3, 3.1, 0);
        group.add(lid);
      }
      // Pipes
      for (let i = 0; i < 2; i++) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6, 8), matMap.teal);
        pipe.rotation.z = Math.PI/2;
        pipe.position.set(-0.5, 0.8, i * 2 - 1);
        group.add(pipe);
      }
    } else if (p.category === 'parks') {
      // Park: trees, paths, fountain
      for (let i = -3; i <= 3; i += 2) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.5), matMap.concrete);
        trunk.position.set(i, 0.75, -2);
        group.add(trunk);
        const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), matMap.green);
        foliage.position.set(i, 2, -2);
        group.add(foliage);
      }
      // Path
      const path = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.5), matMap.concrete);
      path.rotation.x = -Math.PI/2;
      path.position.set(0, 0.01, 0);
      group.add(path);
      // Fountain
      const fBase = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 0.3, 16), matMap.steel);
      fBase.position.set(0, 0.15, 2.5);
      group.add(fBase);
      const fTop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8), matMap.teal);
      fTop.position.set(0, 1, 2.5);
      group.add(fTop);
    } else {
      // Generic building
      const base = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 6), matMap.concrete);
      base.position.set(0, 0.25, 0);
      group.add(base);
      for (let x = -1; x <= 1; x += 2) {
        for (let z = -1; z <= 1; z += 2) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), matMap.steel);
          col.position.set(x * 2.5, 2.75, z * 2.5);
          group.add(col);
        }
      }
      const floors = Math.ceil(p.actualProgress / 25);
      for (let f = 0; f < floors; f++) {
        const floor = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.2, 5.2), matMap.concrete);
        floor.position.set(0, 1.5 + f * 1.2, 0);
        group.add(floor);
        // Window panels
        for (let w = -1; w <= 1; w++) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.05), matMap.glass);
          win.position.set(w * 1.5, 1.8 + f * 1.2, 2.6);
          group.add(win);
        }
      }
      const incomplete = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.5 + (1 - p.actualProgress/100) * 3, 5.2), matMap.amber);
      incomplete.material.transparent = true;
      incomplete.material.opacity = 0.3;
      incomplete.position.set(0, 1.5 + floors * 1.2 + 1, 0);
      group.add(incomplete);
    }

    // Coordinate axes indicator
    const axisHelper = new THREE.AxesHelper(2);
    axisHelper.position.set(-8, 0.1, -8);
    group.add(axisHelper);
  };

  const renderTwinPanels = (p) => {
    // Phases
    const phaseEl = document.getElementById('twin-phase-list');
    if (phaseEl) {
      const phases = p.milestones.slice(0,4);
      phaseEl.innerHTML = phases.map((m, i) => `
        <div class="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-surface-container-low transition-colors ${m.completed ? 'opacity-100' : 'opacity-60'}">
          <div class="w-5 h-5 rounded flex items-center justify-center ${m.completed ? 'bg-secondary' : 'bg-surface-container'}">
            <span class="material-symbols-outlined text-xs ${m.completed?'text-white':'text-on-surface-variant'}">${m.completed?'check':'pending'}</span>
          </div>
          <span class="text-xs font-medium text-on-surface flex-1">${m.name}</span>
        </div>
      `).join('');
    }

    // Sensors
    const sensorEl = document.getElementById('twin-sensors');
    const sensors = [
      { name: 'Structural Load', value: '94%', status: 'normal', icon: 'compress' },
      { name: 'Foundation Stability', value: '98%', status: 'normal', icon: 'foundation' },
      { name: 'Material Quality', value: p.status==='critical'?'72%':'91%', status: p.status==='critical'?'warning':'normal', icon: 'science' },
      { name: 'Worker Safety Score', value: '100%', status: 'normal', icon: 'health_and_safety' },
    ];
    if (sensorEl) {
      sensorEl.innerHTML = sensors.map(s => `
        <div class="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-sm ${s.status==='warning'?'text-amber-600':'text-secondary'}">${s.icon}</span>
            <span class="text-xs text-on-surface">${s.name}</span>
          </div>
          <span class="label-caps ${s.status==='warning'?'text-amber-600':'text-secondary'} font-bold">${s.value}</span>
        </div>
      `).join('');
    }

    // Issues
    const issueEl = document.getElementById('twin-issues');
    const issues = p.inspections.filter(i=>i.result!=='Pass');
    if (issueEl) {
      issueEl.innerHTML = issues.length > 0 ? issues.map(i => `
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="material-symbols-outlined text-amber-600 text-sm">warning</span>
            <span class="text-xs font-semibold text-amber-800">${i.type}</span>
          </div>
          <div class="text-xs text-amber-700">${i.notes}</div>
        </div>
      `).join('') : '<div class="text-xs text-on-surface-variant text-center py-3">No active issues</div>';
    }
  };

  const resetTwinCamera = () => {
    if (state.twinCamera) {
      state.twinCamera.position.set(10, 8, 12);
      state.twinCamera.lookAt(0, 2, 0);
      toast('Camera reset');
    }
  };

  // ===================== SPATIAL DASHBOARD =====================
  const initSpatialDashboard = () => {
    const canvas = document.getElementById('spatial-canvas');
    if (!canvas || state.spatialRenderer) {
      if (state.spatialRenderer) return;
      return;
    }

    const W = canvas.clientWidth || 600;
    const H = canvas.clientHeight || 300;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    state.spatialScene = scene;

    const camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 500);
    camera.position.set(15, 12, 18);
    camera.lookAt(0, 0, 0);
    state.spatialCamera = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    state.spatialRenderer = renderer;

    // Lights
    scene.add(new THREE.AmbientLight(0x334155, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8);
    dl.position.set(10, 15, 10);
    scene.add(dl);

    // Build mini cityscape
    const group = new THREE.Group();
    scene.add(group);

    const gridHelper = new THREE.GridHelper(30, 30, 0x1e293b, 0x1e293b);
    group.add(gridHelper);

    // Buildings representing projects
    const projectPositions = [
      {x:-6,z:-6, h:4, color:0x14b8a6}, // on track
      {x:0,z:-6, h:6, color:0xef4444},  // critical
      {x:6,z:-6, h:3, color:0xf59e0b},  // review
      {x:-6,z:0, h:5, color:0x14b8a6},
      {x:0,z:0, h:2, color:0x14b8a6},
      {x:6,z:0, h:4, color:0xef4444},
      {x:-3,z:5, h:1, color:0x14b8a6},
      {x:3,z:5, h:3, color:0xf59e0b},
    ];

    projectPositions.forEach(pb => {
      const geo = new THREE.BoxGeometry(1.5, pb.h, 1.5);
      const mat = new THREE.MeshStandardMaterial({ color: pb.color, roughness: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pb.x, pb.h/2, pb.z);
      group.add(mesh);
      // Roof indicator light
      const light = new THREE.PointLight(pb.color, 0.5, 5);
      light.position.set(pb.x, pb.h + 0.5, pb.z);
      group.add(light);
    });

    // Roads
    for (let i = -3; i <= 3; i++) {
      const roadH = new THREE.Mesh(new THREE.PlaneGeometry(28, 0.5), new THREE.MeshStandardMaterial({color:0x1e293b}));
      roadH.rotation.x = -Math.PI/2;
      roadH.position.set(0, 0.01, i*4);
      group.add(roadH);
    }

    let rotY = 0;
    let isDragging = false, prevX = 0;
    canvas.addEventListener('mousedown', e => { isDragging = true; prevX = e.clientX; });
    window.addEventListener('mouseup', () => isDragging = false);
    canvas.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      rotY += dx * 0.005;
      group.rotation.y = rotY;
      prevX = e.clientX;
    });
    canvas.addEventListener('wheel', e => {
      camera.position.z = Math.max(8, Math.min(30, camera.position.z + e.deltaY * 0.03));
    });

    const animate = () => {
      state.spatialAnimFrame = requestAnimationFrame(animate);
      group.rotation.y += 0.003;
      renderer.render(scene, camera);
    };
    animate();

    renderSpatialPanels();
  };

  const renderSpatialPanels = () => {
    // Quick stats
    const statsEl = document.getElementById('spatial-quick-stats');
    if (statsEl) {
      statsEl.innerHTML = [
        { label:'Active', value: PP_DATA.projects.length, color:'text-on-surface' },
        { label:'On Track', value: PP_DATA.projects.filter(p=>p.status==='on_track').length, color:'text-secondary' },
        { label:'Critical', value: PP_DATA.projects.filter(p=>p.status==='critical').length, color:'text-error' },
        { label:'Reports', value: PP_DATA.citizenReports.length, color:'text-amber-600' },
      ].map(s => `
        <div class="bg-white/5 rounded-lg p-2 text-center">
          <div class="font-bold text-xl ${s.color}">${s.value}</div>
          <div class="label-caps text-slate-400 mt-0.5">${s.label}</div>
        </div>
      `).join('');
    }

    // Metrics
    const metricsEl = document.getElementById('spatial-metrics');
    if (metricsEl) {
      const totalBudget = PP_DATA.projects.reduce((s,p)=>s+p.budget,0);
      const totalDisbursed = PP_DATA.projects.reduce((s,p)=>s+p.disbursed,0);
      const avgProgress = Math.round(PP_DATA.projects.reduce((s,p)=>s+p.actualProgress,0)/PP_DATA.projects.length);
      metricsEl.innerHTML = [
        { label:'Total Portfolio', value: fmtMoney(totalBudget), sub:'Public Capital Allocation' },
        { label:'Total Invested', value: fmtMoney(totalDisbursed), sub:`${Math.round(totalDisbursed/totalBudget*100)}% of portfolio` },
        { label:'Avg Progress', value: `${avgProgress}%`, sub:'All active projects' },
      ].map(m => `
        <div class="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
          <div>
            <div class="label-caps text-on-surface-variant">${m.label}</div>
            <div class="text-xs text-on-surface-variant">${m.sub}</div>
          </div>
          <div class="font-jakarta font-bold text-on-surface">${m.value}</div>
        </div>
      `).join('');
    }

    // Alerts
    const alertsEl = document.getElementById('spatial-alerts');
    if (alertsEl) {
      alertsEl.innerHTML = PP_DATA.projects.filter(p=>p.status==='critical').map(p => `
        <div class="cursor-pointer" onclick="PP.openProject('${p.id}')">
          <div class="text-xs font-semibold text-error">${p.name}</div>
          <div class="label-caps text-on-surface-variant">${p.scheduleVariance}d variance · Ward ${p.ward}</div>
        </div>
      `).join('') || '<div class="text-sm text-on-surface-variant">No alerts</div>';
    }

    // Activity
    const actEl = document.getElementById('spatial-activity');
    if (actEl) {
      actEl.innerHTML = PP_DATA.notifications.slice(0,4).map(n => `
        <div class="flex items-start gap-2 py-2 border-b border-slate-50 last:border-0">
          <span class="material-symbols-outlined text-sm mt-0.5 ${n.type==='critical'?'text-error':n.type==='warning'?'text-amber-500':n.type==='success'?'text-secondary':'text-blue-500'}">${n.type==='critical'?'crisis_alert':n.type==='warning'?'warning':n.type==='success'?'check_circle':'info'}</span>
          <div class="flex-1 min-w-0">
            <div class="text-xs text-on-surface">${n.message}</div>
            <div class="label-caps text-on-surface-variant">${n.time}</div>
          </div>
        </div>
      `).join('');
    }

    // Capital Velocity chart
    const ctx = document.getElementById('chart-spatial-velocity');
    if (ctx && !state.charts.spatialVelocity) {
      state.charts.spatialVelocity = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'],
          datasets: [{
            label: 'Disbursed ($M)',
            data: [45,52,60,70,80,92,105,118,128,135],
            backgroundColor: '#14b8a6',
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, callback: v => `$${v}M` } }
          }
        }
      });
    }
  };

  // ===================== CITIZEN REPORTS =====================
  const switchReportTab = (tab, btn) => {
    ['all-reports','submit-report','track-report'].forEach(t => {
      document.getElementById(`report-tab-${t}`)?.classList.toggle('hidden', t !== tab);
    });
    document.querySelectorAll('.report-tab').forEach(b => {
      b.classList.toggle('active', b === btn);
      b.classList.toggle('bg-white', b === btn);
      b.classList.toggle('shadow-sm', b === btn);
      b.classList.toggle('font-semibold', b === btn);
    });
    if (tab === 'all-reports') renderReports();
  };

  const renderReports = () => {
    const statusF = document.getElementById('report-status-filter')?.value||'';
    const catF = document.getElementById('report-cat-filter')?.value||'';
    const list = PP_DATA.citizenReports.filter(r =>
      (!statusF || r.status === statusF) &&
      (!catF || r.category === catF)
    );

    const counts = {
      critical: PP_DATA.citizenReports.filter(r=>r.status==='critical').length,
      under_review: PP_DATA.citizenReports.filter(r=>r.status==='under_review').length,
      assigned: PP_DATA.citizenReports.filter(r=>r.status==='assigned').length,
      resolved: PP_DATA.citizenReports.filter(r=>r.status==='resolved').length,
    };
    document.getElementById('report-critical-count').textContent = `${counts.critical} Critical`;
    document.getElementById('report-review-count').textContent = `${counts.under_review} Under Review`;
    document.getElementById('report-assigned-count').textContent = `${counts.assigned} Assigned`;
    document.getElementById('report-resolved-count').textContent = `${counts.resolved} Resolved`;

    const el = document.getElementById('reports-list');
    if (!el) return;
    el.innerHTML = list.map(r => renderReportCard(r)).join('') ||
      '<div class="text-center py-8 text-on-surface-variant"><span class="material-symbols-outlined text-4xl block mb-2">inbox</span>No reports found</div>';
  };

  const renderReportCard = (r) => {
    const isAdmin = state.currentUser?.role === 'admin';
    const catLabel = { road_damage:'Road Damage', infrastructure_safety:'Safety Issue', water_supply:'Water Supply', public_facility:'Public Facility' };
    return `
    <div class="card p-4 hover:shadow-md transition-shadow">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="flex items-center gap-2 flex-wrap">
          ${statusPill(r.status)}
          <span class="label-caps text-on-surface-variant">${catLabel[r.category]||r.category}</span>
        </div>
        <span class="label-caps ${r.priority==='critical'?'text-error':r.priority==='high'?'text-amber-600':'text-on-surface-variant'} shrink-0">${r.priority.toUpperCase()}</span>
      </div>
      <h3 class="font-jakarta font-semibold text-sm text-on-surface mb-1">${r.title}</h3>
      <p class="text-xs text-on-surface-variant mb-2">${r.description.substring(0,120)}${r.description.length>120?'...':''}</p>
      <div class="flex flex-wrap gap-3 text-xs text-on-surface-variant mb-3">
        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">location_on</span>${r.location}</span>
        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">calendar_today</span>${r.submittedDate}</span>
        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">thumb_up</span>${r.upvotes} votes</span>
        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-xs">photo_camera</span>${r.photos} photos</span>
      </div>
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="label-caps text-on-surface-variant">${r.id}</div>
          ${r.assignedDepartment ? `<div class="text-xs text-secondary font-medium">${r.assignedDepartment}</div>` : ''}
        </div>
        <div class="flex items-center gap-2">
          ${isAdmin ? `
          <select onchange="PP.updateReportStatus('${r.id}', this.value)" class="h-7 px-2 rounded-lg bg-white border border-outline-variant text-xs cursor-pointer">
            <option value="critical" ${r.status==='critical'?'selected':''}>Critical</option>
            <option value="under_review" ${r.status==='under_review'?'selected':''}>Under Review</option>
            <option value="assigned" ${r.status==='assigned'?'selected':''}>Assigned</option>
            <option value="resolved" ${r.status==='resolved'?'selected':''}>Resolved</option>
          </select>` : ''}
          <button onclick="PP.openReport('${r.id}')" class="btn-primary text-xs py-1.5 px-3">
            View <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>`;
  };

  const openReport = (id) => {
    const r = PP_DATA.citizenReports.find(x => x.id === id);
    if (!r) return;
    const isAdmin = state.currentUser?.role === 'admin';

    document.getElementById('report-detail-content').innerHTML = `
      <div class="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10">
        <div>
          <div class="font-jakarta font-semibold text-on-surface">${r.title}</div>
          <div class="text-xs text-on-surface-variant">${r.id}</div>
        </div>
        <button onclick="PP.closeDrawer('report-detail-drawer')"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="p-4 space-y-4">
        <div class="flex items-center gap-2 flex-wrap">
          ${statusPill(r.status)}
          <span class="label-caps ${r.priority==='critical'?'text-error':r.priority==='high'?'text-amber-600':'text-on-surface-variant'}">${r.priority.toUpperCase()} PRIORITY</span>
        </div>
        <p class="text-sm text-on-surface">${r.description}</p>
        <div class="card p-3">
          <div class="section-title mb-2">Report Details</div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div><div class="label-caps text-on-surface-variant">Location</div><div>${r.location}</div></div>
            <div><div class="label-caps text-on-surface-variant">Submitted</div><div>${r.submittedDate}</div></div>
            <div><div class="label-caps text-on-surface-variant">Department</div><div>${r.assignedDepartment||'Unassigned'}</div></div>
            <div><div class="label-caps text-on-surface-variant">Upvotes</div><div>${r.upvotes}</div></div>
          </div>
        </div>
        ${isAdmin ? `
        <div class="card p-3">
          <div class="section-title mb-2">Admin Actions</div>
          <div class="space-y-2">
            <div>
              <label class="label-caps text-on-surface-variant mb-1 block">Status</label>
              <select onchange="PP.updateReportStatus('${r.id}', this.value)" class="w-full h-9 border border-outline-variant rounded-lg px-3 text-sm bg-white">
                <option value="critical" ${r.status==='critical'?'selected':''}>Critical</option>
                <option value="under_review" ${r.status==='under_review'?'selected':''}>Under Review</option>
                <option value="assigned" ${r.status==='assigned'?'selected':''}>Assigned</option>
                <option value="resolved" ${r.status==='resolved'?'selected':''}>Resolved</option>
              </select>
            </div>
            <div>
              <label class="label-caps text-on-surface-variant mb-1 block">Internal Remarks</label>
              <textarea rows="2" class="w-full border border-outline-variant rounded-lg px-3 py-2 text-sm bg-white resize-none" placeholder="Add internal notes...">${r.internalRemarks||''}</textarea>
            </div>
            <button onclick="PP.saveReportRemark('${r.id}')" class="btn-primary text-xs py-1.5 w-full justify-center">Save Remarks</button>
          </div>
        </div>` : ''}
        ${r.resolutionHistory.length > 0 ? `
        <div class="card p-3">
          <div class="section-title mb-2">Resolution History</div>
          <div class="space-y-2">
            ${r.resolutionHistory.map(h => `
              <div class="flex items-start gap-2">
                <span class="material-symbols-outlined text-secondary text-sm mt-0.5">check_circle</span>
                <div>
                  <div class="text-sm font-medium text-on-surface">${h.action}</div>
                  <div class="text-xs text-on-surface-variant">${h.date} · ${h.actor}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>` : ''}
      </div>
    `;
    openDrawer('report-detail-drawer');
  };

  const submitReport = async (e) => {
    e.preventDefault();
    const form = e.target;
    let photoCount = 0;

    // Check if user uploaded a photo and upload to server
    const photoInput = document.getElementById('report-photo-input');
    if (photoInput && photoInput.files && photoInput.files.length > 0) {
      const fd = new FormData();
      fd.append('file', photoInput.files[0]);
      fd.append('entityType', 'report');
      try {
        const upRes = await fetch('/api/upload', { method: 'POST', body: fd });
        if (upRes.ok) photoCount = 1;
      } catch (err) {
        console.warn('Photo upload warning:', err);
      }
    }

    const payload = {
      title: form.title.value.trim(),
      category: form.category.value,
      priority: form.priority.value,
      location: form.location.value.trim(),
      lat: 37.79 + (Math.random() - 0.5) * 0.05,
      lng: -122.38 + (Math.random() - 0.5) * 0.05,
      description: form.description.value.trim(),
      contact: form.contact?.value?.trim() || '',
      photos: photoCount,
      submittedBy: state.currentUser?.name || 'Citizen'
    };

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const savedReport = await res.json();
        PP_DATA.citizenReports.unshift(savedReport);
        toast(`Report ${savedReport.id} saved permanently to database!`);
        form.reset();
        document.getElementById('photo-preview')?.classList.add('hidden');
        renderReports();
        if (state.map) updateMapMarkers();

        setTimeout(() => {
          document.getElementById('track-report-id').value = savedReport.id;
          switchReportTab('track-report', document.querySelector('.report-tab[data-tab="track-report"]'));
          trackReport();
        }, 500);
        return;
      }
    } catch (err) {
      console.warn('API error, falling back locally', err);
    }

    // Local fallback if offline
    const newReport = {
      id: `CR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      ...payload,
      status: 'under_review',
      submittedDate: new Date().toISOString().split('T')[0],
      upvotes: 0,
      assignedDepartment: '',
      internalRemarks: '',
      resolutionHistory: []
    };
    PP_DATA.citizenReports.unshift(newReport);
    toast(`Report ${newReport.id} submitted!`);
    form.reset();
    document.getElementById('photo-preview')?.classList.add('hidden');
    renderReports();
    if (state.map) updateMapMarkers();
  };

  const handlePhotoUpload = (input) => {
    const preview = document.getElementById('photo-preview');
    const name = document.getElementById('photo-name');
    if (input.files.length > 0) {
      preview?.classList.remove('hidden');
      if (name) name.textContent = input.files[0].name;
    }
  };

  const trackReport = () => {
    const id = document.getElementById('track-report-id').value.trim();
    const r = PP_DATA.citizenReports.find(x => x.id.toLowerCase() === id.toLowerCase());
    const el = document.getElementById('track-result');
    if (!el) return;
    if (!r) {
      el.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-error">Report ID not found. Please check and try again.</div>`;
      return;
    }
    el.innerHTML = `
      <div class="card p-4">
        <div class="flex items-center justify-between gap-2 mb-3">
          <div class="font-jakarta font-semibold text-on-surface">${r.title}</div>
          ${statusPill(r.status)}
        </div>
        <div class="space-y-2 text-sm">
          <div class="flex gap-2"><span class="label-caps text-on-surface-variant w-24">Report ID</span><span>${r.id}</span></div>
          <div class="flex gap-2"><span class="label-caps text-on-surface-variant w-24">Submitted</span><span>${r.submittedDate}</span></div>
          <div class="flex gap-2"><span class="label-caps text-on-surface-variant w-24">Priority</span><span>${r.priority}</span></div>
          <div class="flex gap-2"><span class="label-caps text-on-surface-variant w-24">Department</span><span>${r.assignedDepartment||'Pending Assignment'}</span></div>
        </div>
        ${r.resolutionHistory.length > 0 ? `
        <div class="mt-3 border-t border-slate-100 pt-3">
          <div class="label-caps text-on-surface-variant mb-2">Progress</div>
          ${r.resolutionHistory.map(h=>`<div class="flex items-center gap-2 text-xs mb-1"><span class="material-symbols-outlined text-secondary text-sm">check_circle</span><span>${h.action} (${h.date})</span></div>`).join('')}
        </div>` : '<div class="mt-3 text-xs text-on-surface-variant">Your report is in queue for review.</div>'}
      </div>
    `;
  };

  const updateReportStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`/api/reports/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const r = PP_DATA.citizenReports.find(x => x.id === id);
        if (r) {
          r.status = newStatus;
          r.resolutionHistory = r.resolutionHistory || [];
          r.resolutionHistory.push({
            date: new Date().toISOString().split('T')[0],
            action: `Status changed to ${newStatus}`,
            actor: state.currentUser?.name || 'Admin'
          });
        }
        renderReports();
        if (state.map) updateMapMarkers();
        toast(`Report ${id} status updated to ${statusLabel[newStatus]} in database!`);
        return;
      }
    } catch (err) {
      console.warn('API error, falling back', err);
    }

    const r = PP_DATA.citizenReports.find(x => x.id === id);
    if (!r) return;
    r.status = newStatus;
    if (newStatus === 'resolved') {
      r.resolutionHistory = r.resolutionHistory || [];
      r.resolutionHistory.push({ date: new Date().toISOString().split('T')[0], action: 'Marked as resolved', actor: state.currentUser?.name || 'Admin' });
    }
    renderReports();
    toast(`Report ${id} status updated to ${statusLabel[newStatus]}`);
  };

  const saveReportRemark = async (id) => {
    const remark = document.getElementById('report-internal-remarks')?.value || '';
    try {
      const res = await fetch(`/api/reports/${id}/remarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalRemarks: remark })
      });
      if (res.ok) {
        const r = PP_DATA.citizenReports.find(x => x.id === id);
        if (r) r.internalRemarks = remark;
        toast('Internal remark saved permanently to database!');
        closeDrawer('report-detail-drawer');
        return;
      }
    } catch (err) {
      console.warn('API error, saving locally', err);
    }
    const r = PP_DATA.citizenReports.find(x => x.id === id);
    if (r) r.internalRemarks = remark;
    toast('Internal remark saved!');
    closeDrawer('report-detail-drawer');
  };

  // ===================== USERS =====================
  const renderUsersTable = () => {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    tbody.innerHTML = PP_DATA.users.map(u => `
      <tr>
        <td>
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold">${u.avatar}</div>
            <span class="font-medium">${u.name}</span>
          </div>
        </td>
        <td>${statusPill(u.role)}</td>
        <td class="text-on-surface-variant">${u.email}</td>
        <td>${u.ward ? `Ward ${u.ward}` : 'All'}</td>
        <td>
          <div class="flex items-center gap-1">
            <button onclick="PP.editUser(${u.id})" class="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface">
              <span class="material-symbols-outlined text-sm">edit</span>
            </button>
            ${u.id !== 1 ? `<button onclick="PP.deleteUser(${u.id})" class="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-on-surface-variant hover:text-error">
              <span class="material-symbols-outlined text-sm">delete</span>
            </button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  };

  const openAddUser = () => {
    const name = prompt('User name:');
    if (!name) return;
    const role = prompt('Role (admin/field_inspector/contractor/citizen):') || 'citizen';
    const email = prompt('Email:') || '';
    const newUser = { id: Date.now(), name, role, email, ward: null, avatar: name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) };
    PP_DATA.users.push(newUser);
    renderUsersTable();
    toast('User added!');
  };

  const editUser = (id) => { toast('User editing form – implementation ready for backend connection'); };
  const deleteUser = (id) => {
    if (confirm('Remove this user?')) {
      const idx = PP_DATA.users.findIndex(u => u.id === id);
      if (idx > -1) PP_DATA.users.splice(idx, 1);
      renderUsersTable();
      toast('User removed');
    }
  };

  // ===================== ADD / EDIT / DELETE PROJECT =====================
  const openAddProject = () => {
    state.editingProjectId = null;
    document.getElementById('add-project-modal-title').textContent = 'Add New Project';
    document.getElementById('project-form').reset();
    document.getElementById('project-form-id').value = '';
    openModal('add-project-modal');
  };

  const openEditProject = (id) => {
    const p = PP_DATA.projects.find(x => x.id === id);
    if (!p) return;
    state.editingProjectId = id;
    document.getElementById('add-project-modal-title').textContent = 'Edit Project';
    document.getElementById('project-form-id').value = id;
    document.getElementById('pf-name').value = p.name;
    document.getElementById('pf-category').value = p.category;
    document.getElementById('pf-ward').value = p.ward;
    document.getElementById('pf-department').value = p.department;
    document.getElementById('pf-status').value = p.status;
    document.getElementById('pf-budget').value = p.budget;
    document.getElementById('pf-disbursed').value = p.disbursed;
    document.getElementById('pf-contractor').value = p.contractor;
    document.getElementById('pf-start').value = p.startDate;
    document.getElementById('pf-deadline').value = p.deadline;
    document.getElementById('pf-actual').value = p.actualProgress;
    document.getElementById('pf-planned').value = p.plannedProgress;
    document.getElementById('pf-description').value = p.description;
    document.getElementById('pf-location').value = p.location;
    openModal('add-project-modal');
  };

  const saveProject = async (e) => {
    e.preventDefault();
    const id = document.getElementById('project-form-id').value;
    const projectData = {
      name: document.getElementById('pf-name').value,
      category: document.getElementById('pf-category').value,
      ward: parseInt(document.getElementById('pf-ward').value),
      department: document.getElementById('pf-department').value,
      status: document.getElementById('pf-status').value,
      budget: parseFloat(document.getElementById('pf-budget').value) || 0,
      disbursed: parseFloat(document.getElementById('pf-disbursed').value) || 0,
      contractor: document.getElementById('pf-contractor').value || 'TBD',
      start_date: document.getElementById('pf-start').value,
      deadline: document.getElementById('pf-deadline').value,
      actual_progress: parseInt(document.getElementById('pf-actual').value) || 0,
      planned_progress: parseInt(document.getElementById('pf-planned').value) || 0,
      description: document.getElementById('pf-description').value,
      location: document.getElementById('pf-location').value,
    };

    if (id) {
      // Edit in DB
      try {
        const res = await fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData)
        });
        if (res.ok) {
          const updated = await res.json();
          const idx = PP_DATA.projects.findIndex(p => p.id === id);
          if (idx > -1) PP_DATA.projects[idx] = updated;
          toast('Project updated in database!');
          closeModal('add-project-modal');
          if (state.currentPage === 'projects') filterProjectsList();
          if (state.currentPage === 'dashboard') updateDashboard();
          if (state.map) updateMapMarkers();
          return;
        }
      } catch (err) {
        console.warn('API error, saving locally', err);
      }

      const idx = PP_DATA.projects.findIndex(p => p.id === id);
      if (idx > -1) {
        PP_DATA.projects[idx] = { ...PP_DATA.projects[idx], ...projectData, actualProgress: projectData.actual_progress, plannedProgress: projectData.planned_progress };
        PP_DATA.projects[idx].scheduleVariance = projectData.actual_progress - projectData.planned_progress;
        toast('Project updated!');
      }
    } else {
      // Add in DB
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData)
        });
        if (res.ok) {
          const created = await res.json();
          PP_DATA.projects.unshift(created);
          toast(`Project ${created.id} saved to database!`);
          closeModal('add-project-modal');
          if (state.currentPage === 'projects') filterProjectsList();
          if (state.currentPage === 'dashboard') updateDashboard();
          if (state.map) updateMapMarkers();
          return;
        }
      } catch (err) {
        console.warn('API error, saving locally', err);
      }

      const newProj = {
        id: `PP-${new Date().getFullYear()}-${String(Math.floor(100+Math.random()*900)).padStart(3,'0')}`,
        ...projectData,
        actualProgress: projectData.actual_progress,
        plannedProgress: projectData.planned_progress,
        scheduleVariance: projectData.actual_progress - projectData.planned_progress,
        estimatedCompletion: projectData.deadline,
        milestones: [],
        inspections: [],
        progressHistory: [],
        images: [],
        lat: 37.78 + (Math.random()-0.5)*0.08,
        lng: -122.38 + (Math.random()-0.5)*0.08,
        tags: [],
      };
      PP_DATA.projects.unshift(newProj);
      toast(`Project ${newProj.id} created!`);
    }

    closeModal('add-project-modal');
    if (state.currentPage === 'projects') filterProjectsList();
    if (state.currentPage === 'dashboard') updateDashboard();
    if (state.map) updateMapMarkers();
  };

  const confirmDelete = (id) => {
    const p = PP_DATA.projects.find(x => x.id === id);
    if (!p) return;
    state.deletingProjectId = id;
    document.getElementById('delete-confirm-text').textContent = `Delete "${p.name}"? This action cannot be undone.`;
    document.getElementById('delete-confirm-btn').onclick = () => deleteProject(id);
    openModal('delete-confirm-modal');
  };

  const deleteProject = async (id) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const idx = PP_DATA.projects.findIndex(p => p.id === id);
        if (idx > -1) PP_DATA.projects.splice(idx, 1);
        closeModal('delete-confirm-modal');
        closeDrawer('project-detail-drawer');
        filterProjectsList();
        updateDashboard();
        if (state.map) updateMapMarkers();
        toast('Project deleted from database');
        return;
      }
    } catch (err) {
      console.warn('API error deleting project', err);
    }
    const idx = PP_DATA.projects.findIndex(p => p.id === id);
    if (idx > -1) PP_DATA.projects.splice(idx, 1);
    closeModal('delete-confirm-modal');
    closeDrawer('project-detail-drawer');
    filterProjectsList();
    updateDashboard();
    if (state.map) updateMapMarkers();
    toast('Project deleted');
  };

  // ===================== NOTIFICATIONS =====================
  const showNotifications = () => {
    const el = document.getElementById('notifications-list');
    if (el) {
      el.innerHTML = PP_DATA.notifications.map(n => `
        <div class="flex items-start gap-3 p-3 rounded-lg ${n.read?'bg-white':'bg-surface-container-low'} border border-outline-variant mb-1">
          <span class="material-symbols-outlined text-lg mt-0.5 ${n.type==='critical'?'text-error':n.type==='warning'?'text-amber-500':n.type==='success'?'text-secondary':'text-blue-500'}">${n.type==='critical'?'crisis_alert':n.type==='warning'?'warning':n.type==='success'?'check_circle':'info'}</span>
          <div class="flex-1">
            <div class="text-sm ${n.read?'text-on-surface-variant':'font-semibold text-on-surface'}">${n.message}</div>
            <div class="label-caps text-on-surface-variant mt-0.5">${n.time}</div>
          </div>
          ${!n.read ? '<span class="w-2 h-2 rounded-full bg-secondary shrink-0 mt-1"></span>' : ''}
        </div>
      `).join('') || '<div class="text-sm text-on-surface-variant text-center py-8">No notifications</div>';
      // Mark all as read
      PP_DATA.notifications.forEach(n => n.read = true);
      document.getElementById('notif-count').textContent = '0';
      document.getElementById('topbar-notif-badge').style.display = 'none';
    }
    openDrawer('notifications-drawer');
  };

  // ===================== EXPORT =====================
  const exportReport = () => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      toast('Generating text export (PDF module offline)...');
      let csv = 'Project ID,Name,Category,Ward,Contractor,Budget,Progress,Status\n';
      PP_DATA.projects.forEach(p => {
        csv += `"${p.id}","${p.name.replace(/"/g, '""')}","${p.category}","${p.ward}","${p.contractor.replace(/"/g, '""')}","${p.budget}","${p.actualProgress}%","${p.status}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ProjectPulse_Projects.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast('Exported projects CSV!');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('ProjectPulse – Infrastructure Report', 15, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('DEMO DATA – Not verified government records', 15, 28);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, 34);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Active Projects Summary', 15, 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    let y = 54;
    PP_DATA.projects.forEach(p => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.text(`${p.id}: ${p.name}`, 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`  Ward ${p.ward} | ${p.contractor} | Status: ${statusLabel[p.status]} | Progress: ${p.actualProgress}% | Budget: ${fmtMoney(p.budget)}`, 15, y+5);
      y += 14;
    });

    doc.save('ProjectPulse_Report.pdf');
    toast('PDF report exported!');
  };

  const exportProjectPDF = (id) => {
    const p = PP_DATA.projects.find(x => x.id === id);
    if (!p) return;
    if (!window.jspdf || !window.jspdf.jsPDF) {
      toast('PDF generator is initializing or offline.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(p.name, 15, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${p.id} · Ward ${p.ward} · DEMO DATA`, 15, 28);
    doc.text(`Contractor: ${p.contractor}`, 15, 36);
    doc.text(`Status: ${statusLabel[p.status]} | Progress: ${p.actualProgress}% (Planned: ${p.plannedProgress}%)`, 15, 44);
    doc.text(`Budget: ${fmtMoney(p.budget)} | Disbursed: ${fmtMoney(p.disbursed)}`, 15, 52);
    doc.text(`Deadline: ${p.deadline} | Est. Completion: ${p.estimatedCompletion}`, 15, 60);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Milestones', 15, 74);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let y = 82;
    p.milestones.forEach(m => {
      doc.text(`${m.completed ? '[✓]' : '[ ]'} ${m.name} – ${m.completed ? m.completedDate : m.date}`, 15, y);
      y += 7;
    });
    doc.save(`${p.id}_Report.pdf`);
    toast('Project PDF exported!');
  };

  // ===================== GEMINI AI ASSISTANT =====================
  // Set your Gemini API key via the custom key input in the AI Assistant panel,
  // or configure GEMINI_API_KEY in your server's environment variables.
  const GEMINI_API_KEY = '';
  const GEMINI_MODEL = 'gemini-3.5-flash';
  let currentApiKey = GEMINI_API_KEY;
  let aiChatHistory = [];

  const buildGeminiSystemPrompt = () => {
    const projects = PP_DATA.projects;
    const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
    const critical = projects.filter(p => p.status === 'critical');
    const delayed = projects.filter(p => p.scheduleVariance < 0);
    const reports = PP_DATA.citizenReports;
    return `You are the AI Civic Assistant for ProjectPulse, Metro District's real-time civic infrastructure monitoring platform.

PLATFORM CONTEXT:
- ${projects.length} active infrastructure projects totalling $${(totalBudget / 1e9).toFixed(2)}B in public capital
- ${critical.length} projects in critical status, ${delayed.length} with schedule delays
- ${reports.length} active citizen reports

LIVE PROJECT DATA (Demo — not verified government records):
${projects.map(p => `• ${p.id} "${p.name}" | Ward ${p.ward} | ${p.contractor} | Status: ${p.status} | Progress: ${p.actualProgress}% (target ${p.plannedProgress}%) | Budget: $${(p.budget / 1e6).toFixed(1)}M disbursed $${(p.disbursed / 1e6).toFixed(1)}M | Deadline: ${p.deadline} | Variance: ${p.scheduleVariance}d`).join('\n')}

CITIZEN REPORTS:
${reports.map(r => `• ${r.id} "${r.title}" | ${r.priority} priority | ${r.status} | ${r.location}`).join('\n')}

INSTRUCTIONS:
- Be a sharp, data-driven municipal intelligence analyst
- Reference specific project IDs, names, and figures from the data above
- Keep responses concise but insightful (3-5 sentences or bullet points)
- Always note when data is "demo data" (not verified government records)
- For risk analysis: check schedule variance, budget burn rate vs progress, unresolved inspections
- For executive memos: use formal, authoritative government language`;
  };

  const showAIAssistant = () => openModal('ai-assistant-modal');

  const toggleAISettings = () => {
    const drawer = document.getElementById('ai-settings-drawer');
    if (drawer) drawer.classList.toggle('hidden');
  };

  const clearAIChat = () => {
    aiChatHistory = [];
    const chat = document.getElementById('ai-chat');
    if (chat) chat.innerHTML = `<div class="flex gap-2"><div class="w-7 h-7 bg-gradient-to-br from-teal-500 to-blue-600 rounded-full flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-white text-xs">smart_toy</span></div><div class="bg-surface-container-low rounded-xl rounded-tl-sm p-3.5 text-xs text-on-surface max-w-sm shadow-sm border border-outline-variant/30">Chat cleared. How can I assist you?</div></div>`;
  };

  const updateCustomApiKey = () => {
    const input = document.getElementById('custom-api-key-input');
    if (input && input.value.trim()) {
      currentApiKey = input.value.trim();
      toast('API key updated!');
      document.getElementById('ai-settings-drawer')?.classList.add('hidden');
    }
  };

  const sendQuickPrompt = (text) => {
    const input = document.getElementById('ai-input');
    if (input) { input.value = text; askAI(); }
  };

  const appendAIMessage = (role, html, isLoading = false) => {
    const chat = document.getElementById('ai-chat');
    if (!chat) return;
    if (role === 'user') {
      chat.innerHTML += `<div class="flex justify-end"><div class="bg-[#0f172a] text-white rounded-xl rounded-tr-sm px-3.5 py-2.5 text-xs max-w-xs shadow-sm">${html}</div></div>`;
    } else {
      const idAttr = isLoading ? 'id="ai-loading-bubble"' : '';
      chat.innerHTML += `<div class="flex gap-2" ${idAttr}><div class="w-7 h-7 bg-gradient-to-br from-teal-500 to-blue-600 rounded-full flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-white text-xs">smart_toy</span></div><div class="bg-surface-container-low rounded-xl rounded-tl-sm px-3.5 py-2.5 text-xs text-on-surface max-w-sm shadow-sm border border-outline-variant/30 leading-relaxed">${html}</div></div>`;
    }
    chat.scrollTop = chat.scrollHeight;
  };

  const askAI = async () => {
    const input = document.getElementById('ai-input');
    const q = input?.value.trim();
    if (!q) return;
    input.value = '';

    appendAIMessage('user', q.replace(/</g, '&lt;'));
    appendAIMessage('bot', '<span class="inline-flex gap-1"><span class="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce"></span><span class="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style="animation-delay:.15s"></span><span class="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style="animation-delay:.3s"></span></span>', true);

    aiChatHistory.push({ role: 'user', parts: [{ text: q }] });

    try {
      const key = currentApiKey || GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildGeminiSystemPrompt() }] },
          contents: aiChatHistory,
          generationConfig: { temperature: 0.4, maxOutputTokens: 512 }
        })
      });
      const data = await res.json();
      document.getElementById('ai-loading-bubble')?.remove();

      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const reply = data.candidates[0].content.parts[0].text;
        aiChatHistory.push({ role: 'model', parts: [{ text: reply }] });
        const formatted = reply
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/\n/g, '<br>');
        appendAIMessage('bot', formatted);
      } else if (data.error) {
        appendAIMessage('bot', `<span class="text-red-500 font-medium">API Error: ${data.error.message}</span>`);
      } else {
        appendAIMessage('bot', '<span class="text-amber-600">No response received. Please try again.</span>');
      }
    } catch (err) {
      document.getElementById('ai-loading-bubble')?.remove();
      appendAIMessage('bot', '<span class="text-red-500 font-medium">Network error. Check your connection and API key.</span>');
    }
  };

  const runLiveProjectRiskAnalysis = async (projectId) => {
    const p = PP_DATA.projects.find(x => x.id === projectId);
    if (!p) return;

    const containerIds = ['monitoring-live-risk-container', `live-risk-result-${projectId}`];
    const btn = document.getElementById('btn-run-monitoring-risk') || document.getElementById(`btn-run-risk-${projectId}`);

    const loadingHtml = `<div class="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg p-3"><span class="inline-flex gap-1"><span class="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce"></span><span class="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style="animation-delay:.15s"></span><span class="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style="animation-delay:.3s"></span></span>Running Gemini 3.5 deep analysis on ${p.name}…</div>`;
    containerIds.forEach(cid => { const el = document.getElementById(cid); if (el) el.innerHTML = loadingHtml; });
    if (btn) btn.disabled = true;

    const prompt = `You are a senior municipal infrastructure risk analyst. Provide a concise but authoritative risk assessment for the following infrastructure project using ONLY the data provided.

PROJECT DATA (Demo — not verified government records):
- ID: ${p.id}
- Name: ${p.name}
- Ward: ${p.ward} | Category: ${p.category}
- Contractor: ${p.contractor}
- Status: ${p.status}
- Actual Progress: ${p.actualProgress}% | Planned: ${p.plannedProgress}% | Variance: ${p.scheduleVariance}d
- Budget: $${(p.budget / 1e6).toFixed(1)}M total | $${(p.disbursed / 1e6).toFixed(1)}M disbursed (${Math.round(p.disbursed / p.budget * 100)}%)
- Start: ${p.startDate} | Deadline: ${p.deadline} | Est. Completion: ${p.estimatedCompletion}
- Milestones: ${p.milestones.filter(m => m.completed).length}/${p.milestones.length} complete
- Recent Inspections: ${p.inspections?.map(i => `${i.type}: ${i.result}`).join(', ') || 'None on record'}

Provide a structured 3-section response:
1. RISK LEVEL: (Low/Medium/High/Critical) with one sentence rationale
2. KEY CONCERNS: 2-3 bullet points of specific data-driven risks
3. RECOMMENDED ACTIONS: 2-3 concrete administrative actions

Keep total response under 160 words. End with disclaimer: "Analysis based on demo data only."`;

    try {
      const key = currentApiKey || GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 400 }
        })
      });
      const data = await res.json();
      if (btn) btn.disabled = false;

      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const reply = data.candidates[0].content.parts[0].text;
        const formatted = reply
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/\n/g, '<br>');
        const html = `<div class="text-xs text-on-surface leading-relaxed bg-gradient-to-br from-teal-50 to-blue-50 border border-teal-200/60 rounded-lg p-3.5">${formatted}</div>
          <div class="flex items-center gap-1 mt-1.5 text-[10px] text-teal-600 font-medium"><span class="material-symbols-outlined text-[12px]">verified</span>Generated by Gemini 3.5 Flash · ${new Date().toLocaleTimeString()}</div>`;
        containerIds.forEach(cid => { const el = document.getElementById(cid); if (el) el.innerHTML = html; });
      } else {
        const errHtml = `<div class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">API Error: ${data.error?.message || 'Unknown error. Please try again.'}</div>`;
        containerIds.forEach(cid => { const el = document.getElementById(cid); if (el) el.innerHTML = errHtml; });
      }
    } catch (err) {
      if (btn) btn.disabled = false;
      const errHtml = `<div class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">Network error. Ensure internet access is available and try again.</div>`;
      containerIds.forEach(cid => { const el = document.getElementById(cid); if (el) el.innerHTML = errHtml; });
    }
  };

  const triageCitizenReport = async () => {
    const form = document.querySelector('form[onsubmit]');
    const badge = document.getElementById('ai-triage-badge');

    const titleEl = document.getElementById('report-title') || form?.querySelector('[name="title"]') || form?.querySelector('[placeholder*="title" i]');
    const descEl = document.getElementById('report-description') || form?.querySelector('[name="description"]') || form?.querySelector('textarea');
    const title = titleEl?.value?.trim() || '';
    const desc = descEl?.value?.trim() || '';

    if (!title && !desc) {
      toast('Please fill in the title and description first.');
      return;
    }

    if (badge) {
      badge.classList.remove('hidden');
      badge.innerHTML = `<div class="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg p-2 mb-2"><span class="inline-flex gap-1"><span class="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce"></span><span class="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style="animation-delay:.15s"></span></span>AI is triaging your report…</div>`;
    }

    const prompt = `Classify this citizen infrastructure complaint for Metro District:
Title: "${title || '(none)'}"
Description: "${desc || '(none)'}"

Respond ONLY in this exact JSON format with no markdown, no extra text:
{"category":"road_damage|infrastructure_safety|water_supply|public_facility","priority":"low|medium|high|critical","department":"Department of Transportation|Public Works|Water & Utilities|Parks & Recreation|Electrical Services","summary":"One sentence summary","urgency_reason":"Why this priority level"}`;

    try {
      const key = currentApiKey || GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
        })
      });
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let parsed = null;
      try { parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim()); } catch { parsed = null; }

      if (parsed && badge) {
        const catSel = form?.querySelector('[name="category"]') || document.getElementById('report-category');
        const priSel = form?.querySelector('[name="priority"]') || document.getElementById('report-priority');
        if (catSel && parsed.category) catSel.value = parsed.category;
        if (priSel && parsed.priority) priSel.value = parsed.priority;

        const priColor = { critical: 'red', high: 'orange', medium: 'amber', low: 'green' }[parsed.priority] || 'teal';
        badge.innerHTML = `<div class="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-2 text-xs">
          <div class="font-semibold text-teal-800 flex items-center gap-1 mb-1.5"><span class="material-symbols-outlined text-[13px] text-teal-600">auto_awesome</span>AI Triage Complete</div>
          <div class="flex flex-wrap gap-2 mb-1">
            <span class="bg-teal-100 text-teal-800 rounded px-2 py-0.5 font-medium">${(parsed.category || '').replace(/_/g, ' ')}</span>
            <span class="bg-${priColor}-100 text-${priColor}-800 rounded px-2 py-0.5 font-medium capitalize">${parsed.priority || ''} priority</span>
          </div>
          <div class="text-slate-700"><strong>Dept:</strong> ${parsed.department || '—'}</div>
          <div class="text-teal-700 mt-1 italic">${parsed.urgency_reason || ''}</div>
          <div class="text-teal-500 mt-1.5 font-medium">Form auto-filled · Gemini 3.5 Flash</div>
        </div>`;
      } else if (badge) {
        badge.innerHTML = `<div class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-2">Could not auto-triage. Please fill the form manually.</div>`;
      }
    } catch (err) {
      if (badge) badge.innerHTML = `<div class="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-2">Triage failed: network error.</div>`;
    }
  };

  // ===================== MODALS & DRAWERS =====================
  const openModal = (id) => {
    document.getElementById(id)?.classList.add('open');
  };
  const closeModal = (id) => {
    document.getElementById(id)?.classList.remove('open');
  };
  const openDrawer = (id) => {
    document.getElementById(id)?.classList.add('open');
    document.getElementById('drawer-overlay')?.classList.add('show');
  };
  const closeDrawer = (id) => {
    document.getElementById(id)?.classList.remove('open');
    // Check if any other drawers are open
    const openDrawers = document.querySelectorAll('.drawer.open');
    if (openDrawers.length === 0) {
      document.getElementById('drawer-overlay')?.classList.remove('show');
    }
  };
  const closeAllDrawers = () => {
    document.querySelectorAll('.drawer').forEach(d => d.classList.remove('open'));
    document.getElementById('drawer-overlay')?.classList.remove('show');
  };

  const openAddNote = () => { openModal('add-note-modal'); };
  const saveNote = () => {
    const text = document.getElementById('note-text').value;
    if (!text.trim()) { toast('Please enter a note'); return; }
    toast('Note saved!');
    closeModal('add-note-modal');
  };

  const openMobileMenu = () => { openDrawer('mobile-menu-drawer'); };

  const showProfile = () => {
    toast(`Signed in as ${state.currentUser?.name} (${state.currentUser?.role})`);
  };

  // ===================== INIT =====================
  const initApp = () => {
    // Set date
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', { weekday:'short', month:'long', day:'numeric', year:'numeric' });

    // Populate select menus
    ['monitor-project-select','twin-project-select'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel) {
        PP_DATA.projects.forEach(p => {
          const o = document.createElement('option');
          o.value = p.id; o.textContent = `${p.id} – ${p.name}`;
          sel.appendChild(o);
        });
      }
    });

    // Department dropdown
    const deptSel = document.getElementById('pf-department');
    if (deptSel) {
      PP_DATA.departments.forEach(d => {
        const o = document.createElement('option');
        o.value = d; o.textContent = d;
        deptSel.appendChild(o);
      });
    }

    navigate('dashboard');

    // Global search
    document.getElementById('global-search')?.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      if (q.length >= 2) {
        navigate('projects');
        setTimeout(() => {
          document.getElementById('project-search').value = q;
          filterProjectsList();
        }, 100);
      }
    });

    // Window resize handler
    window.addEventListener('resize', () => {
      if (state.twinRenderer) {
        const canvas = document.getElementById('digital-twin-canvas');
        if (canvas) {
          const W = canvas.clientWidth;
          const H = canvas.clientHeight;
          state.twinRenderer.setSize(W, H);
          if (state.twinCamera) state.twinCamera.aspect = W/H;
          state.twinCamera?.updateProjectionMatrix();
        }
      }
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
        closeAllDrawers();
      }
    });
  };

  // Public API
  return {
    login, logout, handleRoleChange, initApp,
    initGoogleAuth, triggerGoogleLogin, loadDatabaseData, applyUserSession,
    navigate, toggleSidebar, closeSidebar,
    updateDashboard, filterProjects,
    setCategoryFilter, filterProjectsList, clearProjectSearch, clearAllFilters,
    renderProjectGrid,
    openProject,
    initMap, updateMapMarkers, flyToProject, centerMap, toggleMapLayer,
    loadMonitoringProject, openAddInspection,
    initDigitalTwin, loadTwinProject, resetTwinCamera,
    initSpatialDashboard,
    switchReportTab, renderReports, openReport, submitReport, handlePhotoUpload, trackReport, updateReportStatus, saveReportRemark,
    renderUsersTable, openAddUser, editUser, deleteUser,
    openAddProject, openEditProject, saveProject, confirmDelete, deleteProject,
    showNotifications,
    exportReport, exportProjectPDF,
    showAIAssistant, askAI, toggleAISettings, clearAIChat, updateCustomApiKey, sendQuickPrompt,
    runLiveProjectRiskAnalysis, triageCitizenReport,
    openModal, closeModal, openDrawer, closeDrawer, closeAllDrawers,
    openAddNote, saveNote, openMobileMenu, showProfile,
  };
})();
var PP = window.PP;

// Initialize Google Identity Services & Backend Sync
window.addEventListener('DOMContentLoaded', () => {
  if (window.PP) {
    if (window.PP.initGoogleAuth) window.PP.initGoogleAuth();
    if (window.PP.loadDatabaseData) window.PP.loadDatabaseData();
  }
});

// Auto-restore session from backend API or localStorage
(async () => {
  try {
    // 1. Try backend session
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user && window.PP && window.PP.applyUserSession) {
        window.PP.applyUserSession(data.user);
        return;
      }
    }
  } catch (e) {}

  // 2. Try localStorage session
  try {
    const saved = localStorage.getItem('pp_session');
    if (saved) {
      const user = JSON.parse(saved);
      if (user && user.email && window.PP && window.PP.applyUserSession) {
        window.PP.applyUserSession(user);
      }
    }
  } catch (e) {}
})();
