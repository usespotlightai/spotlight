import { describe, expect, it } from 'vitest';
import { client } from '@/lib/api/client.gen';

describe('the API client', () => {
  it('names the web app as the client, keeping the JSON default', () => {
    const headers = new Headers(client.getConfig().headers as HeadersInit);

    expect(headers.get('Spotlight-Client')).toBe('web');
    expect(headers.get('Content-Type')).toBe('application/json');
  });
});
