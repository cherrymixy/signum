export interface AnalysisRequest {
  imageBase64: string;
  imageMimeType: string;
  intentText: string;
  targetPreset: string;
  contextPreset: string;
}

export interface AnalysisResponse {
  success: boolean;
  data: {
    result: any;
  };
}

/**
 * 이미지 파일을 base64로 변환
 */
export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // "data:image/png;base64,..." 에서 base64 부분만 추출
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 이미지 분석 API 호출
 */
export async function analyzeImage(request: AnalysisRequest): Promise<AnalysisResponse> {
  const response = await fetch('/api/analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw { response: { data: error } };
  }

  return response.json();
}
