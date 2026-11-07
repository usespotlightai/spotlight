import { unscoped } from '@identity/application/ports/workspace-outbound-scope.fake-spec';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type {
  CallAuth,
  Credentials,
} from '@integrations/application/ports/integration-runtime.port';
import { noFiles } from '@integrations/application/ports/notice-file-reader.fake-spec';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import type { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import { NotifyTask } from '@integrations/application/services/notify-task.service';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { TaskNotices } from '@integrations/infrastructure/acl/task-notices.adapter';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import { WebInboxLinks } from '@integrations/infrastructure/links/web-inbox-links';
import {
  HttpOutbound,
  type OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { noNetwork } from '@integrations/infrastructure/outbound/network-outbound.fake-spec';
import { unlimited } from '@integrations/infrastructure/outbound/outbound-limits.fake-spec';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { clientsFrom } from '@integrations/integrations.clients.fake-spec';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
import {
  callingNoServer,
  discoveringNothing,
} from '@integrations/integrations.mcp.fake-spec';
import {
  callAuthFor,
  injecting,
} from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
import type { TaskLinksPort } from '@work/application/ports/task-links.port';
import { describe, expect, it, vi } from 'vitest';

const taskLinks: TaskLinksPort = {
  taskPage: (slug, teamId, taskId) =>
    `https://app.example/w/${slug}/team/${teamId}/tasks/${taskId}`,
  conversationPage: (slug, conversationId) =>
    `https://app.example/w/${slug}/inbox/${conversationId}`,
  chatPage: (slug, teamId, chatId) =>
    `https://app.example/w/${slug}/team/${teamId}/agent/${chatId}`,
};

const taskNotices = (...args: ConstructorParameters<typeof NotifyTask>) =>
  new TaskNotices(new NotifyTask(...args));

const expressions = new CelExpressionEngine();

const runtimeWith = (
  outbound: unknown,
  exchange: unknown = {},
  clients: OAuth2ClientsPort = clientsFrom(),
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(expressions, operationsContaining()),
    outbound as HttpOutbound,
    clients,
    exchange as OAuth2Exchange,
    discoveringNothing(),
    callingNoServer(),
    unlimited,
    unscoped,
    noNetwork,
    noFiles,
  );

const _NOW = new Date('2026-09-07T10:00:00.000Z');

const slack = (headers = '') => `
integration: slack
actions:
  post-message:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
${headers}      body: '\${{ {"channel": target.channel, "thread_ts": target.thread, "text": ask.body} }}'
      expect:
        success: '\${{ response.ok }}'
      capture:
        thread: '\${{ response.ts }}'
  acknowledge:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
${headers}      body: '\${{ {"channel": target.channel, "thread_ts": target.thread, "text": dyn("On it.")} }}'
      expect:
        success: '\${{ response.ok }}'
on:
  task.opened:
    - action: acknowledge
      to:
        channel: '\${{ task.marks["slack.channel"] }}'
        thread: '\${{ task.marks["slack.thread"] }}'
      routes:
        delivery: C0DELIVERY
  task.asked:
    - action: post-message
      to:
        channel: '\${{ task.marks["slack.channel"] }}'
        thread: '\${{ task.marks["slack.thread"] }}'
      routes:
        delivery: C0DELIVERY
      mark:
        - kind: slack.thread
          value: '\${{ capture.thread }}'
`;

const READS_A_SECRET = `      auth:
        secrets: [secret.SLACK_BOT_TOKEN]
`;

const asked = (
  marks: Record<string, string> = {},
  awaitsApproval = false,
): IntegrationTaskViewDto => ({
  taskId: 'task_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  title: 'Drain the queue',
  pullRequest: null,
  line: 'delivery',
  station: 'Triage',
  stationKey: 'triage',
  marks,
  waiting: {
    conversationId: 'task_1:1',
    body: 'Which queue should I drain?',
    awaitsApproval,
    attachments: [],
  },
});

const notifying = (
  reply: OutboundResult = {
    ok: true,
    status: 200,
    response: { ok: true, ts: '170.9' },
    capture: { thread: '170.9' },
  },
  file = slack(),
  injection: SecretInjectionPort = injecting().injection,
) => {
  const run = vi.fn(
    async (
      _action: unknown,
      _against: Record<string, unknown>,
      _credentials?: Credentials,
    ) => reply,
  );

  const notifier = taskNotices(
    {
      ofTeam: vi.fn(async () => [defined(file)]),
    } as unknown as DefinedIntegrationsPort,
    runtimeWith({ run } as unknown as HttpOutbound),
    callAuthFor(injection),
    new WebInboxLinks(
      { slugOf: vi.fn(async () => 'acme') } as unknown as WorkspaceReaderPort,
      taskLinks,
    ),
    { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

  return { notifier, run };
};

describe('TaskNotices', () => {
  it('posts a routed line’s ask to its channel, with the ask body and a link', async () => {
    const { notifier, run } = notifying();

    await notifier.notify(asked(), 'task.asked');

    const action = run.mock.calls[0]?.[1] as {
      ask: { body: string; link: string };
      target: { channel?: string; thread?: string };
    };
    expect(action.target.channel).toBe('C0DELIVERY');
    expect(action.target.thread).toBeUndefined();
    expect(action.ask.body).toBe('Which queue should I drain?');
    expect(action.ask.link).toContain('/w/acme/inbox/task_1:');
  });

  it('gives the action the task’s title, address and pull request', async () => {
    const { notifier, run } = notifying();

    await notifier.notify(
      { ...asked(), pullRequest: 'https://github.com/acme/api/pull/9' },
      'task.asked',
    );

    const action = run.mock.calls[0]?.[1] as {
      task: { title: string; url: string | null; pullRequest: string | null };
    };
    expect(action.task.title).toBe('Drain the queue');
    expect(action.task.url).toContain('/tasks/task_1');
    expect(action.task.pullRequest).toBe('https://github.com/acme/api/pull/9');
  });

  it('tells the service where to approve or reject a tool call, since it cannot be decided there', async () => {
    const { notifier, run } = notifying();

    await notifier.notify(asked({}, true), 'task.asked');

    const action = run.mock.calls[0]?.[1] as { ask: { body: string } };
    expect(action.ask.body).toBe(
      'Which queue should I drain?\n\nApprove or reject it in Spotlight: https://app.example/w/acme/inbox/task_1:1',
    );
  });

  it('posts into the origin thread when the task carries one, over the route', async () => {
    const { notifier, run } = notifying();

    await notifier.notify(
      asked({ 'slack.thread': '170.1', 'slack.channel': 'C0REQ' }),
      'task.asked',
    );

    const action = run.mock.calls[0]?.[1] as {
      target: { channel?: string; thread?: string };
    };
    expect(action.target.channel).toBe('C0REQ');
    expect(action.target.thread).toBe('170.1');
  });

  it('hands back the thread it captured, for the caller to record', async () => {
    const { notifier } = notifying();

    const marks = await notifier.notify(asked(), 'task.asked');

    expect(marks.map((each) => `${each.kind}:${each.value}`)).toContain(
      'slack.thread:170.9',
    );
  });

  it('stores no marks where the service answers the post with an error', async () => {
    const { notifier } = notifying({
      ok: false,
      status: 200,
      response: { ok: false },
      capture: {},
    });

    expect(await notifier.notify(asked(), 'task.asked')).toEqual([]);
  });

  it('lets the post inject the workspace’s secrets as Spotlight’s own', async () => {
    const { injection, forSpotlight } = injecting({
      SLACK_BOT_TOKEN: { host: 'slack.com', value: 'xoxb-1' },
    });
    const { notifier, run } = notifying(
      undefined,
      slack(READS_A_SECRET),
      injection,
    );

    await notifier.notify(asked({ 'slack.thread': '170.1' }), 'task.asked');

    const credentials = run.mock.calls[0]?.[2] as Credentials;
    await credentials.injectedFor('https://slack.com/api/chat.postMessage', [
      SecretName.of('SLACK_BOT_TOKEN'),
    ]);

    expect(forSpotlight).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      secrets: ['SLACK_BOT_TOKEN'],
      url: 'https://slack.com/api/chat.postMessage',
    });
  });

  it('runs the binding for the event it is given', async () => {
    const { notifier, run } = notifying();
    const opened = asked({ 'slack.thread': '170.1', 'slack.channel': 'C0REQ' });

    await notifier.notify(opened, 'task.opened');
    expect(run).toHaveBeenCalledTimes(1);

    run.mockClear();
    await notifier.notify(opened, 'task.failed');
    expect(run).not.toHaveBeenCalled();
  });
});

const SHOT = {
  id: 'file_1',
  name: 'shot.png',
  contentType: 'image/png',
  size: 3,
};

const LOG = {
  id: 'file_2',
  name: 'run.log',
  contentType: 'text/plain',
  size: 5,
};

const UPLOADING = `
integration: slack
actions:
  post-question:
    uploads:
      each: '\${{ ask.attachments.filter(file, file.type.startsWith("image/")) }}'
      prepare:
        method: GET
        url: https://slack.com/api/files.getUploadURLExternal
        query:
          filename: '\${{ file.name }}'
          length: '\${{ string(file.size) }}'
        expect:
          success: '\${{ response.ok }}'
        capture:
          url: '\${{ response.upload_url }}'
          id: '\${{ response.file_id }}'
      send:
        method: POST
        url: '\${{ prepared.url }}'
      complete:
        method: POST
        url: https://slack.com/api/files.completeUploadExternal
        body: '\${{ {"files": uploaded.map(each, {"id": each.prepared.id, "title": each.name})} }}'
        expect:
          success: '\${{ response.ok }}'
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      body: '\${{ {"channel": target.channel, "text": ask.body, "blocks": uploaded.map(each, {"type": "image", "slack_file": {"id": each.prepared.id}, "alt_text": each.name})} }}'
      expect:
        success: '\${{ response.ok }}'
on:
  task.asked:
    - action: post-question
      to:
        channel: '\${{ task.marks["slack.channel"] }}'
`;

const READY = UPLOADING.replace(
  '    request:\n',
  () => `      ready:
        method: GET
        url: https://slack.com/api/files.info
        query:
          file: '\${{ prepared.id }}'
        expect:
          success: '\${{ response.ok && has(response.file.mimetype) }}'
        attempts: 3
    request:
`,
);

const withFiles = (
  attachments: NonNullable<IntegrationTaskViewDto['waiting']>['attachments'],
): IntegrationTaskViewDto => {
  const task = asked({ 'slack.channel': 'C0REQ' });

  return task.waiting
    ? { ...task, waiting: { ...task.waiting, attachments } }
    : task;
};

type Readiness = 'ready' | 'unready' | 'lost' | 'forbidden';

const SECOND_SHOT = { ...SHOT, id: 'file_3', name: 'second.png' };

const readied = (
  run: ReturnType<typeof uploading>['run'],
): { file: string; prepared: unknown }[] =>
  run.mock.calls
    .filter(([action]) => 'attempts' in action)
    .map(([, against]) => ({
      file: (against.file as { name: string }).name,
      prepared: against.prepared,
    }));

const uploading = (
  sendStatus = 200,
  file = UPLOADING,
  images: 'shown' | 'refused' | 'lost' = 'shown',
  callAuth: CallAuthResolver = callAuthFor(injecting().injection),
  readiness: (name: string, check: number) => Readiness = () => 'ready',
) => {
  const checks = new Map<string, number>();
  const answered = (response: unknown, capture = {}): OutboundResult => ({
    ok: true,
    status: 200,
    response,
    capture,
  });
  const run = vi.fn(
    async (
      action: object,
      against: Record<string, unknown>,
    ): Promise<OutboundResult> => {
      const file = against.file as { name: string } | undefined;

      if ('attempts' in action && file) {
        const check = (checks.get(file.name) ?? 0) + 1;
        checks.set(file.name, check);
        const answer = readiness(file.name, check);

        if (answer === 'lost') {
          throw new Error('socket hang up');
        }

        if (answer === 'forbidden') {
          return {
            ok: false,
            status: 403,
            response: { ok: false, error: 'forbidden' },
            capture: {},
          };
        }

        return answer === 'ready'
          ? answered({ ok: true, file: { mimetype: 'image/png' } })
          : {
              ok: false,
              status: 200,
              response: { ok: true, file: {} },
              capture: {},
            };
      }

      if (file && !('prepared' in against)) {
        return answered(
          { ok: true },
          {
            url: `https://files.slack.com/upload/${file.name}`,
            id: `F_${file.name}`,
          },
        );
      }

      const shown = (against.uploaded as readonly unknown[] | undefined) ?? [];

      if (!('uploads' in action) || images === 'shown' || shown.length === 0) {
        return answered({ ok: true });
      }

      if (images === 'lost') {
        throw new Error('socket hang up');
      }

      return {
        ok: false,
        status: 200,
        response: { ok: false, error: 'invalid_blocks' },
        capture: {},
      };
    },
  );
  const upload = vi.fn(
    async (
      _request: unknown,
      against: Record<string, unknown>,
      _credentials: Credentials,
      _file: { bytes: Uint8Array; type: string },
    ): Promise<OutboundResult> => {
      const status = against.connection === 'at-old' ? 401 : sendStatus;

      return { ok: status === 200, status, response: 'OK', capture: {} };
    },
  );
  const open = vi.fn(async () => new Uint8Array([1, 2, 3]));
  const sleep = vi.fn(async () => {});
  const warn = vi.fn();

  const notifier = taskNotices(
    {
      ofTeam: vi.fn(async () => [defined(file)]),
    } as unknown as DefinedIntegrationsPort,
    new CompiledIntegrationRuntime(
      new IntegrationReader(expressions, operationsContaining()),
      { run, upload } as unknown as HttpOutbound,
      clientsFrom(),
      {} as OAuth2Exchange,
      discoveringNothing(),
      callingNoServer(),
      unlimited,
      unscoped,
      noNetwork,
      { open },
      sleep,
    ),
    callAuth,
    new WebInboxLinks(
      { slugOf: vi.fn(async () => 'acme') } as unknown as WorkspaceReaderPort,
      taskLinks,
    ),
    { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

  return { notifier, run, upload, open, sleep, warn };
};

describe('TaskNotices uploads', () => {
  it('uploads the ask’s images before it posts, and gives the post what each upload captured', async () => {
    const { notifier, run, upload, open } = uploading();

    await notifier.notify(withFiles([SHOT, LOG]), 'task.asked');

    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith('task_1', 'file_1');
    expect(upload).toHaveBeenCalledOnce();
    const [, sentTo, , sent] = upload.mock.calls[0] ?? [];
    expect(sentTo).toMatchObject({
      prepared: { url: 'https://files.slack.com/upload/shot.png' },
    });
    expect(sent).toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      type: 'image/png',
    });

    const posted = run.mock.calls[run.mock.calls.length - 1]?.[1] as {
      uploaded: { name: string; prepared: { id: string } }[];
    };
    expect(run).toHaveBeenCalledTimes(3);
    expect(
      posted.uploaded.map((each) => `${each.name}:${each.prepared.id}`),
    ).toEqual(['shot.png:F_shot.png']);
  });

  it('posts with nothing uploaded where the ask has no files', async () => {
    const { notifier, run, upload } = uploading();

    await notifier.notify(withFiles([]), 'task.asked');

    expect(upload).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0]?.[1]).toMatchObject({ uploaded: [] });
  });

  it('sends only files of the notice, whatever the expression lists', async () => {
    const { notifier, open, upload } = uploading(
      200,
      UPLOADING.replace(
        'ask.attachments.filter(file, file.type.startsWith("image/"))',
        '[{"id": "file_9", "name": "other.png"}]',
      ),
    );

    await notifier.notify(withFiles([SHOT]), 'task.asked');

    expect(open).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('still posts, without files, where an upload fails, and reports the failure', async () => {
    const { notifier, run, warn } = uploading(500);

    await notifier.notify(withFiles([SHOT]), 'task.asked');

    expect(run.mock.calls[run.mock.calls.length - 1]?.[1]).toMatchObject({
      uploaded: [],
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ error: { status: 500, output: '"OK"' } }),
      'A service answered a task notice with an error',
    );
  });

  it('posts the question again without its images where Slack refuses them', async () => {
    const { notifier, run, warn } = uploading(200, UPLOADING, 'refused');

    await notifier.notify(withFiles([SHOT]), 'task.asked');

    const posts = run.mock.calls
      .filter(([action]) => 'uploads' in action)
      .map(([, against]) => against);
    expect(posts.map((each) => (each.uploaded as unknown[]).length)).toEqual([
      1, 0,
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          output: expect.stringContaining('invalid_blocks'),
        }),
      }),
      'A service answered a task notice with an error',
    );
  });

  it('uploads a file once, however often the expression lists it', async () => {
    const { notifier, upload } = uploading(
      200,
      UPLOADING.replace(
        'ask.attachments.filter(file, file.type.startsWith("image/"))',
        'ask.attachments + ask.attachments',
      ),
    );

    await notifier.notify(withFiles([SHOT]), 'task.asked');

    expect(upload).toHaveBeenCalledOnce();
  });

  it('does not post again where the post got no answer, since it may have arrived', async () => {
    const { notifier, run } = uploading(200, UPLOADING, 'lost');

    await notifier.notify(withFiles([SHOT]), 'task.asked');

    expect(
      run.mock.calls.filter(([action]) => 'uploads' in action),
    ).toHaveLength(1);
  });

  it('sends a file with the connection, and refreshes the connection once where it is refused', async () => {
    const unauthorized = vi.fn(async () => AccessToken.of('at-new'));
    const connected: CallAuth = {
      workspace: async () => WorkspaceId.of('ws_1'),
      connection: {
        token: AccessToken.of('at-old'),
        owner: ConnectionOwner.person(UserId.of('ada')),
        linkedAccount: '@ada',
        unauthorized,
      },
      credentials: { injectedFor: vi.fn(), standInsFor: vi.fn() },
    };
    const { notifier, upload } = uploading(
      200,
      UPLOADING.replace(
        `      send:
        method: POST
        url: '\${{ prepared.url }}'
`,
        `      send:
        method: POST
        url: '\${{ prepared.url }}'
        auth:
          oauth2:
            connection: true
`,
      ).replace(
        'integration: slack\n',
        `integration: slack
connection:
  oauth2:
    authorize: https://slack.com/oauth/v2/authorize
    token: https://slack.com/api/oauth.v2.access
`,
      ),
      'shown',
      { of: async () => connected } as unknown as CallAuthResolver,
    );

    await notifier.notify(withFiles([SHOT]), 'task.asked');

    expect(unauthorized).toHaveBeenCalledOnce();
    expect(upload.mock.calls.map(([, against]) => against.connection)).toEqual([
      'at-old',
      'at-new',
    ]);
  });

  it('waits until each uploaded file is ready before it posts', async () => {
    const { notifier, run, sleep } = uploading(
      200,
      READY,
      'shown',
      undefined,
      (_name, check) => (check < 2 ? 'unready' : 'ready'),
    );

    await notifier.notify(withFiles([SHOT]), 'task.asked');

    const prepared = {
      url: 'https://files.slack.com/upload/shot.png',
      id: 'F_shot.png',
    };
    expect(readied(run)).toEqual([
      { file: 'shot.png', prepared },
      { file: 'shot.png', prepared },
    ]);
    expect(sleep).toHaveBeenCalledOnce();
    expect(run.mock.calls[run.mock.calls.length - 1]?.[1]).toMatchObject({
      uploaded: [{ name: 'shot.png' }],
    });
  });

  it('checks the files at the same time, so the wait is that of the slowest file', async () => {
    const { notifier, run, sleep } = uploading(
      200,
      READY,
      'shown',
      undefined,
      (name, check) =>
        name === 'second.png' && check < 3 ? 'unready' : 'ready',
    );

    await notifier.notify(withFiles([SHOT, SECOND_SHOT]), 'task.asked');

    expect(readied(run).map((each) => each.file)).toEqual([
      'shot.png',
      'second.png',
      'second.png',
      'second.png',
    ]);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[run.mock.calls.length - 1]?.[1]).toMatchObject({
      uploaded: [{ name: 'shot.png' }, { name: 'second.png' }],
    });
  });

  it('checks a file again where a check gets no answer', async () => {
    const { notifier, run } = uploading(
      200,
      READY,
      'shown',
      undefined,
      (_name, check) => (check < 2 ? 'lost' : 'ready'),
    );

    await notifier.notify(withFiles([SHOT]), 'task.asked');

    expect(readied(run)).toHaveLength(2);
    expect(run.mock.calls[run.mock.calls.length - 1]?.[1]).toMatchObject({
      uploaded: [{ name: 'shot.png' }],
    });
  });

  it('stops checking a file where the service refuses the check, since that will not change', async () => {
    const { notifier, run, sleep, warn } = uploading(
      200,
      READY,
      'shown',
      undefined,
      () => 'forbidden',
    );

    await notifier.notify(withFiles([SHOT]), 'task.asked');

    expect(readied(run)).toHaveLength(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(run.mock.calls[run.mock.calls.length - 1]?.[1]).toMatchObject({
      uploaded: [],
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          status: 403,
          output:
            'the check of the file shot.png was refused: {"ok":false,"error":"forbidden"}',
        },
      }),
      'A service answered a task notice with an error',
    );
  });

  it('posts without the files where one is not ready after every attempt, and reports it', async () => {
    const { notifier, run, sleep, warn } = uploading(
      200,
      READY,
      'shown',
      undefined,
      () => 'unready',
    );

    await notifier.notify(withFiles([SHOT]), 'task.asked');

    expect(readied(run)).toHaveLength(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[run.mock.calls.length - 1]?.[1]).toMatchObject({
      uploaded: [],
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: {
          status: 200,
          output:
            'the file shot.png was not ready after 3 attempts: {"ok":true,"file":{}}',
        },
      }),
      'A service answered a task notice with an error',
    );
  });

  it('renders the file’s name and size into the request that prepares it', async () => {
    const { notifier, run } = uploading();

    await notifier.notify(withFiles([SHOT]), 'task.asked');

    const [prepare, against] = run.mock.calls[0] ?? [];
    const rendered = new HttpOutbound({} as OutboundPolicy).rendered(
      prepare as Parameters<HttpOutbound['rendered']>[0],
      against ?? {},
    );
    expect(rendered?.url).toBe(
      'https://slack.com/api/files.getUploadURLExternal?filename=shot.png&length=3',
    );
  });
});
