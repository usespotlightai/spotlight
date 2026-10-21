import type { DeviceStatus } from '@/lib/device';
import { perWorld } from '@/mocks/world';

export const DEVICE_CODES: Record<string, DeviceStatus> = {
  WDJBMJHT: 'pending',
  QPRNKZ4V: 'approved',
  HX7MCL2R: 'denied',
};

export const devicesWorld = perWorld(() => ({
  codes: structuredClone(DEVICE_CODES),
}));
