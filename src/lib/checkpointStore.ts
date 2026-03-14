/**
 * 서버 사이드 체크포인트 스토어
 * 파이프라인 실행 중 사용자 개입을 위한 Promise resolver 저장소
 *
 * Note: 단일 Node.js 프로세스 환경용 (개발/단일 서버).
 *       프로덕션 멀티 인스턴스 환경에서는 Redis pub/sub으로 교체 필요.
 */

type Resolver = (response: string) => void;

// Next.js dev 모드에서 모듈이 라우트별로 분리되므로 global에 저장
declare global {
    // eslint-disable-next-line no-var
    var __checkpointStore: Map<string, Resolver> | undefined;
}
if (!global.__checkpointStore) {
    global.__checkpointStore = new Map<string, Resolver>();
}
const checkpoints = global.__checkpointStore;

const TIMEOUT_MS = 3 * 60 * 1000; // 3분 대기 후 자동 스킵

/**
 * 체크포인트를 등록하고 사용자 응답을 기다리는 Promise 반환.
 * 타임아웃 시 빈 문자열('')로 resolve → 파이프라인 자동 재개.
 */
export function registerCheckpoint(checkpointId: string): Promise<string> {
    return new Promise<string>((resolve) => {
        checkpoints.set(checkpointId, resolve);

        const timer = setTimeout(() => {
            if (checkpoints.has(checkpointId)) {
                checkpoints.delete(checkpointId);
                resolve(''); // timeout → skip
            }
        }, TIMEOUT_MS);

        // GC 방지: resolve 시 타이머 정리
        const original = resolve;
        checkpoints.set(checkpointId, (response: string) => {
            clearTimeout(timer);
            checkpoints.delete(checkpointId);
            original(response);
        });
    });
}

/**
 * 사용자 응답으로 체크포인트 해결.
 * @returns true: 성공, false: 체크포인트 없음 (이미 타임아웃 또는 없는 ID)
 */
export function resolveCheckpoint(checkpointId: string, response: string): boolean {
    const resolver = checkpoints.get(checkpointId);
    if (!resolver) return false;
    resolver(response);
    return true;
}
