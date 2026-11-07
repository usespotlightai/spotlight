import type { SentHostCallResponse } from '@runs/application/commands/host-call.commands';
import type { RecordHostCallResponseRequestDto } from '@runs/presentation/http/dto/host-call.request.dto';

export const textOf = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const textsOf = (raw: unknown): Record<string, string> =>
  raw && typeof raw === 'object'
    ? Object.fromEntries(
        Object.entries(raw).filter(
          (each): each is [string, string] => typeof each[1] === 'string',
        ),
      )
    : {};

export const HostCallResponseHttpMapper = {
  toSent(
    body: RecordHostCallResponseRequestDto | undefined,
  ): SentHostCallResponse {
    return {
      host: textOf(body?.host),
      status: Number(body?.status),
      headers: textsOf(body?.headers),
      body: new Uint8Array(Buffer.from(textOf(body?.body), 'base64')),
      ms: Number(body?.ms),
      error: typeof body?.error === 'string' ? body.error : null,
    };
  },
};
