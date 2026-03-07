'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { EncodingSuggestions } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: EncodingSuggestions & { proposalId: string }; status: string };
    selected?: boolean;
}

export default function RevisionProposalNode({ data, selected }: Props) {
    const s = data.content;
    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[280px] max-w-[320px] ${selected ? 'border-green-500/50' : 'border-[#2a2a2a]'
            } ${data.status === 'creating' ? 'border-green-500/30 shadow-lg shadow-green-500/10' : ''}`} data-agent="revision">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-green-400 !border-green-600" />
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">🔧</span>
                <span className="text-xs font-medium text-[#e5e5e5] flex-1">{data.title}</span>
                {data.status === 'creating' && (
                    <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 rounded animate-pulse">승인 대기</span>
                )}
            </div>
            <div className="p-3 space-y-2">
                <p className="text-[11px] text-[#ccc] leading-relaxed">{s.summary}</p>
                {s.suggestions.map((item, i) => (
                    <div key={i} className="bg-[#0a0a0a] rounded p-2 space-y-1">
                        <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] px-1 rounded ${item.priority === 'high' ? 'bg-green-500/20 text-green-400' :
                                    item.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                                        'bg-[#2a2a2a] text-[#888]'
                                }`}>{item.area}</span>
                        </div>
                        <p className="text-[10px] text-[#bbb]">{item.suggestion}</p>
                        <p className="text-[9px] text-[#666]">⚖️ {item.tradeoff}</p>
                    </div>
                ))}
            </div>
            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-green-400 !border-green-600" />
        </div>
    );
}
