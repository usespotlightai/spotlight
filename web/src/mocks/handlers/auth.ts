import { HttpResponse } from 'msw';
import type { DeviceStatus } from '@/lib/device';
import { enteredUserCode } from '@/lib/device';
import { api, json } from '@/mocks/http';
import { devicesWorld } from '@/mocks/world/devices';

const invalidCode = () =>
  HttpResponse.json(
    { error: 'invalid_request', error_description: 'Invalid user code' },
    { status: 400 },
  );

const decided =
  (status: DeviceStatus) =>
  async ({ request }: { request: Request }) => {
    const { userCode } = (await request.json()) as { userCode: string };
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
    const status = devicesWorld().codes[code];

    return status ? json({ user_code: code, status }) : invalidCode();
  }),
  api.post('/auth/device/approve', decided('approved')),
  api.post('/auth/device/deny', decided('denied')),
];
