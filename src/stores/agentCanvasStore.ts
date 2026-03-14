'use client';

import { create } from 'zustand';
import {
    AgentId,
    AgentRuntimeState,
    CanvasNode,
    CanvasEdge,
    ApprovalItem,
    CheckpointItem,
    ActivityLogEntry,
    SSEEvent,
    PipelineInput,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { getNextPosition } from '@/lib/layoutEngine';

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
    };

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
}

const initialAgents: Record<AgentId, AgentRuntimeState> = {
    orchestrator: { agentId: 'orchestrator', status: 'idle', cursor: { x: 0, y: 0 } },
    intent: { agentId: 'intent', status: 'idle', cursor: { x: 0, y: 0 } },
    decoder: { agentId: 'decoder', status: 'idle', cursor: { x: 0, y: 0 } },
    gap: { agentId: 'gap', status: 'idle', cursor: { x: 0, y: 0 } },
    revision: { agentId: 'revision', status: 'idle', cursor: { x: 0, y: 0 } },
    executor: { agentId: 'executor', status: 'idle', cursor: { x: 0, y: 0 } },
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

    input: {
        intentText: '',
        targetPreset: '',
        contextPreset: '',
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

            case 'pipeline:done':
                set({ pipelineStatus: 'done', pipelineSummary: event.summary });
                break;

            case 'orchestrator:thinking':
                addActivity('orchestrator', 'thinking', `${event.reasoning} → ${event.nextAction}`);
                break;

            case 'error':
                set({ pipelineStatus: 'error' });
                addActivity('intent', 'error', event.message);
                break;
        }
    },

    startPipeline: () =>
        set({
            pipelineStatus: 'running',
            nodes: [],
            edges: [],
            approvals: [],
            checkpoints: [],
            pendingCheckpoint: null,
            activityLog: [],
            agents: { ...initialAgents },
            pipelineSummary: undefined,
        }),

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
