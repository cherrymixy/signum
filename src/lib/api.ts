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
 * 이미지를 Canvas를 통해 리사이즈 + 압축하여 base64로 변환
 * Vercel의 4.5MB body limit을 초과하지 않도록 최대 1600px, JPEG 품질 0.8로 압축
 */
export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX_DIM = 1600;
      let { width, height } = img;

      // 큰 이미지는 리사이즈
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context 생성 실패'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // JPEG로 압축 (품질 0.8)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
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
