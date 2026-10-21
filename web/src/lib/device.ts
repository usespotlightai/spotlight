export type DeviceStatus = 'pending' | 'approved' | 'denied';

export type DeviceDecision = 'approve' | 'deny';

export const DEVICE_PATH = '/device';

export const TOO_MANY_ATTEMPTS =
  'Sorry, there were too many attempts. Please wait a few minutes and try again.';

export const devicePath = (userCode: string) =>
  `${DEVICE_PATH}?user_code=${encodeURIComponent(userCode)}`;

export const enteredUserCode = (typed: string) =>
  typed.replace(/[^a-z0-9]/gi, '').toUpperCase();

export const shownUserCode = (userCode: string) => {
  const code = enteredUserCode(userCode);

  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
};
