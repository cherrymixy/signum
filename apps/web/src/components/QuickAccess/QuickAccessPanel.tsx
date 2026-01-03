'use client';

import { useCallback, useState } from 'react';
import { Node, NodeType } from '@signum/shared';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';

interface QuickAccessPanelProps {
  onNodeCreate: (node: Node) => void;
  isDarkMode?: boolean;
}

// 테마에 따른 클래스 이름 헬퍼
function getThemeClasses(isDark: boolean) {
  return {
    bg: isDark ? 'bg-[#0f0f0f]' : 'bg-[#f5f5f5]',
    border: isDark ? 'border-[#1a1a1a]' : 'border-[#e5e5e5]',
    text: isDark ? 'text-[#e5e5e5]' : 'text-[#1a1a1a]',
    textSecondary: isDark ? 'text-[#888888]' : 'text-[#666666]',
    cardBg: isDark ? 'bg-[#1a1a1a]' : 'bg-white',
    cardBorder: isDark ? 'border-[#2a2a2a]' : 'border-[#e5e5e5]',
    hoverCardBg: isDark ? 'hover:bg-[#222222]' : 'hover:bg-[#f9f9f9]',
    hoverCardBorder: isDark ? 'hover:border-[#3a3a3a]' : 'hover:border-[#d0d0d0]',
    iconColor: isDark ? 'text-[#888888]' : 'text-[#666666]',
  };
}

interface TemplateCard {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  icon: React.ReactNode;
}

// Image 아이콘 (라인 스타일)
const ImageIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

// Decode 아이콘 (라인 스타일)
const DecodeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

const templates: TemplateCard[] = [
  {
    id: 'image-upload',
    type: 'imageUpload',
    title: 'Image',
    description: '이미지 업로드',
    icon: <ImageIcon />,
  },
  {
    id: 'decoding-analysis',
    type: 'decodingAnalysis',
    title: 'Decode',
    description: '이미지 해석',
    icon: <DecodeIcon />,
  },
];

export default function QuickAccessPanel({ onNodeCreate, isDarkMode = true }: QuickAccessPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const theme = getThemeClasses(isDarkMode);

  const handleDragStart = useCallback(
    (e: React.DragEvent, template: TemplateCard) => {
      e.dataTransfer.setData('application/reactflow', JSON.stringify(template));
      e.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div
      className={`h-full ${theme.bg} border-r ${theme.border} flex flex-col transition-all duration-300 ${
        isExpanded ? 'w-80' : 'w-16'
      }`}
    >
      {/* 로고 영역 */}
      <div className="p-4">
        <button
          onClick={toggleExpanded}
          className="w-full flex items-center justify-center hover:opacity-80 transition-opacity"
        >
          <Image
            src="/logo.png"
            alt="Signum"
            width={24}
            height={24}
            className="w-6 h-6"
          />
        </button>
      </div>

      {/* 퀵 액세스 영역 */}
      {isExpanded && (
        <>
          <div className="p-4">
            <h2 className={`text-xs font-medium ${theme.textSecondary} tracking-wide uppercase mb-3`}>
              Quick Access
            </h2>
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, template)}
                  className="p-3 cursor-move group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 ${theme.iconColor} opacity-40 group-hover:opacity-80 transition-opacity flex-shrink-0`}>
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-medium ${theme.text} text-sm`}>{template.title}</h3>
                      <p className={`text-xs ${theme.textSecondary} mt-0.5`}>{template.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 축소 상태일 때 아이콘만 표시 */}
      {!isExpanded && (
        <div className="flex-1 flex flex-col items-center pt-4 space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              draggable
              onDragStart={(e) => handleDragStart(e, template)}
              className="w-10 h-10 flex items-center justify-center cursor-move group"
              title={template.title}
            >
              <div className={`w-5 h-5 ${theme.iconColor} opacity-40 group-hover:opacity-80 transition-opacity`}>
                {template.icon}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



