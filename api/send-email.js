// Vercel Serverless Function — 이메일 일괄 발송
// 환경변수 필요: RESEND_API_KEY (Vercel 대시보드에서 설정)

const SUPABASE_URL = 'https://wkomfaiaklypmaovlsiv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_eVHLxRoHCL23JifBiyePrA_t18geEpr';

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', 'https://study110.ai.kr');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'POST만 허용됩니다' });
    }

    try {
        // 1. 관리자 인증 확인
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, error: '로그인이 필요합니다' });
        }

        // Supabase GoTrue API로 사용자 확인
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                'Authorization': authHeader,
                'apikey': SUPABASE_ANON_KEY
            }
        });

        if (!userRes.ok) {
            return res.status(401).json({ success: false, error: '인증이 만료되었습니다. 다시 로그인해주세요.' });
        }

        const user = await userRes.json();

        // 프로필에서 관리자 역할 확인
        const profileRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role`,
            {
                headers: {
                    'Authorization': authHeader,
                    'apikey': SUPABASE_ANON_KEY
                }
            }
        );

        const profiles = await profileRes.json();
        if (!profiles || profiles.length === 0 || profiles[0].role !== 'admin') {
            return res.status(403).json({ success: false, error: '관리자 권한이 필요합니다' });
        }

        // 2. 요청 데이터 파싱
        const { to, subject, html } = req.body;

        if (!to || !Array.isArray(to) || to.length === 0) {
            return res.status(400).json({ success: false, error: '수신자(to)가 필요합니다' });
        }
        if (!subject) {
            return res.status(400).json({ success: false, error: '제목(subject)이 필요합니다' });
        }
        if (!html) {
            return res.status(400).json({ success: false, error: '본문(html)이 필요합니다' });
        }

        // 3. Resend API Key 확인
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!RESEND_API_KEY) {
            return res.status(500).json({ success: false, error: 'RESEND_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.' });
        }

        // 4. 개별 이메일 발송 (BCC 대신 개별 발송으로 개인정보 보호)
        const results = [];
        for (const email of to) {
            try {
                const sendRes = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${RESEND_API_KEY}`
                    },
                    body: JSON.stringify({
                        from: 'AI Study 110 <noreply@study110.ai.kr>',
                        to: [email],
                        subject: subject,
                        html: html
                    })
                });
                const data = await sendRes.json();
                results.push({ email, success: sendRes.ok, data, statusCode: sendRes.status });
            } catch (err) {
                results.push({ email, success: false, data: { error: err.message } });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        return res.status(200).json({
            success: true,
            sent: successCount,
            failed: failCount,
            details: results
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
