'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ImageUploadNodeData } from '@signum/shared';
import { uploadImage, getImageUrl } from '@/lib/api';

interface ImageUploadNodeProps extends NodeProps {
  data: ImageUploadNodeData & {
    onUpdate: (data: Partial<ImageUploadNodeData>) => void;
  };
}

export default function ImageUploadNode({ data }: ImageUploadNodeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
    <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg min-w-[280px]">
      <Handle type="source" position={Position.Right} />
      
      <div className="p-4">
        <div className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span>📷</span>
          <span>Image Upload</span>
        </div>

        {data.imageUrl ? (
          <div className="space-y-2">
            <img
              src={data.imageUrl}
              alt={data.fileName || 'Uploaded image'}
              className="w-full h-32 object-cover rounded border border-gray-200"
            />
            <p className="text-xs text-gray-500 truncate">{data.fileName}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              다른 이미지 선택
            </button>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="text-gray-500">업로드 중...</div>
            ) : (
              <>
                <div className="text-3xl mb-2">📤</div>
                <p className="text-sm text-gray-600">클릭하거나 드래그하여 이미지 업로드</p>
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

