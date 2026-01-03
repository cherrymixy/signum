'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ImageUploadNodeData } from '@signum/shared';
import { uploadImage, getImageUrl } from '@/lib/api';
import { getNodeStyle } from '@/lib/nodeStyles';

interface ImageUploadNodeProps extends NodeProps {
  data: ImageUploadNodeData & {
    onUpdate: (data: Partial<ImageUploadNodeData>) => void;
  };
}

export default function ImageUploadNode({ data, type }: ImageUploadNodeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const nodeStyle = getNodeStyle(type || 'imageUpload');

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const response = await uploadImage(file);
        data.onUpdate({
          imageId: response.data.imageId,
          imageUrl: getImageUrl(response.data.imageId),
          fileName: response.data.fileName,
        });
      } catch (error) {
        console.error('Upload failed:', error);
        alert('이미지 업로드에 실패했습니다.');
      } finally {
        setUploading(false);
      }
    },
    [data]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const fakeEvent = {
          target: { files: [file] },
        } as any;
        handleFileSelect(fakeEvent);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.3)] min-w-[320px] max-w-[420px]">
      <Handle 
        type="source" 
        position={Position.Right}
        style={{ borderColor: nodeStyle.portColor }}
      />
      
      <div className="border-b border-[#2a2a2a] px-5 py-3">
        <div className="text-xs font-medium text-[#e5e5e5] tracking-wide uppercase">
          {nodeStyle.title}
        </div>
      </div>
      
      <div className="p-5">
        {data.imageUrl ? (
          <div className="space-y-3">
            <img
              src={data.imageUrl}
              alt={data.fileName || 'Uploaded image'}
              className="w-full rounded-md"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#888888] truncate flex-1">{data.fileName}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-[#666666] hover:text-[#888888] ml-2 transition-colors"
              >
                변경
              </button>
            </div>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border border-dashed border-[#2a2a2a] rounded-md p-8 text-center cursor-pointer hover:border-[#3a3a3a] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="text-[#666666] text-sm">업로드 중...</div>
            ) : (
              <>
                <div className="text-2xl mb-2 opacity-40">📤</div>
                <p className="text-sm text-[#666666]">이미지를 드롭하거나 클릭</p>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}

