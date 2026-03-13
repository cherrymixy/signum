import OpenAI from 'openai';
import { SSEEmitter, delay } from '@/lib/sseHelpers';
import { getNodePosition, getNextPosition } from '@/lib/layoutEngine';
import {
    fidget, scan, revisit,
    grabFromToolbox, connectWithCursor,
} from '@/lib/cursorBehaviors';
import { runIntentAgent } from './intentAgent';
import { runDecodingAgent } from './decodingAgent';
import { runGapAnalystAgent } from './gapAnalystAgent';
import { runEncodingSuggestionAgent } from './encodingSuggestionAgent';
import { registerCheckpoint } from '@/lib/checkpointStore';
import {
    PipelineInput, CanvasNode, CanvasEdge, AgentId,
    IntentAnalysis, DecodingHypothesisSet, GapAnalysis, EncodingSuggestions,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════
// 유틸리티
// ═══════════════════════════════════════════

/**
 * 노드 위에서 스트리밍 API를 실행하는 패턴
 * - 스트리밍 토큰을 node:update로 실시간 전송
 * - API 완료까지 커서가 노드 위에서 미세하게 움직임
 */
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

/**
 * 사용자 입력을 기다리는 체크포인트
 * SSE로 질문을 전송하고, 서버에서 사용자 응답을 받을 때까지 대기
 */
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
// 오케스트레이터 상태
// ═══════════════════════════════════════════

interface PipelineState {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
    intentResult?: IntentAnalysis;
    decodingResult?: DecodingHypothesisSet;
    gapResult?: GapAnalysis;
    suggestionResult?: EncodingSuggestions;
    revisionProposalId?: string; // revision 노드 content의 proposalId와 동기화
    userContext: string[]; // 체크포인트에서 수집한 사용자 지시
    completedSteps: string[];
    lastNodeId: string;
    lastNodePos: { x: number; y: number };
}

// ═══════════════════════════════════════════
// 오케스트레이터 LLM 의사결정
// ═══════════════════════════════════════════

type OrchestratorAction =
    | { action: 'run_intent'; reason: string }
    | { action: 'run_decoder'; reason: string }
    | { action: 'run_gap'; reason: string }
    | { action: 'run_revision'; reason: string }
    | { action: 'create_insight'; reason: string; message: string; category: string; confidence: number }
    | { action: 'create_comparison'; reason: string; leftLabel: string; leftContent: string; rightLabel: string; rightContent: string; verdict: string; winner: string }
    | { action: 'create_annotation'; reason: string; comment: string; targetAgent: string }
    | { action: 'finish'; reason: string; summary: string };

const ORCHESTRATOR_SYSTEM_PROMPT = `당신은 시각 커뮤니케이션 분석 오케스트레이터입니다.
이미지 인코딩-디코딩 분석 파이프라인을 매 스텝마다 자율적으로 결정합니다.

=== 가용 액션 ===

[핵심 분석 에이전트]
- run_intent   : 창작자 의도 구조화 (coreMessage, emotionalTone, callToAction, implicitAssumptions)
                 조건: 아직 실행되지 않았을 때만
- run_decoder  : 타겟 페르소나 관점 해석 가설 3~5개 생성 (interpretation, probability, reasoning, emotionalResponse)
                 조건: intent 완료 후
- run_gap      : 의도-해석 불일치 분석 (gaps 목록, overallAlignmentScore 0~100, criticalFindings)
                 조건: intent + decoder 완료 후
- run_revision : 시각적 수정 제안 생성 (suggestions 목록, summary)
                 조건: intent + gap 완료 후

[보강 액션 — revision 완료 후 사용]
- create_insight    : 핵심 발견 인사이트 노드 (message: 한 문장, category: discovery/warning/opportunity/pattern, confidence: 0~100)
- create_comparison : 두 요소 비교 노드 (leftLabel, leftContent, rightLabel, rightContent, verdict, winner: left/right/neutral)
- create_annotation : 특정 분석에 코멘트 (comment, targetAgent: intent/decoder/gap/revision)
- finish            : 분석 완료 선언 (summary: 전체 결론 한 문장)
                 조건: revision 완료 + 보강 액션 최소 1개 이상 실행 후

=== 전략 가이드 ===
1. run_intent → run_decoder → run_gap → run_revision 순서를 반드시 따르세요.
2. revision 완료 후 분석 상태에 따라 보강 액션을 1~3개 추가하세요.
3. overallAlignmentScore < 50%: warning insight + comparison 추가를 강권합니다.
4. overallAlignmentScore >= 70%: discovery insight 1개로 충분할 수 있습니다.
5. 이미 completedSteps에 있는 핵심 에이전트는 다시 실행하지 마세요.
6. 매 턴 정확히 하나의 액션을 결정하세요.

JSON만 반환하세요. action과 reason 필드는 필수입니다.`;

async function askOrchestrator(
    openai: OpenAI,
    state: PipelineState,
    input: PipelineInput,
    step: number,
): Promise<OrchestratorAction> {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: ORCHESTRATOR_SYSTEM_PROMPT },
            {
                role: 'user',
                content: `[스텝 ${step + 1}] 현재 분석 상태를 보고 다음 액션을 결정하세요.\n\n${buildStateDescription(state, input)}\n\naction과 reason 필드를 포함한 JSON으로 응답하세요.`,
            },
        ],
        max_tokens: 600,
        response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Orchestrator: 빈 응답');

    return JSON.parse(content) as OrchestratorAction;
}

function buildStateDescription(state: PipelineState, input: PipelineInput): string {
    const parts: string[] = [];

    parts.push(`=== 분석 조건 ===`);
    parts.push(`창작자 의도: "${input.intentText}"`);
    parts.push(`타겟: ${input.targetPreset} | 컨텍스트: ${input.contextPreset}`);

    parts.push(`\n=== 완료된 에이전트 ===`);
    parts.push(state.completedSteps.length > 0
        ? state.completedSteps.join(' → ')
        : '없음 — run_intent부터 시작하세요');

    if (state.intentResult) {
        parts.push(`\n[Intent 완료]`);
        parts.push(`핵심 메시지: ${state.intentResult.coreMessage}`);
        parts.push(`감성 톤: ${state.intentResult.emotionalTone}`);
        parts.push(`행동 유도: ${state.intentResult.callToAction}`);
        if (state.intentResult.implicitAssumptions?.length) {
            parts.push(`암묵적 가정: ${state.intentResult.implicitAssumptions.join(', ')}`);
        }
    }

    if (state.decodingResult) {
        parts.push(`\n[Decoder 완료] 가설 ${state.decodingResult.hypotheses.length}개`);
        parts.push(`우세 해석: ${state.decodingResult.dominantInterpretation}`);
        state.decodingResult.hypotheses.forEach((h, i) => {
            parts.push(`  ${i + 1}. (${(h.probability * 100).toFixed(0)}%) ${h.interpretation} — 감정: ${h.emotionalResponse}`);
        });
    }

    if (state.gapResult) {
        parts.push(`\n[Gap 완료] 일치도: ${state.gapResult.overallAlignmentScore}%`);
        parts.push(`핵심 발견: ${state.gapResult.criticalFindings}`);
        state.gapResult.gaps.forEach((g, i) => {
            parts.push(`  Gap${i + 1} [${g.severity}] ${g.dimension}: 의도="${g.intended}" vs 해석="${g.decoded}" (원인: ${g.cause})`);
        });
    }

    if (state.suggestionResult) {
        parts.push(`\n[Revision 완료] 제안 ${state.suggestionResult.suggestions.length}개`);
        parts.push(`요약: ${state.suggestionResult.summary}`);
        state.suggestionResult.suggestions.forEach((s, i) => {
            parts.push(`  ${i + 1}. [${s.priority}] ${s.area}: ${s.suggestion}`);
        });
    }

    const boostCount = state.completedSteps.filter(s =>
        ['insight', 'comparison', 'annotation'].includes(s)
    ).length;
    if (boostCount > 0) {
        parts.push(`\n보강 액션 실행 수: ${boostCount}개`);
    }

    if (state.userContext.length > 0) {
        parts.push(`\n=== 사용자 지시 ===`);
        state.userContext.forEach(ctx => parts.push(ctx));
    }

    return parts.join('\n');
}

// ═══════════════════════════════════════════
// 메인 자율 파이프라인
// ═══════════════════════════════════════════

export async function runStreamingPipeline(
    input: PipelineInput,
    emitter: SSEEmitter
) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        emitter.emit({ type: 'error', message: 'OPENAI_API_KEY가 설정되지 않았습니다.' });
        emitter.close();
        return;
    }

    const openai = new OpenAI({ apiKey });

    // ─── 이미지 입력 노드 ───
    const imageNodeId = uuidv4();
    const imagePos = getNodePosition('imageInput');
    const imageNode: CanvasNode = {
        id: imageNodeId,
        type: 'imageInput',
        position: imagePos,
        data: {
            title: '이미지 입력',
            content: {
                intentText: input.intentText,
                targetPreset: input.targetPreset,
                contextPreset: input.contextPreset,
                hasImage: true,
            },
            createdAt: Date.now(),
            status: 'active',
        },
    };
    emitter.emit({ type: 'node:create', node: imageNode });
    await delay(400);

    const state: PipelineState = {
        nodes: [imageNode],
        edges: [],
        userContext: [],
        completedSteps: [],
        lastNodeId: imageNodeId,
        lastNodePos: imagePos,
    };

    let cursor = { x: imagePos.x + 120, y: imagePos.y + 50 };

    try {
        // ═══════════════════════════════════════
        // 완전 자율 루프 — 오케스트레이터가 매 스텝 결정
        // ═══════════════════════════════════════
        const MAX_STEPS = 12;

        for (let step = 0; step < MAX_STEPS; step++) {
            emitter.emit({
                type: 'agent:status',
                agentId: 'orchestrator',
                status: 'thinking',
                message: `다음 행동을 결정합니다... (${step + 1}/${MAX_STEPS})`,
            });

            const decision = await askOrchestrator(openai, state, input, step);

            emitter.emit({
                type: 'orchestrator:thinking',
                reasoning: decision.reason,
                nextAction: decision.action,
            });
            emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'idle' });

            if (decision.action === 'finish') break;

            switch (decision.action) {
                case 'run_intent':
                    if (!state.completedSteps.includes('intent')) {
                        cursor = await executeIntentAgent(emitter, openai, input, state, cursor);
                    }
                    break;
                case 'run_decoder':
                    if (state.intentResult && !state.completedSteps.includes('decoder')) {
                        cursor = await executeDecoderAgent(emitter, openai, input, state, cursor);
                    }
                    break;
                case 'run_gap':
                    if (state.intentResult && state.decodingResult && !state.completedSteps.includes('gap')) {
                        cursor = await executeGapAgent(emitter, openai, state, cursor);
                    }
                    break;
                case 'run_revision':
                    if (state.intentResult && state.gapResult && !state.completedSteps.includes('revision')) {
                        cursor = await executeRevisionAgent(emitter, openai, input, state, cursor);
                    }
                    break;
                case 'create_insight':
                    cursor = await createInsightNode(emitter, state, cursor, decision);
                    break;
                case 'create_comparison':
                    cursor = await createComparisonNode(emitter, state, cursor, decision);
                    break;
                case 'create_annotation':
                    cursor = await createAnnotationNode(emitter, state, cursor, decision);
                    break;
            }
        }

        // ═══════════════════════════════════════
        // 최종 요약 노드 + 승인 요청
        // ═══════════════════════════════════════
        cursor = await createSummaryNode(emitter, state, cursor, {
            headline: '인코딩-디코딩 분석 완료',
            keyPoints: [
                state.intentResult ? `의도: ${state.intentResult.coreMessage}` : '',
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

        emitter.emit({
            type: 'pipeline:done',
            summary: `${state.nodes.length}개 노드 | ${state.completedSteps.join(' → ')}`,
        });

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
    const intentPos = getNextPosition(state.nodes, 'intentAnalysis');
    const intentNodeId = uuidv4();

    // 1. 커서 이동 + 빈 노드 생성 (streaming 상태)
    emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'thinking', message: '의도 분석을 시작합니다...' });
    cursor = await grabFromToolbox(emitter, 'intent', 'intentAnalysis', cursor, { x: intentPos.x + 20, y: intentPos.y + 15 });

    const intentNode: CanvasNode = {
        id: intentNodeId, type: 'intentAnalysis', position: intentPos,
        data: { agentId: 'intent', title: '의도 분석', content: null, streamingText: '', createdAt: Date.now(), status: 'streaming' },
    };
    emitter.emit({ type: 'node:create', node: intentNode });
    state.nodes.push(intentNode);
    await delay(150);

    // 2. 엣지 연결
    cursor = await connectWithCursor(emitter, 'intent', cursor, state.lastNodePos, intentPos, {
        id: uuidv4(), source: state.lastNodeId, target: intentNodeId, animated: true,
    });

    // 3. 스트리밍 실행 — 커서가 노드 위에서 fidget
    emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'thinking', message: '이미지를 분석하는 중...' });
    const streamOut = await streamAndThink(
        emitter, 'intent', intentNodeId,
        { x: intentPos.x + 60, y: intentPos.y + 60 },
        (onToken) => runIntentAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentText: input.intentText,
        }, onToken),
    );
    cursor = streamOut.cursorPos;
    state.intentResult = streamOut.result;

    // 4. 최종 content 업데이트
    emitter.emit({ type: 'node:update', nodeId: intentNodeId, data: { content: streamOut.result, streamingText: undefined, status: 'active' } });
    cursor = await revisit(emitter, 'intent', cursor, state.lastNodePos, intentPos);

    emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'idle' });
    state.lastNodeId = intentNodeId;
    state.lastNodePos = intentPos;
    state.completedSteps.push('intent');

    return cursor;
}

async function executeDecoderAgent(
    emitter: SSEEmitter, openai: OpenAI, input: PipelineInput,
    state: PipelineState, cursor: { x: number; y: number },
): Promise<{ x: number; y: number }> {
    if (!state.intentResult) {
        emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'error', message: 'Intent 분석이 먼저 필요합니다' });
        return cursor;
    }

    // 1. 첫 번째 가설 노드를 streaming 상태로 먼저 생성
    const firstHypPos = getNextPosition(state.nodes, 'decodingHypothesis');
    const firstHypNodeId = uuidv4();

    emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'thinking', message: '타겟 관점에서 해석을 생성합니다...' });
    cursor = await grabFromToolbox(emitter, 'decoder', 'decodingHypothesis', cursor, { x: firstHypPos.x + 20, y: firstHypPos.y + 15 });

    const firstHypNode: CanvasNode = {
        id: firstHypNodeId, type: 'decodingHypothesis', position: firstHypPos,
        data: { agentId: 'decoder', title: '해석 가설 분석 중...', content: null, streamingText: '', createdAt: Date.now(), status: 'streaming' },
    };
    emitter.emit({ type: 'node:create', node: firstHypNode });
    state.nodes.push(firstHypNode);
    await delay(150);

    cursor = await connectWithCursor(emitter, 'decoder', cursor, state.lastNodePos, firstHypPos, {
        id: uuidv4(), source: state.lastNodeId, target: firstHypNodeId, animated: true,
    });

    // 2. 스트리밍 실행
    const streamOut = await streamAndThink(
        emitter, 'decoder', firstHypNodeId,
        { x: firstHypPos.x + 60, y: firstHypPos.y + 60 },
        (onToken) => runDecodingAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentAnalysis: state.intentResult!,
            targetPreset: input.targetPreset,
            contextPreset: input.contextPreset,
        }, onToken),
    );
    cursor = streamOut.cursorPos;
    state.decodingResult = streamOut.result;
    const hypotheses = streamOut.result.hypotheses;

    // 3. 첫 번째 노드를 가설 1로 업데이트
    emitter.emit({ type: 'node:update', nodeId: firstHypNodeId, data: {
        title: `가설 1 (${(hypotheses[0]?.probability * 100 || 0).toFixed(0)}%)`,
        content: hypotheses[0],
        streamingText: undefined,
        status: 'active',
    }});

    let lastHypothesisId = firstHypNodeId;
    let lastHypothesisPos = firstHypPos;

    // 4. 나머지 가설 노드들 순차 생성
    for (let i = 1; i < hypotheses.length; i++) {
        const h = hypotheses[i];
        const hPos = getNextPosition(state.nodes, 'decodingHypothesis');

        emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'creating', message: `가설 ${i + 1} 노드를 배치합니다` });
        cursor = await grabFromToolbox(emitter, 'decoder', 'decodingHypothesis', cursor, { x: hPos.x + 20, y: hPos.y + 15 });

        const hNodeId = uuidv4();
        const hNode: CanvasNode = {
            id: hNodeId, type: 'decodingHypothesis', position: hPos,
            data: { agentId: 'decoder', title: `가설 ${i + 1} (${(h.probability * 100).toFixed(0)}%)`, content: h, createdAt: Date.now(), status: 'active' },
        };
        emitter.emit({ type: 'node:create', node: hNode });
        state.nodes.push(hNode);
        await delay(100);

        cursor = await connectWithCursor(emitter, 'decoder', cursor, state.lastNodePos, hPos, {
            id: uuidv4(), source: state.lastNodeId, target: hNodeId, animated: true,
        });
        cursor = await revisit(emitter, 'decoder', cursor, lastHypothesisPos, hPos);

        lastHypothesisId = hNodeId;
        lastHypothesisPos = hPos;
    }

    emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'idle' });
    state.lastNodeId = lastHypothesisId;
    state.lastNodePos = lastHypothesisPos;
    state.completedSteps.push('decoder');

    // ─── 체크포인트 1: 해석 방향 확인 ───
    const topHypotheses = streamOut.result.hypotheses.slice(0, 3);
    const checkpointOptions = [
        ...topHypotheses.map((h, i) =>
            `가설 ${i + 1} 중심 (${(h.probability * 100).toFixed(0)}%): ${h.interpretation.slice(0, 50)}${h.interpretation.length > 50 ? '...' : ''}`
        ),
        '현재 방향대로 계속 진행',
    ];
    const cpId1 = uuidv4();
    emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'thinking', message: '사용자 확인을 기다립니다...' });
    const cpResponse1 = await waitForCheckpoint(
        emitter, cpId1,
        '해석 가설 분석이 완료되었습니다. Gap 분석에서 어떤 관점을 중점적으로 다룰까요?',
        checkpointOptions,
        `우세 해석: ${streamOut.result.dominantInterpretation}`,
    );
    if (cpResponse1 && cpResponse1 !== '현재 방향대로 계속 진행') {
        state.userContext.push(`[해석 방향 지시] ${cpResponse1}`);
    }
    emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'idle' });

    return cursor;
}

async function executeGapAgent(
    emitter: SSEEmitter, openai: OpenAI,
    state: PipelineState, cursor: { x: number; y: number },
): Promise<{ x: number; y: number }> {
    if (!state.intentResult || !state.decodingResult) {
        emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'error', message: 'Intent와 Decoding이 먼저 필요합니다' });
        return cursor;
    }

    const gapPos = getNextPosition(state.nodes, 'gapAnalysis');
    const gapNodeId = uuidv4();

    // 1. 기존 노드들 훑어보기 (이전 분석 결과 확인)
    emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'thinking', message: '의도-해석 차이를 분석합니다...' });
    const placedPositions = state.nodes.map(n => n.position);
    cursor = await scan(emitter, 'gap', cursor, placedPositions.slice(-3));

    // 2. 빈 노드 생성 (streaming 상태)
    cursor = await grabFromToolbox(emitter, 'gap', 'gapAnalysis', cursor, { x: gapPos.x + 20, y: gapPos.y + 15 });

    const gapNode: CanvasNode = {
        id: gapNodeId, type: 'gapAnalysis', position: gapPos,
        data: { agentId: 'gap', title: 'Gap 분석', content: null, streamingText: '', createdAt: Date.now(), status: 'streaming' },
    };
    emitter.emit({ type: 'node:create', node: gapNode });
    state.nodes.push(gapNode);
    await delay(150);

    // 3. 가설 노드들 → Gap 노드 연결
    const hypothesisNodes = state.nodes.filter(n => n.type === 'decodingHypothesis');
    for (const hNode of hypothesisNodes) {
        cursor = await connectWithCursor(emitter, 'gap', cursor, hNode.position, gapPos, {
            id: uuidv4(), source: hNode.id, target: gapNodeId, animated: true,
        });
    }

    // 4. 스트리밍 실행
    const streamOut = await streamAndThink(
        emitter, 'gap', gapNodeId,
        { x: gapPos.x + 60, y: gapPos.y + 80 },
        (onToken) => runGapAnalystAgent(openai, {
            intentAnalysis: state.intentResult!,
            decodingResult: state.decodingResult!,
            userContext: state.userContext.join('\n') || undefined,
        }, onToken),
    );
    cursor = streamOut.cursorPos;
    state.gapResult = streamOut.result;

    // 5. 최종 content 업데이트
    emitter.emit({ type: 'node:update', nodeId: gapNodeId, data: {
        title: `Gap 분석 (일치도 ${streamOut.result.overallAlignmentScore}%)`,
        content: streamOut.result,
        streamingText: undefined,
        status: 'active',
    }});

    emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'idle' });
    state.lastNodeId = gapNodeId;
    state.lastNodePos = gapPos;
    state.completedSteps.push('gap');

    // ─── 체크포인트 2: 수정 우선순위 확인 ───
    const alignScore = streamOut.result.overallAlignmentScore;
    const highGaps = streamOut.result.gaps.filter(g => g.severity === 'high');
    const cpOptions2 = alignScore < 50
        ? [
            `심각도 HIGH Gap ${highGaps.length}개 집중 수정`,
            '감정 반응 개선 우선',
            '모든 Gap 균형있게 수정',
            '현재 방향대로 계속 진행',
        ]
        : [
            '핵심 Gap 수정 + 세부 보완',
            '빠른 개선 포인트 중심으로 제안',
            '현재 방향대로 계속 진행',
        ];

    const cpId2 = uuidv4();
    emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'thinking', message: '사용자 확인을 기다립니다...' });
    const cpResponse2 = await waitForCheckpoint(
        emitter, cpId2,
        `Gap 분석 완료 — 일치도 ${alignScore}%. 수정 제안 방향을 선택해주세요.`,
        cpOptions2,
        streamOut.result.criticalFindings,
    );
    if (cpResponse2 && cpResponse2 !== '현재 방향대로 계속 진행') {
        state.userContext.push(`[수정 우선순위 지시] ${cpResponse2}`);
    }
    emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'idle' });

    return cursor;
}

async function executeRevisionAgent(
    emitter: SSEEmitter, openai: OpenAI, input: PipelineInput,
    state: PipelineState, cursor: { x: number; y: number },
): Promise<{ x: number; y: number }> {
    if (!state.intentResult || !state.gapResult) {
        emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'error', message: 'Intent와 Gap 분석이 먼저 필요합니다' });
        return cursor;
    }

    const revisionPos = getNextPosition(state.nodes, 'revisionProposal');
    const revisionNodeId = uuidv4();
    const proposalId = uuidv4();
    state.revisionProposalId = proposalId;

    // 1. 빈 노드 생성 (streaming 상태)
    emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'thinking', message: '수정 방향을 고민합니다...' });
    cursor = await grabFromToolbox(emitter, 'revision', 'revisionProposal', cursor, { x: revisionPos.x + 20, y: revisionPos.y + 15 });

    const revNode: CanvasNode = {
        id: revisionNodeId, type: 'revisionProposal', position: revisionPos,
        data: { agentId: 'revision', title: '수정 제안', content: null, streamingText: '', createdAt: Date.now(), status: 'streaming' },
    };
    emitter.emit({ type: 'node:create', node: revNode });
    state.nodes.push(revNode);
    await delay(150);

    // 2. 엣지 연결
    cursor = await connectWithCursor(emitter, 'revision', cursor, state.lastNodePos, revisionPos, {
        id: uuidv4(), source: state.lastNodeId, target: revisionNodeId, animated: true,
    });

    // 3. 스트리밍 실행
    const streamOut = await streamAndThink(
        emitter, 'revision', revisionNodeId,
        { x: revisionPos.x + 60, y: revisionPos.y + 80 },
        (onToken) => runEncodingSuggestionAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentAnalysis: state.intentResult!,
            gapAnalysis: state.gapResult!,
            userContext: state.userContext.join('\n') || undefined,
        }, onToken),
    );
    cursor = streamOut.cursorPos;
    state.suggestionResult = streamOut.result;

    // 4. 최종 content 업데이트
    emitter.emit({ type: 'node:update', nodeId: revisionNodeId, data: {
        content: { ...streamOut.result, proposalId },
        streamingText: undefined,
        status: 'creating',
    }});

    const placedPositions = state.nodes.map(n => n.position);
    cursor = await scan(emitter, 'revision', cursor, placedPositions.slice(-3));

    emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'idle' });
    state.lastNodeId = revisionNodeId;
    state.lastNodePos = revisionPos;
    state.completedSteps.push('revision');

    return cursor;
}

// ═══════════════════════════════════════════
// 자율 노드 생성 함수들
// ═══════════════════════════════════════════

async function createInsightNode(
    emitter: SSEEmitter, state: PipelineState,
    cursor: { x: number; y: number }, decision: any,
): Promise<{ x: number; y: number }> {
    const pos = getNextPosition(state.nodes, 'insight', state.lastNodeId);

    emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'creating', message: '인사이트 노드를 생성합니다' });
    cursor = await grabFromToolbox(emitter, 'orchestrator' as AgentId, 'insight', cursor, { x: pos.x + 20, y: pos.y + 15 });

    const nodeId = uuidv4();
    const node: CanvasNode = {
        id: nodeId, type: 'insight', position: pos,
        data: {
            agentId: 'orchestrator', title: '인사이트',
            content: {
                message: decision.message || '',
                category: decision.category || 'discovery',
                confidence: decision.confidence ?? 70,
            },
            createdAt: Date.now(), status: 'active',
        },
    };
    emitter.emit({ type: 'node:create', node });
    state.nodes.push(node);
    await delay(120);

    emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.lastNodeId, target: nodeId, animated: true } });
    emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'idle' });

    state.lastNodeId = nodeId;
    state.lastNodePos = pos;
    state.completedSteps.push('insight');

    return cursor;
}

async function createQuestionNode(
    emitter: SSEEmitter, state: PipelineState,
    cursor: { x: number; y: number }, decision: any,
): Promise<{ x: number; y: number }> {
    const pos = getNextPosition(state.nodes, 'question', state.lastNodeId);

    emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'creating', message: '질문 노드를 생성합니다' });
    cursor = await grabFromToolbox(emitter, 'orchestrator' as AgentId, 'question', cursor, { x: pos.x + 20, y: pos.y + 15 });

    const nodeId = uuidv4();
    const node: CanvasNode = {
        id: nodeId, type: 'question', position: pos,
        data: {
            agentId: 'orchestrator', title: '탐구 질문',
            content: { question: decision.question || '', status: 'exploring' },
            createdAt: Date.now(), status: 'active',
        },
    };
    emitter.emit({ type: 'node:create', node });
    state.nodes.push(node);
    await delay(120);

    emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.lastNodeId, target: nodeId, animated: true } });
    emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'idle' });

    // question 노드는 메인 플로우를 바꾸지 않음 (lastNode 유지)
    state.completedSteps.push('question');

    return cursor;
}

async function createComparisonNode(
    emitter: SSEEmitter, state: PipelineState,
    cursor: { x: number; y: number }, decision: any,
): Promise<{ x: number; y: number }> {
    const pos = getNextPosition(state.nodes, 'comparison', state.lastNodeId);

    emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'creating', message: '비교 분석 노드를 생성합니다' });
    cursor = await grabFromToolbox(emitter, 'orchestrator' as AgentId, 'comparison', cursor, { x: pos.x + 20, y: pos.y + 15 });

    const nodeId = uuidv4();
    const node: CanvasNode = {
        id: nodeId, type: 'comparison', position: pos,
        data: {
            agentId: 'orchestrator', title: '비교 분석',
            content: {
                leftLabel: decision.leftLabel || '',
                leftContent: decision.leftContent || '',
                rightLabel: decision.rightLabel || '',
                rightContent: decision.rightContent || '',
                verdict: decision.verdict || '',
                winner: decision.winner || 'neutral',
            },
            createdAt: Date.now(), status: 'active',
        },
    };
    emitter.emit({ type: 'node:create', node });
    state.nodes.push(node);
    await delay(120);

    emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.lastNodeId, target: nodeId, animated: true } });
    emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'idle' });

    state.lastNodeId = nodeId;
    state.lastNodePos = pos;
    state.completedSteps.push('comparison');

    return cursor;
}

async function createAnnotationNode(
    emitter: SSEEmitter, state: PipelineState,
    cursor: { x: number; y: number }, decision: any,
): Promise<{ x: number; y: number }> {
    // 코멘트 대상 노드 찾기 (마지막 노드)
    const targetNodeId = state.lastNodeId;
    const pos = getNextPosition(state.nodes, 'annotation', targetNodeId);

    emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'creating', message: '코멘트 노드를 생성합니다' });
    cursor = await grabFromToolbox(emitter, 'orchestrator' as AgentId, 'annotation', cursor, { x: pos.x + 20, y: pos.y + 15 });

    const nodeId = uuidv4();
    const annotatorAgent = decision.targetAgent || 'orchestrator';
    const node: CanvasNode = {
        id: nodeId, type: 'annotation', position: pos,
        data: {
            agentId: annotatorAgent, title: '코멘트',
            content: {
                comment: decision.comment || '',
                targetNodeId,
                annotatorAgent,
            },
            createdAt: Date.now(), status: 'active',
        },
    };
    emitter.emit({ type: 'node:create', node });
    state.nodes.push(node);
    await delay(120);

    emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: targetNodeId, target: nodeId, animated: false } });
    emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'idle' });

    // annotation 노드는 메인 플로우를 바꾸지 않음
    state.completedSteps.push('annotation');

    return cursor;
}

async function createSummaryNode(
    emitter: SSEEmitter, state: PipelineState,
    cursor: { x: number; y: number }, decision: any,
): Promise<{ x: number; y: number }> {
    const pos = getNextPosition(state.nodes, 'summary', state.lastNodeId);

    emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'creating', message: '요약 노드를 생성합니다' });
    cursor = await grabFromToolbox(emitter, 'orchestrator' as AgentId, 'summary', cursor, { x: pos.x + 20, y: pos.y + 15 });

    const nodeId = uuidv4();
    const node: CanvasNode = {
        id: nodeId, type: 'summary', position: pos,
        data: {
            agentId: 'orchestrator', title: '분석 요약',
            content: {
                headline: decision.headline || '',
                keyPoints: Array.isArray(decision.keyPoints) ? decision.keyPoints : [],
                overallScore: decision.overallScore,
                recommendation: decision.recommendation || '',
            },
            createdAt: Date.now(), status: 'active',
        },
    };
    emitter.emit({ type: 'node:create', node });
    state.nodes.push(node);
    await delay(120);

    emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: state.lastNodeId, target: nodeId, animated: true } });
    emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'idle' });

    state.lastNodeId = nodeId;
    state.lastNodePos = pos;
    state.completedSteps.push('summary');

    return cursor;
}
