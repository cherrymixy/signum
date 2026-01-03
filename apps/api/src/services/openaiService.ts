import OpenAI from 'openai';
import { AnalysisResult } from '@signum/shared';
import { StorageService } from './storageService';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert image decoding analyst. Analyze images and provide structured insights in Korean.

You must respond with a JSON object containing exactly these 5 fields:
1. observation: Array of strings or objects with {title, detail} - what you observe in the image
2. connotation: Array of strings or objects with {title, detail} - implied meanings and connotations
3. decoding_hypotheses: Array of objects with {label, probability (0-1), rationale} - possible interpretations
4. risks: Array of strings or objects with {title, detail} - potential risks or negative interpretations
5. edit_suggestions: Array of strings or objects with {title, detail} - suggestions for improvement

Return ONLY valid JSON, no markdown, no code blocks.`;

export class OpenAIService {
  static async analyzeImage(
    imageId: string,
    intentText: string,
    targetPreset: string,
    contextPreset: string
  ): Promise<AnalysisResult> {
    console.log(`[OpenAI] 분석 시작 - imageId: ${imageId}`);
    console.log(`[OpenAI] 파라미터 - intent: "${intentText}", target: "${targetPreset}", context: "${contextPreset}"`);

    const imageInfo = StorageService.getImageInfo(imageId);

    if (!imageInfo) {
      console.error(`[OpenAI] 이미지를 찾을 수 없음 - imageId: ${imageId}`);
      throw new Error('IMAGE_NOT_FOUND');
    }

    console.log(`[OpenAI] 이미지 정보 - path: ${imageInfo.filePath}, mimeType: ${imageInfo.mimeType}`);

    let imageBuffer: Buffer;
    try {
      imageBuffer = fs.readFileSync(imageInfo.filePath);
      console.log(`[OpenAI] 이미지 로드 성공 - size: ${imageBuffer.length} bytes`);
    } catch (fileError: any) {
      console.error(`[OpenAI] 이미지 파일 읽기 실패:`, fileError);
      throw new Error('IMAGE_FILE_READ_ERROR');
    }

    const base64Image = imageBuffer.toString('base64');

    const userPrompt = `다음 조건으로 이미지를 분석해주세요:

의도: ${intentText}
타겟 프리셋: ${targetPreset}
컨텍스트 프리셋: ${contextPreset}

위에서 요청한 JSON 형식으로 분석 결과를 반환해주세요.`;

    try {
      console.log(`[OpenAI] API 호출 시작 - model: gpt-5-nano`);
      const startTime = Date.now();

      const response = await openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageInfo.mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const elapsed = Date.now() - startTime;
      console.log(`[OpenAI] API 응답 수신 - 소요시간: ${elapsed}ms`);
      console.log(`[OpenAI] 토큰 사용량 - prompt: ${response.usage?.prompt_tokens}, completion: ${response.usage?.completion_tokens}, total: ${response.usage?.total_tokens}`);

      const content = response.choices[0]?.message?.content;

      if (!content) {
        console.error(`[OpenAI] API 응답이 비어있음 - choices:`, JSON.stringify(response.choices));
        throw new Error('EMPTY_RESPONSE');
      }

      console.log(`[OpenAI] 응답 내용 길이: ${content.length} chars`);

      let result: AnalysisResult;
      try {
        result = JSON.parse(content) as AnalysisResult;
        console.log(`[OpenAI] JSON 파싱 성공`);
      } catch (parseError: any) {
        console.error(`[OpenAI] JSON 파싱 실패:`, parseError.message);
        console.error(`[OpenAI] 원본 응답:`, content);
        throw new Error('JSON_PARSE_ERROR');
      }

      // 결과 검증 및 정규화
      const normalizedResult = {
        observation: Array.isArray(result.observation) ? result.observation : [],
        connotation: Array.isArray(result.connotation) ? result.connotation : [],
        decoding_hypotheses: Array.isArray(result.decoding_hypotheses)
          ? result.decoding_hypotheses
          : [],
        risks: Array.isArray(result.risks) ? result.risks : [],
        edit_suggestions: Array.isArray(result.edit_suggestions)
          ? result.edit_suggestions
          : [],
      };

      console.log(`[OpenAI] 분석 완료 - observations: ${normalizedResult.observation.length}, hypotheses: ${normalizedResult.decoding_hypotheses.length}`);

      return normalizedResult;
    } catch (error: any) {
      // 이미 처리된 커스텀 에러는 그대로 전달
      if (['IMAGE_NOT_FOUND', 'IMAGE_FILE_READ_ERROR', 'EMPTY_RESPONSE', 'JSON_PARSE_ERROR'].includes(error.message)) {
        throw error;
      }

      // OpenAI API 에러 상세 로깅
      console.error(`[OpenAI] API 에러 발생:`);
      console.error(`  - 에러 타입: ${error.constructor.name}`);
      console.error(`  - 메시지: ${error.message}`);

      if (error.status) {
        console.error(`  - HTTP 상태: ${error.status}`);
      }
      if (error.code) {
        console.error(`  - 에러 코드: ${error.code}`);
      }
      if (error.type) {
        console.error(`  - 에러 타입: ${error.type}`);
      }

      // API 키 문제
      if (error.status === 401 || error.code === 'invalid_api_key') {
        console.error(`[OpenAI] API 키가 유효하지 않습니다.`);
        throw new Error('INVALID_API_KEY');
      }

      // Rate limit
      if (error.status === 429) {
        console.error(`[OpenAI] Rate limit 초과`);
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      // 모델 관련 에러
      if (error.code === 'model_not_found') {
        console.error(`[OpenAI] 모델을 찾을 수 없음: gpt-5-nano`);
        throw new Error('MODEL_NOT_FOUND');
      }

      // 컨텍스트 길이 초과
      if (error.code === 'context_length_exceeded') {
        console.error(`[OpenAI] 이미지가 너무 큽니다.`);
        throw new Error('IMAGE_TOO_LARGE');
      }

      throw new Error('ANALYSIS_FAILED');
    }
  }
}



