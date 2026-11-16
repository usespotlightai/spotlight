import { isOrigin } from './links';

const GRANTED = new Set(['notifications', 'clipboard-sanitized-write']);

export const grants = (
  permission: string,
  requester: string,
  origin: string,
): boolean => GRANTED.has(permission) && isOrigin(requester, origin);
