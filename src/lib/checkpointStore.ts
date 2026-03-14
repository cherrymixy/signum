/**
 * 서버 사이드 체크포인트 스토어
 *
 * Next.js dev 모드에서 webpack이 'global'을 라우트별로 샌드박스할 수 있으므로
 * Node.js 프로세스 싱글턴인 'process'를 사용.
 */

type Resolver = (response: string) => void;

// process는 webpack 샌드박스 밖의 진짜 Node.js 싱글턴
const proc = process as any;
if (!proc.__checkpointStore) {
    proc.__checkpointStore = new Map<string, Resolver>();
}
const checkpoints: Map<string, Resolver> = proc.__checkpointStore;

const TIMEOUT_MS = 3 * 60 * 1000;

export function registerCheckpoint(checkpointId: string): Promise<string> {
    console.log(`[CP] register  id=${checkpointId}  mapSize=${checkpoints.size}`);
    return new Promise<string>((resolve) => {
        const timer = setTimeout(() => {
            if (checkpoints.has(checkpointId)) {
                checkpoints.delete(checkpointId);
                console.log(`[CP] timeout   id=${checkpointId}`);
                resolve('');
            }
        }, TIMEOUT_MS);

        checkpoints.set(checkpointId, (response: string) => {
            clearTimeout(timer);
            checkpoints.delete(checkpointId);
            console.log(`[CP] resolved  id=${checkpointId}  response="${response}"`);
            resolve(response);
        });
    });
}

export function resolveCheckpoint(checkpointId: string, response: string): boolean {
    console.log(`[CP] resolve   id=${checkpointId}  found=${checkpoints.has(checkpointId)}  mapSize=${checkpoints.size}`);
    const resolver = checkpoints.get(checkpointId);
    if (!resolver) return false;
    resolver(response);
    return true;
}
