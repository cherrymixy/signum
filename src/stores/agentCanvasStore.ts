'use client';

import { create } from 'zustand';
import {
    AgentId,
    AgentRuntimeState,
    CanvasNode,
    CanvasNodeType,
    CanvasEdge,
    ApprovalItem,
    CheckpointItem,
    ActivityLogEntry,
    SSEEvent,
    PipelineInput,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { getNextPosition } from '@/lib/layoutEngine';
import { loadCreatorProfile, saveAnalysisToProfile, buildProfileContext } from '@/lib/creatorProfile';

interface AgentCanvasState {
    // === 캔버스 데이터 ===
    nodes: CanvasNode[];
    edges: CanvasEdge[];

    // === 에이전트 상태 ===
    agents: Record<AgentId, AgentRuntimeState>;

    // === UI 상태 ===
    approvals: ApprovalItem[];
    checkpoints: CheckpointItem[];
    pendingCheckpoint: CheckpointItem | null;
    activityLog: ActivityLogEntry[];
    pipelineStatus: 'idle' | 'running' | 'done' | 'error';
    pipelineSummary?: string;

    // === 입력 상태 ===
    input: {
        imageBase64?: string;
        imageMimeType?: string;
        fileName?: string;
        intentText: string;
        targetPreset: string;
        contextPreset: string;
        profileContext?: string;
    };

    // === Continuation 상태 ===
    continuationStatus: 'idle' | 'running' | 'done' | 'error';

    // === A/B 비교 상태 ===
    compareStatus: 'idle' | 'running' | 'done' | 'error';
    compareImageBase64?: string;
    compareImageMimeType?: string;

    // === Actions ===
    setInput: (input: Partial<AgentCanvasState['input']>) => void;
    addNode: (node: CanvasNode) => void;
    updateNodeData: (nodeId: string, data: Partial<any>) => void;
    addEdge: (edge: CanvasEdge) => void;
    updateAgent: (agentId: AgentId, update: Partial<AgentRuntimeState>) => void;
    addActivity: (agentId: AgentId, action: string, detail?: string) => void;
    addApproval: (item: ApprovalItem) => void;
    resolveApproval: (proposalId: string, approved: boolean) => void;
    executeApproval: (proposalId: string) => void;
    respondToCheckpoint: (checkpointId: string, response: string) => Promise<void>;
    handleSSEEvent: (event: SSEEvent) => void;
    startPipeline: () => void;
    resetCanvas: () => void;
    startContinuation: () => void;
    endContinuation: (status: 'done' | 'error') => void;
    addHumanNode: (type: CanvasNodeType) => string;
    setCompareImage: (base64: string, mimeType: string) => void;
    runCompareAnalysis: () => Promise<void>;
}

const initialAgents: Record<AgentId, AgentRuntimeState> = {
    orchestrator: { agentId: 'orchestrator', status: 'idle', cursor: { x: 0, y: 0 } },
    intent: { agentId: 'intent', status: 'idle', cursor: { x: 0, y: 0 } },
    decoder: { agentId: 'decoder', status: 'idle', cursor: { x: 0, y: 0 } },
    gap: { agentId: 'gap', status: 'idle', cursor: { x: 0, y: 0 } },
    revision: { agentId: 'revision', status: 'idle', cursor: { x: 0, y: 0 } },
    executor: { agentId: 'executor', status: 'idle', cursor: { x: 0, y: 0 } },
    human: { agentId: 'human', status: 'idle', cursor: { x: 0, y: 0 } },
};

export const useAgentCanvasStore = create<AgentCanvasState>((set, get) => ({
    // Initial state
    nodes: [],
    edges: [],
    agents: { ...initialAgents },
    approvals: [],
    checkpoints: [],
    pendingCheckpoint: null,
    activityLog: [],
    pipelineStatus: 'idle',
    pipelineSummary: undefined,
    continuationStatus: 'idle',
    compareStatus: 'idle',
    compareImageBase64: undefined,
    compareImageMimeType: undefined,

    input: {
        intentText: '',
        targetPreset: 'general',
        contextPreset: 'brand-ad',
        profileContext: undefined,
    },

    // === Actions ===

    setInput: (input) =>
        set((state) => ({
            input: { ...state.input, ...input },
        })),

    addNode: (node) =>
        set((state) => ({
            nodes: [...state.nodes, node],
        })),

    updateNodeData: (nodeId, data) =>
        set((state) => ({
            nodes: state.nodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
            ),
        })),

    addEdge: (edge) =>
        set((state) => ({
            edges: [...state.edges, edge],
        })),

    updateAgent: (agentId, update) =>
        set((state) => ({
            agents: {
                ...state.agents,
                [agentId]: { ...state.agents[agentId], ...update },
            },
        })),

    addActivity: (agentId, action, detail) =>
        set((state) => ({
            activityLog: [
                {
                    id: uuidv4(),
                    agentId,
                    action,
                    timestamp: Date.now(),
                    detail,
                },
                ...state.activityLog,
            ].slice(0, 100), // 최대 100개 유지
        })),

    addApproval: (item) =>
        set((state) => ({
            approvals: [...state.approvals, item],
        })),

    resolveApproval: (proposalId, approved) =>
        set((state) => ({
            approvals: state.approvals.map((a) =>
                a.proposalId === proposalId
                    ? { ...a, status: approved ? 'approved' : 'rejected' }
                    : a
            ),
        })),

    executeApproval: async (proposalId: string) => {
        const { addNode, addEdge, updateAgent, addActivity, resolveApproval, nodes, input } = get();

        // 승인 상태 업데이트
        resolveApproval(proposalId, true);

        // revision proposal 노드 찾기
        const revisionNode = nodes.find(
            (n) => n.type === 'revisionProposal' && n.data.content?.proposalId === proposalId
        );

        // Revision Agent 상태 업데이트
        updateAgent('revision', { status: 'idle', currentMessage: undefined });
        if (revisionNode) {
            get().updateNodeData(revisionNode.id, { status: 'approved' });
        }

        // intent 노드에서 의도 요약 가져오기
        const intentNode = nodes.find((n) => n.type === 'intentAnalysis');
        const intentSummary = intentNode?.data.content?.coreMessage || input.intentText || '';

        const approval = get().approvals.find((a) => a.proposalId === proposalId);
        const suggestions = approval?.suggestions || [];

        // ─── Executor Agent: 이미지 생성 ───

        const execPos = getNextPosition(nodes, 'execution');
        const execX = execPos.x;
        const execY = execPos.y;
        updateAgent('executor', {
            status: 'thinking',
            cursor: { x: execX + 120, y: execY + 50 },
            currentMessage: 'DALL-E로 수정 이미지를 생성합니다...',
        });
        addActivity('executor', 'thinking', 'DALL-E로 수정 이미지 생성 중...');

        const execNodeId = uuidv4();

        // 커서 이동 헬퍼
        const moveCursor = async (toX: number, toY: number, ms = 200) => {
            updateAgent('executor', { cursor: { x: toX, y: toY } });
            await new Promise(r => setTimeout(r, ms));
        };

        let executionResult: any = null;
        try {
            // OpenAI API 호출
            const response = await fetch('/api/agents/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: input.imageBase64,
                    imageMimeType: input.imageMimeType,
                    suggestions,
                    intentSummary,
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error?.message || '이미지 생성 실패');
            }

            executionResult = result;

            // Execution 노드 생성 (생성된 이미지 포함)
            updateAgent('executor', { status: 'creating', currentMessage: '수정 이미지 노드를 생성합니다' });
            addActivity('executor', 'creating', '수정 이미지 노드 생성');

            addNode({
                id: execNodeId,
                type: 'execution',
                position: { x: execX, y: execY },
                data: {
                    agentId: 'executor',
                    title: '수정 이미지 생성 완료',
                    content: {
                        summary: result.data.description || `${suggestions.length}개 수정 제안이 반영된 이미지가 생성되었습니다.`,
                        generatedImageBase64: result.data.generatedImageBase64,
                        generatedImageMimeType: result.data.generatedImageMimeType,
                    },
                    createdAt: Date.now(),
                    status: 'active',
                },
            });
        } catch (error: any) {
            // 오류 시에도 노드 생성 (오류 표시)
            updateAgent('executor', { status: 'error', currentMessage: error.message });
            addActivity('executor', 'error', error.message);

            addNode({
                id: execNodeId,
                type: 'execution',
                position: { x: execX, y: execY },
                data: {
                    agentId: 'executor',
                    title: '이미지 생성 오류',
                    content: { summary: error.message, error: true },
                    createdAt: Date.now(),
                    status: 'active',
                },
            });
        }

        await new Promise((r) => setTimeout(r, 300));

        // Revision → Execution 엣지 (커서 애니메이션)
        if (revisionNode) {
            const revPos = revisionNode.position;
            updateAgent('executor', { status: 'connecting' });
            await moveCursor(revPos.x + 150, revPos.y + 40, 250);
            await moveCursor(execX + 10, execY + 40, 300);
            addEdge({
                id: uuidv4(),
                source: revisionNode.id,
                target: execNodeId,
                animated: true,
            });
            await new Promise((r) => setTimeout(r, 80));
        }

        await new Promise((r) => setTimeout(r, 300));

        // ── Verification Loop: 수정 이미지를 재분석해 개선도 확인 ──
        const verifyIntentNode = get().nodes.find((n) => n.type === 'intentAnalysis');
        const verifyGapNode = get().nodes.find((n) => n.type === 'gapAnalysis');
        const intentAnalysis = verifyIntentNode?.data.content;
        const originalScore: number = verifyGapNode?.data.content?.overallAlignmentScore ?? 0;

        if (intentAnalysis && executionResult?.data?.generatedImageBase64) {
            updateAgent('executor', { status: 'thinking', currentMessage: '수정 이미지를 재분석합니다...' });
            addActivity('executor', 'thinking', '수정 이미지 품질 검증 중...');

            try {
                const verifyRes = await fetch('/api/agents/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        generatedImageBase64: executionResult.data.generatedImageBase64,
                        generatedImageMimeType: executionResult.data.generatedImageMimeType || 'image/png',
                        intentAnalysis,
                        originalScore,
                    }),
                });

                if (verifyRes.ok) {
                    const verifyData = await verifyRes.json();
                    if (verifyData.success) {
                        const { newScore, improvement } = verifyData.data as { newScore: number; improvement: number };
                        const category: 'discovery' | 'pattern' | 'warning' =
                            improvement >= 10 ? 'discovery' : improvement >= 0 ? 'pattern' : 'warning';
                        const sign = improvement >= 0 ? '+' : '';
                        const message =
                            improvement >= 10
                                ? `검증 완료 — 일치도 ${originalScore}% → ${newScore}% (${sign}${improvement}p 개선됨)`
                                : improvement >= 0
                                ? `검증 완료 — 일치도 ${originalScore}% → ${newScore}% (${sign}${improvement}p)`
                                : `검증 완료 — 일치도 ${originalScore}% → ${newScore}% (${sign}${improvement}p). 추가 수정을 고려하세요.`;

                        const verifyNodeId = uuidv4();
                        const verifyPos = getNextPosition(get().nodes, 'insight');
                        addNode({
                            id: verifyNodeId,
                            type: 'insight',
                            position: verifyPos,
                            data: {
                                agentId: 'executor',
                                title: '수정 이미지 검증',
                                content: { message, category, confidence: newScore },
                                createdAt: Date.now(),
                                status: 'active',
                            },
                        });
                        addEdge({ id: uuidv4(), source: execNodeId, target: verifyNodeId, animated: false });
                        addActivity('executor', 'idle', message);
                    }
                }
            } catch {
                // 검증 실패는 이미지 생성 자체를 방해하지 않음
            }
        }

        await new Promise((r) => setTimeout(r, 300));

        // Evaluation 노드
        updateAgent('executor', { status: 'creating', currentMessage: '평가 노드를 생성합니다' });
        addActivity('executor', 'creating', '평가 노드 생성');

        const nodesAfterExec = get().nodes;
        const evalPos = getNextPosition(nodesAfterExec, 'evaluation');
        const evalNodeId = uuidv4();
        addNode({
            id: evalNodeId,
            type: 'evaluation',
            position: { x: evalPos.x, y: evalPos.y },
            data: {
                title: '최종 평가',
                content: { summary: '수정 이미지가 생성되었습니다. 원본과 비교하여 인코딩 개선 여부를 확인하세요.' },
                createdAt: Date.now(),
                status: 'active',
            },
        });

        await new Promise((r) => setTimeout(r, 300));

        // Execution → Evaluation 엣지 (커서 애니메이션)
        updateAgent('executor', { status: 'connecting' });
        await moveCursor(execX + 150, execY + 40, 250);
        await moveCursor(evalPos.x + 10, evalPos.y + 40, 300);
        addEdge({ id: uuidv4(), source: execNodeId, target: evalNodeId, animated: true });
        await new Promise((r) => setTimeout(r, 80));

        // 완료
        updateAgent('executor', { status: 'idle', currentMessage: undefined });
        addActivity('executor', 'idle', '이미지 생성 완료');
    },

    respondToCheckpoint: async (checkpointId, response) => {
        // 서버에 응답 전송 후 성공 시에만 패널 닫기
        const res = await fetch('/api/agents/checkpoint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkpointId, response }),
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            // 타임아웃(404): 파이프라인이 이미 자동 재개 → 패널만 닫기
            if (res.status === 404 && body?.error === 'timeout') {
                console.warn('[Checkpoint] 타임아웃으로 자동 재개됨:', checkpointId);
                set((state) => ({
                    pendingCheckpoint: null,
                    checkpoints: state.checkpoints.map((c) =>
                        c.checkpointId === checkpointId ? { ...c, status: 'resolved', response: '' } : c
                    ),
                }));
                return;
            }
            // 그 외 오류: throw → CheckpointPanel이 error 상태 처리
            throw new Error(`HTTP ${res.status}`);
        }

        // 성공: 이 체크포인트가 아직 활성 상태인 경우에만 패널 닫기
        // (응답 대기 중 다음 checkpoint:request가 도착해 pendingCheckpoint가 교체됐을 수 있음)
        set((state) => ({
            pendingCheckpoint:
                state.pendingCheckpoint?.checkpointId === checkpointId
                    ? null
                    : state.pendingCheckpoint,
            checkpoints: state.checkpoints.map((c) =>
                c.checkpointId === checkpointId ? { ...c, status: 'resolved', response } : c
            ),
        }));
    },

    handleSSEEvent: (event) => {
        const { addNode, updateNodeData, addEdge, updateAgent, addActivity, addApproval, resolveApproval } = get();

        switch (event.type) {
            case 'agent:status':
                updateAgent(event.agentId, {
                    status: event.status,
                    currentMessage: event.message,
                });
                addActivity(event.agentId, event.status, event.message);
                break;

            case 'cursor:move':
                updateAgent(event.agentId, {
                    cursor: { x: event.x, y: event.y },
                });
                break;

            case 'cursor:grab':
                updateAgent(event.agentId, {
                    status: 'grabbing',
                    carrying: event.nodeType,
                });
                addActivity(event.agentId, 'grabbing', `${event.nodeType} 노드를 가져옵니다`);
                break;

            case 'cursor:drop':
                updateAgent(event.agentId, {
                    status: 'creating',
                    carrying: undefined,
                });
                break;

            case 'cursor:connect':
                updateAgent(event.agentId, {
                    status: 'connecting',
                    cursor: { x: event.toX, y: event.toY },
                });
                break;

            case 'node:create':
                addNode(event.node);
                if (event.node.data.agentId) {
                    addActivity(event.node.data.agentId, 'created node', event.node.data.title);
                }
                break;

            case 'node:update':
                updateNodeData(event.nodeId, event.data);
                break;

            case 'edge:create':
                addEdge(event.edge);
                break;

            case 'approval:request':
                addApproval({
                    proposalId: event.proposalId,
                    agentId: 'revision',
                    title: '수정안 승인 요청',
                    summary: event.suggestions.map((s) => s.suggestion).join('; '),
                    suggestions: event.suggestions,
                    status: 'pending',
                    createdAt: Date.now(),
                });
                break;

            case 'approval:resolved':
                resolveApproval(event.proposalId, event.approved);
                break;

            case 'checkpoint:request': {
                const newCheckpoint: CheckpointItem = {
                    checkpointId: event.checkpointId,
                    question: event.question,
                    options: event.options,
                    context: event.context,
                    status: 'pending',
                };
                set((state) => ({
                    checkpoints: [...state.checkpoints, newCheckpoint],
                    pendingCheckpoint: newCheckpoint,
                }));
                addActivity('orchestrator', 'checkpoint', event.question);
                break;
            }

            case 'checkpoint:resolved':
                set((state) => ({
                    checkpoints: state.checkpoints.map((c) =>
                        c.checkpointId === event.checkpointId
                            ? { ...c, status: 'resolved', response: event.response }
                            : c
                    ),
                    pendingCheckpoint:
                        state.pendingCheckpoint?.checkpointId === event.checkpointId
                            ? null
                            : state.pendingCheckpoint,
                }));
                break;

            case 'pipeline:done': {
                set({ pipelineStatus: 'done', pipelineSummary: event.summary });
                // 분석 이력을 크리에이터 프로필에 저장
                const { nodes: doneNodes, input: doneInput } = get();
                const doneGapNode = doneNodes.find(n => n.type === 'gapAnalysis');
                if (doneGapNode?.data?.content?.overallAlignmentScore !== undefined) {
                    saveAnalysisToProfile({
                        timestamp: Date.now(),
                        alignmentScore: doneGapNode.data.content.overallAlignmentScore,
                        criticalFindings: doneGapNode.data.content.criticalFindings || '',
                        gapDimensions: (doneGapNode.data.content.gaps || []).map((g: any) => g.dimension).filter(Boolean),
                        targetPreset: doneInput.targetPreset,
                        contextPreset: doneInput.contextPreset,
                    });
                }
                break;
            }

            case 'orchestrator:thinking':
                addActivity('orchestrator', 'thinking', `${event.reasoning} → ${event.nextAction}`);
                break;

            case 'error':
                set({ pipelineStatus: 'error' });
                addActivity('intent', 'error', event.message);
                break;
        }
    },

    startContinuation: () => set({ continuationStatus: 'running' }),

    endContinuation: (status) => set({ continuationStatus: status }),

    setCompareImage: (base64, mimeType) => set({ compareImageBase64: base64, compareImageMimeType: mimeType, compareStatus: 'idle' }),

    runCompareAnalysis: async () => {
        const { nodes, input, compareImageBase64, compareImageMimeType, addNode, addEdge, addActivity } = get();
        if (!compareImageBase64) return;

        const intentNode = nodes.find(n => n.type === 'intentAnalysis');
        const gapNode = nodes.find(n => n.type === 'gapAnalysis');
        const intentAnalysis = intentNode?.data?.content;
        const originalScore: number = gapNode?.data?.content?.overallAlignmentScore ?? 0;

        if (!intentAnalysis) return;

        set({ compareStatus: 'running' });
        addActivity('orchestrator', 'thinking', 'A/B 비교 분석 시작...');

        try {
            const res = await fetch('/api/agents/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64B: compareImageBase64,
                    imageMimeTypeB: compareImageMimeType || 'image/jpeg',
                    intentAnalysis,
                    originalScore,
                    contextPreset: input.contextPreset,
                }),
            });

            if (!res.ok) throw new Error('비교 분석 API 오류');
            const data = await res.json();

            if (!data.success) throw new Error(data.error?.message || '비교 실패');

            const { scoreA, scoreB, diff, winner, criticalFindingsB } = data.data;
            const winnerLabel = winner === 'A' ? '원본 이미지 우세' : winner === 'B' ? '비교 이미지 우세' : '유사한 성능';
            const sign = diff >= 0 ? '+' : '';

            const comparePos = getNextPosition(nodes, 'comparison');
            const compareNodeId = uuidv4();

            addNode({
                id: compareNodeId,
                type: 'comparison',
                position: comparePos,
                data: {
                    agentId: 'orchestrator',
                    title: 'A/B 비교 결과',
                    content: {
                        leftLabel: `이미지 A (원본)`,
                        leftContent: `일치도 ${scoreA}%\n${gapNode?.data?.content?.criticalFindings || ''}`,
                        rightLabel: `이미지 B (비교)`,
                        rightContent: `일치도 ${scoreB}% (${sign}${diff}p)\n${criticalFindingsB}`,
                        verdict: winnerLabel,
                        winner: winner === 'A' ? 'left' : winner === 'B' ? 'right' : 'neutral',
                    },
                    createdAt: Date.now(),
                    status: 'active',
                },
            });

            // gapNode → comparisonNode 엣지
            if (gapNode) {
                addEdge({ id: uuidv4(), source: gapNode.id, target: compareNodeId, animated: false });
            }

            addActivity('orchestrator', 'idle', `A/B 비교 완료 — ${winnerLabel} (A: ${scoreA}%, B: ${scoreB}%)`);
            set({ compareStatus: 'done' });
        } catch (error: any) {
            addActivity('orchestrator', 'error', error.message);
            set({ compareStatus: 'error' });
        }
    },

    addHumanNode: (type) => {
        const { nodes } = get();
        const pos = getNextPosition(nodes, type);
        const nodeId = uuidv4();

        let content: any = {};
        if (type === 'annotation') {
            content = { comment: '', targetNodeId: '', annotatorAgent: 'human' };
        } else if (type === 'question') {
            content = { question: '', answer: undefined, status: 'exploring' };
        } else if (type === 'insight') {
            content = { message: '', category: 'discovery', confidence: 80 };
        }

        const node: CanvasNode = {
            id: nodeId,
            type,
            position: pos,
            data: {
                agentId: 'human' as any,
                title: type === 'annotation' ? '메모' : type === 'question' ? 'AI 질문' : '인사이트',
                content,
                createdAt: Date.now(),
                status: 'active',
            },
        };
        get().addNode(node);
        return nodeId;
    },

    startPipeline: () => {
        // 크리에이터 프로필 로드 → input에 profileContext 주입
        const profile = loadCreatorProfile();
        const profileContext = profile ? buildProfileContext(profile) : undefined;
        set((state) => ({
            pipelineStatus: 'running',
            nodes: [],
            edges: [],
            approvals: [],
            checkpoints: [],
            pendingCheckpoint: null,
            activityLog: [],
            agents: { ...initialAgents },
            pipelineSummary: undefined,
            input: { ...state.input, profileContext },
        }));
    },

    resetCanvas: () =>
        set({
            nodes: [],
            edges: [],
            approvals: [],
            checkpoints: [],
            pendingCheckpoint: null,
            activityLog: [],
            agents: { ...initialAgents },
            pipelineStatus: 'idle',
            pipelineSummary: undefined,
        }),
}));
