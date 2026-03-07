'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';

interface Props {
    data: { agentId: string; title: string; content: any; status: string };
    selected?: boolean;
}

export default function ExecutionNode({ data, selected }: Props) {
    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[240px] ${selected ? 'border-pink-500/50' : 'border-[#2a2a2a]'
            }`} data-agent="executor">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-pink-400 !border-pink-600" />
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">🚀</span>
                <span className="text-xs font-medium text-[#e5e5e5]">{data.title}</span>
            </div>
            <div className="p-3">
                <p className="text-[11px] text-[#ccc]">{data.content?.summary || '수정 실행 완료'}</p>
            </div>
            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-pink-400 !border-pink-600" />
        </div>
    );
}
