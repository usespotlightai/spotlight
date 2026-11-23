import type {
  GitAnswerDto,
  GitCallDto,
} from '@work/application/dto/git-call.dto';
import type { Push } from '@work/application/ports/receive-pack.port';
import { GitReceivePack } from '@work/infrastructure/git/receive-pack';
import { describe, expect, it } from 'vitest';

const OLD = '1'.repeat(40);
const NEW = '2'.repeat(40);
const PACK = 'PACK\u0000\u0000\u0000\u0002rest-of-the-pack';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const pkt = (line: string): string =>
  `${(line.length + 4).toString(16).padStart(4, '0')}${line}`;

const request = (capabilities: string, ...refs: readonly string[]): string =>
  [
    ...refs.map((ref, at) =>
      pkt(`${OLD} ${NEW} ${ref}${at === 0 ? `\u0000${capabilities}` : ''}\n`),
    ),
    '0000',
    PACK,
  ].join('');

const chunked = (text: string, size: number): AsyncIterable<Uint8Array> => ({
  async *[Symbol.asyncIterator]() {
    const bytes = encoder.encode(text);

    for (let at = 0; at < bytes.length; at += size) {
      yield bytes.subarray(at, at + size);
    }
  },
});

const call = (
  body: string,
  headers: GitCallDto['headers'] = {},
  size = 7,
): GitCallDto => ({
  method: 'POST',
  path: '/git-receive-pack',
  search: '',
  headers,
  body: chunked(body, size),
});

const text = async (
  body: AsyncIterable<Uint8Array> | null,
): Promise<string> => {
  const parts: string[] = [];

  for await (const chunk of body ?? []) {
    parts.push(decoder.decode(chunk, { stream: true }));
  }

  return parts.join('');
};

const read = async (incoming: GitCallDto): Promise<Push> => {
  const result = await new GitReceivePack().read(incoming);

  if (result.kind !== 'read') {
    throw new Error('the push was not read');
  }

  return result.push;
};

const unreadable = async (incoming: GitCallDto): Promise<GitAnswerDto> => {
  const result = await new GitReceivePack().read(incoming);

  if (result.kind !== 'unreadable') {
    throw new Error('the push was read');
  }

  return result.answer;
};

const unbanded = (body: string): string => {
  const parts: string[] = [];

  for (let at = 0; at < body.length;) {
    const size = Number.parseInt(body.slice(at, at + 4), 16);

    if (size === 0) {
      break;
    }

    parts.push(body.slice(at + 5, at + size));
    at += size;
  }

  return parts.join('');
};

describe('GitReceivePack, reading the commands of a push', () => {
  it('reads every ref the push updates, across chunks', async () => {
    const push = await read(
      call(request('report-status', 'refs/heads/fix/icons', 'refs/tags/v1')),
    );

    expect(push.updates.map((each) => each.ref)).toEqual([
      'refs/heads/fix/icons',
      'refs/tags/v1',
    ]);
    expect(push.updates.map((each) => each.deletes)).toEqual([false, false]);
  });

  it('reads the commit each ref moves from, and takes every update the runner did not verify as a fast-forward as a rewrite', async () => {
    const push = await read(
      call(request('report-status', 'refs/heads/main', 'refs/heads/fix'), {
        'spotlight-fast-forwards': 'refs%2Fheads%2Fmain,%E0%A4%A',
      }),
    );

    expect(
      push.updates.map((each) => [
        each.ref,
        each.from.value,
        each.to.value,
        each.rewrites,
      ]),
    ).toEqual([
      ['refs/heads/main', OLD, NEW, false],
      ['refs/heads/fix', OLD, NEW, true],
    ]);
  });

  it('reads a delete as a delete', async () => {
    const push = await read(
      call(
        `${pkt(`${OLD} ${'0'.repeat(40)} refs/heads/old\u0000report-status\n`)}0000`,
      ),
    );

    expect(push.updates[0]?.deletes).toBe(true);
  });

  it('carries the push on byte for byte', async () => {
    const body = request('report-status', 'refs/heads/fix/icons');
    const push = await read(call(body));

    expect(await text(push.call.body)).toBe(body);
  });

  it('answers a refusal as git reports a rejected ref, inside the side band', async () => {
    const push = await read(
      call(
        request(
          'report-status side-band-64k agent=git/2.47',
          'refs/heads/main',
          'refs/heads/fix/icons',
        ),
      ),
    );
    const answer = await push.refused('main is the default branch.');

    expect(answer.status).toBe(200);
    expect(answer.headers['content-type']).toBe(
      'application/x-git-receive-pack-result',
    );
    expect(unbanded(await text(answer.body))).toBe(
      [
        pkt('unpack ok\n'),
        pkt('ng refs/heads/main main is the default branch.\n'),
        pkt('ng refs/heads/fix/icons main is the default branch.\n'),
        '0000',
      ].join(''),
    );
  });

  it('answers a refusal without the side band when git did not ask for it', async () => {
    const push = await read(
      call(request('report-status-v2', 'refs/heads/main')),
    );

    expect(await text((await push.refused('No.')).body)).toBe(
      `${pkt('unpack ok\n')}${pkt('ng refs/heads/main No.\n')}0000`,
    );
  });

  it('answers a refusal with 403 when git asked for no report', async () => {
    const push = await read(call(request('ofs-delta', 'refs/heads/main')));
    const answer = await push.refused('No.');

    expect(answer.status).toBe(403);
    expect(await text(answer.body)).toBe('No.\n');
  });

  it('reads the commands after shallow lines, and with SHA-256 ids, a byte at a time', async () => {
    const long = 'a'.repeat(64);
    const push = await read(
      call(
        [
          pkt(`shallow ${OLD}\n`),
          pkt(
            `${long} ${'b'.repeat(64)} refs/heads/fix/icons\u0000report-status object-format=sha256\n`,
          ),
          '0000',
          PACK,
        ].join(''),
        {},
        1,
      ),
    );

    expect(push.updates.map((each) => each.ref)).toEqual([
      'refs/heads/fix/icons',
    ]);
  });

  it('reads the rest of the push before it answers a refusal', async () => {
    let taken = 0;
    const body = request('report-status', 'refs/heads/main');
    const push = await read({
      ...call(body),
      body: {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of chunked(body, 7)) {
            taken += chunk.length;
            yield chunk;
          }
        },
      },
    });

    await push.refused('No.');

    expect(taken).toBe(encoder.encode(body).length);
  });

  it('reads no push whose commands run past a mebibyte', async () => {
    const many = Array.from(
      { length: 20_000 },
      (_, at) => `refs/heads/branch-${at}`,
    );

    expect(
      (await unreadable(call(request('report-status', ...many), {}, 4096)))
        .status,
    ).toBe(400);
  });

  it('reads the probe git sends before a large push as a push of nothing', async () => {
    const push = await read(call('0000'));

    expect(push.updates).toEqual([]);
    expect(await text(push.call.body)).toBe('0000');
  });

  it('reads no compressed push', async () => {
    expect(
      (
        await unreadable(
          call(request('report-status', 'refs/heads/main'), {
            'content-encoding': 'gzip',
          }),
        )
      ).status,
    ).toBe(400);
  });

  it('reads no push whose commands are not git commands', async () => {
    expect((await unreadable(call(`${pkt('hello\n')}0000`))).status).toBe(400);
  });

  it('reads no push that ends before its commands do', async () => {
    expect(
      (await unreadable(call(pkt(`${OLD} ${NEW} refs/heads/main\n`)))).status,
    ).toBe(400);
  });
});

describe('GitReceivePack, reading what GitHub took from a push', () => {
  const reported = async (
    report: string,
    capabilities = 'report-status',
  ): Promise<readonly string[]> => {
    const push = await read(
      call(request(capabilities, 'refs/heads/fix', 'refs/heads/other')),
    );
    const taken: string[] = [];
    const answer = push.reported(
      { status: 200, headers: {}, body: chunked(report, 5) },
      async (updates) => {
        taken.push(...updates.map((each) => each.ref));
      },
    );

    expect(await text(answer.body)).toBe(report);
    return taken;
  };

  it('reads no push that names one ref twice', async () => {
    const answer = await unreadable(
      call(request('report-status', 'refs/heads/fix', 'refs/heads/fix')),
    );

    expect(answer.status).toBe(400);
    expect(await text(answer.body)).toContain('one command for each ref');
  });

  it('takes only the refs GitHub reports as ok', async () => {
    expect(
      await reported(
        `${pkt('unpack ok\n')}${pkt('ok refs/heads/fix\n')}${pkt('ng refs/heads/other stale info\n')}0000`,
      ),
    ).toEqual(['refs/heads/fix']);
  });

  it('takes the refs GitHub reports as ok inside the side band', async () => {
    const status = `${pkt('unpack ok\n')}${pkt('ok refs/heads/fix\n')}${pkt('ok refs/heads/other\n')}0000`;

    expect(
      await reported(
        `${pkt(`\u0001${status}`)}${pkt('\u0002remote: done\n')}0000`,
        'report-status side-band-64k',
      ),
    ).toEqual(['refs/heads/fix', 'refs/heads/other']);
  });

  it('takes nothing when GitHub could not unpack the push', async () => {
    expect(
      await reported(
        `${pkt('unpack index-pack failed\n')}${pkt('ng refs/heads/fix unpacker error\n')}0000`,
      ),
    ).toEqual([]);
  });
});
