import { z } from 'zod';

export const analysisRequestSchema = z.object({
  imageId: z.string().uuid('유효하지 않은 이미지 ID입니다.'),
  intentText: z.string().min(1, '의도 텍스트를 입력해주세요.'),
  targetPreset: z.string().min(1, '타겟 프리셋을 선택해주세요.'),
  contextPreset: z.string().min(1, '컨텍스트 프리셋을 선택해주세요.'),
});

export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;



