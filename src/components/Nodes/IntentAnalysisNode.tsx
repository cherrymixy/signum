'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { IntentAnalysis } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: IntentAnalysis; status: string };
    selected?: boolean;
}

export default function IntentAnalysisNode({ data, selected }: Props) {
    const c = data.content;
    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[260px] max-w-[300px] ${selected ? 'border-violet-500/50' : 'border-[#2a2a2a]'
            }`} data-agent="intent">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-violet-400 !border-violet-600" />
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">💡</span>
                <span className="text-xs font-medium text-[#e5e5e5]">{data.title}</span>
            </div>
            <div className="p-3 space-y-2">
                <div>
                    <p className="text-[10px] text-violet-400/80 uppercase tracking-wide mb-0.5">핵심 메시지</p>
                    <p className="text-[11px] text-[#ccc] leading-relaxed">{c.coreMessage}</p>
                </div>
                <div>
                    <p className="text-[10px] text-violet-400/80 uppercase tracking-wide mb-0.5">감성 톤</p>
                    <p className="text-[11px] text-[#ccc]">{c.emotionalTone}</p>
                </div>
                <div>
                    <p className="text-[10px] text-violet-400/80 uppercase tracking-wide mb-0.5">행동 유도</p>
                    <p className="text-[11px] text-[#ccc]">{c.callToAction}</p>
                </div>
                {c.implicitAssumptions?.length > 0 && (
                    <div>
                        <p className="text-[10px] text-violet-400/80 uppercase tracking-wide mb-0.5">암묵적 가정</p>
                        {c.implicitAssumptions.map((a, i) => (
                            <p key={i} className="text-[10px] text-[#888] leading-relaxed">• {a}</p>
                        ))}
                    </div>
                )}
            </div>
            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-violet-400 !border-violet-600" />
        </div>
    );
}
