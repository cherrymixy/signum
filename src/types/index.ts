// === Analysis Types ===

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

// === Node Types ===

export type NodeType = 'imageUpload' | 'decodingAnalysis';

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

export type NodeData = ImageUploadNodeData | DecodingAnalysisNodeData;

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
