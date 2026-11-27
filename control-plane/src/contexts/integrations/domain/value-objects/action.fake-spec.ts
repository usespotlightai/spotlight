import { Action } from '@integrations/domain/value-objects/action.vo';

export const actionNamed = (
  name: string,
  over: { uploads?: boolean; fromNetwork?: boolean } = {},
): Action =>
  Action.of({
    name,
    fromNetwork: over.fromNetwork ?? false,
    waitsSeconds: null,
    uploads: over.uploads ? { sendsBody: false } : null,
    auth: { oauth2: false, secrets: false },
    headers: [],
    url: 'https://api.example.com',
  });
