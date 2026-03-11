'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { SummaryData } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: SummaryData; status: string };
    selected?: boolean;
}

export default function SummaryNode({ data, selected }: Props) {
    const c = data.content;
    const score = c.overallScore ?? 0;
    const scoreColor = score >= 70 ? '#4ade80' : score >= 40 ? '#f59e0b' : '#ef4444';

    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[280px] max-w-[340px] ${selected ? 'border-emerald-500/50' : 'border-[#2a2a2a]'
            }`} data-agent="orchestrator">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-emerald-400 !border-emerald-600" />

            {/* Header */}
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">📋</span>
                <span className="text-xs font-medium text-[#e5e5e5] flex-1">{data.title}</span>
                {c.overallScore !== undefined && (
                    <span
                        className="text-[11px] font-mono font-bold px-1.5 rounded"
                        style={{ color: scoreColor, backgroundColor: `${scoreColor}15` }}
                    >
                        {score}점
                    </span>
                )}
            </div>

            <div className="p-3 space-y-2.5">
                {/* 헤드라인 */}
                <p className="text-[12px] text-[#e5e5e5] font-medium leading-relaxed">{c.headline}</p>

                {/* 전체 평가 바 */}
                {c.overallScore !== undefined && (
                    <div className="h-2 bg-[#0a0a0a] rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full viz-bar-fill"
                            style={{
                                width: `${score}%`,
                                background: `linear-gradient(90deg, ${scoreColor}80, ${scoreColor})`,
                            }}
                        />
                    </div>
                )}

                {/* 핵심 포인트 */}
                <div className="space-y-1">
                    {c.keyPoints.map((point, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <span className="text-[9px] text-emerald-400 font-mono mt-0.5 shrink-0">{i + 1}</span>
                            <p className="text-[10px] text-[#bbb] leading-relaxed">{point}</p>
                        </div>
                    ))}
                </div>

                {/* 권장 사항 */}
                <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-md px-2.5 py-1.5">
                    <p className="text-[9px] text-emerald-400/60 uppercase tracking-wider mb-0.5">권장 사항</p>
                    <p className="text-[11px] text-emerald-300 leading-relaxed">{c.recommendation}</p>
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-emerald-400 !border-emerald-600" />
        </div>
    );
}
