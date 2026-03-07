'use client';

import React from 'react';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';

export default function ApprovalDock() {
    const approvals = useAgentCanvasStore((s) => s.approvals);
    const executeApproval = useAgentCanvasStore((s) => s.executeApproval);
    const resolveApproval = useAgentCanvasStore((s) => s.resolveApproval);

    const pending = approvals.filter((a) => a.status === 'pending');

    if (pending.length === 0) return null;

    return (
        <div className="absolute bottom-0 left-72 right-64 bg-[#0f0f0f]/95 backdrop-blur border-t border-[#1a1a1a] z-40">
            <div className="px-4 py-2 border-b border-[#1a1a1a] flex items-center gap-2">
                <span className="text-xs">🔧</span>
                <span className="text-xs font-semibold text-[#e5e5e5]">Pending Approvals</span>
                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 rounded">{pending.length}</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
                {pending.map((item) => (
                    <div key={item.proposalId} className="px-4 py-3 border-b border-[#1a1a1a] flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#ccc] font-medium mb-1">{item.title}</p>
                            <div className="space-y-1">
                                {item.suggestions.slice(0, 3).map((s, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <span className={`text-[9px] px-1 rounded ${s.priority === 'high' ? 'bg-green-500/20 text-green-400' :
                                                s.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-[#2a2a2a] text-[#888]'
                                            }`}>{s.area}</span>
                                        <span className="text-[10px] text-[#999] truncate">{s.suggestion}</span>
                                    </div>
                                ))}
                                {item.suggestions.length > 3 && (
                                    <p className="text-[9px] text-[#555]">+{item.suggestions.length - 3} more</p>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <button
                                onClick={() => executeApproval(item.proposalId)}
                                className="px-3 py-1.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                            >
                                Approve
                            </button>
                            <button
                                onClick={() => resolveApproval(item.proposalId, false)}
                                className="px-3 py-1.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
