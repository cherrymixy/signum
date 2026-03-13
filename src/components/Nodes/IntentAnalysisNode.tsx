'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { IntentAnalysis } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: IntentAnalysis; streamingText?: string; status: string };
    selected?: boolean;
}

// 감성 톤 → 컬러·아이콘 매핑
const TONE_MAP: Record<string, { color: string; bg: string; icon: string }> = {
    '따뜻한': { color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: '🔥' },
    '차분한': { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', icon: '🌊' },
    '긴장감': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '⚡' },
    '유쾌한': { color: '#facc15', bg: 'rgba(250,204,21,0.12)', icon: '✨' },
    '진지한': { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: '🎯' },
    '감성적': { color: '#ec4899', bg: 'rgba(236,72,153,0.12)', icon: '💜' },
    '역동적': { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: '🚀' },
    '신비로운': { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '🔮' },
};

function getToneStyle(tone: string) {
    // 키워드 매칭
    for (const [key, val] of Object.entries(TONE_MAP)) {
        if (tone.includes(key)) return val;
    }
    return { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '🎨' };
}

export default function IntentAnalysisNode({ data, selected }: Props) {
    const isStreaming = data.status === 'streaming' || !data.content;
    const c = data.content as IntentAnalysis;
    const toneStyle = c ? getToneStyle(c.emotionalTone) : { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '🎨' };

    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[280px] max-w-[320px] ${selected ? 'border-violet-500/50' : 'border-[#2a2a2a]'
            }`} data-agent="intent">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-violet-400 !border-violet-600" />

            {/* Header */}
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">💡</span>
                <span className="text-xs font-medium text-[#e5e5e5]">{data.title}</span>
                {isStreaming && (
                    <span className="ml-auto text-[9px] text-violet-400 animate-pulse">분석 중</span>
                )}
            </div>

            {isStreaming ? (
                <div className="p-3 space-y-2.5">
                    <div className="h-3 bg-[#1e1e1e] rounded animate-pulse" style={{ width: '88%' }} />
                    <div className="h-3 bg-[#1e1e1e] rounded animate-pulse" style={{ width: '72%' }} />
                    <div className="h-8 bg-[#1a1a1a] border border-violet-500/10 rounded-md animate-pulse" />
                    <div className="flex flex-wrap gap-1">
                        <div className="h-4 w-16 bg-[#1e1e1e] rounded-full animate-pulse" />
                        <div className="h-4 w-20 bg-[#1e1e1e] rounded-full animate-pulse" />
                        <div className="h-4 w-14 bg-[#1e1e1e] rounded-full animate-pulse" />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
                        <span className="text-[9px] text-[#555]">
                            의도 구조화 중{data.streamingText ? ` · ${data.streamingText.length}자` : ''}
                        </span>
                    </div>
                </div>
            ) : (
            <div className="p-3 space-y-2.5">
                {/* 핵심 메시지 — 인용 블록 스타일 */}
                <div className="flex gap-2">
                    <div className="w-[3px] rounded-full bg-violet-500 shrink-0" />
                    <p className="text-[12px] text-[#e5e5e5] leading-relaxed font-medium italic">
                        "{c.coreMessage}"
                    </p>
                </div>

                {/* 감성 톤 — 컬러 pill */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#666] shrink-0">감성 톤</span>
                    <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                        style={{ color: toneStyle.color, backgroundColor: toneStyle.bg }}
                    >
                        <span className="text-[10px]">{toneStyle.icon}</span>
                        {c.emotionalTone}
                    </span>
                </div>

                {/* 행동 유도 — CTA 박스 */}
                <div className="bg-violet-500/8 border border-violet-500/20 rounded-md px-2.5 py-1.5">
                    <p className="text-[9px] text-violet-400/60 uppercase tracking-wider mb-0.5">행동 유도</p>
                    <p className="text-[11px] text-violet-300 font-medium">{c.callToAction}</p>
                </div>

                {/* 암묵적 가정 — chip badges */}
                {c.implicitAssumptions?.length > 0 && (
                    <div>
                        <p className="text-[9px] text-[#555] uppercase tracking-wider mb-1.5">암묵적 가정</p>
                        <div className="flex flex-wrap gap-1">
                            {c.implicitAssumptions.map((a, i) => (
                                <span
                                    key={i}
                                    className="text-[10px] text-[#999] bg-[#1e1e1e] border border-[#2a2a2a] rounded-full px-2 py-0.5"
                                >
                                    {a}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            )}

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-violet-400 !border-violet-600" />
        </div>
    );
}
