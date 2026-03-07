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
