'use client';

import { create } from 'zustand';
import {
    AgentId,
    AgentRuntimeState,
    CanvasNode,
    CanvasEdge,
    ApprovalItem,
    ActivityLogEntry,
    SSEEvent,
    PipelineInput,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface AgentCanvasState {
    // === 캔버스 데이터 ===
    nodes: CanvasNode[];
    edges: CanvasEdge[];

    // === 에이전트 상태 ===
    agents: Record<AgentId, AgentRuntimeState>;

    // === UI 상태 ===
    approvals: ApprovalItem[];
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
    handleSSEEvent: (event: SSEEvent) => void;
    startPipeline: () => void;
    resetCanvas: () => void;
}

const initialAgents: Record<AgentId, AgentRuntimeState> = {
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

        const execX = 1850;
        const execY = 60;
        updateAgent('executor', {
            status: 'thinking',
            cursor: { x: execX, y: execY },
            currentMessage: 'Gemini로 수정 이미지를 생성합니다...',
        });
        addActivity('executor', 'thinking', 'Gemini로 수정 이미지 생성 중...');

        const execNodeId = uuidv4();

        try {
            // Gemini API 호출
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
                position: { x: execX + 30, y: execY + 40 },
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
                position: { x: execX + 30, y: execY + 40 },
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

        // Revision → Execution 엣지
        if (revisionNode) {
            addEdge({
                id: uuidv4(),
                source: revisionNode.id,
                target: execNodeId,
                animated: true,
            });
        }

        await new Promise((r) => setTimeout(r, 500));

        // Evaluation 노드
        updateAgent('executor', { status: 'creating', currentMessage: '평가 노드를 생성합니다' });
        addActivity('executor', 'creating', '평가 노드 생성');

        const evalNodeId = uuidv4();
        addNode({
            id: evalNodeId,
            type: 'evaluation',
            position: { x: execX + 30, y: execY + 460 },
            data: {
                title: '최종 평가',
                content: { summary: '수정 이미지가 생성되었습니다. 원본과 비교하여 인코딩 개선 여부를 확인하세요.' },
                createdAt: Date.now(),
                status: 'active',
            },
        });

        await new Promise((r) => setTimeout(r, 300));
        addEdge({ id: uuidv4(), source: execNodeId, target: evalNodeId, animated: true });

        // 완료
        updateAgent('executor', { status: 'idle', currentMessage: undefined });
        addActivity('executor', 'idle', '이미지 생성 완료');
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

            case 'pipeline:done':
                set({ pipelineStatus: 'done', pipelineSummary: event.summary });
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
            activityLog: [],
            agents: { ...initialAgents },
            pipelineSummary: undefined,
        }),

    resetCanvas: () =>
        set({
            nodes: [],
            edges: [],
            approvals: [],
            activityLog: [],
            agents: { ...initialAgents },
            pipelineStatus: 'idle',
            pipelineSummary: undefined,
        }),
}));
