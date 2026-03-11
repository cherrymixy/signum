'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { QuestionData } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: QuestionData; status: string };
    selected?: boolean;
}

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
    exploring: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '탐색 중' },
    answered: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', label: '해결됨' },
    deferred: { color: '#888', bg: 'rgba(136,136,136,0.12)', label: '보류' },
};

export default function QuestionNode({ data, selected }: Props) {
    const c = data.content;
    const st = STATUS_STYLES[c.status] || STATUS_STYLES.exploring;

    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[240px] max-w-[280px] ${selected ? 'border-amber-500/50' : 'border-[#2a2a2a]'
            }`} data-agent="orchestrator">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-amber-400 !border-amber-600" />

            {/* Header */}
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">❓</span>
                <span className="text-xs font-medium text-[#e5e5e5] flex-1">{data.title}</span>
                <span
                    className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ color: st.color, backgroundColor: st.bg }}
                >
                    {st.label}
                </span>
            </div>

            <div className="p-3 space-y-2">
                {/* 질문 */}
                <div className="flex gap-2">
                    <div className="w-[3px] rounded-full bg-amber-500 shrink-0" />
                    <p className="text-[12px] text-amber-200 leading-relaxed font-medium">{c.question}</p>
                </div>

                {/* 답변 (있다면) */}
                {c.answer && (
                    <div className="bg-[#0a0a0a] rounded-md p-2">
                        <p className="text-[9px] text-emerald-400/60 uppercase tracking-wider mb-0.5">답변</p>
                        <p className="text-[10px] text-[#ccc] leading-relaxed">{c.answer}</p>
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-amber-400 !border-amber-600" />
        </div>
    );
}
