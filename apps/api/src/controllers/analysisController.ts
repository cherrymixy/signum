import { Request, Response } from 'express';
import { sendError } from '../utils/errors';
import { analysisRequestSchema } from '../utils/validation';
import { OpenAIService } from '../services/openaiService';
import { StorageService } from '../services/storageService';
import { v4 as uuidv4 } from 'uuid';

export async function analyzeImage(req: Request, res: Response) {
  try {
    // 입력 검증
    const validationResult = analysisRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return sendError(
        res,
        'VALIDATION_ERROR',
        firstError.message,
        400
      );
    }

    const { imageId, intentText, targetPreset, contextPreset } = validationResult.data;

    // 이미지 존재 확인
    const imageInfo = StorageService.getImageInfo(imageId);
    if (!imageInfo) {
      return sendError(res, 'IMAGE_NOT_FOUND', '분석할 이미지를 찾을 수 없습니다.', 404);
    }

    // OpenAI 분석 실행
    const result = await OpenAIService.analyzeImage(
      imageId,
      intentText,
      targetPreset,
      contextPreset
    );

    res.json({
      success: true,
      data: {
        analysisId: uuidv4(),
        result,
      },
    });
  } catch (error: any) {
    console.error('Analysis error:', error);
    
    if (error.message === 'IMAGE_NOT_FOUND') {
      return sendError(res, 'IMAGE_NOT_FOUND', '분석할 이미지를 찾을 수 없습니다.', 404);
    }
    
    if (error.message === 'ANALYSIS_FAILED' || error.code === 'insufficient_quota') {
      return sendError(res, 'ANALYSIS_FAILED', '분석 중 오류가 발생했습니다.', 500);
    }

    sendError(res, 'INTERNAL_SERVER_ERROR', '서버 내부 오류가 발생했습니다.', 500);
  }
}



