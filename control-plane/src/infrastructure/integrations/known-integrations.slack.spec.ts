import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { compileIntegration } from '@infrastructure/integrations/integration.compile';
import { KnownIntegrations } from '@infrastructure/integrations/known-integrations';
import { WebhookRuntime } from '@infrastructure/integrations/webhook.runtime';
import { HttpOutbound } from '@infrastructure/outbound/http-outbound';
import { describe, expect, it, vi } from 'vitest';

const slack = () => {
  const read = compileIntegration(
    '.spotlight/integrations/slack.yml',
    new KnownIntegrations().fileFor('slack') as string,
  );

  if (!read.ok) {
    throw new Error(
      read.problems.map((each) => `${each.at} ${each.reason}`).join(', '),
    );
  }

  return read.readable;
};

const shared = {
  id: 'F0QUEUE',
  name: 'queue.png',
  mimetype: 'image/png',
  size: 48213,
  url_private_download:
    'https://files.slack.com/files-pri/T0-F0QUEUE/download/queue.png',
};

const slackAnswering = () =>
  vi.fn(async (url: string | URL | Request) =>
    String(url).includes('users.info')
      ? new Response(JSON.stringify({ ok: false }), { status: 200 })
      : new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
  );

const read = (event: Record<string, unknown>, fetch = slackAnswering()) =>
  new WebhookRuntime(
    slack(),
    WorkspaceId.of('ws_1'),
    new Map([['SLACK_BOT_TOKEN', 'xoxb-1']]),
    () => Date.now(),
    null,
    new HttpOutbound(['slack.com'], fetch),
  ).read({ headers: {}, body: { event }, raw: null });

const reply = (over: Record<string, unknown> = {}) => ({
  type: 'message',
  text: '',
  channel: 'C0REQ',
  thread_ts: '170.1',
  ts: '170.2',
  ...over,
});

describe('the Slack starter file, given files', () => {
  it('hears a thread reply that shares a file, and names the file', async () => {
    const [happened] = await read(
      reply({ subtype: 'file_share', files: [shared] }),
    );

    expect(happened?.happening.value).toBe('slack.message.replied');
    expect(
      happened?.attachments?.map(({ name, contentType, size }) => ({
        name,
        contentType,
        size,
      })),
    ).toEqual([{ name: 'queue.png', contentType: 'image/png', size: 48213 }]);
  });

  it('fetches a mention’s file from where Slack keeps it, with the bot token', async () => {
    const fetch = slackAnswering();
    const [happened] = await read(
      {
        type: 'app_mention',
        text: '<@U0SPOT> the queue looks like this',
        user: 'U0ADA',
        channel: 'C0REQ',
        ts: '170.1',
        files: [shared],
      },
      fetch,
    );

    await expect(happened?.attachments?.[0]?.fetch()).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );

    const [url, init] = fetch.mock.calls[
      fetch.mock.calls.length - 1
    ] as unknown as [string, RequestInit];
    expect(url).toBe(shared.url_private_download);
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer xoxb-1',
    );
  });

  it('carries no files where a reply shares none', async () => {
    const [happened] = await read(reply({ text: 'the queue' }));

    expect(happened?.attachments).toEqual([]);
  });

  it('still does not hear a reply being edited', async () => {
    await expect(read(reply({ subtype: 'message_changed' }))).resolves.toEqual(
      [],
    );
  });
});
