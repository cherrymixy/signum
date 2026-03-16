/**
 * 크리에이터 프로필 — 세션 간 분석 이력을 localStorage에 누적
 * 서버 사이드 코드에서는 사용하지 말 것 (window 미존재)
 */

const PROFILE_KEY = 'signum_creator_profile';
const MAX_ANALYSES = 20;

export interface AnalysisRecord {
    timestamp: number;
    alignmentScore: number;
    criticalFindings: string;
    gapDimensions: string[];
    targetPreset: string;
    contextPreset: string;
}

export interface CreatorProfile {
    analyses: AnalysisRecord[];
    totalCount: number;
}

export function loadCreatorProfile(): CreatorProfile | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = localStorage.getItem(PROFILE_KEY);
        if (!stored) return null;
        return JSON.parse(stored) as CreatorProfile;
    } catch {
        return null;
    }
}

export function saveAnalysisToProfile(record: AnalysisRecord): void {
    if (typeof window === 'undefined') return;
    try {
        const profile = loadCreatorProfile() || { analyses: [], totalCount: 0 };
        profile.analyses = [record, ...profile.analyses].slice(0, MAX_ANALYSES);
        profile.totalCount = (profile.totalCount || 0) + 1;
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
        // localStorage 실패는 무시
    }
}

/**
 * 프로필을 바탕으로 에이전트 프롬프트에 주입할 한 줄 컨텍스트 생성
 */
export function buildProfileContext(profile: CreatorProfile): string {
    if (!profile || !profile.analyses.length) return '';

    const recent = profile.analyses.slice(0, 5);
    const avgScore = Math.round(recent.reduce((s, a) => s + a.alignmentScore, 0) / recent.length);

    // 반복 발생 Gap 차원 집계
    const dimCount: Record<string, number> = {};
    recent.forEach(a => a.gapDimensions.forEach(d => {
        dimCount[d] = (dimCount[d] || 0) + 1;
    }));
    const topDims = Object.entries(dimCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([d]) => d);

    const dimNote = topDims.length ? `, 반복 Gap 패턴: ${topDims.join('/')}` : '';
    return `[이 크리에이터 이력: 총 ${profile.totalCount}회 분석, 최근 평균 일치도 ${avgScore}%${dimNote}]`;
}
