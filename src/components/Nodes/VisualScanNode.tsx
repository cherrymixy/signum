'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { VisualScanResult } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: VisualScanResult; streamingText?: string; status: string };
    selected?: boolean;
}

const STRENGTH_CONFIG = {
    strong: { width: '100%', color: '#f59e0b', label: 'S' },
    moderate: { width: '60%', color: '#fbbf24', label: 'M' },
    weak: { width: '30%', color: '#78716c', label: 'W' },
};

export default function VisualScanNode({ data, selected }: Props) {
    const isStreaming = data.status === 'streaming' || !data.content;

    return (
        <div
            className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[280px] max-w-[340px] ${
                selected ? 'border-amber-500/50' : 'border-[#2a2a2a]'
            }`}
            data-agent="visualScan"
        >
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-amber-400 !border-amber-600" />

            {/* Header */}
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">👁</span>
                <span className="text-xs font-medium text-[#e5e5e5] flex-1">{data.title}</span>
                {isStreaming && (
                    <span className="text-[9px] text-amber-400 animate-pulse">스캔 중</span>
                )}
            </div>

            {isStreaming ? (
                <div className="p-3 space-y-3">
                    {/* Impression skeleton */}
                    <div className="h-5 bg-[#1e1e1e] rounded animate-pulse w-3/4" />
                    {/* Signal bars skeleton */}
                    {[85, 65, 50].map((w, i) => (
                        <div key={i} className="bg-[#0a0a0a] rounded-md p-2 space-y-1.5">
                            <div className="h-2 bg-[#1e1e1e] rounded animate-pulse" style={{ width: `${w}%` }} />
                            <div className="h-1.5 bg-[#1a1a1a] rounded-full">
                                <div className="h-full bg-[#2a2a2a] rounded-full animate-pulse" style={{ width: `${w}%` }} />
                            </div>
                        </div>
                    ))}
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                        <span className="text-[9px] text-[#555]">
                            시각 신호 분석 중{data.streamingText ? ` · ${data.streamingText.length}자` : ''}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="p-3 space-y-3">
                    {/* First impression */}
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-amber-400/60 uppercase tracking-wider shrink-0">첫인상</span>
                        <span className="text-[12px] text-amber-200 font-medium">{data.content.overallImpression}</span>
                    </div>

                    {/* Color mood */}
                    <div className="flex items-start gap-2 bg-[#0a0a0a] rounded-md px-2 py-1.5">
                        <span className="text-[9px] text-amber-400/60 uppercase tracking-wider shrink-0 mt-px">색상 무드</span>
                        <span className="text-[10px] text-[#bbb] leading-relaxed">{data.content.colorMood}</span>
                    </div>

                    {/* Dominant signals */}
                    <div className="space-y-1.5">
                        <p className="text-[9px] text-[#555] uppercase tracking-wider">지배 신호</p>
                        {data.content.dominantSignals.map((sig, i) => {
                            const cfg = STRENGTH_CONFIG[sig.strength] || STRENGTH_CONFIG.moderate;
                            return (
                                <div key={i} className="bg-[#0a0a0a] rounded-md p-2 space-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="text-[7px] font-bold w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
                                            style={{ color: cfg.color, backgroundColor: `${cfg.color}20` }}
                                        >
                                            {cfg.label}
                                        </span>
                                        <span className="text-[10px] text-amber-300 font-medium flex-1 truncate">{sig.element}</span>
                                        <span className="text-[9px] text-[#666] shrink-0">{sig.emotion}</span>
                                    </div>
                                    <p className="text-[9px] text-[#888] leading-snug pl-5">{sig.decoded}</p>
                                    {/* Strength bar */}
                                    <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden ml-5">
                                        <div
                                            className="h-full rounded-full viz-bar-fill"
                                            style={{ width: cfg.width, backgroundColor: cfg.color }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Attention flow */}
                    <div className="flex items-start gap-2">
                        <span className="text-[9px] text-[#555] uppercase tracking-wider shrink-0 mt-px">시선 흐름</span>
                        <span className="text-[9px] text-[#777] leading-relaxed">{data.content.attentionFlow}</span>
                    </div>

                    {/* Unintended signals */}
                    {data.content.unintendedSignals.length > 0 && (
                        <div className="bg-red-950/20 border border-red-900/30 rounded-md p-2 space-y-1">
                            <p className="text-[9px] text-red-400/70 uppercase tracking-wider flex items-center gap-1">
                                <span>⚠</span> 의도치 않은 신호
                            </p>
                            {data.content.unintendedSignals.map((s, i) => (
                                <p key={i} className="text-[9px] text-red-300/80 leading-snug">· {s}</p>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-amber-400 !border-amber-600" />
        </div>
    );
}
