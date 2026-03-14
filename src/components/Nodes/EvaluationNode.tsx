'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';

interface Props {
    data: { title: string; content: any; status: string };
    selected?: boolean;
}

export default function EvaluationNode({ data, selected }: Props) {
    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[240px] max-w-[320px] ${selected ? 'border-emerald-500/50' : 'border-[#2a2a2a]'
            }`}>
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-emerald-400 !border-emerald-600" />
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">📊</span>
                <span className="text-xs font-medium text-[#e5e5e5]">{data.title}</span>
            </div>
            <div className="p-3">
                <p className="text-[11px] text-[#ccc]">{data.content?.summary || '평가 결과'}</p>
            </div>
        </div>
    );
}
