import { Response } from 'express';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400
) {
  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  } as ErrorResponse);
}



