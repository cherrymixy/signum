import { Router } from 'express';
import { StorageService } from '../services/storageService';
import { sendError } from '../utils/errors';
import fs from 'fs';

const router = Router();

router.get('/:imageId', (req, res) => {
  try {
    const { imageId } = req.params;
    const imageInfo = StorageService.getImageInfo(imageId);

    if (!imageInfo) {
      return sendError(res, 'IMAGE_NOT_FOUND', '이미지를 찾을 수 없습니다.', 404);
    }

    if (!fs.existsSync(imageInfo.filePath)) {
      return sendError(res, 'IMAGE_NOT_FOUND', '이미지 파일을 찾을 수 없습니다.', 404);
    }

    res.setHeader('Content-Type', imageInfo.mimeType);
    res.sendFile(imageInfo.filePath);
  } catch (error: any) {
    console.error('Image serve error:', error);
    sendError(res, 'INTERNAL_SERVER_ERROR', '이미지를 불러오는 중 오류가 발생했습니다.', 500);
  }
});

export default router;



