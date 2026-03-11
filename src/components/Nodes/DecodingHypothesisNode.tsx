'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { DecodingHypothesisItem } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: DecodingHypothesisItem; status: string };
    selected?: boolean;
}

// 감정 반응 키워드 → 색상
const EMOTION_COLORS: Record<string, string> = {
    '긍정': '#4ade80',
    '호감': '#4ade80',
    '공감': '#38bdf8',
    '중립': '#888888',
    '혼란': '#facc15',
    '불안': '#f97316',
    '부정': '#ef4444',
    '거부': '#ef4444',
};

function getEmotionColor(emotion: string): string {
    for (const [key, color] of Object.entries(EMOTION_COLORS)) {
        if (emotion.includes(key)) return color;
    }
    return '#38bdf8';
}

export default function DecodingHypothesisNode({ data, selected }: Props) {
    const h = data.content;
    const pct = Math.round(h.probability * 100);
    const emotionColor = getEmotionColor(h.emotionalResponse);

    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[260px] max-w-[300px] ${selected ? 'border-sky-500/50' : 'border-[#2a2a2a]'
            }`} data-agent="decoder">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-sky-400 !border-sky-600" />

            {/* Header */}
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">👁️</span>
                <span className="text-xs font-medium text-[#e5e5e5] flex-1">{data.title}</span>
            </div>

            <div className="p-3 space-y-2.5">
                {/* 확률 프로그레스 바 */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-[#666] uppercase tracking-wider">확률</span>
                        <span className="text-[12px] font-mono font-bold text-sky-400">{pct}%</span>
                    </div>
                    <div className="h-2 bg-[#0a0a0a] rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full viz-bar-fill"
                            style={{
                                width: `${pct}%`,
                                background: `linear-gradient(90deg, #0ea5e9, #38bdf8)`,
                            }}
                        />
                    </div>
                </div>

                {/* 해석 */}
                <p className="text-[11px] text-[#ddd] leading-relaxed">{h.interpretation}</p>

                {/* 근거 */}
                <div className="bg-[#0a0a0a] rounded-md p-2">
                    <p className="text-[9px] text-sky-400/60 uppercase tracking-wider mb-0.5">근거</p>
                    <p className="text-[10px] text-[#999] leading-relaxed">{h.reasoning}</p>
                </div>

                {/* 감정 반응 인디케이터 */}
                <div className="flex items-center gap-2">
                    <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: emotionColor, boxShadow: `0 0 6px ${emotionColor}60` }}
                    />
                    <span className="text-[10px] text-[#888]">감정 반응:</span>
                    <span className="text-[11px] font-medium" style={{ color: emotionColor }}>
                        {h.emotionalResponse}
                    </span>
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-sky-400 !border-sky-600" />
        </div>
    );
}
