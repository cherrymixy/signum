// === Analysis Types (Legacy — 기존 단일 분석용) ===

export type AnalysisItem = string | {
    title: string;
    detail: string;
};

export interface DecodingHypothesis {
    label: string;
    probability: number; // 0~1
    rationale: string;
}

export interface AnalysisResult {
    observation: AnalysisItem[];
    connotation: AnalysisItem[];
    decoding_hypotheses: DecodingHypothesis[];
    risks: AnalysisItem[];
    edit_suggestions: AnalysisItem[];
}

// === Agent Output Types ===

/** Intent Agent 출력: 창작 의도 구조화 */
export interface IntentAnalysis {
    coreMessage: string;         // 핵심 메시지 (무엇을 전달하려 하는가)
    emotionalTone: string;       // 감성 톤 (어떤 감정을 유발하려 하는가)
    callToAction: string;        // 행동 유도 (사용자에게 어떤 반응을 기대하는가)
    implicitAssumptions: string[]; // 암묵적 가정들
    summary: string;             // 의도 요약 한 줄
}

/** Decoding Agent 출력: 타겟 관점 해석 가설 */
export interface DecodingHypothesisItem {
    interpretation: string;      // 해석 내용
    probability: number;         // 확률 (0~1)
    reasoning: string;           // 근거
    emotionalResponse: string;   // 예상 감정 반응
}

export interface DecodingHypothesisSet {
    targetPersona: string;       // 타겟 페르소나 설명
    context: string;             // 게시 컨텍스트
    hypotheses: DecodingHypothesisItem[]; // 해석 가설 목록
    dominantInterpretation: string; // 가장 우세한 해석 요약
}

/** Gap Analyst Agent 출력: 의도-해석 차이 분석 */
export interface GapItem {
    dimension: string;           // 차이 발생 차원 (메시지/감성/행동유도)
    intended: string;            // 창작자 의도
    decoded: string;             // 수용자 해석
    severity: 'high' | 'medium' | 'low'; // 심각도
    cause: string;               // 원인 분석
}

export interface GapAnalysis {
    gaps: GapItem[];
    overallAlignmentScore: number; // 전체 일치도 (0~100)
    criticalFindings: string;     // 핵심 발견 요약
}

/** Encoding Suggestion Agent 출력: 수정 방향 제안 */
export interface SuggestionItem {
    area: string;                // 수정 영역 (컬러, 구도, 텍스트 등)
    suggestion: string;          // 구체적 제안
    expectedImpact: string;      // 기대 효과
    tradeoff: string;            // 트레이드오프
    priority: 'high' | 'medium' | 'low'; // 우선순위
}

export interface EncodingSuggestions {
    suggestions: SuggestionItem[];
    summary: string;             // 전체 제안 요약
}

// === Agent Pipeline Types ===

export type AgentStepStatus = 'idle' | 'running' | 'done' | 'error';

export interface AgentPipelineState {
    status: AgentStepStatus;
    intentStep: { status: AgentStepStatus; result?: IntentAnalysis; error?: string };
    decodingStep: { status: AgentStepStatus; result?: DecodingHypothesisSet; error?: string };
    gapStep: { status: AgentStepStatus; result?: GapAnalysis; error?: string };
    suggestionStep: { status: AgentStepStatus; result?: EncodingSuggestions; error?: string };
}

// === Node Types ===

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

// === Edge Types ===

export interface Edge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    type?: string;
}
