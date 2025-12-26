import fs from 'fs';
import path from 'path';

// apps/api/uploads 디렉토리 사용
const uploadsDir = path.resolve(process.cwd(), 'uploads');

export interface ImageAsset {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export class StorageService {
  static getImagePath(imageId: string): string | null {
    const files = fs.readdirSync(uploadsDir);
    const file = files.find((f) => f.startsWith(imageId));
    
    if (!file) {
      return null;
    }
    
    return path.join(uploadsDir, file);
  }

  static getImageInfo(imageId: string): ImageAsset | null {
    const filePath = this.getImagePath(imageId);
    
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    return {
      id: imageId,
      fileName: path.basename(filePath),
      filePath,
      mimeType: mimeTypes[ext.toLowerCase()] || 'image/jpeg',
      size: stats.size,
      uploadedAt: stats.birthtime.toISOString(),
    };
  }
}

