'use client';

import React, { useState, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { AgentPipelineNodeData, AgentStepStatus, AgentPipelineState } from '@/types';

interface AgentPipelineNodeProps {
    data: AgentPipelineNodeData & {
        onUpdate?: (data: Partial<AgentPipelineNodeData>) => void;
        connectedImageNodeId?: string;
        connectedImageNodeData?: { imageBase64?: string; imageMimeType?: string };
    };
    selected?: boolean;
}

// 상태별 아이콘
function StatusIcon({ status }: { status: AgentStepStatus }) {
    if (status === 'idle') return <span className="text-[#555] text-xs">○</span>;
    if (status === 'running') return <span className="text-amber-400 text-xs animate-pulse">◉</span>;
    if (status === 'done') return <span className="text-emerald-400 text-xs">●</span>;
    if (status === 'error') return <span className="text-red-400 text-xs">✕</span>;
    return null;
}

// 에이전트 단계 표시 컴포넌트
function AgentStep({
    label,
    status,
    result,
    isLast = false
}: {
    label: string;
    status: AgentStepStatus;
    result?: any;
    isLast?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`${!isLast ? 'border-b border-[#2a2a2a]' : ''}`}>
            <button
                onClick={() => result && setExpanded(!expanded)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1a1a1a] transition-colors ${result ? 'cursor-pointer' : 'cursor-default'
                    }`}
            >
                <StatusIcon status={status} />
                <span className={`text-xs font-medium flex-1 ${status === 'done' ? 'text-[#ccc]' :
                        status === 'running' ? 'text-amber-300' :
                            status === 'error' ? 'text-red-400' :
                                'text-[#666]'
                    }`}>
                    {label}
                </span>
                {result && (
                    <span className="text-[#555] text-[10px]">{expanded ? '▲' : '▼'}</span>
                )}
            </button>
            {expanded && result && (
                <div className="px-3 pb-2">
                    <pre className="text-[10px] text-[#888] bg-[#111] rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

const TARGET_PRESETS = [
    { value: 'gen-z-female', label: '10~20대 여성' },
    { value: 'gen-z-male', label: '10~20대 남성' },
    { value: 'millennial', label: '30대' },
    { value: 'gen-x', label: '40~50대' },
    { value: 'general', label: '일반 대중' },
    { value: 'professional', label: '비즈니스/전문가' },
];

const CONTEXT_PRESETS = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'youtube-thumbnail', label: 'YouTube 썸네일' },
    { value: 'brand-ad', label: '브랜드 광고' },
    { value: 'presentation', label: '프레젠테이션' },
    { value: 'portfolio', label: '포트폴리오' },
    { value: 'poster', label: '포스터/전단지' },
];

export default function AgentPipelineNode({ data, selected }: AgentPipelineNodeProps) {
    const [isRunning, setIsRunning] = useState(false);

    const handleInputChange = useCallback(
        (field: string, value: string) => {
            data.onUpdate?.({ [field]: value });
        },
        [data]
    );

    const handleRunPipeline = useCallback(async () => {
        const imageBase64 = data.connectedImageNodeData?.imageBase64;
        const imageMimeType = data.connectedImageNodeData?.imageMimeType;

        if (!imageBase64 || !imageMimeType) {
            data.onUpdate?.({ status: 'error', errorMessage: '이미지 노드를 연결해주세요.' });
            return;
        }
        if (!data.intentText?.trim()) {
            data.onUpdate?.({ status: 'error', errorMessage: '의도 텍스트를 입력해주세요.' });
            return;
        }
        if (!data.targetPreset || !data.contextPreset) {
            data.onUpdate?.({ status: 'error', errorMessage: '타겟과 컨텍스트를 선택해주세요.' });
            return;
        }

        setIsRunning(true);
        data.onUpdate?.({
            status: 'running',
            errorMessage: undefined,
            pipeline: {
                status: 'running',
                intentStep: { status: 'running' },
                decodingStep: { status: 'idle' },
                gapStep: { status: 'idle' },
                suggestionStep: { status: 'idle' },
            }
        });

        try {
            const response = await fetch('/api/agents/pipeline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64,
                    imageMimeType,
                    intentText: data.intentText,
                    targetPreset: data.targetPreset,
                    contextPreset: data.contextPreset,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || '파이프라인 실행 실패');
            }

            const result = await response.json();
            const pipelineState: AgentPipelineState = result.data;

            data.onUpdate?.({
                status: pipelineState.status === 'done' ? 'completed' : 'error',
                pipeline: pipelineState,
                errorMessage: pipelineState.status === 'error' ? '일부 에이전트 실행 실패' : undefined,
            });
        } catch (error: any) {
            data.onUpdate?.({
                status: 'error',
                errorMessage: error.message || '파이프라인 실행 중 오류',
            });
        } finally {
            setIsRunning(false);
        }
    }, [data]);

    const pipeline = data.pipeline;
    const hasResults = pipeline?.status === 'done' || pipeline?.status === 'error';

    // Gap 분석 결과에서 일치도 점수 추출
    const alignmentScore = pipeline?.gapStep?.result?.overallAlignmentScore;

    return (
        <div
            className={`bg-[#141414] rounded-lg border transition-all min-w-[320px] max-w-[380px] ${selected ? 'border-violet-500/60 shadow-lg shadow-violet-500/10' : 'border-[#2a2a2a]'
                }`}
        >
            {/* 입력 핸들 */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-2 !h-2 !bg-violet-400 !border-violet-600"
            />

            {/* 헤더 */}
            <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-400" />
                <span className="text-sm font-medium text-[#e5e5e5]">Agent Pipeline</span>
                {alignmentScore !== undefined && (
                    <span className={`ml-auto text-xs font-mono px-2 py-0.5 rounded ${alignmentScore >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                            alignmentScore >= 40 ? 'bg-amber-500/20 text-amber-400' :
                                'bg-red-500/20 text-red-400'
                        }`}>
                        {alignmentScore}%
                    </span>
                )}
            </div>

            {/* 입력 영역 */}
            <div className="p-3 space-y-2 border-b border-[#2a2a2a]">
                <textarea
                    value={data.intentText || ''}
                    onChange={(e) => handleInputChange('intentText', e.target.value)}
                    placeholder="이미지를 통해 전달하려는 의도를 입력하세요..."
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-xs text-[#ccc] placeholder-[#555] resize-none focus:outline-none focus:border-violet-500/50"
                    rows={2}
                    disabled={isRunning}
                />
                <div className="flex gap-2">
                    <select
                        value={data.targetPreset || ''}
                        onChange={(e) => handleInputChange('targetPreset', e.target.value)}
                        className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-[#ccc] focus:outline-none focus:border-violet-500/50"
                        disabled={isRunning}
                    >
                        <option value="">타겟 선택</option>
                        {TARGET_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                    <select
                        value={data.contextPreset || ''}
                        onChange={(e) => handleInputChange('contextPreset', e.target.value)}
                        className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-[#ccc] focus:outline-none focus:border-violet-500/50"
                        disabled={isRunning}
                    >
                        <option value="">컨텍스트</option>
                        {CONTEXT_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 에이전트 파이프라인 상태 */}
            <div className="border-b border-[#2a2a2a]">
                <AgentStep
                    label="💡 Intent Agent — 의도 구조화"
                    status={pipeline?.intentStep?.status || 'idle'}
                    result={pipeline?.intentStep?.result}
                />
                <AgentStep
                    label="👁️ Decoding Agent — 해석 가설"
                    status={pipeline?.decodingStep?.status || 'idle'}
                    result={pipeline?.decodingStep?.result}
                />
                <AgentStep
                    label="⚡ Gap Analyst — 차이 분석"
                    status={pipeline?.gapStep?.status || 'idle'}
                    result={pipeline?.gapStep?.result}
                />
                <AgentStep
                    label="🔧 Suggestion — 수정 제안"
                    status={pipeline?.suggestionStep?.status || 'idle'}
                    result={pipeline?.suggestionStep?.result}
                    isLast
                />
            </div>

            {/* Gap 요약 (결과가 있을 때) */}
            {pipeline?.gapStep?.result && (
                <div className="p-3 border-b border-[#2a2a2a]">
                    <p className="text-[10px] text-[#888] uppercase tracking-wide mb-1">핵심 발견</p>
                    <p className="text-xs text-[#ccc]">{pipeline.gapStep.result.criticalFindings}</p>
                    {pipeline.gapStep.result.gaps.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {pipeline.gapStep.result.gaps.map((gap, i) => (
                                <div key={i} className="flex items-start gap-1.5">
                                    <span className={`text-[10px] mt-0.5 px-1 rounded ${gap.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                                            gap.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                                'bg-emerald-500/20 text-emerald-400'
                                        }`}>{gap.severity}</span>
                                    <span className="text-[10px] text-[#999]">{gap.dimension}: {gap.cause}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 제안 요약 (결과가 있을 때) */}
            {pipeline?.suggestionStep?.result && (
                <div className="p-3 border-b border-[#2a2a2a]">
                    <p className="text-[10px] text-[#888] uppercase tracking-wide mb-1">수정 제안</p>
                    <p className="text-xs text-[#ccc] mb-2">{pipeline.suggestionStep.result.summary}</p>
                    {pipeline.suggestionStep.result.suggestions.length > 0 && (
                        <div className="space-y-1.5">
                            {pipeline.suggestionStep.result.suggestions.map((s, i) => (
                                <div key={i} className="bg-[#0a0a0a] rounded p-2">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className={`text-[10px] px-1 rounded ${s.priority === 'high' ? 'bg-violet-500/20 text-violet-400' :
                                                s.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-[#2a2a2a] text-[#888]'
                                            }`}>{s.area}</span>
                                    </div>
                                    <p className="text-[10px] text-[#bbb]">{s.suggestion}</p>
                                    <p className="text-[10px] text-[#666] mt-1">⚖️ {s.tradeoff}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 에러 메시지 */}
            {data.errorMessage && (
                <div className="px-3 py-2 border-b border-[#2a2a2a]">
                    <p className="text-xs text-red-400">{data.errorMessage}</p>
                </div>
            )}

            {/* 실행 버튼 */}
            <div className="p-3">
                <button
                    onClick={handleRunPipeline}
                    disabled={isRunning}
                    className={`w-full py-2 rounded text-xs font-medium transition-all ${isRunning
                            ? 'bg-violet-500/20 text-violet-300 cursor-wait'
                            : 'bg-violet-500/30 hover:bg-violet-500/50 text-violet-200 active:scale-[0.98]'
                        }`}
                >
                    {isRunning ? 'Agent 분석 중...' : hasResults ? '다시 분석' : '🚀 Agent Pipeline 실행'}
                </button>
            </div>

            {/* 출력 핸들 */}
            <Handle
                type="source"
                position={Position.Right}
                className="!w-2 !h-2 !bg-violet-400 !border-violet-600"
            />
        </div>
    );
}
