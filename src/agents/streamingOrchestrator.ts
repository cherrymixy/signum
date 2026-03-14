import OpenAI from 'openai';
import { SSEEmitter, delay } from '@/lib/sseHelpers';
import { getNodePosition, getNextPosition } from '@/lib/layoutEngine';
import {
    fidget, scan, revisit,
    grabFromToolbox, connectWithCursor,
} from '@/lib/cursorBehaviors';
import { runIntentAgent } from './intentAgent';
import { runVisualScanAgent } from './visualScanAgent';
import { runDecodingAgent } from './decodingAgent';
import { runGapAnalystAgent } from './gapAnalystAgent';
import { runEncodingSuggestionAgent } from './encodingSuggestionAgent';
import { registerCheckpoint } from '@/lib/checkpointStore';
import {
    PipelineInput, CanvasNode, CanvasEdge, AgentId,
    IntentAnalysis, DecodingHypothesisSet, GapAnalysis, EncodingSuggestions,
    VisualScanResult, DecodingPerspective,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════
// 유틸리티
// ═══════════════════════════════════════════

async function streamAndThink<T>(
    emitter: SSEEmitter,
    agentId: AgentId,
    nodeId: string,
    cursorPos: { x: number; y: number },
    apiCall: (onToken: (text: string) => void) => Promise<T>,
): Promise<{ result: T; cursorPos: { x: number; y: number } }> {
    let streamDone = false;
    let lastPos = { ...cursorPos };

    const fidgetLoop = async () => {
        while (!streamDone) {
            lastPos = await fidget(emitter, agentId, lastPos, 2, 6);
            if (!streamDone) await delay(Math.round(200 + Math.random() * 300));
        }
    };

    const [result] = await Promise.all([
        apiCall((text) => {
            emitter.emit({ type: 'node:update', nodeId, data: { streamingText: text } });
        }).then((r) => { streamDone = true; return r; }),
        fidgetLoop(),
    ]);

    return { result, cursorPos: lastPos };
}

async function waitForCheckpoint(
    emitter: SSEEmitter,
    checkpointId: string,
    question: string,
    options: string[],
    context?: string,
): Promise<string> {
    emitter.emit({ type: 'checkpoint:request', checkpointId, question, options, context });
    const response = await registerCheckpoint(checkpointId);
    emitter.emit({ type: 'checkpoint:resolved', checkpointId, response });
    return response;
}

// ═══════════════════════════════════════════
// 파이프라인 상태
// ═══════════════════════════════════════════

interface PipelineState {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
    intentResult?: IntentAnalysis;
    visualScanResult?: VisualScanResult;
    decodingResults: { perspective: DecodingPerspective; result: DecodingHypothesisSet; nodeId: string }[];
    gapResult?: GapAnalysis;
    suggestionResult?: EncodingSuggestions;
    revisionProposalId?: string;
    userContext: string[];
    completedSteps: string[];
    // 노드 ID (엣지 연결용)
    imageNodeId: string;
    intentNodeId?: string;
    visualScanNodeId?: string;
    lastNodeId: string;
    lastNodePos: { x: number; y: number };
}

// ═══════════════════════════════════════════
// 보강 오케스트레이터 (enrichment 단계)
// ═══════════════════════════════════════════

type EnrichmentAction =
    | { action: 'create_insight'; reason: string; message: string; category: string; confidence: number }
    | { action: 'create_comparison'; reason: string; leftLabel: string; leftContent: string; rightLabel: string; rightContent: string; verdict: string; winner: string }
    | { action: 'create_annotation'; reason: string; comment: string; targetAgent: string }
    | { action: 'finish'; reason: string; summary: string };

const ENRICHMENT_PROMPT = `당신은 시각 커뮤니케이션 분석 결과를 보강하는 오케스트레이터입니다.
핵심 분석(intent, visualScan, decoder×3, gap, revision)이 완료된 상태에서 추가 인사이트를 제공하세요.

가용 액션:
- create_insight: 핵심 발견 (message, category: discovery/warning/opportunity/pattern, confidence: 0~100)
- create_comparison: 두 요소 비교 (leftLabel, leftContent, rightLabel, rightContent, verdict, winner: left/right/neutral)
- create_annotation: 특정 분석 코멘트 (comment, targetAgent: intent/gap/revision)
- finish: 완료 (summary: 결론 한 줄) — 보강 액션 1개 이상 후

전략: score<50%→warning insight 필수, score≥70%→discovery 1개면 충분. 최대 2~3개 후 finish.
JSON만 반환하세요. action과 reason 필드는 필수입니다.`;

async function askEnrichmentOrchestrator(
    openai: OpenAI,
    state: PipelineState,
    enrichmentStep: number,
): Promise<EnrichmentAction> {
    const boostDone = state.completedSteps.filter(s => ['insight', 'comparison', 'annotation'].includes(s)).length;
    const desc = [
        `일치도: ${state.gapResult?.overallAlignmentScore ?? 0}% | 핵심: ${state.gapResult?.criticalFindings || '없음'}`,
        `수정 제안: ${state.suggestionResult?.suggestions.length || 0}개 | 요약: ${state.suggestionResult?.summary || ''}`,
        `시각 신호 첫인상: ${state.visualScanResult?.overallImpression || ''}`,
        `보강 완료: ${boostDone}개`,
        state.userContext.length > 0 ? `사용자 지시: ${state.userContext.join(' / ')}` : '',
    ].filter(Boolean).join('\n');

    const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: ENRICHMENT_PROMPT },
            { role: 'user', content: `[보강 스텝 ${enrichmentStep + 1}]\n${desc}\n\n다음 보강 액션을 JSON으로 결정하세요.` },
        ],
        max_tokens: 500,
        response_format: { type: 'json_object' },
    });

    const content = res.choices[0]?.message?.content;
    if (!content) throw new Error('Enrichment Orchestrator: 빈 응답');
    return JSON.parse(content) as EnrichmentAction;
}

// ═══════════════════════════════════════════
// 메인 파이프라인
// ═══════════════════════════════════════════

export async function runStreamingPipeline(input: PipelineInput, emitter: SSEEmitter) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        emitter.emit({ type: 'error', message: 'OPENAI_API_KEY가 설정되지 않았습니다.' });
        emitter.close();
        return;
    }

    const openai = new OpenAI({ apiKey });

    // 이미지 입력 노드
    const imageNodeId = uuidv4();
    const imagePos = getNodePosition('imageInput');
    const imageNode: CanvasNode = {
        id: imageNodeId, type: 'imageInput', position: imagePos,
        data: {
            title: '이미지 입력',
            content: { intentText: input.intentText, targetPreset: input.targetPreset, contextPreset: input.contextPreset, hasImage: true },
            createdAt: Date.now(), status: 'active',
        },
    };
    emitter.emit({ type: 'node:create', node: imageNode });
    await delay(400);

    const state: PipelineState = {
        nodes: [imageNode], edges: [],
        decodingResults: [], userContext: [], completedSteps: [],
        imageNodeId, lastNodeId: imageNodeId, lastNodePos: imagePos,
    };

    let cursor = { x: imagePos.x + 120, y: imagePos.y + 50 };

    try {
        // ═══════════════════════════════════════════
        // PHASE 1: Intent + Visual Scan (병렬)
        // ═══════════════════════════════════════════
        emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'thinking', message: '의도 분석 + 시각 신호 스캔을 동시에 시작합니다...' });
        await delay(200);

        const [intentCursor] = await Promise.all([
            executeIntentAgent(emitter, openai, input, state, { x: cursor.x, y: cursor.y }),
            executeVisualScanAgent(emitter, openai, input, state, { x: cursor.x + 40, y: cursor.y + 30 }),
        ]);
        cursor = intentCursor;
        emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'idle' });

        // ═══════════════════════════════════════════
        // PHASE 2: 3 Decoders (병렬)
        // ═══════════════════════════════════════════
        cursor = await executeParallelDecoders(emitter, openai, input, state, cursor);

        // 체크포인트 1: 해석 방향
        if (state.decodingResults.length > 0) {
            const cpOptions = [
                ...state.decodingResults.map(dr => {
                    const label = dr.perspective === 'target' ? '타겟' : dr.perspective === 'critical' ? '비판적' : '직관적';
                    return `${label} 관점 중심 — "${dr.result.dominantInterpretation.slice(0, 45)}..."`;
                }),
                '전체 관점 균형있게 분석',
            ];
            const cp1 = uuidv4();
            emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'thinking', message: '사용자 확인을 기다립니다...' });
            const r1 = await waitForCheckpoint(emitter, cp1, '3가지 관점 해석 완료. Gap 분석 방향을 선택해주세요.', cpOptions, state.decodingResults[0]?.result.dominantInterpretation);
            if (r1 && r1 !== '전체 관점 균형있게 분석') state.userContext.push(`[Gap 분석 방향] ${r1}`);
            emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'idle' });
        }

        // ═══════════════════════════════════════════
        // PHASE 3: Gap Analysis
        // ═══════════════════════════════════════════
        cursor = await executeGapAgent(emitter, openai, state, cursor);

        // 체크포인트 2: 수정 방향
        if (state.gapResult) {
            const score = state.gapResult.overallAlignmentScore;
            const highGaps = state.gapResult.gaps.filter(g => g.severity === 'high').length;
            const cp2Options = score < 50
                ? [`HIGH Gap ${highGaps}개 집중 수정`, '감정 반응 개선 우선', '모든 Gap 균형 수정', '현재 방향대로 진행']
                : ['핵심 Gap + 보완', '빠른 개선 포인트 중심', '현재 방향대로 진행'];
            const cp2 = uuidv4();
            emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'thinking', message: '사용자 확인을 기다립니다...' });
            const r2 = await waitForCheckpoint(emitter, cp2, `Gap 분석 완료 — 일치도 ${score}%. 수정 제안 방향을 선택해주세요.`, cp2Options, state.gapResult.criticalFindings);
            if (r2 && r2 !== '현재 방향대로 진행') state.userContext.push(`[수정 우선순위] ${r2}`);
            emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'idle' });
        }

        // ═══════════════════════════════════════════
        // PHASE 4: Revision
        // ═══════════════════════════════════════════
        cursor = await executeRevisionAgent(emitter, openai, input, state, cursor);

        // ═══════════════════════════════════════════
        // PHASE 5: LLM 보강 루프 (최대 4스텝)
        // ═══════════════════════════════════════════
        emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'thinking', message: '분석 결과를 보강합니다...' });
        for (let step = 0; step < 4; step++) {
            const decision = await askEnrichmentOrchestrator(openai, state, step);
            emitter.emit({ type: 'orchestrator:thinking', reasoning: decision.reason, nextAction: decision.action });
            if (decision.action === 'finish') break;
            switch (decision.action) {
                case 'create_insight': cursor = await createInsightNode(emitter, state, cursor, decision); break;
                case 'create_comparison': cursor = await createComparisonNode(emitter, state, cursor, decision); break;
                case 'create_annotation': cursor = await createAnnotationNode(emitter, state, cursor, decision); break;
            }
        }
        emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'idle' });

        // ═══════════════════════════════════════════
        // PHASE 6: Summary + 승인 요청
        // ═══════════════════════════════════════════
        await createSummaryNode(emitter, state, cursor, {
            headline: '인코딩-디코딩 분석 완료',
            keyPoints: [
                state.intentResult ? `의도: ${state.intentResult.coreMessage}` : '',
                state.visualScanResult ? `시각 신호: ${state.visualScanResult.overallImpression}` : '',
                state.gapResult ? `일치도: ${state.gapResult.overallAlignmentScore}%` : '',
                state.suggestionResult ? `${state.suggestionResult.suggestions.length}개 수정 제안` : '',
            ].filter(Boolean),
            overallScore: state.gapResult?.overallAlignmentScore,
            recommendation: state.suggestionResult?.summary || '분석 결과를 검토하세요.',
        });

        if (state.suggestionResult && state.revisionProposalId) {
            emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'waitingApproval', message: '사용자 승인을 기다립니다...' });
            emitter.emit({ type: 'approval:request', proposalId: state.revisionProposalId, suggestions: state.suggestionResult.suggestions });
        }

        emitter.emit({ type: 'pipeline:done', summary: `${state.nodes.length}개 노드 | ${state.completedSteps.join(' → ')}` });

    } catch (error: any) {
        emitter.emit({ type: 'error', message: error.message || '파이프라인 실행 중 오류' });
    } finally {
        emitter.close();
    }
}

// ═══════════════════════════════════════════
// 에이전트 실행 함수들
// ═══════════════════════════════════════════

async function executeIntentAgent(
    emitter: SSEEmitter, openai: OpenAI, input: PipelineInput,
    state: PipelineState, cursor: { x: number; y: number },
): Promise<{ x: number; y: number }> {
    const pos = getNextPosition(state.nodes, 'intentAnalysis');
    const nodeId = uuidv4();
    // 병렬 실행 시 위치 선점 — 첫 번째 await 전에 삽입해야 visualScan이 올바른 위치를 계산함
    state.nodes.push({ id: nodeId, type: 'intentAnalysis', position: pos, data: { status: 'streaming' } as any });

    emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'thinking', message: '창작자 의도를 구조화합니다...' });
    cursor = await grabFromToolbox(emitter, 'intent', 'intentAnalysis', cursor, { x: pos.x + 20, y: pos.y + 15 });

    const node: CanvasNode = {
        id: nodeId, type: 'intentAnalysis', position: pos,
        data: { agentId: 'intent', title: '의도 분析', content: null, streamingText: '', createdAt: Date.now(), status: 'streaming' },
    };
    emitter.emit({ type: 'node:create', node });
    const intentIdx = state.nodes.findIndex(n => n.id === nodeId);
    if (intentIdx !== -1) state.nodes[intentIdx] = node; else state.nodes.push(node);
    await delay(100);
    emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.imageNodeId, target: nodeId, animated: true } });

    const out = await streamAndThink(emitter, 'intent', nodeId, { x: pos.x + 60, y: pos.y + 60 },
        (onToken) => runIntentAgent(openai, { imageBase64: input.imageBase64, imageMimeType: input.imageMimeType, intentText: input.intentText }, onToken),
    );
    cursor = out.cursorPos;
    state.intentResult = out.result;

    emitter.emit({ type: 'node:update', nodeId, data: { content: out.result, streamingText: undefined, status: 'active' } });
    cursor = await revisit(emitter, 'intent', cursor, state.lastNodePos, pos);
    emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'idle' });

    state.intentNodeId = nodeId;
    state.lastNodeId = nodeId;
    state.lastNodePos = pos;
    state.completedSteps.push('intent');
    return cursor;
}

async function executeVisualScanAgent(
    emitter: SSEEmitter, openai: OpenAI, input: PipelineInput,
    state: PipelineState, cursor: { x: number; y: number },
): Promise<{ x: number; y: number }> {
    const pos = getNextPosition(state.nodes, 'visualScan');
    const nodeId = uuidv4();
    // 병렬 실행 시 위치 선점
    state.nodes.push({ id: nodeId, type: 'visualScan', position: pos, data: { status: 'streaming' } as any });

    emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'thinking', message: '시각 신호를 스캔합니다...' });
    cursor = await grabFromToolbox(emitter, 'orchestrator', 'visualScan', cursor, { x: pos.x + 20, y: pos.y + 15 });

    const node: CanvasNode = {
        id: nodeId, type: 'visualScan', position: pos,
        data: { agentId: 'orchestrator', title: '시각 신호 스캔', content: null, streamingText: '', createdAt: Date.now(), status: 'streaming' },
    };
    emitter.emit({ type: 'node:create', node });
    const vsIdx = state.nodes.findIndex(n => n.id === nodeId);
    if (vsIdx !== -1) state.nodes[vsIdx] = node; else state.nodes.push(node);
    await delay(100);
    emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.imageNodeId, target: nodeId, animated: true } });

    const intentFallback: IntentAnalysis = state.intentResult || { coreMessage: input.intentText, emotionalTone: '', callToAction: '', implicitAssumptions: [], summary: '' };
    const out = await streamAndThink(emitter, 'orchestrator', nodeId, { x: pos.x + 60, y: pos.y + 60 },
        (onToken) => runVisualScanAgent(openai, { imageBase64: input.imageBase64, imageMimeType: input.imageMimeType, intentAnalysis: intentFallback }, onToken),
    );
    cursor = out.cursorPos;
    state.visualScanResult = out.result;

    emitter.emit({ type: 'node:update', nodeId, data: { content: out.result, streamingText: undefined, status: 'active' } });
    emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'idle' });

    state.visualScanNodeId = nodeId;
    state.completedSteps.push('visualScan');
    return cursor;
}

async function executeParallelDecoders(
    emitter: SSEEmitter, openai: OpenAI, input: PipelineInput,
    state: PipelineState, cursor: { x: number; y: number },
): Promise<{ x: number; y: number }> {
    if (!state.intentResult) return cursor;

    const perspectives: Array<{ id: DecodingPerspective; title: string }> = [
        { id: 'target', title: `${input.targetPreset} 관점` },
        { id: 'critical', title: '비판적 독해' },
        { id: 'intuitive', title: '직관적 반응' },
    ];

    emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'thinking', message: '3가지 관점에서 동시 해석 시작...' });

    // 1. 노드 순서대로 생성 (collision detection을 위해 순차적으로)
    const nodeInfos: Array<{ nodeId: string; pos: { x: number; y: number } }> = [];
    for (const persp of perspectives) {
        const pos = getNextPosition(state.nodes, 'decodingHypothesis');
        const nodeId = uuidv4();

        cursor = await grabFromToolbox(emitter, 'decoder', 'decodingHypothesis', cursor, { x: pos.x + 20, y: pos.y + 15 });

        const node: CanvasNode = {
            id: nodeId, type: 'decodingHypothesis', position: pos,
            data: { agentId: 'decoder', title: persp.title, content: null, streamingText: '', createdAt: Date.now(), status: 'streaming' },
        };
        emitter.emit({ type: 'node:create', node });
        state.nodes.push(node);
        await delay(60);

        if (state.intentNodeId) emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.intentNodeId, target: nodeId, animated: true } });
        if (state.visualScanNodeId) emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.visualScanNodeId, target: nodeId, animated: true } });

        nodeInfos.push({ nodeId, pos });
    }

    // 2. 3개 API 동시 실행
    emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'thinking', message: '3개 관점 병렬 분석 중...' });

    // 결과를 인덱스 순서로 저장해 perspectives 순서를 항상 보장
    const decodingResultSlots: ({ perspective: DecodingPerspective; result: DecodingHypothesisSet; nodeId: string } | null)[]
        = new Array(perspectives.length).fill(null);

    await Promise.all(perspectives.map(async (persp, i) => {
        const { nodeId } = nodeInfos[i];
        try {
            const result = await runDecodingAgent(openai, {
                imageBase64: input.imageBase64, imageMimeType: input.imageMimeType,
                intentAnalysis: state.intentResult!,
                visualScan: state.visualScanResult,
                targetPreset: input.targetPreset, contextPreset: input.contextPreset,
                perspective: persp.id,
            }, (text) => emitter.emit({ type: 'node:update', nodeId, data: { streamingText: text } }));

            const dominant = result.hypotheses.sort((a, b) => b.probability - a.probability)[0];
            decodingResultSlots[i] = { perspective: persp.id, result, nodeId };

            emitter.emit({ type: 'node:update', nodeId, data: { title: persp.title, content: dominant, streamingText: undefined, status: 'active' } });
        } catch (e: any) {
            emitter.emit({ type: 'node:update', nodeId, data: { status: 'active', content: { interpretation: '분석 오류', probability: 0, reasoning: e.message, emotionalResponse: '오류' } } });
        }
    }));

    // null 슬롯 제거 후 순서 보장된 배열로 추가
    state.decodingResults = decodingResultSlots.filter((r): r is NonNullable<typeof r> => r !== null);

    emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'idle' });

    const last = nodeInfos[nodeInfos.length - 1];
    state.lastNodeId = last.nodeId;
    state.lastNodePos = last.pos;
    state.completedSteps.push('decoder');
    return cursor;
}

async function executeGapAgent(
    emitter: SSEEmitter, openai: OpenAI,
    state: PipelineState, cursor: { x: number; y: number },
): Promise<{ x: number; y: number }> {
    if (!state.intentResult || state.decodingResults.length === 0) return cursor;

    const pos = getNextPosition(state.nodes, 'gapAnalysis');
    const nodeId = uuidv4();

    emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'thinking', message: '의도-해석 Gap을 분석합니다...' });
    cursor = await scan(emitter, 'gap', cursor, state.nodes.slice(-4).map(n => n.position));
    cursor = await grabFromToolbox(emitter, 'gap', 'gapAnalysis', cursor, { x: pos.x + 20, y: pos.y + 15 });

    const node: CanvasNode = {
        id: nodeId, type: 'gapAnalysis', position: pos,
        data: { agentId: 'gap', title: 'Gap 분석', content: null, streamingText: '', createdAt: Date.now(), status: 'streaming' },
    };
    emitter.emit({ type: 'node:create', node });
    state.nodes.push(node);
    await delay(100);

    // 모든 decoder + intent → gap 연결
    for (const dr of state.decodingResults) {
        emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: dr.nodeId, target: nodeId, animated: true } });
    }
    if (state.intentNodeId) emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.intentNodeId, target: nodeId, animated: true } });

    const out = await streamAndThink(emitter, 'gap', nodeId, { x: pos.x + 60, y: pos.y + 80 },
        (onToken) => runGapAnalystAgent(openai, {
            intentAnalysis: state.intentResult!,
            visualScan: state.visualScanResult,
            decodingResults: state.decodingResults.map(dr => dr.result),
            userContext: state.userContext.join('\n') || undefined,
        }, onToken),
    );
    cursor = out.cursorPos;
    state.gapResult = out.result;

    emitter.emit({ type: 'node:update', nodeId, data: { title: `Gap 분석 (일치도 ${out.result.overallAlignmentScore}%)`, content: out.result, streamingText: undefined, status: 'active' } });
    emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'idle' });

    state.lastNodeId = nodeId;
    state.lastNodePos = pos;
    state.completedSteps.push('gap');
    return cursor;
}

async function executeRevisionAgent(
    emitter: SSEEmitter, openai: OpenAI, input: PipelineInput,
    state: PipelineState, cursor: { x: number; y: number },
): Promise<{ x: number; y: number }> {
    if (!state.intentResult || !state.gapResult) return cursor;

    const pos = getNextPosition(state.nodes, 'revisionProposal');
    const nodeId = uuidv4();
    const proposalId = uuidv4();
    state.revisionProposalId = proposalId;

    emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'thinking', message: '시각적 수정 방향을 제안합니다...' });
    cursor = await grabFromToolbox(emitter, 'revision', 'revisionProposal', cursor, { x: pos.x + 20, y: pos.y + 15 });

    const node: CanvasNode = {
        id: nodeId, type: 'revisionProposal', position: pos,
        data: { agentId: 'revision', title: '수정 제안', content: null, streamingText: '', createdAt: Date.now(), status: 'streaming' },
    };
    emitter.emit({ type: 'node:create', node });
    state.nodes.push(node);
    await delay(100);
    emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.lastNodeId, target: nodeId, animated: true } });

    const out = await streamAndThink(emitter, 'revision', nodeId, { x: pos.x + 60, y: pos.y + 80 },
        (onToken) => runEncodingSuggestionAgent(openai, {
            intentAnalysis: state.intentResult!, gapAnalysis: state.gapResult!,
            visualScan: state.visualScanResult,
            userContext: state.userContext.join('\n') || undefined,
        }, onToken),
    );
    cursor = out.cursorPos;
    state.suggestionResult = out.result;

    emitter.emit({ type: 'node:update', nodeId, data: { content: { ...out.result, proposalId }, streamingText: undefined, status: 'creating' } });
    cursor = await scan(emitter, 'revision', cursor, state.nodes.slice(-3).map(n => n.position));

    emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'idle' });
    state.lastNodeId = nodeId;
    state.lastNodePos = pos;
    state.completedSteps.push('revision');
    return cursor;
}

// ═══════════════════════════════════════════
// 보강 노드 생성
// ═══════════════════════════════════════════

async function createInsightNode(emitter: SSEEmitter, state: PipelineState, cursor: { x: number; y: number }, d: any): Promise<{ x: number; y: number }> {
    const pos = getNextPosition(state.nodes, 'insight');
    cursor = await grabFromToolbox(emitter, 'orchestrator' as AgentId, 'insight', cursor, { x: pos.x + 20, y: pos.y + 15 });
    const nodeId = uuidv4();
    emitter.emit({ type: 'node:create', node: { id: nodeId, type: 'insight', position: pos, data: { agentId: 'orchestrator', title: '인사이트', content: { message: d.message || '', category: d.category || 'discovery', confidence: d.confidence ?? 70 }, createdAt: Date.now(), status: 'active' } } });
    state.nodes.push({ id: nodeId, type: 'insight', position: pos, data: { agentId: 'orchestrator', title: '인사이트', content: { message: d.message || '', category: d.category || 'discovery', confidence: d.confidence ?? 70 }, createdAt: Date.now(), status: 'active' } });
    await delay(120);
    emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.lastNodeId, target: nodeId, animated: true } });
    state.lastNodeId = nodeId; state.lastNodePos = pos;
    state.completedSteps.push('insight');
    return cursor;
}

async function createComparisonNode(emitter: SSEEmitter, state: PipelineState, cursor: { x: number; y: number }, d: any): Promise<{ x: number; y: number }> {
    const pos = getNextPosition(state.nodes, 'comparison');
    cursor = await grabFromToolbox(emitter, 'orchestrator' as AgentId, 'comparison', cursor, { x: pos.x + 20, y: pos.y + 15 });
    const nodeId = uuidv4();
    const nodeData = { agentId: 'orchestrator' as AgentId, title: '비교 분석', content: { leftLabel: d.leftLabel || '', leftContent: d.leftContent || '', rightLabel: d.rightLabel || '', rightContent: d.rightContent || '', verdict: d.verdict || '', winner: d.winner || 'neutral' }, createdAt: Date.now(), status: 'active' as const };
    emitter.emit({ type: 'node:create', node: { id: nodeId, type: 'comparison', position: pos, data: nodeData } });
    state.nodes.push({ id: nodeId, type: 'comparison', position: pos, data: nodeData });
    await delay(120);
    emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.lastNodeId, target: nodeId, animated: true } });
    state.lastNodeId = nodeId; state.lastNodePos = pos;
    state.completedSteps.push('comparison');
    return cursor;
}

async function createAnnotationNode(emitter: SSEEmitter, state: PipelineState, cursor: { x: number; y: number }, d: any): Promise<{ x: number; y: number }> {
    const pos = getNextPosition(state.nodes, 'annotation');
    cursor = await grabFromToolbox(emitter, 'orchestrator' as AgentId, 'annotation', cursor, { x: pos.x + 20, y: pos.y + 15 });
    const nodeId = uuidv4();
    const annotator = (d.targetAgent || 'orchestrator') as AgentId;
    const nodeData = { agentId: annotator, title: '코멘트', content: { comment: d.comment || '', targetNodeId: state.lastNodeId, annotatorAgent: annotator }, createdAt: Date.now(), status: 'active' as const };
    emitter.emit({ type: 'node:create', node: { id: nodeId, type: 'annotation', position: pos, data: nodeData } });
    state.nodes.push({ id: nodeId, type: 'annotation', position: pos, data: nodeData });
    await delay(120);
    emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.lastNodeId, target: nodeId, animated: false } });
    state.completedSteps.push('annotation');
    return cursor;
}

async function createSummaryNode(emitter: SSEEmitter, state: PipelineState, cursor: { x: number; y: number }, d: any): Promise<{ x: number; y: number }> {
    const pos = getNextPosition(state.nodes, 'summary');
    cursor = await grabFromToolbox(emitter, 'orchestrator' as AgentId, 'summary', cursor, { x: pos.x + 20, y: pos.y + 15 });
    const nodeId = uuidv4();
    const nodeData = { agentId: 'orchestrator' as AgentId, title: '분석 요약', content: { headline: d.headline || '', keyPoints: Array.isArray(d.keyPoints) ? d.keyPoints : [], overallScore: d.overallScore, recommendation: d.recommendation || '' }, createdAt: Date.now(), status: 'active' as const };
    emitter.emit({ type: 'node:create', node: { id: nodeId, type: 'summary', position: pos, data: nodeData } });
    state.nodes.push({ id: nodeId, type: 'summary', position: pos, data: nodeData });
    await delay(120);
    emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.lastNodeId, target: nodeId, animated: true } });
    state.lastNodeId = nodeId; state.lastNodePos = pos;
    state.completedSteps.push('summary');
    return cursor;
}
