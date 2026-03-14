import { NextRequest } from 'next/server';
import { resolveCheckpoint } from '@/lib/checkpointStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
        console.error(`[Checkpoint] resolveCheckpoint 실패 — ID: ${checkpointId} (타임아웃 또는 잘못된 ID)`);
        return new Response(JSON.stringify({ error: 'timeout' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
    });
}
