'use client';

import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { DecodingAnalysisNodeData, AnalysisResult, AnalysisItem } from '@signum/shared';
import { analyzeImage, getImageUrl } from '@/lib/api';

interface DecodingAnalysisNodeProps extends NodeProps {
  data: DecodingAnalysisNodeData & {
    onUpdate: (data: Partial<DecodingAnalysisNodeData>) => void;
    connectedImageNodeId?: string;
    connectedImageNodeData?: { imageId?: string };
  };
}

const TARGET_PRESETS = [
  { value: '20s_female', label: '20대 여성' },
  { value: '30s_male', label: '30대 남성' },
  { value: 'general', label: '일반' },
  { value: 'designers', label: '디자이너' },
];

const CONTEXT_PRESETS = [
  { value: 'SNS_thumbnail', label: 'SNS 썸네일' },
  { value: 'editorial', label: '에디토리얼' },
  { value: 'poster', label: '포스터' },
  { value: 'advertisement', label: '광고' },
];

function renderAnalysisItem(item: AnalysisItem, index: number) {
  if (typeof item === 'string') {
    return <li key={index} className="text-sm text-gray-700">{item}</li>;
  }
  return (
    <li key={index} className="text-sm">
      <span className="font-medium text-gray-800">{item.title}:</span>{' '}
      <span className="text-gray-600">{item.detail}</span>
    </li>
  );
}

export default function DecodingAnalysisNode({ data }: DecodingAnalysisNodeProps) {
  const [intentText, setIntentText] = useState(data.intentText || '');
  const [targetPreset, setTargetPreset] = useState(data.targetPreset || '');
  const [contextPreset, setContextPreset] = useState(data.contextPreset || '');

  const handleAnalyze = useCallback(async () => {
    if (!data.connectedImageNodeData?.imageId) {
      data.onUpdate({
        status: 'error',
        errorMessage: '이미지 노드와 연결해주세요.',
      });
      return;
    }

    if (!intentText.trim() || !targetPreset || !contextPreset) {
      data.onUpdate({
        status: 'error',
        errorMessage: '모든 필드를 입력해주세요.',
      });
      return;
    }

    data.onUpdate({
      status: 'analyzing',
      errorMessage: undefined,
    });

    try {
      const response = await analyzeImage({
        imageId: data.connectedImageNodeData.imageId,
        intentText,
        targetPreset,
        contextPreset,
      });

      data.onUpdate({
        analysisResult: response.data.result,
        status: 'completed',
        intentText,
        targetPreset,
        contextPreset,
        errorMessage: undefined,
      });
    } catch (error: any) {
      console.error('Analysis failed:', error);
      const errorMessage =
        error.response?.data?.error?.message || '분석 중 오류가 발생했습니다.';
      data.onUpdate({
        status: 'error',
        errorMessage,
      });
    }
  }, [data, intentText, targetPreset, contextPreset]);

  return (
    <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg min-w-[320px] max-w-[400px]">
      <Handle type="target" position={Position.Left} />
      
      <div className="p-4 space-y-4">
        <div className="font-semibold text-gray-800 flex items-center gap-2">
          <span>🔍</span>
          <span>Decoding Analysis</span>
        </div>

        {data.status === 'error' && data.errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
            {data.errorMessage}
          </div>
        )}

        {!data.connectedImageNodeData?.imageId && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm text-yellow-700">
            이미지 노드와 연결해주세요.
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              의도 텍스트
            </label>
            <textarea
              value={intentText}
              onChange={(e) => setIntentText(e.target.value)}
              placeholder="이미지가 어떻게 해석될지 분석해주세요"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              타겟 프리셋
            </label>
            <select
              value={targetPreset}
              onChange={(e) => setTargetPreset(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택하세요</option>
              {TARGET_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              컨텍스트 프리셋
            </label>
            <select
              value={contextPreset}
              onChange={(e) => setContextPreset(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택하세요</option>
              {CONTEXT_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={data.status === 'analyzing'}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
          >
            {data.status === 'analyzing' ? '분석 중...' : 'Analyze'}
          </button>
        </div>

        {data.analysisResult && data.status === 'completed' && (
          <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
            <AnalysisResultView result={data.analysisResult} />
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisResultView({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-4 text-xs">
      {result.observation.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">관찰 사항</h4>
          <ul className="list-disc list-inside space-y-1">
            {result.observation.map(renderAnalysisItem)}
          </ul>
        </div>
      )}

      {result.connotation.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">함의</h4>
          <ul className="list-disc list-inside space-y-1">
            {result.connotation.map(renderAnalysisItem)}
          </ul>
        </div>
      )}

      {result.decoding_hypotheses.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">디코딩 가설</h4>
          <ul className="space-y-2">
            {result.decoding_hypotheses.map((hypothesis, index) => (
              <li key={index} className="bg-gray-50 p-2 rounded">
                <div className="font-medium text-gray-800">{hypothesis.label}</div>
                <div className="text-gray-600 text-xs mt-1">
                  확률: {(hypothesis.probability * 100).toFixed(1)}%
                </div>
                <div className="text-gray-600 text-xs mt-1">{hypothesis.rationale}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.risks.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">리스크</h4>
          <ul className="list-disc list-inside space-y-1">
            {result.risks.map(renderAnalysisItem)}
          </ul>
        </div>
      )}

      {result.edit_suggestions.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">편집 제안</h4>
          <ul className="list-disc list-inside space-y-1">
            {result.edit_suggestions.map(renderAnalysisItem)}
          </ul>
        </div>
      )}
    </div>
  );
}



