import OpenAI from 'openai';
import { SSEEmitter, delay } from '@/lib/sseHelpers';
import { getNodePosition, getNextPosition } from '@/lib/layoutEngine';
import {
    moveTo, fidget, wander, scan, revisit,
    grabFromToolbox, connectWithCursor,
} from '@/lib/cursorBehaviors';
import { runIntentAgent } from './intentAgent';
import { runDecodingAgent } from './decodingAgent';
import { runGapAnalystAgent } from './gapAnalystAgent';
import { runEncodingSuggestionAgent } from './encodingSuggestionAgent';
import {
    PipelineInput, CanvasNode, CanvasEdge, AgentId,
    IntentAnalysis, DecodingHypothesisSet, GapAnalysis, EncodingSuggestions,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════
// 유틸리티
// ═══════════════════════════════════════════

/**
 * API 호출과 동시에 에이전트 커서가 주변을 탐색하는 패턴
 */
async function thinkWhileCalling<T>(
    emitter: SSEEmitter,
    agentId: AgentId,
    cursorPos: { x: number; y: number },
    interestPoints: { x: number; y: number }[],
    apiCall: () => Promise<T>,
): Promise<{ result: T; cursorPos: { x: number; y: number } }> {
    let wanderDone = false;
    let lastPos = { ...cursorPos };

    const wanderLoop = async () => {
        while (!wanderDone) {
            lastPos = await wander(emitter, agentId, lastPos, interestPoints, 2500);
            if (!wanderDone) {
                lastPos = await fidget(emitter, agentId, lastPos, 3, 10);
            }
        }
    };

    const [result] = await Promise.all([
        apiCall().then((r) => { wanderDone = true; return r; }),
        wanderLoop(),
    ]);

    return { result, cursorPos: lastPos };
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
    completedSteps: string[];
    lastNodeId: string;
    lastNodePos: { x: number; y: number };
}

// ═══════════════════════════════════════════
// 오케스트레이터 LLM 의사결정
// ═══════════════════════════════════════════

type OrchestratorAction =
    | { action: 'call_intent'; reason: string }
    | { action: 'call_decoder'; reason: string }
    | { action: 'call_gap'; reason: string }
    | { action: 'call_revision'; reason: string }
    | { action: 'create_insight'; reason: string; message: string; category: string; confidence: number }
    | { action: 'create_question'; reason: string; question: string }
    | { action: 'create_comparison'; reason: string; leftLabel: string; leftContent: string; rightLabel: string; rightContent: string; verdict: string; winner: string }
    | { action: 'create_annotation'; reason: string; comment: string; targetAgent: string }
    | { action: 'create_summary'; reason: string; headline: string; keyPoints: string[]; overallScore: number; recommendation: string }
    | { action: 'finish'; reason: string; summary: string };

const ENRICHMENT_SYSTEM_PROMPT = `당신은 시각 커뮤니케이션 분석 보조입니다.
이미지 인코딩-디코딩 분석이 완료된 후, 분석을 풍부하게 만드는 추가 행동을 결정합니다.

사용 가능한 행동:
- create_insight — 분석에서 발견한 핵심 인사이트 (category: discovery/warning/opportunity/pattern, confidence: 0-100, message: 한 문장)
- create_comparison — 의도 vs 해석 등 두 요소 비교 (leftLabel, leftContent, rightLabel, rightContent, verdict, winner: left/right/neutral)
- create_annotation — 특정 분석에 대한 코멘트 (comment, targetAgent: intent/decoder/gap/revision)
- finish — 더 이상 추가할 것 없음 (summary: 전체 분석 결론)

규칙:
1. 반드시 1~3개의 자율 행동 후 finish를 호출하세요.
2. create_insight 또는 create_comparison을 우선 사용하세요.
3. create_question이나 create_summary는 사용하지 마세요.
4. 매 턴 정확히 하나의 action을 JSON으로 반환하세요.

JSON 형식으로만 응답하세요.`;

async function askEnrichment(
    openai: OpenAI,
    state: PipelineState,
    input: PipelineInput,
    enrichmentStep: number,
): Promise<OrchestratorAction> {
    const stateDescription = buildStateDescription(state, input);

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: ENRICHMENT_SYSTEM_PROMPT },
            {
                role: 'user',
                content: `[분석 완료 — 추가 행동 ${enrichmentStep}/3]
${stateDescription}

분석을 더 풍부하게 할 추가 행동을 JSON으로 결정하세요.
action 필드와 reason 필드는 필수입니다.`,
            },
        ],
        max_tokens: 800,
        response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Enrichment: 빈 응답');

    return JSON.parse(content) as OrchestratorAction;
}

function buildStateDescription(state: PipelineState, input: PipelineInput): string {
    const parts: string[] = [];
    parts.push(`창작자 의도: "${input.intentText}"`);
    parts.push(`타겟: ${input.targetPreset}`);
    parts.push(`컨텍스트: ${input.contextPreset}`);
    parts.push(`완료된 단계: ${state.completedSteps.length > 0 ? state.completedSteps.join(', ') : '없음'}`);
    parts.push(`생성된 노드: ${state.nodes.length}개`);

    if (state.intentResult) {
        parts.push(`\n[Intent 분석 결과]\n핵심 메시지: ${state.intentResult.coreMessage}\n감성 톤: ${state.intentResult.emotionalTone}\n행동 유도: ${state.intentResult.callToAction}`);
    }
    if (state.decodingResult) {
        parts.push(`\n[Decoding 결과]\n우세 해석: ${state.decodingResult.dominantInterpretation}\n가설 수: ${state.decodingResult.hypotheses.length}`);
        state.decodingResult.hypotheses.forEach((h, i) => {
            parts.push(`가설 ${i + 1} (${(h.probability * 100).toFixed(0)}%): ${h.interpretation}`);
        });
    }
    if (state.gapResult) {
        parts.push(`\n[Gap 분석 결과]\n일치도: ${state.gapResult.overallAlignmentScore}%\nGap 수: ${state.gapResult.gaps.length}\n핵심 발견: ${state.gapResult.criticalFindings}`);
    }
    if (state.suggestionResult) {
        parts.push(`\n[수정 제안]\n요약: ${state.suggestionResult.summary}\n제안 수: ${state.suggestionResult.suggestions.length}`);
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
        completedSteps: [],
        lastNodeId: imageNodeId,
        lastNodePos: imagePos,
    };

    let cursor = { x: imagePos.x + 120, y: imagePos.y + 50 };

    try {
        // ═══════════════════════════════════════
        // Phase 1: 핵심 에이전트 (하드코딩 순서)
        // ═══════════════════════════════════════
        emitter.emit({ type: 'orchestrator:thinking', reasoning: '핵심 분석 에이전트를 순서대로 호출합니다', nextAction: 'call_intent' });

        // 1. Intent Agent
        emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'thinking', message: 'Phase 1: 의도 분석을 시작합니다...' });
        cursor = await executeIntentAgent(emitter, openai, input, state, cursor);

        // 2. Decoder Agent
        emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'thinking', message: 'Phase 1: 해석 가설을 생성합니다...' });
        emitter.emit({ type: 'orchestrator:thinking', reasoning: '의도 분석 완료, 타겟 관점 해석 시작', nextAction: 'call_decoder' });
        cursor = await executeDecoderAgent(emitter, openai, input, state, cursor);

        // 3. Gap Agent
        emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'thinking', message: 'Phase 1: Gap 분석을 시작합니다...' });
        emitter.emit({ type: 'orchestrator:thinking', reasoning: '해석 가설 생성 완료, 의도-해석 Gap 분석 시작', nextAction: 'call_gap' });
        cursor = await executeGapAgent(emitter, openai, state, cursor);

        // 4. Revision Agent
        emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'thinking', message: 'Phase 1: 수정 제안을 생성합니다...' });
        emitter.emit({ type: 'orchestrator:thinking', reasoning: 'Gap 분석 완료, 수정 방향 제안 시작', nextAction: 'call_revision' });
        cursor = await executeRevisionAgent(emitter, openai, input, state, cursor);

        // ═══════════════════════════════════════
        // Phase 2: 자율 보강 (LLM 결정, 최대 4회)
        // ═══════════════════════════════════════
        emitter.emit({ type: 'agent:status', agentId: 'orchestrator', status: 'thinking', message: 'Phase 2: 분석 보강 행동을 결정합니다...' });

        const MAX_ENRICHMENT = 4;
        for (let enrichStep = 1; enrichStep <= MAX_ENRICHMENT; enrichStep++) {
            const decision = await askEnrichment(openai, state, input, enrichStep);

            emitter.emit({
                type: 'orchestrator:thinking',
                reasoning: decision.reason,
                nextAction: decision.action,
            });

            if (decision.action === 'finish') break;

            switch (decision.action) {
                case 'create_insight':
                    cursor = await createInsightNode(emitter, state, cursor, decision);
                    break;
                case 'create_comparison':
                    cursor = await createComparisonNode(emitter, state, cursor, decision);
                    break;
                case 'create_annotation':
                    cursor = await createAnnotationNode(emitter, state, cursor, decision);
                    break;
                case 'create_summary':
                    cursor = await createSummaryNode(emitter, state, cursor, decision);
                    break;
                default:
                    // 알 수 없는 action은 무시
                    break;
            }
        }

        // ═══════════════════════════════════════
        // Phase 3: 최종 요약 + 승인 요청
        // ═══════════════════════════════════════

        // 최종 요약 노드 생성
        cursor = await createSummaryNode(emitter, state, cursor, {
            headline: `인코딩-디코딩 분석 완료`,
            keyPoints: [
                state.intentResult ? `의도: ${state.intentResult.coreMessage}` : '',
                state.gapResult ? `일치도: ${state.gapResult.overallAlignmentScore}%` : '',
                state.suggestionResult ? `${state.suggestionResult.suggestions.length}개 수정 제안` : '',
            ].filter(Boolean),
            overallScore: state.gapResult?.overallAlignmentScore,
            recommendation: state.suggestionResult?.summary || '분석 결과를 검토하세요.',
        });

        // 수정 제안 승인 요청
        if (state.suggestionResult) {
            const proposalId = uuidv4();
            emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'waitingApproval', message: '사용자 승인을 기다립니다...' });
            emitter.emit({ type: 'approval:request', proposalId, suggestions: state.suggestionResult.suggestions });
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

    emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'thinking', message: '이미지를 살펴보고 있습니다...' });

    const intentOut = await thinkWhileCalling(
        emitter, 'intent', cursor,
        [state.lastNodePos, { x: state.lastNodePos.x + 180, y: state.lastNodePos.y }],
        () => runIntentAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentText: input.intentText,
        }),
    );
    cursor = intentOut.cursorPos;
    state.intentResult = intentOut.result;

    emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'creating', message: '의도 분석 노드를 배치합니다' });
    cursor = await grabFromToolbox(emitter, 'intent', 'intentAnalysis', cursor, { x: intentPos.x + 20, y: intentPos.y + 15 });

    const intentNodeId = uuidv4();
    const intentNode: CanvasNode = {
        id: intentNodeId, type: 'intentAnalysis', position: intentPos,
        data: { agentId: 'intent', title: '의도 분석', content: intentOut.result, createdAt: Date.now(), status: 'active' },
    };
    emitter.emit({ type: 'node:create', node: intentNode });
    state.nodes.push(intentNode);
    await delay(180);

    cursor = await connectWithCursor(emitter, 'intent', cursor, state.lastNodePos, intentPos, {
        id: uuidv4(), source: state.lastNodeId, target: intentNodeId, animated: true,
    });
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

    emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'thinking', message: '타겟 관점에서 해석을 생성합니다...' });

    const placedPositions = state.nodes.map(n => n.position);
    const decodingOut = await thinkWhileCalling(
        emitter, 'decoder', cursor,
        [...placedPositions.slice(-3)],
        () => runDecodingAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentAnalysis: state.intentResult!,
            targetPreset: input.targetPreset,
            contextPreset: input.contextPreset,
        }),
    );
    cursor = decodingOut.cursorPos;
    state.decodingResult = decodingOut.result;

    let lastHypothesisId = state.lastNodeId;
    let lastHypothesisPos = state.lastNodePos;

    for (let i = 0; i < decodingOut.result.hypotheses.length; i++) {
        const h = decodingOut.result.hypotheses[i];
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

        if (i > 0) {
            cursor = await revisit(emitter, 'decoder', cursor, lastHypothesisPos, hPos);
        }

        lastHypothesisId = hNodeId;
        lastHypothesisPos = hPos;
    }

    emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'idle' });
    state.lastNodeId = lastHypothesisId;
    state.lastNodePos = lastHypothesisPos;
    state.completedSteps.push('decoder');

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
    emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'thinking', message: '의도-해석 차이를 분석합니다...' });

    const placedPositions = state.nodes.map(n => n.position);
    const gapOut = await thinkWhileCalling(
        emitter, 'gap', cursor,
        placedPositions.slice(-4),
        () => runGapAnalystAgent(openai, {
            intentAnalysis: state.intentResult!,
            decodingResult: state.decodingResult!,
        }),
    );
    cursor = gapOut.cursorPos;
    state.gapResult = gapOut.result;

    cursor = await scan(emitter, 'gap', cursor, placedPositions.slice(-3));

    emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'creating', message: 'Gap 분석 노드를 배치합니다' });
    cursor = await grabFromToolbox(emitter, 'gap', 'gapAnalysis', cursor, { x: gapPos.x + 20, y: gapPos.y + 15 });

    const gapNodeId = uuidv4();
    const gapNode: CanvasNode = {
        id: gapNodeId, type: 'gapAnalysis', position: gapPos,
        data: { agentId: 'gap', title: `Gap 분석 (일치도 ${gapOut.result.overallAlignmentScore}%)`, content: gapOut.result, createdAt: Date.now(), status: 'active' },
    };
    emitter.emit({ type: 'node:create', node: gapNode });
    state.nodes.push(gapNode);
    await delay(180);

    // 가설 노드들에서 Gap으로 연결
    const hypothesisNodes = state.nodes.filter(n => n.type === 'decodingHypothesis');
    for (const hNode of hypothesisNodes) {
        cursor = await connectWithCursor(emitter, 'gap', cursor, hNode.position, gapPos, {
            id: uuidv4(), source: hNode.id, target: gapNodeId, animated: true,
        });
    }

    emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'idle' });
    state.lastNodeId = gapNodeId;
    state.lastNodePos = gapPos;
    state.completedSteps.push('gap');

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
    emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'thinking', message: '수정 방향을 고민합니다...' });

    const placedPositions = state.nodes.map(n => n.position);
    const revOut = await thinkWhileCalling(
        emitter, 'revision', cursor,
        placedPositions.slice(-4),
        () => runEncodingSuggestionAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentAnalysis: state.intentResult!,
            gapAnalysis: state.gapResult!,
        }),
    );
    cursor = revOut.cursorPos;
    state.suggestionResult = revOut.result;

    emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'creating', message: '수정 제안 노드를 배치합니다' });
    cursor = await grabFromToolbox(emitter, 'revision', 'revisionProposal', cursor, { x: revisionPos.x + 20, y: revisionPos.y + 15 });

    const revisionNodeId = uuidv4();
    const proposalId = uuidv4();
    const revNode: CanvasNode = {
        id: revisionNodeId, type: 'revisionProposal', position: revisionPos,
        data: { agentId: 'revision', title: '수정 제안', content: { ...revOut.result, proposalId }, createdAt: Date.now(), status: 'creating' },
    };
    emitter.emit({ type: 'node:create', node: revNode });
    state.nodes.push(revNode);
    await delay(180);

    cursor = await connectWithCursor(emitter, 'revision', cursor, state.lastNodePos, revisionPos, {
        id: uuidv4(), source: state.lastNodeId, target: revisionNodeId, animated: true,
    });
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
