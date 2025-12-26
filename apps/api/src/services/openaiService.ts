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
    const imageInfo = StorageService.getImageInfo(imageId);
    
    if (!imageInfo) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    const imageBuffer = fs.readFileSync(imageInfo.filePath);
    const base64Image = imageBuffer.toString('base64');

    const userPrompt = `다음 조건으로 이미지를 분석해주세요:

의도: ${intentText}
타겟 프리셋: ${targetPreset}
컨텍스트 프리셋: ${contextPreset}

위에서 요청한 JSON 형식으로 분석 결과를 반환해주세요.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
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

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('OpenAI API 응답이 비어있습니다.');
      }

      const result = JSON.parse(content) as AnalysisResult;

      // 결과 검증 및 정규화
      return {
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
    } catch (error: any) {
      console.error('OpenAI API Error:', error);
      
      if (error.message === 'IMAGE_NOT_FOUND') {
        throw error;
      }
      
      throw new Error('ANALYSIS_FAILED');
    }
  }
}



