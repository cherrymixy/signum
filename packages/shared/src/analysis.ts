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



