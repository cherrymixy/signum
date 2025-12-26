import { Request, Response } from 'express';
import { sendError } from '../utils/errors';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function uploadImage(req: Request, res: Response) {
  try {
    if (!req.file) {
      return sendError(res, 'INVALID_FILE', '파일이 업로드되지 않았습니다.', 400);
    }

    const imageId = path.parse(req.file.filename).name; // UUID without extension

    res.json({
      success: true,
      data: {
        imageId,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `/api/images/${imageId}`,
      },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    sendError(res, 'UPLOAD_FAILED', '파일 업로드 중 오류가 발생했습니다.', 500);
  }
}



