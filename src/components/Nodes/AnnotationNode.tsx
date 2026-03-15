'use client';

import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { AnnotationData } from '@/types';
import { getAgentDef } from '@/agents/agentDefinitions';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';

interface Props {
    id: string;
    data: { agentId?: string; title: string; content: AnnotationData; status: string };
    selected?: boolean;
}

export default function AnnotationNode({ id, data, selected }: Props) {
    const c = data.content;
    const isHuman = !data.agentId || data.agentId === 'human';
    const agentDef = isHuman ? getAgentDef('human') : getAgentDef(c.annotatorAgent);
    const updateNodeData = useAgentCanvasStore((s) => s.updateNodeData);
    const [text, setText] = useState(c.comment || '');

    const handleBlur = () => {
        updateNodeData(id, { content: { ...c, comment: text } });
    };

    return (
        <div
            className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[200px] max-w-[280px] ${
                selected ? 'border-yellow-500/50' : 'border-[#2a2a2a]'
            }`}
        >
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-yellow-400 !border-yellow-600" />

            <div className="px-3 py-1.5 border-b border-[#2a2a2a] flex items-center gap-1.5">
                <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                    style={{ backgroundColor: `${agentDef.color}20`, border: `1px solid ${agentDef.color}40` }}
                >
                    {agentDef.icon}
                </div>
                <span className="text-[10px] font-medium" style={{ color: agentDef.color }}>{agentDef.name}</span>
                {!isHuman && <span className="text-[8px] text-[#555]">의 코멘트</span>}
                {isHuman && <span className="text-[8px] text-[#555]">의 메모</span>}
            </div>

            <div className="p-2.5">
                {isHuman ? (
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onBlur={handleBlur}
                        placeholder="메모를 입력하세요..."
                        className="w-full bg-transparent text-[11px] text-[#ccc] leading-relaxed resize-none focus:outline-none placeholder-[#444] min-h-[60px]"
                        rows={3}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <p className="text-[11px] text-[#ccc] leading-relaxed italic">"{c.comment}"</p>
                )}
            </div>

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-yellow-400 !border-yellow-600" />
        </div>
    );
}
