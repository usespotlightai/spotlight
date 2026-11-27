import { HttpResponse, type StrictRequest } from 'msw';

import type { DeviceStatus } from '@/lib/device';
import { enteredUserCode } from '@/lib/device';
import { entryOf } from '@/mocks/entry';
import { api, json } from '@/mocks/http';
import { devicesWorld } from '@/mocks/world/devices';

const invalidCode = () =>
  HttpResponse.json(
    { error: 'invalid_request', error_description: 'Invalid user code' },
    { status: 400 },
  );

type DeviceDecision = { userCode: string };

const decided =
  (status: DeviceStatus) =>
  async ({ request }: { request: StrictRequest<DeviceDecision> }) => {
    const { userCode } = await request.json();
    const code = enteredUserCode(userCode);
    const { codes } = devicesWorld();

    if (codes[code] !== 'pending') {
      return invalidCode();
    }
    codes[code] = status;
    return json({ success: true });
  };

export const authHandlers = [
  api.post('/auth/sign-in/social', () =>
    json({ redirect: false, url: 'https://github.com/login/oauth/authorize' }),
  ),
  api.get('/auth/device', ({ request }) => {
    const code = enteredUserCode(
      new URL(request.url).searchParams.get('user_code') ?? '',
    );
    const status = entryOf(devicesWorld().codes, code);

    return status !== undefined
      ? json({ user_code: code, status })
      : invalidCode();
  }),
  api.post<DeviceDecision>('/auth/device/approve', decided('approved')),
  api.post<DeviceDecision>('/auth/device/deny', decided('denied')),
];
