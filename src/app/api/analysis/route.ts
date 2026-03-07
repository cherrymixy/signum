import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { AnalysisResult } from '@/types';

const SYSTEM_PROMPT = `You are an expert image decoding analyst. Analyze images and provide structured insights in Korean.

You must respond with a JSON object containing exactly these 5 fields:
1. observation: Array of strings or objects with {title, detail} - what you observe in the image
2. connotation: Array of strings or objects with {title, detail} - implied meanings and connotations
3. decoding_hypotheses: Array of objects with {label, probability (0-1), rationale} - possible interpretations
4. risks: Array of strings or objects with {title, detail} - potential risks or negative interpretations
5. edit_suggestions: Array of strings or objects with {title, detail} - suggestions for improvement

Return ONLY valid JSON, no markdown, no code blocks.`;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { imageBase64, imageMimeType, intentText, targetPreset, contextPreset } = body;

        // Validation
        if (!imageBase64 || !imageMimeType) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '이미지 데이터가 필요합니다.' } },
                { status: 400 }
            );
        }
        if (!intentText || !intentText.trim()) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '의도 텍스트를 입력해주세요.' } },
                { status: 400 }
            );
        }
        if (!targetPreset) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '타겟 프리셋을 선택해주세요.' } },
                { status: 400 }
            );
        }
        if (!contextPreset) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '컨텍스트 프리셋을 선택해주세요.' } },
                { status: 400 }
            );
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('[API] OPENAI_API_KEY is not configured');
            return NextResponse.json(
                { error: { code: 'CONFIG_ERROR', message: 'OpenAI API 키가 설정되지 않았습니다.' } },
                { status: 500 }
            );
        }

        const openai = new OpenAI({ apiKey });

        const userPrompt = `다음 조건으로 이미지를 분석해주세요:

의도: ${intentText}
타겟 프리셋: ${targetPreset}
컨텍스트 프리셋: ${contextPreset}

위에서 요청한 JSON 형식으로 분석 결과를 반환해주세요.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userPrompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${imageMimeType};base64,${imageBase64}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 4000,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
            return NextResponse.json(
                { error: { code: 'EMPTY_RESPONSE', message: 'AI 응답이 비어있습니다.' } },
                { status: 500 }
            );
        }

        let result: AnalysisResult;
        try {
            result = JSON.parse(content) as AnalysisResult;
        } catch {
            console.error('[API] JSON parse failed:', content);
            return NextResponse.json(
                { error: { code: 'JSON_PARSE_ERROR', message: '분석 결과 파싱에 실패했습니다.' } },
                { status: 500 }
            );
        }

        // Normalize result
        const normalizedResult: AnalysisResult = {
            observation: Array.isArray(result.observation) ? result.observation : [],
            connotation: Array.isArray(result.connotation) ? result.connotation : [],
            decoding_hypotheses: Array.isArray(result.decoding_hypotheses) ? result.decoding_hypotheses : [],
            risks: Array.isArray(result.risks) ? result.risks : [],
            edit_suggestions: Array.isArray(result.edit_suggestions) ? result.edit_suggestions : [],
        };

        return NextResponse.json({
            success: true,
            data: { result: normalizedResult },
        });
    } catch (error: any) {
        console.error('[API] Analysis error:', error);

        if (error.status === 401) {
            return NextResponse.json(
                { error: { code: 'INVALID_API_KEY', message: 'API 키가 유효하지 않습니다.' } },
                { status: 401 }
            );
        }
        if (error.status === 429) {
            return NextResponse.json(
                { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'API 요청 한도를 초과했습니다.' } },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: { code: 'ANALYSIS_FAILED', message: '분석 중 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
