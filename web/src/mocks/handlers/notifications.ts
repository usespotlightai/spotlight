import { api, json, noContent } from '@/mocks/http';

const PUSH_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

export const notificationsHandlers = [
  api.get('/me/notifications/push-key', () => json({ publicKey: PUSH_KEY })),
  api.put('/me/push-subscriptions', () => noContent()),
  api.delete('/me/push-subscriptions', () => noContent()),
];
