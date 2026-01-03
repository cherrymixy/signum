import { AnalysisResult } from './analysis';

export type NodeType = 'imageUpload' | 'decodingAnalysis';

export interface ImageUploadNodeData {
  imageId?: string;
  imageUrl?: string;
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

// Re-export AnalysisResult from analysis.ts
export type { AnalysisResult, AnalysisItem, DecodingHypothesis } from './analysis';



