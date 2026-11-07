const THROTTLING = new Set([408, 425, 429]);

const SERVER_ERROR = 500;

export const isThrottling = (status: number): boolean => THROTTLING.has(status);

export const isServerError = (status: number): boolean =>
  status >= SERVER_ERROR;

export const answersTransiently = (status: number): boolean =>
  isThrottling(status) || isServerError(status);
