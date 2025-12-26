import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/errors';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err);

  if (err.type === 'entity.parse.failed') {
    return sendError(res, 'VALIDATION_ERROR', '잘못된 JSON 형식입니다.', 400);
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 'INVALID_FILE', '파일 크기가 너무 큽니다.', 400);
  }

  return sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    err.message || '서버 내부 오류가 발생했습니다.',
    500
  );
}



