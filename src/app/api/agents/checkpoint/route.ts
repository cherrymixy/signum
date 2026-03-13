import { NextRequest } from 'next/server';
import { resolveCheckpoint } from '@/lib/checkpointStore';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const { checkpointId, response } = await request.json();

    if (!checkpointId) {
        return new Response(JSON.stringify({ error: 'checkpointId 필요' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const resolved = resolveCheckpoint(checkpointId, response ?? '');

    if (!resolved) {
        return new Response(JSON.stringify({ error: '체크포인트를 찾을 수 없습니다 (타임아웃 또는 잘못된 ID)' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
    });
}
