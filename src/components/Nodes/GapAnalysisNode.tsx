'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { GapAnalysis } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: GapAnalysis; streamingText?: string; status: string };
    selected?: boolean;
}

const SEVERITY_STYLES = {
    high: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'HIGH' },
    medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'MED' },
    low: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)', label: 'LOW' },
};

function CircularGauge({ score }: { score: number }) {
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 70 ? '#4ade80' : score >= 40 ? '#f59e0b' : '#ef4444';
    const glowColor = score >= 70 ? 'rgba(74,222,128,0.3)' : score >= 40 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';

    return (
        <div className="flex flex-col items-center">
            <svg width="72" height="72" className="viz-gauge-appear">
                <circle
                    cx="36" cy="36" r={radius}
                    fill="none" stroke="#1a1a1a" strokeWidth="5"
                />
                <circle
                    cx="36" cy="36" r={radius}
                    fill="none" stroke={color} strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 36 36)"
                    style={{
                        filter: `drop-shadow(0 0 4px ${glowColor})`,
                        transition: 'stroke-dashoffset 1s ease-out',
                    }}
                />
                <text
                    x="36" y="34" textAnchor="middle"
                    className="fill-current" style={{ fill: color, fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}
                >
                    {score}
                </text>
                <text
                    x="36" y="46" textAnchor="middle"
                    style={{ fill: '#666', fontSize: '8px', letterSpacing: '0.5px' }}
                >
                    ALIGN%
                </text>
            </svg>
        </div>
    );
}

export default function GapAnalysisNode({ data, selected }: Props) {
    const isStreaming = data.status === 'streaming' || !data.content;

    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[280px] max-w-[340px] ${selected ? 'border-orange-500/50' : 'border-[#2a2a2a]'
            }`} data-agent="gap">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-orange-400 !border-orange-600" />

            {/* Header */}
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">⚡</span>
                <span className="text-xs font-medium text-[#e5e5e5] flex-1">{data.title}</span>
                {isStreaming && (
                    <span className="text-[9px] text-orange-400 animate-pulse">분석 중</span>
                )}
            </div>

            {isStreaming ? (
                <div className="p-3 space-y-3">
                    <div className="flex gap-3 items-start">
                        <div className="w-[72px] h-[72px] rounded-full bg-[#1a1a1a] border-4 border-[#222] animate-pulse" />
                        <div className="flex-1 space-y-2 pt-1">
                            <div className="h-2 w-12 bg-[#1e1e1e] rounded animate-pulse" />
                            <div className="h-3 bg-[#1e1e1e] rounded animate-pulse" style={{ width: '85%' }} />
                            <div className="h-3 bg-[#1e1e1e] rounded animate-pulse" style={{ width: '70%' }} />
                        </div>
                    </div>
                    <div className="h-16 bg-[#0a0a0a] rounded-md animate-pulse" />
                    <div className="h-16 bg-[#0a0a0a] rounded-md animate-pulse" />
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                        <span className="text-[9px] text-[#555]">
                            Gap 탐지 중{data.streamingText ? ` · ${data.streamingText.length}자` : ''}
                        </span>
                    </div>
                </div>
            ) : (
            <div className="p-3 space-y-3">{(() => { const g = data.content; return (<>
                {/* 원형 게이지 + 핵심 발견 */}
                <div className="flex gap-3 items-start">
                    <CircularGauge score={g.overallAlignmentScore} />
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-orange-400/60 uppercase tracking-wider mb-1">핵심 발견</p>
                        <p className="text-[11px] text-[#ccc] leading-relaxed">{g.criticalFindings}</p>
                    </div>
                </div>

                {/* Gap 목록 — 심각도 바 */}
                {g.gaps.map((gap, i) => {
                    const sev = SEVERITY_STYLES[gap.severity] || SEVERITY_STYLES.low;
                    return (
                        <div key={i} className="bg-[#0a0a0a] rounded-md p-2 space-y-1.5">
                            {/* 심각도 + 차원 */}
                            <div className="flex items-center gap-2">
                                <span
                                    className="text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                                    style={{ color: sev.color, backgroundColor: sev.bg }}
                                >
                                    {sev.label}
                                </span>
                                <span className="text-[11px] text-orange-300 font-medium">{gap.dimension}</span>
                            </div>

                            {/* 의도 → 해석 흐름 */}
                            <div className="flex items-center gap-1.5">
                                <div className="flex-1 bg-[#141414] rounded px-2 py-1">
                                    <p className="text-[8px] text-violet-400/60 mb-0.5">의도</p>
                                    <p className="text-[10px] text-[#bbb]">{gap.intended}</p>
                                </div>
                                <div className="shrink-0 flex flex-col items-center">
                                    <div
                                        className="w-4 h-[2px] rounded"
                                        style={{ backgroundColor: sev.color }}
                                    />
                                    <span className="text-[7px] mt-0.5" style={{ color: sev.color }}>GAP</span>
                                </div>
                                <div className="flex-1 bg-[#141414] rounded px-2 py-1">
                                    <p className="text-[8px] text-sky-400/60 mb-0.5">해석</p>
                                    <p className="text-[10px] text-[#bbb]">{gap.decoded}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
                </>); })()}
            </div>
            )}

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-orange-400 !border-orange-600" />
        </div>
    );
}
