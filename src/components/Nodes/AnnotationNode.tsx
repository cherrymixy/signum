'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { AnnotationData } from '@/types';
import { getAgentDef } from '@/agents/agentDefinitions';

interface Props {
    data: { agentId: string; title: string; content: AnnotationData; status: string };
    selected?: boolean;
}

export default function AnnotationNode({ data, selected }: Props) {
    const c = data.content;
    const agentDef = getAgentDef(c.annotatorAgent);

    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[200px] max-w-[260px] ${selected ? 'border-yellow-500/50' : 'border-[#2a2a2a]'
            }`} data-agent={c.annotatorAgent}>
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-yellow-400 !border-yellow-600" />

            {/* Speech bubble tail effect via CSS border trick is too complex, using a simpler header */}
            <div className="px-3 py-1.5 border-b border-[#2a2a2a] flex items-center gap-1.5">
                <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                    style={{ backgroundColor: `${agentDef.color}20`, border: `1px solid ${agentDef.color}40` }}
                >
                    {agentDef.icon}
                </div>
                <span className="text-[10px] font-medium" style={{ color: agentDef.color }}>{agentDef.name}</span>
                <span className="text-[8px] text-[#555]">의 코멘트</span>
            </div>

            <div className="p-2.5">
                <p className="text-[11px] text-[#ccc] leading-relaxed italic">"{c.comment}"</p>
            </div>

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-yellow-400 !border-yellow-600" />
        </div>
    );
}
