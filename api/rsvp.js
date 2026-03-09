// Vercel Serverless Function — RSVP 처리 (이메일 링크 클릭)

const SUPABASE_URL = 'https://wkomfaiaklypmaovlsiv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_eVHLxRoHCL23JifBiyePrA_t18geEpr';

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'GET만 허용됩니다' });
    }

    const { event_id, email, response } = req.query;

    // 파라미터 검증
    if (!event_id || !email || !response) {
        return res.redirect(302, '/rsvp.html?status=error&msg=invalid_params');
    }

    const eventIdNum = parseInt(event_id, 10);
    if (isNaN(eventIdNum) || eventIdNum <= 0) {
        return res.redirect(302, '/rsvp.html?status=error&msg=invalid_event_id');
    }

    if (response !== 'attend' && response !== 'decline') {
        return res.redirect(302, '/rsvp.html?status=error&msg=invalid_response');
    }

    try {
        // 프로필에서 이름 조회 시도
        let name = null;
        try {
            const profileRes = await fetch(
                `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=name&limit=1`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                }
            );
            const profiles = await profileRes.json();
            if (profiles && profiles.length > 0) {
                name = profiles[0].name;
            }
        } catch (e) {
            // 이름 조회 실패해도 계속 진행
        }

        // 기존 RSVP 확인
        const checkRes = await fetch(
            `${SUPABASE_URL}/rest/v1/rsvps?event_id=eq.${eventIdNum}&email=eq.${encodeURIComponent(email)}&select=id`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );
        const existing = await checkRes.json();

        if (existing && existing.length > 0) {
            // UPDATE
            const updateRes = await fetch(
                `${SUPABASE_URL}/rest/v1/rsvps?id=eq.${existing[0].id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                        response: response,
                        name: name || undefined,
                        updated_at: new Date().toISOString()
                    })
                }
            );
            if (!updateRes.ok) {
                const err = await updateRes.text();
                throw new Error(err);
            }
        } else {
            // INSERT
            const insertRes = await fetch(
                `${SUPABASE_URL}/rest/v1/rsvps`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                        event_id: eventIdNum,
                        email: email,
                        name: name,
                        response: response
                    })
                }
            );
            if (!insertRes.ok) {
                const err = await insertRes.text();
                throw new Error(err);
            }
        }

        // 성공 — rsvp.html로 리다이렉트
        return res.redirect(302, `/rsvp.html?status=success&response=${response}&email=${encodeURIComponent(email)}`);

    } catch (error) {
        console.error('RSVP error:', error);
        return res.redirect(302, `/rsvp.html?status=error&msg=${encodeURIComponent(error.message || 'unknown')}`);
    }
};
