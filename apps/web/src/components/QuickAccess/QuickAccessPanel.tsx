'use client';

import { useCallback } from 'react';
import { Node, NodeType } from '@signum/shared';
import { v4 as uuidv4 } from 'uuid';

interface QuickAccessPanelProps {
  onNodeCreate: (node: Node) => void;
}

interface TemplateCard {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  icon: string;
}

const templates: TemplateCard[] = [
  {
    id: 'image-upload',
    type: 'imageUpload',
    title: 'Image Upload',
    description: '이미지를 업로드하고 미리보기합니다',
    icon: '📷',
  },
  {
    id: 'decoding-analysis',
    type: 'decodingAnalysis',
    title: 'Decoding Analysis',
    description: '이미지를 분석하고 결과를 확인합니다',
    icon: '🔍',
  },
];

export default function QuickAccessPanel({ onNodeCreate }: QuickAccessPanelProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent, template: TemplateCard) => {
      e.dataTransfer.setData('application/reactflow', JSON.stringify(template));
      e.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 shadow-lg flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Quick Access</h2>
        <p className="text-sm text-gray-500 mt-1">템플릿을 드래그하여 캔버스에 추가하세요</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {templates.map((template) => (
          <div
            key={template.id}
            draggable
            onDragStart={(e) => handleDragStart(e, template)}
            className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-move hover:bg-gray-100 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">{template.icon}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-800">{template.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{template.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



