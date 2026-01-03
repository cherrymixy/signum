'use client';

import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { DecodingAnalysisNodeData, AnalysisResult, AnalysisItem } from '@signum/shared';
import { analyzeImage, getImageUrl } from '@/lib/api';
import { getNodeStyle } from '@/lib/nodeStyles';

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
  { value: 'children', label: '어린이' },
];

const CONTEXT_PRESETS = [
  { value: 'SNS_thumbnail', label: 'SNS 썸네일' },
  { value: 'editorial', label: '에디토리얼' },
  { value: 'poster', label: '포스터' },
  { value: 'advertisement', label: '광고' },
  { value: 'fairy_tale', label: '동화' },
];

function renderAnalysisItem(item: AnalysisItem, index: number) {
  if (typeof item === 'string') {
    return <li key={index} className="text-sm text-[#cccccc] leading-relaxed">{item}</li>;
  }
  return (
    <li key={index} className="text-sm leading-relaxed">
      <span className="font-medium text-[#e5e5e5]">{item.title}:</span>{' '}
      <span className="text-[#aaaaaa]">{item.detail}</span>
    </li>
  );
}

export default function DecodingAnalysisNode({ data, type }: DecodingAnalysisNodeProps) {
  const [intentText, setIntentText] = useState(data.intentText || '');
  const [targetPreset, setTargetPreset] = useState(data.targetPreset || '');
  const [contextPreset, setContextPreset] = useState(data.contextPreset || '');
  const nodeStyle = getNodeStyle(type || 'decodingAnalysis');

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
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.3)] min-w-[360px] max-w-[480px]">
      <Handle 
        type="target" 
        position={Position.Left}
        style={{ borderColor: nodeStyle.portColor }}
      />
      
      <div className="border-b border-[#2a2a2a] px-6 py-3">
        <div className="text-xs font-medium text-[#e5e5e5] tracking-wide uppercase">
          {nodeStyle.title}
        </div>
      </div>
      
      <div className="p-6 space-y-5">
        {data.status === 'error' && data.errorMessage && (
          <div className="bg-[#2a1a1a] border border-[#4a2a2a] rounded-md p-3 text-sm text-[#cc6666]">
            {data.errorMessage}
          </div>
        )}

        {!data.connectedImageNodeData?.imageId && (
          <div className="bg-[#2a2a1a] border border-[#4a4a2a] rounded-md p-3 text-sm text-[#ccaa66]">
            이미지 노드와 연결해주세요.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <textarea
              value={intentText}
              onChange={(e) => setIntentText(e.target.value)}
              placeholder="의도 텍스트를 입력하세요"
              className="w-full px-4 py-3 text-sm bg-[#0f0f0f] border border-[#2a2a2a] rounded-md text-[#e5e5e5] placeholder-[#555555] focus:outline-none focus:border-[#404040] resize-none transition-colors"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <select
              value={targetPreset}
              onChange={(e) => setTargetPreset(e.target.value)}
              className="flex-1 px-3 py-2 text-sm bg-[#0f0f0f] border border-[#2a2a2a] rounded-md text-[#e5e5e5] focus:outline-none focus:border-[#404040] transition-colors"
            >
              <option value="" className="bg-[#1a1a1a]">타겟</option>
              {TARGET_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value} className="bg-[#1a1a1a]">
                  {preset.label}
                </option>
              ))}
            </select>

            <select
              value={contextPreset}
              onChange={(e) => setContextPreset(e.target.value)}
              className="flex-1 px-3 py-2 text-sm bg-[#0f0f0f] border border-[#2a2a2a] rounded-md text-[#e5e5e5] focus:outline-none focus:border-[#404040] transition-colors"
            >
              <option value="" className="bg-[#1a1a1a]">컨텍스트</option>
              {CONTEXT_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value} className="bg-[#1a1a1a]">
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={data.status === 'analyzing'}
            className="w-full px-4 py-2.5 bg-[#2a2a2a] text-[#888888] rounded-md hover:bg-[#333333] hover:text-[#aaaaaa] disabled:bg-[#1a1a1a] disabled:text-[#555555] disabled:cursor-not-allowed text-sm transition-colors"
          >
            {data.status === 'analyzing' ? '분석 중...' : 'Analyze'}
          </button>
        </div>

        {data.analysisResult && data.status === 'completed' && (
          <div className="mt-5 space-y-4 border-t border-[#2a2a2a] pt-5">
            <AnalysisResultView result={data.analysisResult} />
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisResultView({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-5 text-sm">
      {result.observation.length > 0 && (
        <div>
          <h4 className="font-medium text-[#e5e5e5] mb-3 text-xs tracking-wide uppercase">관찰 사항</h4>
          <ul className="space-y-2 pl-0 list-none">
            {result.observation.map(renderAnalysisItem)}
          </ul>
        </div>
      )}

      {result.connotation.length > 0 && (
        <div>
          <h4 className="font-medium text-[#e5e5e5] mb-3 text-xs tracking-wide uppercase">함의</h4>
          <ul className="space-y-2 pl-0 list-none">
            {result.connotation.map(renderAnalysisItem)}
          </ul>
        </div>
      )}

      {result.decoding_hypotheses.length > 0 && (
        <div>
          <h4 className="font-medium text-[#e5e5e5] mb-3 text-xs tracking-wide uppercase">디코딩 가설</h4>
          <ul className="space-y-3">
            {result.decoding_hypotheses.map((hypothesis, index) => (
              <li key={index} className="bg-[#0f0f0f] border border-[#2a2a2a] p-3 rounded-md">
                <div className="font-medium text-[#e5e5e5] mb-1">{hypothesis.label}</div>
                <div className="text-[#888888] text-xs mb-2">
                  확률: {(hypothesis.probability * 100).toFixed(1)}%
                </div>
                <div className="text-[#aaaaaa] text-xs leading-relaxed">{hypothesis.rationale}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.risks.length > 0 && (
        <div>
          <h4 className="font-medium text-[#e5e5e5] mb-3 text-xs tracking-wide uppercase">리스크</h4>
          <ul className="space-y-2 pl-0 list-none">
            {result.risks.map(renderAnalysisItem)}
          </ul>
        </div>
      )}

      {result.edit_suggestions.length > 0 && (
        <div>
          <h4 className="font-medium text-[#e5e5e5] mb-3 text-xs tracking-wide uppercase">편집 제안</h4>
          <ul className="space-y-2 pl-0 list-none">
            {result.edit_suggestions.map(renderAnalysisItem)}
          </ul>
        </div>
      )}
    </div>
  );
}



