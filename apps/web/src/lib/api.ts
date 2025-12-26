import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface UploadResponse {
  success: boolean;
  data: {
    imageId: string;
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  };
}

export interface AnalysisRequest {
  imageId: string;
  intentText: string;
  targetPreset: string;
  contextPreset: string;
}

export interface AnalysisResponse {
  success: boolean;
  data: {
    analysisId: string;
    result: any;
  };
}

export const uploadImage = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<UploadResponse>('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const analyzeImage = async (
  request: AnalysisRequest
): Promise<AnalysisResponse> => {
  const response = await api.post<AnalysisResponse>('/api/analysis', request);
  return response.data;
};

export const getImageUrl = (imageId: string): string => {
  return `${API_BASE_URL}/api/images/${imageId}`;
};



