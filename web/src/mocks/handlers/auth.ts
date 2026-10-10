import { api, json } from '@/mocks/http';

export const authHandlers = [
  api.post('/auth/sign-in/social', () =>
    json({ redirect: false, url: 'https://github.com/login/oauth/authorize' }),
  ),
];
