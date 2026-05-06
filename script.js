// ── STATE ──────────────────────────────────────────────
let currentUser = null;
let allEvents = [];
let currentEvId = null;
let currentStep = 1;

// ── PAGE SWITCH ────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
}

// ── LOGIN ──────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const status   = document.getElementById('login-status');

  if (!username || !password) { status.textContent = 'Enter credentials'; return; }

  try {
    const res  = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      if (data.role === 'admin') {
        showPage('pg-admin');
        showTab('events');
        const av = document.getElementById('admin-avatar');
        if (av) av.textContent = username[0].toUpperCase();
      } else {
        showPage('pg-user');
        const av = document.getElementById('user-avatar');
        if (av) av.textContent = username[0].toUpperCase();
        loadUserEvents();
      }
      status.textContent = 'Login success';
    } else {
      status.textContent = 'Invalid login';
    }
  } catch {
    status.textContent = 'Server error';
  }
}

function logout() {
  currentUser = null;
  showPage('pg-login');
}

// ── ADMIN TABS ─────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[onclick="showTab('${tab}')"]`);
  if (btn) btn.classList.add('active');

  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`admin-${tab}`);
  if (panel) panel.classList.add('active');

  if (tab === 'events') loadAdminEvents();
  if (tab === 'counts') loadCounts();
}

async function loadAdminEvents() {
  const container = document.getElementById('events-list');
  if (!container) return;
  container.innerHTML = 'Loading...';
  try {
    const res = await fetch('/api/events');
    const events = await res.json();
    if (!events.length) { container.innerHTML = '<div class="no-data">No events yet</div>'; return; }
    container.innerHTML = events.map(e => `
      <div class="event-item">
        <div>
          <strong>${e.name}</strong><br>
          <small>${e.category} · ${e.venue} · ${formatDate(e.event_date)}</small>
        </div>
        <button onclick="deleteEvent(${e.id})">Delete</button>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div class="no-data">Error loading</div>';
  }
}

async function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  await fetch(`/api/events/${id}`, { method: 'DELETE' });
  loadAdminEvents();
  loadCounts();
}

async function loadCounts() {
  const container = document.getElementById('counts-list');
  if (!container) return;
  container.innerHTML = 'Loading...';
  try {
    const res = await fetch('/api/events');
    const events = await res.json();
    if (!events.length) { container.innerHTML = '<div class="no-data">No events yet</div>'; return; }
    container.innerHTML = events.map(e => `
      <div class="event-item">
        <div>
          <strong>${e.name}</strong><br>
          <small>${e.registrations || 0} / ${e.capacity} registered</small>
        </div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div class="no-data">Error loading</div>';
  }
}

// ── LOAD USER EVENTS ───────────────────────────────────
async function loadUserEvents() {
  try {
    const res = await fetch('/api/events');
    allEvents = await res.json();
  } catch {
    allEvents = [];
  }

  // update hero stats
  const totalSeats = allEvents.reduce((sum, e) => sum + Math.max(0, (e.capacity || 0) - (e.registrations || 0)), 0);
  const totalEl = document.getElementById('stat-total');
  const seatsEl = document.getElementById('stat-spots');
  if (totalEl) totalEl.textContent = allEvents.length;
  if (seatsEl) seatsEl.textContent = totalSeats;

  renderAllSections();
}

// ── RENDER ALL CAROUSEL SECTIONS ──────────────────────
function renderAllSections() {
  const container = document.getElementById('all-sections');
  if (!container) return;

  const search = (document.getElementById('ev-search')?.value || '').toLowerCase();

  // filter by search
  const events = allEvents.filter(e =>
    !search ||
    e.name.toLowerCase().includes(search) ||
    (e.category || '').toLowerCase().includes(search) ||
    (e.venue || '').toLowerCase().includes(search)
  );

  if (!events.length) {
    container.innerHTML = '<p style="color:#888; padding:12px 0;">No events found.</p>';
    return;
  }

  // get unique categories from the filtered list
  const categories = [...new Set(events.map(e => (e.category || 'Other').toLowerCase()))];

  let html = '';

  // 1. "All Events" carousel at the top
  html += buildSection('All Events', events, 'all');

  // 2. One carousel per category
  categories.forEach(cat => {
    const catEvents = events.filter(e => (e.category || 'Other').toLowerCase() === cat);
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    html += buildSection(label, catEvents, cat);
  });

  container.innerHTML = html;
}

// Build one section (title + carousel)
function buildSection(title, events, sectionId) {
  const cards = events.map(e => buildCard(e)).join('');

  return `
    <div class="ev-section">
      <div class="ev-section-title">
        ${title}
        <span>${events.length} event${events.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="carousel-wrap">
        <button class="carousel-btn left" onclick="scrollCarousel('track-${sectionId}', -1)">&#8249;</button>
        <div class="carousel-track" id="track-${sectionId}">
          ${cards}
        </div>
        <button class="carousel-btn right" onclick="scrollCarousel('track-${sectionId}', 1)">&#8250;</button>
      </div>
    </div>
  `;
}

// Build one event card (no icons)
function buildCard(e) {
  const regs     = e.registrations || 0;
  const cap      = e.capacity || 0;
  const seatsLeft = Math.max(0, cap - regs);
  const pct      = cap > 0 ? Math.round((regs / cap) * 100) : 0;
  const bg       = getBannerColor(e.category);

  return `
    <div class="ev-card" onclick="openRegModal(${e.id})">
      <div class="ec-banner" style="background: ${bg}">
        <div class="ec-banner-inner">
          <span class="ec-cat-badge">${e.category || 'Event'}</span>
        </div>
      </div>
      <div class="ec-body">
        <div class="ec-name">${e.name}</div>
        <div class="ec-meta">${e.venue || 'TBA'} &middot; ${formatDate(e.event_date)}</div>
        <div class="ec-seats">${seatsLeft} / ${cap} seats left</div>
        <div class="ec-prog-track">
          <div class="ec-prog-fill" style="width: ${pct}%"></div>
        </div>
        <button class="ec-rbtn">Register</button>
      </div>
    </div>
  `;
}

// Scroll a carousel left or right
function scrollCarousel(trackId, direction) {
  const track = document.getElementById(trackId);
  if (track) track.scrollLeft += direction * 260;
}

// Banner colors per category
function getBannerColor(cat) {
  const colors = {
    hackathon: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
    workshop:  'linear-gradient(135deg, #065f46, #059669)',
    cultural:  'linear-gradient(135deg, #7c3aed, #a78bfa)',
    sports:    'linear-gradient(135deg, #b45309, #f59e0b)',
    seminar:   'linear-gradient(135deg, #0f766e, #14b8a6)',
    other:     'linear-gradient(135deg, #374151, #6b7280)',
  };
  return colors[(cat || '').toLowerCase()] || 'linear-gradient(135deg, #1B3A6B, #0D9488)';
}

// ── REGISTRATION MODAL ────────────────────────────────
function openRegModal(id) {
  currentEvId = id;
  const ev = allEvents.find(e => e.id === id);

  if (ev) {
    const nameEl  = document.getElementById('m-ev-name');
    const metaEl  = document.getElementById('m-ev-meta');
    const emojiEl = document.getElementById('m-emoji');
    if (nameEl)  nameEl.textContent  = ev.name;
    if (metaEl)  metaEl.textContent  = `${ev.venue || ''} · ${formatDate(ev.event_date)}`;
    if (emojiEl) emojiEl.textContent = '📅';
  }

  // clear fields
  ['reg-name', 'reg-num', 'reg-dept', 'reg-phone', 'reg-email'].forEach(fid => {
    const el = document.getElementById(fid);
    if (el) el.value = '';
  });
  const yearEl = document.getElementById('reg-year');
  if (yearEl) yearEl.value = '';

  goToStep(1);
  document.getElementById('reg-modal')?.classList.add('open');
}

function closeModal() {
  document.getElementById('reg-modal')?.classList.remove('open');
}

function goToStep(step) {
  currentStep = step;

  for (let i = 1; i <= 3; i++) {
    const stepEl = document.getElementById(`mstep${i}`);
    const dot    = document.getElementById(`sdot${i}`);
    const lbl    = document.getElementById(`slbl${i}`);
    if (stepEl) stepEl.classList.toggle('active', i === step);
    if (dot) {
      dot.classList.remove('active', 'done');
      if (i < step)      dot.classList.add('done');
      else if (i === step) dot.classList.add('active');
    }
    if (lbl) lbl.classList.toggle('active', i === step);
  }

  for (let i = 1; i <= 2; i++) {
    const line = document.getElementById(`sline${i}`);
    if (line) line.classList.toggle('done', i < step);
  }
}

function mNext(fromStep) {
  if (fromStep === 1) {
    const name   = document.getElementById('reg-name').value.trim();
    const regNum = document.getElementById('reg-num').value.trim();
    const year   = document.getElementById('reg-year').value;
    if (!name || !regNum || !year) {
      alert('Please fill in Name, Register Number, and Year.');
      return;
    }
  }
  if (fromStep === 2) {
    const dept  = document.getElementById('reg-dept').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    if (!dept || !phone) {
      alert('Please fill in Department and Phone Number.');
      return;
    }
    buildSummary();
  }
  goToStep(fromStep + 1);
}

function mBack(fromStep) {
  goToStep(fromStep - 1);
}

function buildSummary() {
  const ev = allEvents.find(e => e.id === currentEvId);
  const el = document.getElementById('reg-summary');
  if (!el) return;

  const rows = [
    { label: 'Event',           value: ev ? ev.name : '—' },
    { label: 'Full Name',       value: document.getElementById('reg-name').value },
    { label: 'Register Number', value: document.getElementById('reg-num').value },
    { label: 'Year',            value: document.getElementById('reg-year').value },
    { label: 'Department',      value: document.getElementById('reg-dept').value },
    { label: 'Phone',           value: document.getElementById('reg-phone').value },
    { label: 'Email',           value: document.getElementById('reg-email').value || 'Not provided' },
  ];

  el.innerHTML = rows.map(r => `
    <div class="rs-row">
      <span class="rs-lbl">${r.label}</span>
      <span class="rs-val">${r.value || '—'}</span>
    </div>
  `).join('');
}

async function submitReg() {
  const data = {
    event_id: currentEvId,
    name:     document.getElementById('reg-name').value.trim(),
    reg_num:  document.getElementById('reg-num').value.trim(),
    year:     document.getElementById('reg-year').value,
    dept:     document.getElementById('reg-dept').value.trim(),
    phone:    document.getElementById('reg-phone').value.trim(),
    email:    document.getElementById('reg-email').value.trim(),
  };

  try {
    await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch {}

  closeModal();
  showSuccessModal(data);
  loadUserEvents();
}

function showSuccessModal(data) {
  const ev = allEvents.find(e => e.id === currentEvId);
  const ticketEl = document.getElementById('succ-ticket');
  if (ticketEl) {
    ticketEl.innerHTML = [
      { label: 'Name',    value: data.name },
      { label: 'Reg No.', value: data.reg_num },
      { label: 'Event',   value: ev ? ev.name : '—' },
      { label: 'Venue',   value: ev ? ev.venue : '—' },
      { label: 'Date',    value: ev ? formatDate(ev.event_date) : '—' },
    ].map(r => `
      <div class="st-row">
        <span>${r.label}</span>
        <b>${r.value || '—'}</b>
      </div>
    `).join('');
  }
  document.getElementById('succ-modal')?.classList.add('open');
}

function closeSucc() {
  document.getElementById('succ-modal')?.classList.remove('open');
}

// ── HELPERS ───────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return 'TBA';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Admin: add event form
  const eventForm = document.getElementById('event-form');
  if (eventForm) {
    eventForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = {
        name:       document.getElementById('event-name').value,
        category:   document.getElementById('event-category').value,
        venue:      document.getElementById('event-venue').value,
        event_date: document.getElementById('event-date').value,
        capacity:   parseInt(document.getElementById('event-capacity').value) || 100
      };
      try {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        loadAdminEvents();
        loadCounts();
        eventForm.reset();
      } catch {
        alert('Failed to add event');
      }
    });
  }

  // Enter key on login
  document.getElementById('login-password')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') doLogin();
  });

  // Click outside modal to close
  document.getElementById('reg-modal')?.addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
  document.getElementById('succ-modal')?.addEventListener('click', function(e) {
    if (e.target === this) closeSucc();
  });

});
