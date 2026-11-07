import type { RecordHostCallResponseRequestDto } from '@runs/presentation/http/dto/host-call.request.dto';
import { HostCallResponseHttpMapper } from '@runs/presentation/http/mappers/host-call-response.http.mapper';
import { describe, expect, it } from 'vitest';

describe('HostCallResponseHttpMapper', () => {
  it('reads the response a host sent, keeping text headers and decoding the body', () => {
    const sent = HostCallResponseHttpMapper.toSent({
      host: 'host-1',
      status: 200,
      headers: { 'content-type': 'application/json', ignored: 7 },
      body: Buffer.from('{"ok":true}').toString('base64'),
      ms: 84,
    } as unknown as RecordHostCallResponseRequestDto);

    expect(sent).toEqual({
      host: 'host-1',
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: new Uint8Array(Buffer.from('{"ok":true}')),
      ms: 84,
      error: null,
    });
  });

  it('reads a status that is no number as no status', () => {
    expect(
      HostCallResponseHttpMapper.toSent({
        status: 'teapot',
      } as unknown as RecordHostCallResponseRequestDto).status,
    ).toBeNaN();
  });
});
