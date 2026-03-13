// === Agent System Types ===

export type AgentId = 'intent' | 'decoder' | 'gap' | 'revision' | 'executor' | 'orchestrator';

export type AgentStatus =
    | 'idle'
    | 'thinking'
    | 'grabbing'
    | 'carrying'
    | 'creating'
    | 'connecting'
    | 'waitingApproval'
    | 'executing'
    | 'error';

export interface AgentDefinition {
    id: AgentId;
    name: string;
    role: string;
    color: string;
    icon: string;
    description: string;
}

export interface AgentRuntimeState {
    agentId: AgentId;
    status: AgentStatus;
    cursor: { x: number; y: number };
    currentMessage?: string;
    carrying?: CanvasNodeType; // 들고 있는 노드 타입
}

// === Canvas Node Types ===

export type CanvasNodeType =
    | 'imageInput'
    | 'intentAnalysis'
    | 'decodingHypothesis'
    | 'gapAnalysis'
    | 'revisionProposal'
    | 'execution'
    | 'evaluation'
    | 'insight'
    | 'question'
    | 'comparison'
    | 'annotation'
    | 'summary';

export interface CanvasNode {
    id: string;
    type: CanvasNodeType;
    position: { x: number; y: number };
    data: {
        agentId?: AgentId;
        title: string;
        content: any;
        streamingText?: string; // 스트리밍 중 누적 텍스트
        createdAt: number;
        status: 'creating' | 'streaming' | 'active' | 'approved' | 'rejected';
    };
}

export interface CanvasEdge {
    id: string;
    source: string;
    target: string;
    animated?: boolean;
}

// === SSE Event Types ===

export type SSEEvent =
    | { type: 'agent:status'; agentId: AgentId; status: AgentStatus; message?: string }
    | { type: 'cursor:move'; agentId: AgentId; x: number; y: number }
    | { type: 'cursor:grab'; agentId: AgentId; nodeType: CanvasNodeType }
    | { type: 'cursor:drop'; agentId: AgentId }
    | { type: 'cursor:connect'; agentId: AgentId; fromX: number; fromY: number; toX: number; toY: number }
    | { type: 'node:create'; node: CanvasNode }
    | { type: 'node:update'; nodeId: string; data: Partial<any> }
    | { type: 'edge:create'; edge: CanvasEdge }
    | { type: 'approval:request'; proposalId: string; suggestions: SuggestionItem[] }
    | { type: 'approval:resolved'; proposalId: string; approved: boolean }
    | { type: 'checkpoint:request'; checkpointId: string; question: string; options: string[]; context?: string }
    | { type: 'checkpoint:resolved'; checkpointId: string; response: string }
    | { type: 'pipeline:done'; summary: string }
    | { type: 'orchestrator:thinking'; reasoning: string; nextAction: string }
    | { type: 'error'; message: string };

// === Checkpoint Types ===

export interface CheckpointItem {
    checkpointId: string;
    question: string;
    options: string[];
    context?: string;
    status: 'pending' | 'resolved';
    response?: string;
}

// === Approval Types ===

export interface ApprovalItem {
    proposalId: string;
    agentId: AgentId;
    title: string;
    summary: string;
    suggestions: SuggestionItem[];
    status: 'pending' | 'approved' | 'rejected';
    createdAt: number;
}

// === Activity Feed Types ===

export interface ActivityLogEntry {
    id: string;
    agentId: AgentId;
    action: string;
    timestamp: number;
    detail?: string;
}

// === Orchestrator Node Data Types ===

export interface InsightData {
    message: string;
    category: 'discovery' | 'warning' | 'opportunity' | 'pattern';
    confidence: number; // 0-100
    relatedTo?: string; // 관련 노드 ID
}

export interface QuestionData {
    question: string;
    answer?: string;
    status: 'exploring' | 'answered' | 'deferred';
}

export interface ComparisonData {
    leftLabel: string;
    leftContent: string;
    rightLabel: string;
    rightContent: string;
    verdict: string;
    winner?: 'left' | 'right' | 'neutral';
}

export interface AnnotationData {
    comment: string;
    targetNodeId: string;
    annotatorAgent: AgentId;
}

export interface SummaryData {
    headline: string;
    keyPoints: string[];
    overallScore?: number; // 0-100
    recommendation: string;
}

// === Agent Output Types ===

export interface IntentAnalysis {
    coreMessage: string;
    emotionalTone: string;
    callToAction: string;
    implicitAssumptions: string[];
    summary: string;
}

export interface DecodingHypothesisItem {
    interpretation: string;
    probability: number;
    reasoning: string;
    emotionalResponse: string;
}

export interface DecodingHypothesisSet {
    targetPersona: string;
    context: string;
    hypotheses: DecodingHypothesisItem[];
    dominantInterpretation: string;
}

export interface GapItem {
    dimension: string;
    intended: string;
    decoded: string;
    severity: 'high' | 'medium' | 'low';
    cause: string;
}

export interface GapAnalysis {
    gaps: GapItem[];
    overallAlignmentScore: number;
    criticalFindings: string;
}

export interface SuggestionItem {
    area: string;
    suggestion: string;
    expectedImpact: string;
    tradeoff: string;
    priority: 'high' | 'medium' | 'low';
}

export interface EncodingSuggestions {
    suggestions: SuggestionItem[];
    summary: string;
}

// === Pipeline Input ===

export interface PipelineInput {
    imageBase64: string;
    imageMimeType: string;
    intentText: string;
    targetPreset: string;
    contextPreset: string;
}

// ==========================================================
// Legacy Types (하위 호환 — 이전 컴포넌트용, 전환 후 제거)
// ==========================================================

export type AnalysisItem = string | { title: string; detail: string };

export interface DecodingHypothesis {
    label: string;
    probability: number;
    rationale: string;
}

export interface AnalysisResult {
    observation: AnalysisItem[];
    connotation: AnalysisItem[];
    decoding_hypotheses: DecodingHypothesis[];
    risks: AnalysisItem[];
    edit_suggestions: AnalysisItem[];
}

export type NodeType = 'imageUpload' | 'decodingAnalysis' | 'agentPipeline';

export interface ImageUploadNodeData {
    imageId?: string;
    imageUrl?: string;
    imageBase64?: string;
    imageMimeType?: string;
    fileName?: string;
}

export interface DecodingAnalysisNodeData {
    intentText?: string;
    targetPreset?: string;
    contextPreset?: string;
    analysisResult?: AnalysisResult;
    status?: 'idle' | 'analyzing' | 'completed' | 'error';
    errorMessage?: string;
}

export type AgentStepStatus = 'idle' | 'running' | 'done' | 'error';

export interface AgentPipelineState {
    status: AgentStepStatus;
    intentStep: { status: AgentStepStatus; result?: IntentAnalysis; error?: string };
    decodingStep: { status: AgentStepStatus; result?: DecodingHypothesisSet; error?: string };
    gapStep: { status: AgentStepStatus; result?: GapAnalysis; error?: string };
    suggestionStep: { status: AgentStepStatus; result?: EncodingSuggestions; error?: string };
}

export interface AgentPipelineNodeData {
    intentText?: string;
    targetPreset?: string;
    contextPreset?: string;
    pipeline?: AgentPipelineState;
    status?: 'idle' | 'running' | 'completed' | 'error';
    errorMessage?: string;
}

export type NodeData = ImageUploadNodeData | DecodingAnalysisNodeData | AgentPipelineNodeData;

export interface Node {
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: NodeData;
}

export interface Edge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    type?: string;
}
