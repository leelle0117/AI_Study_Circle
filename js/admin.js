// ========== Admin Page Logic ==========

let adminUser = null;
let adminProfile = null;

// ========== Init ==========
async function initAdmin() {
    try {
        const session = await Auth.getSession();
        if (!session) {
            showDenied();
            return;
        }

        adminUser = session.user;

        // ADMIN_EMAILS 체크 (supabase-config.js에 정의)
        if (!ADMIN_EMAILS.includes(adminUser.email.toLowerCase())) {
            showDenied();
            return;
        }

        try {
            adminProfile = await DB.getProfile(adminUser.id);
        } catch (e) {
            adminProfile = null;
        }

        // 관리자 확인 완료 — 콘텐츠 표시
        document.getElementById('admin-loading').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
        document.getElementById('nav-user-name').textContent =
            (adminProfile && adminProfile.name) || adminUser.email;

        loadMembers();
        loadEvents();
        loadLocations();
        loadInquiries();
        loadEmailTab();
    } catch (e) {
        showDenied();
    }
}

function showDenied() {
    document.getElementById('admin-loading').style.display = 'none';
    document.getElementById('admin-denied').style.display = 'block';
}

// ========== Tabs ==========
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
});

// ========== Nav Dropdown ==========
const navUserBtn = document.getElementById('nav-user-btn');
const navDropdown = document.getElementById('nav-dropdown');

navUserBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navDropdown.classList.toggle('show');
});

document.addEventListener('click', () => {
    navDropdown.classList.remove('show');
});

document.getElementById('admin-logout-btn').addEventListener('click', async () => {
    await Auth.signOut();
    window.location.href = 'index.html';
});

// ========== Members ==========
let allMembers = [];

async function loadMembers() {
    try {
        allMembers = await DB.getAllProfiles();
        renderMembers(allMembers);
    } catch (e) {
        document.getElementById('members-tbody').innerHTML =
            '<tr><td colspan="7" class="admin-empty">멤버 목록을 불러올 수 없습니다.</td></tr>';
    }
}

function renderMembers(members) {
    const tbody = document.getElementById('members-tbody');
    if (members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="admin-empty">등록된 멤버가 없습니다.</td></tr>';
        document.getElementById('member-count').textContent = '';
        return;
    }

    tbody.innerHTML = members.map(m => {
        const interests = (m.interests || []).join(', ');
        const date = m.created_at ? new Date(m.created_at).toLocaleDateString('ko-KR') : '-';
        return `<tr>
            <td>${escapeHtml(m.name || '-')}</td>
            <td>${escapeHtml(m.phone || '-')}</td>
            <td>${escapeHtml(m.email || '-')}</td>
            <td>${escapeHtml(m.current_job || '-')}</td>
            <td>${escapeHtml(interests || '-')}</td>
            <td>${escapeHtml(m.member_type || '-')}</td>
            <td>${date}</td>
            <td><button class="btn-secondary btn-small" onclick="deleteMember('${m.id}', '${escapeHtml(m.name || m.email || '')}')" style="color:var(--accent-pink);">삭제</button></td>
        </tr>`;
    }).join('');

    document.getElementById('member-count').textContent = `총 ${members.length}명`;
}

// ========== Member Search ==========
document.getElementById('member-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
        renderMembers(allMembers);
        return;
    }
    const filtered = allMembers.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.phone || '').includes(q)
    );
    renderMembers(filtered);
});

// ========== Events ==========
let allEvents = [];

async function loadEvents() {
    try {
        allEvents = await DB.getAllEvents();
        renderEvents(allEvents);
        await loadLocationSelect();
    } catch (e) {
        document.getElementById('events-tbody').innerHTML =
            '<tr><td colspan="7" class="admin-empty">모임 목록을 불러올 수 없습니다.</td></tr>';
    }
}

let locationOptions = [];

async function loadLocationSelect() {
    try {
        locationOptions = await DB.getAllLocations();
        const sel = document.getElementById('ev-location-select');
        sel.innerHTML = '<option value="">-- 장소를 선택하세요 --</option>' +
            locationOptions.map(loc =>
                `<option value="${loc.id}">${escapeHtml(loc.name)}${loc.is_active ? '' : ' (비활성)'}</option>`
            ).join('');
    } catch (e) {
        console.error('loadLocationSelect error:', e);
    }
}

document.getElementById('ev-location-select').addEventListener('change', function() {
    const loc = locationOptions.find(l => l.id == this.value);
    document.getElementById('ev-location').value = loc ? loc.name : '';
    document.getElementById('ev-address').value = loc ? (loc.address || '') : '';
    document.getElementById('ev-map-url').value = loc ? (loc.map_url || '') : '';
});

function renderEvents(events) {
    const tbody = document.getElementById('events-tbody');
    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">등록된 모임이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = events.map(ev => {
        const date = ev.event_date || '-';
        const time = ev.event_time ? ev.event_time.slice(0, 5) : '-';
        const status = ev.is_active
            ? '<span class="admin-badge active">활성</span>'
            : '<span class="admin-badge inactive">비활성</span>';

        return `<tr>
            <td>${escapeHtml(ev.title)}</td>
            <td>${date}</td>
            <td>${time}</td>
            <td>${escapeHtml(ev.location || '-')}</td>
            <td>${status}</td>
            <td><button class="btn-secondary btn-small" onclick="viewAttendees(${ev.id}, '${escapeHtml(ev.title)}')">보기</button></td>
            <td>
                <button class="btn-secondary btn-small" onclick="editEvent(${ev.id})">수정</button>
                <button class="btn-secondary btn-small" onclick="toggleEventActive(${ev.id}, ${ev.is_active})">${ev.is_active ? '비활성화' : '활성화'}</button>
                <button class="btn-secondary btn-small" onclick="deleteEvent(${ev.id}, '${escapeHtml(ev.title)}')" style="color:var(--accent-pink);">삭제</button>
            </td>
        </tr>`;
    }).join('');
}

// ========== Event Form ==========
const eventForm = document.getElementById('event-form');
const eventFormReset = document.getElementById('event-form-reset');

eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('event-form-status');
    const btn = eventForm.querySelector('.form-submit');
    const editId = document.getElementById('edit-event-id').value;

    const eventData = {
        title: document.getElementById('ev-title').value.trim(),
        event_date: document.getElementById('ev-date').value,
        event_time: document.getElementById('ev-time').value || null,
        day_label: document.getElementById('ev-day-label').value,
        location: document.getElementById('ev-location').value.trim(),
        address: document.getElementById('ev-address').value.trim(),
        map_url: document.getElementById('ev-map-url').value.trim(),
        provision: document.getElementById('ev-provision').value.trim(),
        description: document.getElementById('ev-desc').value.trim(),
        youtube_url: document.getElementById('ev-youtube').value.trim() || null
    };

    statusEl.textContent = '저장 중...';
    statusEl.className = 'form-status loading';
    btn.disabled = true;

    try {
        if (editId) {
            await DB.updateEvent(parseInt(editId), eventData);
            statusEl.textContent = '모임이 수정되었습니다.';
        } else {
            await DB.createEvent(eventData);
            statusEl.textContent = '모임이 등록되었습니다.';
        }
        statusEl.className = 'form-status success';
        resetEventForm();
        loadEvents();
    } catch (err) {
        statusEl.textContent = '저장 중 오류가 발생했습니다.';
        statusEl.className = 'form-status error';
    } finally {
        btn.disabled = false;
    }
});

function editEvent(id) {
    const ev = allEvents.find(e => e.id === id);
    if (!ev) return;

    document.getElementById('edit-event-id').value = ev.id;
    document.getElementById('ev-title').value = ev.title;
    document.getElementById('ev-date').value = ev.event_date;
    document.getElementById('ev-time').value = ev.event_time ? ev.event_time.slice(0, 5) : '';
    document.getElementById('ev-day-label').value = ev.day_label || '';
    document.getElementById('ev-location').value = ev.location || '';
    document.getElementById('ev-address').value = ev.address || '';
    document.getElementById('ev-map-url').value = ev.map_url || '';
    // 장소 select에서 이름 매칭으로 선택
    const matchedLoc = locationOptions.find(l => l.name === ev.location);
    document.getElementById('ev-location-select').value = matchedLoc ? matchedLoc.id : '';
    document.getElementById('ev-provision').value = ev.provision || '';
    document.getElementById('ev-desc').value = ev.description || '';
    document.getElementById('ev-youtube').value = ev.youtube_url || '';
    document.getElementById('event-form-title').textContent = '모임 수정';
    eventForm.querySelector('.form-submit').textContent = '모임 수정 →';
    eventFormReset.style.display = 'inline-flex';

    // 폼으로 스크롤
    eventForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetEventForm() {
    eventForm.reset();
    document.getElementById('edit-event-id').value = '';
    document.getElementById('ev-location').value = '';
    document.getElementById('ev-address').value = '';
    document.getElementById('ev-map-url').value = '';
    document.getElementById('event-form-title').textContent = '새 모임 등록';
    eventForm.querySelector('.form-submit').textContent = '모임 등록 →';
    eventFormReset.style.display = 'none';
    document.getElementById('event-form-status').textContent = '';
}

eventFormReset.addEventListener('click', resetEventForm);

async function toggleEventActive(id, isActive) {
    try {
        await DB.updateEvent(id, { is_active: !isActive });
        loadEvents();
    } catch (e) {
        alert('상태 변경 중 오류가 발생했습니다.');
    }
}

async function deleteEvent(id, title) {
    if (!confirm(`"${title}" 모임을 정말 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`)) return;
    try {
        await DB.deleteEvent(id);
        alert('모임이 삭제되었습니다.');
        loadEvents();
    } catch (e) {
        alert('삭제 중 오류가 발생했습니다: ' + (e.message || e));
    }
}

// ========== Attendees ==========
let currentAttendEventId = null;
let currentAttendEventTitle = null;

async function viewAttendees(eventId, eventTitle) {
    currentAttendEventId = eventId;
    currentAttendEventTitle = eventTitle;
    const card = document.getElementById('attendees-card');
    const tbody = document.getElementById('attendees-tbody');
    const titleEl = document.getElementById('attendees-title');
    const countEl = document.getElementById('attendees-count');

    card.style.display = 'block';
    titleEl.textContent = `"${eventTitle}" 참여자 명단`;
    tbody.innerHTML = '<tr><td colspan="6" class="admin-loading">로딩 중...</td></tr>';
    countEl.textContent = '';

    try {
        const attendees = await DB.getEventAttendees(eventId);

        if (attendees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">참여 신청자가 없습니다.</td></tr>';
            countEl.textContent = '';
        } else {
            tbody.innerHTML = attendees.map(a => {
                const name = a.profiles ? a.profiles.name : '-';
                const phone = a.profiles ? a.profiles.phone : '-';
                const email = a.profiles ? (a.profiles.email || '-') : '-';
                const date = a.created_at ? new Date(a.created_at).toLocaleDateString('ko-KR') : '-';
                return `<tr>
                    <td>${escapeHtml(name)}</td>
                    <td>${escapeHtml(phone)}</td>
                    <td>${escapeHtml(email)}</td>
                    <td>${escapeHtml(a.note || '-')}</td>
                    <td>${date}</td>
                    <td><button class="btn-secondary btn-small" onclick="deleteAttendee('${a.user_id}', '${a.event_id}', '${escapeHtml(name)}')" style="color:var(--accent-pink);">삭제</button></td>
                </tr>`;
            }).join('');
            countEl.textContent = `총 ${attendees.length}명`;
        }
    } catch (e) {
        console.error('viewAttendees error:', e);
        tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">참여자 목록을 불러올 수 없습니다: ' + (e.message || e) + '</td></tr>';
    }

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteAttendee(userId, eventId, displayName) {
    if (!confirm(`"${displayName}" 님의 참여 신청을 삭제하시겠습니까?`)) return;
    try {
        await DB.adminDeleteAttendance(userId, eventId);
        alert('참여 신청이 삭제되었습니다.');
        await viewAttendees(currentAttendEventId, currentAttendEventTitle);
    } catch (e) {
        alert('삭제 중 오류가 발생했습니다: ' + (e.message || e));
    }
}

// ========== Locations ==========
let allLocations = [];

async function loadLocations() {
    try {
        allLocations = await DB.getAllLocations();
        renderLocations(allLocations);
    } catch (e) {
        document.getElementById('locations-tbody').innerHTML =
            '<tr><td colspan="5" class="admin-empty">장소 목록을 불러올 수 없습니다.</td></tr>';
    }
}

function renderLocations(locations) {
    const tbody = document.getElementById('locations-tbody');
    if (locations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">등록된 장소가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = locations.map(loc => {
        const typeLabel = loc.loc_type === 'primary' ? '메인' : '보조';
        const status = loc.is_active
            ? '<span class="admin-badge active">활성</span>'
            : '<span class="admin-badge inactive">비활성</span>';

        return `<tr>
            <td>${escapeHtml(loc.name)}</td>
            <td>${escapeHtml(loc.address || '-')}</td>
            <td>${escapeHtml(typeLabel)}</td>
            <td>${status}</td>
            <td>
                <button class="btn-secondary btn-small" onclick="editLocation(${loc.id})">수정</button>
                <button class="btn-secondary btn-small" onclick="toggleLocationActive(${loc.id}, ${loc.is_active})">${loc.is_active ? '비활성화' : '활성화'}</button>
                <button class="btn-secondary btn-small" onclick="deleteLocation(${loc.id})" style="color:var(--accent-pink);">삭제</button>
            </td>
        </tr>`;
    }).join('');
}

// ========== Location Form ==========
const locForm = document.getElementById('loc-form');
const locFormReset = document.getElementById('loc-form-reset');

locForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('loc-form-status');
    const btn = locForm.querySelector('.form-submit');
    const editId = document.getElementById('edit-loc-id').value;

    const locData = {
        name: document.getElementById('loc-name').value.trim(),
        loc_type: document.getElementById('loc-type').value,
        address: document.getElementById('loc-address').value.trim(),
        map_url: document.getElementById('loc-map-url').value.trim(),
        note: document.getElementById('loc-note').value.trim()
    };

    statusEl.textContent = '저장 중...';
    statusEl.className = 'form-status loading';
    btn.disabled = true;

    try {
        if (editId) {
            await DB.updateLocation(parseInt(editId), locData);
            statusEl.textContent = '장소가 수정되었습니다.';
        } else {
            await DB.createLocation(locData);
            statusEl.textContent = '장소가 등록되었습니다.';
        }
        statusEl.className = 'form-status success';
        resetLocForm();
        loadLocations();
    } catch (err) {
        statusEl.textContent = '저장 중 오류가 발생했습니다.';
        statusEl.className = 'form-status error';
    } finally {
        btn.disabled = false;
    }
});

function editLocation(id) {
    const loc = allLocations.find(l => l.id === id);
    if (!loc) return;

    document.getElementById('edit-loc-id').value = loc.id;
    document.getElementById('loc-name').value = loc.name;
    document.getElementById('loc-type').value = loc.loc_type || 'primary';
    document.getElementById('loc-address').value = loc.address || '';
    document.getElementById('loc-map-url').value = loc.map_url || '';
    document.getElementById('loc-note').value = loc.note || '';
    document.getElementById('loc-form-title').textContent = '장소 수정';
    locForm.querySelector('.form-submit').textContent = '장소 수정 →';
    locFormReset.style.display = 'inline-flex';

    locForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetLocForm() {
    locForm.reset();
    document.getElementById('edit-loc-id').value = '';
    document.getElementById('loc-form-title').textContent = '새 장소 등록';
    locForm.querySelector('.form-submit').textContent = '장소 등록 →';
    locFormReset.style.display = 'none';
    document.getElementById('loc-form-status').textContent = '';
}

locFormReset.addEventListener('click', resetLocForm);

async function toggleLocationActive(id, isActive) {
    try {
        await DB.updateLocation(id, { is_active: !isActive });
        loadLocations();
    } catch (e) {
        alert('상태 변경 중 오류가 발생했습니다.');
    }
}

async function deleteLocation(id) {
    if (!confirm('이 장소를 삭제하시겠습니까?')) return;
    try {
        await DB.deleteLocation(id);
        loadLocations();
    } catch (e) {
        alert('삭제 중 오류가 발생했습니다.');
    }
}

// ========== Delete Member ==========
async function deleteMember(userId, displayName) {
    if (!confirm(`"${displayName}" 회원을 정말 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`)) return;
    try {
        const { error } = await _supabase.rpc('delete_user', { target_user_id: userId });
        if (error) throw error;
        alert('회원이 삭제되었습니다.');
        loadMembers();
    } catch (e) {
        alert('회원 삭제 중 오류가 발생했습니다: ' + (e.message || e));
    }
}

// ========== Inquiries ==========
let allInquiries = [];

async function loadInquiries() {
    try {
        allInquiries = await DB.getAllInquiries();
        renderInquiries(allInquiries);
    } catch (e) {
        document.getElementById('inquiries-tbody').innerHTML =
            '<tr><td colspan="7" class="admin-empty">문의 목록을 불러올 수 없습니다.</td></tr>';
    }
}

function renderInquiries(inquiries) {
    const tbody = document.getElementById('inquiries-tbody');
    if (inquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">접수된 문의가 없습니다.</td></tr>';
        document.getElementById('inquiry-count').textContent = '';
        return;
    }

    tbody.innerHTML = inquiries.map(inq => {
        const date = inq.created_at ? new Date(inq.created_at).toLocaleDateString('ko-KR') : '-';
        return `<tr>
            <td>${escapeHtml(inq.name || '-')}</td>
            <td>${escapeHtml(inq.phone || '-')}</td>
            <td>${escapeHtml(inq.email || '-')}</td>
            <td>${escapeHtml(inq.subject || '-')}</td>
            <td title="${escapeHtml(inq.message || '')}">${escapeHtml((inq.message || '').substring(0, 50))}${(inq.message || '').length > 50 ? '...' : ''}</td>
            <td>${date}</td>
            <td>
                <button class="btn-secondary btn-small" onclick="viewInquiryDetail(${inq.id})">상세</button>
                <button class="btn-secondary btn-small" onclick="deleteInquiry(${inq.id})" style="color:var(--accent-pink);">삭제</button>
            </td>
        </tr>`;
    }).join('');

    document.getElementById('inquiry-count').textContent = `총 ${inquiries.length}건`;
}

function viewInquiryDetail(id) {
    const inq = allInquiries.find(i => i.id === id);
    if (!inq) return;

    document.getElementById('inq-detail-name').textContent = inq.name || '-';
    document.getElementById('inq-detail-phone').textContent = inq.phone || '-';
    document.getElementById('inq-detail-email').textContent = inq.email || '-';
    document.getElementById('inq-detail-subject').textContent = inq.subject || '-';
    document.getElementById('inq-detail-message').textContent = inq.message || '-';
    document.getElementById('inq-detail-date').textContent =
        inq.created_at ? new Date(inq.created_at).toLocaleDateString('ko-KR') : '-';

    document.getElementById('inquiry-detail-modal').classList.add('open');
}

document.getElementById('inquiry-detail-close').addEventListener('click', () => {
    document.getElementById('inquiry-detail-modal').classList.remove('open');
});

document.getElementById('inquiry-detail-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        e.currentTarget.classList.remove('open');
    }
});

async function deleteInquiry(id) {
    if (!confirm('이 문의를 삭제하시겠습니까?')) return;
    try {
        await DB.deleteInquiry(id);
        loadInquiries();
    } catch (e) {
        alert('삭제 중 오류가 발생했습니다.');
    }
}

// ========== Export Members ==========
function getMembersExportData() {
    const members = allMembers.length > 0 ? allMembers : [];
    return members.map(m => ({
        '이름': m.name || '',
        '전화번호': m.phone || '',
        '이메일': m.email || '',
        '현재 하는 일': m.current_job || '',
        '관심분야': (m.interests || []).join(', '),
        '유형': m.member_type || '',
        '가입일': m.created_at ? new Date(m.created_at).toLocaleDateString('ko-KR') : ''
    }));
}

function exportMembersExcel() {
    const data = getMembersExportData();
    if (data.length === 0) { alert('다운로드할 멤버 데이터가 없습니다.'); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    // 열 너비 설정
    ws['!cols'] = [
        { wch: 10 }, { wch: 15 }, { wch: 25 },
        { wch: 30 }, { wch: 30 }, { wch: 10 }, { wch: 12 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '멤버목록');
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `AI_Study_110_멤버목록_${today}.xlsx`);
}

function exportMembersCsv() {
    const data = getMembersExportData();
    if (data.length === 0) { alert('다운로드할 멤버 데이터가 없습니다.'); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = '\uFEFF' + XLSX.utils.sheet_to_csv(ws); // BOM for Excel Korean support
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `AI_Study_110_멤버목록_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ========== Email Bulk Send ==========
let emailMembers = [];       // 이메일 탭에서 사용할 멤버 목록
let emailEvents = [];        // 이메일 탭에서 사용할 이벤트 목록
let emailFilterMode = 'manual'; // 현재 필터 모드

async function loadEmailTab() {
    // 멤버 목록 로드 (이미 로드되었으면 재사용)
    if (allMembers.length === 0) {
        try { allMembers = await DB.getAllProfiles(); } catch (e) { /* ignore */ }
    }
    emailMembers = allMembers;

    // 이벤트 목록 로드
    if (allEvents.length === 0) {
        try { allEvents = await DB.getAllEvents(); } catch (e) { /* ignore */ }
    }
    emailEvents = allEvents;

    // 이벤트 드롭다운 채우기
    const eventSelect = document.getElementById('email-event-select');
    eventSelect.innerHTML = '<option value="">-- 모임을 선택하세요 --</option>' +
        emailEvents.map(ev => {
            const date = ev.event_date || '';
            return `<option value="${ev.id}">${escapeHtml(ev.title)} (${date})</option>`;
        }).join('');

    // 관심분야 옵션 수집 및 렌더링
    const allInterests = new Set();
    emailMembers.forEach(m => {
        (m.interests || []).forEach(i => { if (i) allInterests.add(i); });
    });
    const interestBox = document.getElementById('email-interest-options');
    if (allInterests.size > 0) {
        interestBox.innerHTML = Array.from(allInterests).sort().map(interest =>
            `<label><input type="checkbox" value="${escapeHtml(interest)}" onchange="applyEmailFilter()"> ${escapeHtml(interest)}</label>`
        ).join('');
    } else {
        interestBox.innerHTML = '<p style="color:var(--text-muted); font-size:0.82rem;">관심분야 데이터가 없습니다.</p>';
    }

    // 멤버 유형 옵션 수집 및 렌더링
    const allTypes = new Set();
    emailMembers.forEach(m => {
        if (m.member_type) allTypes.add(m.member_type);
    });
    const typeSelect = document.getElementById('email-type-select');
    typeSelect.innerHTML = '<option value="">-- 유형을 선택하세요 --</option>' +
        Array.from(allTypes).sort().map(t =>
            `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`
        ).join('');

    // 초기 멤버 리스트 렌더링
    renderEmailRecipients(emailMembers);
}

// 필터 모드 변경
document.querySelectorAll('input[name="email-filter"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        emailFilterMode = e.target.value;

        // 모든 필터 패널 숨기기
        document.getElementById('email-filter-event').style.display = 'none';
        document.getElementById('email-filter-interest').style.display = 'none';
        document.getElementById('email-filter-type').style.display = 'none';

        // 선택된 필터 패널 표시
        if (emailFilterMode === 'event') {
            document.getElementById('email-filter-event').style.display = 'block';
        } else if (emailFilterMode === 'interest') {
            document.getElementById('email-filter-interest').style.display = 'block';
        } else if (emailFilterMode === 'type') {
            document.getElementById('email-filter-type').style.display = 'block';
        }

        applyEmailFilter();
    });
});

// 이벤트 선택 변경
document.getElementById('email-event-select').addEventListener('change', async function() {
    const eventId = parseInt(this.value);
    if (!eventId) {
        renderEmailRecipients([]);
        return;
    }
    try {
        const attendees = await DB.getEventAttendees(eventId);
        const members = attendees
            .filter(a => a.profiles)
            .map(a => a.profiles);
        renderEmailRecipients(members);
    } catch (e) {
        renderEmailRecipients([]);
    }
});

// 멤버 유형 선택 변경
document.getElementById('email-type-select').addEventListener('change', function() {
    applyEmailFilter();
});

function applyEmailFilter() {
    let filtered = [];

    if (emailFilterMode === 'all' || emailFilterMode === 'manual') {
        filtered = emailMembers;
    } else if (emailFilterMode === 'interest') {
        const checkedInterests = Array.from(
            document.querySelectorAll('#email-interest-options input:checked')
        ).map(cb => cb.value);
        if (checkedInterests.length === 0) {
            filtered = emailMembers;
        } else {
            filtered = emailMembers.filter(m =>
                (m.interests || []).some(i => checkedInterests.includes(i))
            );
        }
    } else if (emailFilterMode === 'type') {
        const selectedType = document.getElementById('email-type-select').value;
        if (!selectedType) {
            filtered = emailMembers;
        } else {
            filtered = emailMembers.filter(m => m.member_type === selectedType);
        }
    }
    // event 모드는 별도 처리 (위의 email-event-select change 이벤트)

    if (emailFilterMode !== 'event') {
        renderEmailRecipients(filtered);
    }
}

function renderEmailRecipients(members) {
    const container = document.getElementById('email-recipients-tbody');
    const selectAllCb = document.getElementById('email-select-all-cb');

    if (members.length === 0) {
        container.innerHTML = '<p style="padding:1rem; color:var(--text-muted); font-size:0.85rem;">표시할 멤버가 없습니다.</p>';
        selectAllCb.checked = false;
        updateEmailRecipientCount();
        return;
    }

    container.innerHTML = members.map(m => {
        const email = m.email || '';
        const hasEmail = !!email;
        return `<div class="email-member-item">
            <input type="checkbox" class="email-member-cb" value="${escapeHtml(email)}"
                data-name="${escapeHtml(m.name || '')}"
                ${hasEmail ? '' : 'disabled'}>
            <span class="email-member-name">${escapeHtml(m.name || '-')}</span>
            ${hasEmail
                ? `<span class="email-member-email">${escapeHtml(email)}</span>`
                : `<span class="email-member-no-email">이메일 없음</span>`
            }
        </div>`;
    }).join('');

    // 체크박스 이벤트 바인딩
    container.querySelectorAll('.email-member-cb').forEach(cb => {
        cb.addEventListener('change', updateEmailRecipientCount);
    });

    // 전체 선택 상태 업데이트
    const enabledCbs = container.querySelectorAll('.email-member-cb:not(:disabled)');
    const checkedCbs = container.querySelectorAll('.email-member-cb:checked');
    selectAllCb.checked = enabledCbs.length > 0 && enabledCbs.length === checkedCbs.length;

    updateEmailRecipientCount();
}

// 전체 선택 체크박스
document.getElementById('email-select-all-cb').addEventListener('change', function() {
    const checkboxes = document.querySelectorAll('#email-recipients-tbody .email-member-cb:not(:disabled)');
    checkboxes.forEach(cb => { cb.checked = this.checked; });
    updateEmailRecipientCount();
});

function updateEmailRecipientCount() {
    const checked = document.querySelectorAll('#email-recipients-tbody .email-member-cb:checked');
    document.getElementById('email-recipient-count').textContent = `${checked.length}명 선택`;
}

function getSelectedEmails() {
    const checked = document.querySelectorAll('#email-recipients-tbody .email-member-cb:checked');
    return Array.from(checked).map(cb => cb.value).filter(v => v);
}

function previewEmail() {
    const subject = document.getElementById('email-subject').value.trim();
    const body = document.getElementById('email-body').value.trim();

    if (!subject && !body) {
        alert('제목 또는 본문을 입력해주세요.');
        return;
    }

    document.getElementById('email-preview-subject').textContent = subject || '(제목 없음)';

    // 본문: 줄바꿈을 <br>로 변환 (HTML 태그가 아닌 순수 텍스트 부분만)
    const previewBody = document.getElementById('email-preview-body');
    // HTML 태그가 포함되어 있으면 그대로 렌더링, 아니면 줄바꿈 변환
    if (/<[a-z][\s\S]*>/i.test(body)) {
        previewBody.innerHTML = body;
    } else {
        previewBody.innerHTML = escapeHtml(body).replace(/\n/g, '<br>');
    }

    document.getElementById('email-preview-card').style.display = 'block';
    document.getElementById('email-preview-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function sendBulkEmail() {
    const emails = getSelectedEmails();
    const subject = document.getElementById('email-subject').value.trim();
    const body = document.getElementById('email-body').value.trim();
    const statusEl = document.getElementById('email-form-status');
    const btn = document.getElementById('email-send-btn');

    // 유효성 검사
    if (emails.length === 0) {
        statusEl.textContent = '수신자를 선택해주세요.';
        statusEl.className = 'form-status error';
        return;
    }
    if (!subject) {
        statusEl.textContent = '제목을 입력해주세요.';
        statusEl.className = 'form-status error';
        return;
    }
    if (!body) {
        statusEl.textContent = '본문을 입력해주세요.';
        statusEl.className = 'form-status error';
        return;
    }

    // 확인 다이얼로그
    if (!confirm(`${emails.length}명에게 이메일을 발송하시겠습니까?\n\n제목: ${subject}`)) {
        return;
    }

    btn.disabled = true;
    statusEl.textContent = '발송 중...';
    statusEl.className = 'form-status loading';

    // 본문 HTML 변환
    let htmlBody;
    if (/<[a-z][\s\S]*>/i.test(body)) {
        htmlBody = body;
    } else {
        htmlBody = escapeHtml(body).replace(/\n/g, '<br>');
    }

    // HTML 이메일 템플릿 래핑
    const fullHtml = `
        <div style="max-width:600px; margin:0 auto; font-family:'Noto Sans KR', Arial, sans-serif; color:#333; line-height:1.7;">
            <div style="background:#002451; padding:1.5rem; text-align:center;">
                <span style="color:#00e5ff; font-weight:700; font-size:1.2rem;">AI</span>
                <span style="color:#fff; font-weight:600; font-size:1.1rem;"> Study </span>
                <span style="color:#00e5ff; font-weight:700; font-size:1.1rem;">110</span>
            </div>
            <div style="padding:2rem 1.5rem; background:#fff;">
                ${htmlBody}
            </div>
            <div style="padding:1rem 1.5rem; background:#f5f5f5; text-align:center; font-size:0.8rem; color:#888;">
                AI Study Circle 110 | <a href="https://study110.ai.kr" style="color:#002451;">study110.ai.kr</a>
            </div>
        </div>
    `;

    try {
        // Supabase 세션에서 인증 토큰 가져오기
        const session = await Auth.getSession();
        if (!session) throw new Error('로그인이 필요합니다');

        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + session.access_token
            },
            body: JSON.stringify({
                to: emails,
                subject: subject,
                html: fullHtml
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '발송 실패');

        // 결과 표시
        const resultCard = document.getElementById('email-result-card');
        const resultContent = document.getElementById('email-result-content');
        resultCard.style.display = 'block';

        if (data && data.success) {
            statusEl.textContent = `발송 완료! (성공: ${data.sent}건, 실패: ${data.failed}건)`;
            statusEl.className = 'form-status success';

            resultContent.innerHTML = `
                <div class="email-result-summary">
                    <div class="email-result-stat">
                        <div class="stat-num stat-success">${data.sent}</div>
                        <div class="stat-label">성공</div>
                    </div>
                    <div class="email-result-stat">
                        <div class="stat-num stat-fail">${data.failed}</div>
                        <div class="stat-label">실패</div>
                    </div>
                    <div class="email-result-stat">
                        <div class="stat-num" style="color:var(--text-primary);">${emails.length}</div>
                        <div class="stat-label">전체</div>
                    </div>
                </div>
                ${data.failed > 0 ? `
                    <div style="margin-top:0.5rem; font-size:0.82rem; color:var(--text-muted);">
                        <strong>실패 목록:</strong>
                        <ul style="margin-top:0.3rem;">
                            ${data.details.filter(d => !d.success).map(d =>
                                `<li>${escapeHtml(d.email)}: ${escapeHtml(d.data?.error || '알 수 없는 오류')}</li>`
                            ).join('')}
                        </ul>
                    </div>
                ` : ''}
            `;
        } else {
            throw new Error(data?.error || '발송 실패');
        }

        resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
        statusEl.textContent = '발송 중 오류: ' + (err.message || err);
        statusEl.className = 'form-status error';
    } finally {
        btn.disabled = false;
    }
}

// ========== Helpers ==========
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ========== Init ==========
initAdmin();
