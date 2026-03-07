import OpenAI from 'openai';
import { AgentPipelineState } from '@/types';
import { runIntentAgent } from './intentAgent';
import { runDecodingAgent } from './decodingAgent';
import { runGapAnalystAgent } from './gapAnalystAgent';
import { runEncodingSuggestionAgent } from './encodingSuggestionAgent';

export interface PipelineInput {
    imageBase64: string;
    imageMimeType: string;
    intentText: string;
    targetPreset: string;
    contextPreset: string;
}

/**
 * Orchestrator: 4개 에이전트를 순차 실행하는 파이프라인
 * onProgress 콜백으로 각 단계 완료 시 상태를 전달합니다.
 */
export async function runPipeline(
    input: PipelineInput,
    onProgress?: (state: AgentPipelineState) => void
): Promise<AgentPipelineState> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');

    const openai = new OpenAI({ apiKey });

    const state: AgentPipelineState = {
        status: 'running',
        intentStep: { status: 'idle' },
        decodingStep: { status: 'idle' },
        gapStep: { status: 'idle' },
        suggestionStep: { status: 'idle' },
    };

    // Step 1: Intent Agent
    try {
        state.intentStep.status = 'running';
        onProgress?.(structuredClone(state));

        const intentResult = await runIntentAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentText: input.intentText,
        });

        state.intentStep = { status: 'done', result: intentResult };
        onProgress?.(structuredClone(state));

        // Step 2: Decoding Agent
        state.decodingStep.status = 'running';
        onProgress?.(structuredClone(state));

        const decodingResult = await runDecodingAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentAnalysis: intentResult,
            targetPreset: input.targetPreset,
            contextPreset: input.contextPreset,
        });

        state.decodingStep = { status: 'done', result: decodingResult };
        onProgress?.(structuredClone(state));

        // Step 3: Gap Analyst Agent
        state.gapStep.status = 'running';
        onProgress?.(structuredClone(state));

        const gapResult = await runGapAnalystAgent(openai, {
            intentAnalysis: intentResult,
            decodingResult: decodingResult,
        });

        state.gapStep = { status: 'done', result: gapResult };
        onProgress?.(structuredClone(state));

        // Step 4: Encoding Suggestion Agent
        state.suggestionStep.status = 'running';
        onProgress?.(structuredClone(state));

        const suggestionResult = await runEncodingSuggestionAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentAnalysis: intentResult,
            gapAnalysis: gapResult,
        });

        state.suggestionStep = { status: 'done', result: suggestionResult };
        state.status = 'done';
        onProgress?.(structuredClone(state));

        return state;
    } catch (error: any) {
        // 실패한 단계를 기록
        if (state.intentStep.status === 'running') {
            state.intentStep = { status: 'error', error: error.message };
        } else if (state.decodingStep.status === 'running') {
            state.decodingStep = { status: 'error', error: error.message };
        } else if (state.gapStep.status === 'running') {
            state.gapStep = { status: 'error', error: error.message };
        } else if (state.suggestionStep.status === 'running') {
            state.suggestionStep = { status: 'error', error: error.message };
        }
        state.status = 'error';
        onProgress?.(structuredClone(state));
        return state;
    }
}
