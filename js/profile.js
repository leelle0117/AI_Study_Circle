// ========== Profile Page Logic ==========
let currentUser = null;
let currentProfile = null;

// ========== Mobile menu toggle ==========
document.querySelector('.mobile-menu-btn').addEventListener('click', () => {
    document.querySelector('.nav-links').classList.toggle('show');
});

// ========== Status helper ==========
function setStatus(el, message, type) {
    el.textContent = message;
    el.className = 'form-status ' + type;
}

// ========== Phone number: strip non-digits ==========
function sanitizePhone(value) {
    return value.replace(/[^0-9]/g, '');
}

// ========== Nav User Dropdown ==========
const navUserBtn = document.getElementById('nav-user-btn');
const navDropdown = document.getElementById('nav-dropdown');

if (navUserBtn) {
    navUserBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navDropdown.classList.toggle('show');
    });
}

document.addEventListener('click', () => {
    if (navDropdown) navDropdown.classList.remove('show');
});

// Dropdown logout
document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        if (action === 'logout') {
            e.preventDefault();
            try { await Auth.signOut(); } catch (err) { /* ignore */ }
            window.location.href = 'index.html';
        }
        if (navDropdown) navDropdown.classList.remove('show');
    });
});

// ========== Init ==========
let startAttempts = 0;
function startApp() {
    startAttempts++;
    if ((typeof DB === 'undefined' || typeof Auth === 'undefined') && startAttempts <= 10) {
        setTimeout(startApp, 500);
        return;
    }
    if (typeof DB === 'undefined' || typeof Auth === 'undefined') {
        document.getElementById('profile-loading').textContent = '시스템 로드 실패. 페이지를 새로고침 해주세요.';
        return;
    }
    initProfile();
}

async function initProfile() {
    const session = await Auth.getSession();
    if (!session) {
        // 비로그인 → 메인 페이지로 이동
        window.location.href = 'index.html';
        return;
    }

    currentUser = session.user;
    try {
        currentProfile = await DB.getProfile(currentUser.id);
    } catch (e) {
        currentProfile = null;
    }

    updateNav();
    showProfile();

    // Auth state change 리스너
    Auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = 'index.html';
        }
    });
}

function updateNav() {
    const navLoginLink = document.getElementById('nav-login-link');
    const navSignupLink = document.getElementById('nav-signup-link');
    const navProfileLink = document.getElementById('nav-profile-link');
    const navUserMenu = document.getElementById('nav-user-menu');
    const navUserName = document.getElementById('nav-user-name');
    const navAdminLink = document.getElementById('nav-admin-link');

    if (currentUser) {
        navLoginLink.style.display = 'none';
        navSignupLink.style.display = 'none';
        navProfileLink.style.display = 'block';
        navUserMenu.style.display = 'block';
        navUserName.textContent = (currentProfile && currentProfile.name) || currentUser.email;
        navAdminLink.style.display = (currentProfile && currentProfile.role === 'admin') ? 'block' : 'none';
    }
}

function showProfile() {
    document.getElementById('profile-loading').style.display = 'none';
    document.getElementById('profile-content').style.display = 'block';
    fillProfileAll();
}

function fillProfileAll() {
    if (!currentProfile) return;
    // 읽기전용 정보
    document.getElementById('pv-name').textContent = currentProfile.name || '-';
    document.getElementById('pv-phone').textContent = currentProfile.phone || '-';
    document.getElementById('pv-email').textContent = (currentUser && currentUser.email) || '-';
    // 숨겨진 input (저장용)
    document.getElementById('p-name').value = currentProfile.name || '';
    document.getElementById('p-contact').value = currentProfile.phone || '';
    // 수정 가능 필드
    document.getElementById('p-current-job').value = currentProfile.current_job || '';
    document.getElementById('p-type').value = currentProfile.member_type || '';
    document.getElementById('p-message').value = currentProfile.message || '';
    // 관심분야 체크
    var checkboxes = document.querySelectorAll('#profile-interests input[type="checkbox"]');
    var interests = currentProfile.interests || [];
    checkboxes.forEach(function(cb) {
        cb.checked = interests.includes(cb.value);
    });
}

// ========== Profile Update ==========
document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('profile-status');
    const btn = e.target.querySelector('.form-submit');

    const name = document.getElementById('p-name').value.trim();
    const phone = sanitizePhone(document.getElementById('p-contact').value);
    const currentJob = document.getElementById('p-current-job').value.trim();
    const memberType = document.getElementById('p-type').value;
    const message = document.getElementById('p-message').value.trim();
    const checked = e.target.querySelectorAll('input[name="interests"]:checked');
    const interests = Array.from(checked).map(c => c.value);

    setStatus(statusEl, '저장 중...', 'loading');
    btn.disabled = true;

    try {
        currentProfile = await DB.updateProfile(currentUser.id, {
            name, phone,
            current_job: currentJob,
            interests,
            member_type: memberType,
            message
        });
        document.getElementById('nav-user-name').textContent = name;
        fillProfileAll();
        setStatus(statusEl, '프로필이 저장되었습니다.', 'success');
    } catch (err) {
        setStatus(statusEl, '저장 중 오류가 발생했습니다.', 'error');
    } finally {
        btn.disabled = false;
    }
});

// ========== Password Change ==========
document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('password-status');
    const btn = e.target.querySelector('.form-submit');

    const newPw = document.getElementById('pw-new').value;
    const confirmPw = document.getElementById('pw-confirm').value;

    if (newPw.length < 6) {
        setStatus(statusEl, '비밀번호는 6자 이상이어야 합니다.', 'error');
        return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(newPw)) {
        setStatus(statusEl, '비밀번호는 영문과 숫자만 사용할 수 있습니다.', 'error');
        return;
    }
    if (newPw !== confirmPw) {
        setStatus(statusEl, '비밀번호가 일치하지 않습니다.', 'error');
        return;
    }

    setStatus(statusEl, '변경 중...', 'loading');
    btn.disabled = true;

    try {
        var result = await _supabase.auth.updateUser({ password: newPw });
        if (result.error) throw result.error;
        setStatus(statusEl, '비밀번호가 변경되었습니다.', 'success');
        e.target.reset();
    } catch (err) {
        var msg = err.message || '비밀번호 변경 중 오류가 발생했습니다.';
        setStatus(statusEl, msg, 'error');
    } finally {
        btn.disabled = false;
    }
});

// ========== Inquiry Modal ==========
document.addEventListener('DOMContentLoaded', function() {
    var inquiryModal = document.getElementById('inquiry-modal');
    var inquiryCloseBtn = document.getElementById('inquiry-close-btn');
    var navInquiryLink = document.getElementById('nav-inquiry-link');

    if (navInquiryLink) {
        navInquiryLink.addEventListener('click', function(e) {
            e.preventDefault();
            // 문의 폼에 기본 정보 채우기
            if (currentUser && currentProfile) {
                document.getElementById('inq-name').value = currentProfile.name || '';
                document.getElementById('inq-phone').value = currentProfile.phone || '';
                document.getElementById('inq-email').value = currentUser.email || '';
            }
            inquiryModal.classList.add('open');
            document.body.style.overflow = 'hidden';
        });
    }

    if (inquiryCloseBtn) {
        inquiryCloseBtn.addEventListener('click', function() {
            inquiryModal.classList.remove('open');
            document.body.style.overflow = '';
        });
    }

    if (inquiryModal) {
        inquiryModal.addEventListener('click', function(e) {
            if (e.target === inquiryModal) {
                inquiryModal.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
    }

    // 문의하기 폼 제출
    var inquiryForm = document.getElementById('inquiry-form');
    if (inquiryForm) {
        inquiryForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var statusEl = document.getElementById('inquiry-status');
            var btn = e.target.querySelector('.form-submit');

            var name = document.getElementById('inq-name').value.trim();
            var phone = sanitizePhone(document.getElementById('inq-phone').value);
            var email = document.getElementById('inq-email').value.trim();
            var subject = document.getElementById('inq-subject').value.trim();
            var message = document.getElementById('inq-message').value.trim();

            if (!name || !subject || !message) {
                statusEl.textContent = '이름, 제목, 내용은 필수입니다.';
                statusEl.className = 'form-status error';
                return;
            }

            statusEl.textContent = '문의 접수 중...';
            statusEl.className = 'form-status loading';
            btn.disabled = true;

            try {
                await DB.createInquiry({
                    name: name, phone: phone, email: email,
                    subject: subject, message: message,
                    user_id: currentUser ? currentUser.id : null
                });
                statusEl.textContent = '문의가 접수되었습니다. 감사합니다!';
                statusEl.className = 'form-status success';
                document.getElementById('inq-subject').value = '';
                document.getElementById('inq-message').value = '';
                setTimeout(function() {
                    inquiryModal.classList.remove('open');
                    document.body.style.overflow = '';
                }, 2000);
            } catch (err) {
                statusEl.textContent = '문의 접수 중 오류가 발생했습니다.';
                statusEl.className = 'form-status error';
            } finally {
                btn.disabled = false;
            }
        });
    }
});

// ========== Start ==========
startApp();
