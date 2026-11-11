import type { NextFunction, Request, Response } from 'express';

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export const securityHeaders = (
  _request: Request,
  response: Response,
  next: NextFunction,
) => {
  response.set(SECURITY_HEADERS);
  next();
};
