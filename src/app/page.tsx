'use client';

import React from 'react';
import AgentCanvas from '@/components/Canvas/AgentCanvas';
import InputPanel from '@/components/Panels/InputPanel';
import ActivityFeed from '@/components/Panels/ActivityFeed';
import ApprovalDock from '@/components/Panels/ApprovalDock';

export default function Home() {
  return (
    <div className="w-screen h-screen flex bg-[#0a0a0a] overflow-hidden">
      {/* 왼쪽: 입력 패널 */}
      <InputPanel />

      {/* 중앙: 에이전트 캔버스 */}
      <div className="flex-1 relative">
        <AgentCanvas />
        <ApprovalDock />
      </div>

      {/* 오른쪽: 활동 피드 */}
      <ActivityFeed />
    </div>
  );
}
