import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { TEST_USER_HEADER } from './app';

export interface HeardEvent {
  readonly type: string;
  readonly data: unknown;
}

const eventOf = (block: string): HeardEvent | null => {
  let type = 'message';
  const data: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      type = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      data.push(line.slice('data:'.length).trim());
    }
  }

  if (data.length === 0) {
    return null;
  }

  try {
    return { type, data: JSON.parse(data.join('\n')) };
  } catch {
    return { type, data: data.join('\n') };
  }
};

export const watchedLive = (app: INestApplication, personId: string) => {
  const heard: HeardEvent[] = [];
  const { port } = app.getHttpServer().address() as AddressInfo;
  let buffered = '';
  let status: number | undefined;

  const call = request(
    {
      host: '127.0.0.1',
      port,
      path: '/api/me/live',
      headers: { [TEST_USER_HEADER]: personId, accept: 'text/event-stream' },
    },
    (response) => {
      status = response.statusCode;
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        buffered += chunk;
        const blocks = buffered.split('\n\n');
        buffered = blocks.pop() ?? '';

        for (const block of blocks) {
          const event = eventOf(block);

          if (event) {
            heard.push(event);
          }
        }
      });
    },
  );

  call.on('error', () => {});
  call.end();

  return {
    heard,
    status: () => status,
    of: (type: string) => heard.filter((each) => each.type === type),
    close: () => call.destroy(),
  };
};
