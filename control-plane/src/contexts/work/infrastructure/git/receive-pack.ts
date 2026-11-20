import type {
  GitAnswerDto,
  GitCallDto,
} from '@work/application/dto/git-call.dto';
import type {
  PushRead,
  ReceivePackPort,
} from '@work/application/ports/receive-pack.port';
import { RefUpdate } from '@work/domain/value-objects/ref-update.vo';

const LENGTH = 4;
const FLUSH = 0;
const MOST_COMMAND_BYTES = 1024 * 1024;
const FIRST_BUFFER_BYTES = 64 * 1024;
const MOST_DRAIN_MS = 30_000;
const BAND_DATA = 1;
const BAND_BYTES: Readonly<Record<string, number>> = {
  'side-band-64k': 65515,
  'side-band': 995,
};
const COMMAND =
  /^([0-9a-f]{40}|[0-9a-f]{64}) ([0-9a-f]{40}|[0-9a-f]{64}) (\S+)$/;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const pkt = (data: Uint8Array): Uint8Array => {
  const line = new Uint8Array(LENGTH + data.length);

  line.set(
    encoder.encode((LENGTH + data.length).toString(16).padStart(LENGTH, '0')),
  );
  line.set(data, LENGTH);

  return line;
};

const flush = (): Uint8Array => encoder.encode('0000');

const joined = (parts: readonly Uint8Array[]): Uint8Array => {
  const whole = new Uint8Array(
    parts.reduce((sum, each) => sum + each.length, 0),
  );
  let at = 0;

  for (const part of parts) {
    whole.set(part, at);
    at += part.length;
  }

  return whole;
};

const once = (bytes: Uint8Array): AsyncIterable<Uint8Array> => ({
  async *[Symbol.asyncIterator]() {
    yield bytes;
  },
});

const textAnswer = (status: number, text: string): GitAnswerDto => ({
  status,
  headers: { 'content-type': 'text/plain; charset=utf-8' },
  body: once(encoder.encode(`${text}\n`)),
});

const headerOf = (
  headers: GitCallDto['headers'],
  name: string,
): string | undefined => {
  const value = headers[name];

  return Array.isArray(value) ? value.join(',') : value;
};

interface Commands {
  readonly lines: readonly string[];
  readonly read: Uint8Array;
  readonly rest: AsyncIterator<Uint8Array>;
}

const commandsIn = async (
  body: AsyncIterable<Uint8Array>,
): Promise<Commands | null> => {
  const rest = body[Symbol.asyncIterator]();
  const lines: string[] = [];
  let held = new Uint8Array(FIRST_BUFFER_BYTES);
  let read = held.subarray(0, 0);
  let at = 0;

  for (;;) {
    while (read.length - at >= LENGTH) {
      const size = Number.parseInt(
        decoder.decode(read.subarray(at, at + LENGTH)),
        16,
      );

      if (Number.isNaN(size)) {
        return null;
      }

      if (size === FLUSH) {
        return { lines, read, rest };
      }

      if (size < LENGTH) {
        return null;
      }

      if (read.length - at < size) {
        break;
      }

      lines.push(decoder.decode(read.subarray(at + LENGTH, at + size)));
      at += size;
    }

    if (read.length > MOST_COMMAND_BYTES) {
      return null;
    }

    const next = await rest.next();

    if (next.done) {
      return null;
    }

    const length = read.length + next.value.length;

    if (length > held.length) {
      const grown = new Uint8Array(Math.max(held.length * 2, length));

      grown.set(read);
      held = grown;
    }

    held.set(next.value, read.length);
    read = held.subarray(0, length);
  }
};

const drained = async (rest: AsyncIterator<Uint8Array>): Promise<void> => {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<'late'>((resolve) => {
    timer = setTimeout(() => resolve('late'), MOST_DRAIN_MS);
  });

  try {
    for (;;) {
      const next = await Promise.race([rest.next(), late]);

      if (next === 'late' || next.done) {
        return;
      }
    }
  } finally {
    clearTimeout(timer);
  }
};

const reportOf = (
  capabilities: readonly string[],
  updates: readonly RefUpdate[],
  reason: string,
): Uint8Array => {
  const status = joined([
    pkt(encoder.encode('unpack ok\n')),
    ...updates.map((each) =>
      pkt(encoder.encode(`ng ${each.ref} ${reason.replace(/\s+/g, ' ')}\n`)),
    ),
    flush(),
  ]);
  const band = Object.keys(BAND_BYTES).find((each) =>
    capabilities.includes(each),
  );

  if (!band) {
    return status;
  }

  const most = BAND_BYTES[band];
  const packets: Uint8Array[] = [];

  for (let at = 0; at < status.length; at += most) {
    packets.push(
      pkt(joined([Uint8Array.of(BAND_DATA), status.subarray(at, at + most)])),
    );
  }

  return joined([...packets, flush()]);
};

export class GitReceivePack implements ReceivePackPort {
  async read(call: GitCallDto): Promise<PushRead> {
    const encoding = headerOf(call.headers, 'content-encoding');

    if (!call.body || (encoding && encoding !== 'identity')) {
      return {
        kind: 'unreadable',
        answer: textAnswer(400, 'Spotlight reads only uncompressed pushes.'),
      };
    }

    const commands = await commandsIn(call.body);
    const parsed = commands && this.parsed(commands.lines);

    if (!commands || !parsed) {
      return {
        kind: 'unreadable',
        answer: textAnswer(400, 'Spotlight could not read the push commands.'),
      };
    }

    const { read, rest } = commands;
    const { updates, capabilities } = parsed;

    return {
      kind: 'read',
      push: {
        updates,
        call: {
          ...call,
          body: {
            async *[Symbol.asyncIterator]() {
              yield read;
              for (
                let next = await rest.next();
                !next.done;
                next = await rest.next()
              ) {
                yield next.value;
              }
            },
          },
        },
        async refused(reason: string): Promise<GitAnswerDto> {
          await drained(rest);

          if (
            !capabilities.includes('report-status') &&
            !capabilities.includes('report-status-v2')
          ) {
            return textAnswer(403, reason);
          }

          return {
            status: 200,
            headers: {
              'content-type': 'application/x-git-receive-pack-result',
              'cache-control': 'no-cache',
            },
            body: once(reportOf(capabilities, updates, reason)),
          };
        },
      },
    };
  }

  private parsed(
    lines: readonly string[],
  ): { updates: readonly RefUpdate[]; capabilities: readonly string[] } | null {
    const commands = lines.filter((each) => !each.startsWith('shallow '));
    const [first = ''] = commands;
    const [, listed = ''] = first.split('\0');
    const updates: RefUpdate[] = [];

    for (const each of commands) {
      const [command = ''] = each.split('\0');
      const matched = COMMAND.exec(command.trimEnd());

      if (!matched) {
        return null;
      }

      const [, , to = '', ref = ''] = matched;

      updates.push(RefUpdate.of({ ref, to }));
    }

    return {
      updates,
      capabilities: listed.trim().split(/\s+/).filter(Boolean),
    };
  }
}
