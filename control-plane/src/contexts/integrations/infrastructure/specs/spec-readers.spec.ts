import type { CallAuth } from '@integrations/application/ports/integration-runtime.port';
import type {
  SpecRead,
  SpecReaderPort,
} from '@integrations/application/ports/spec-reader.port';
import { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { SpecReaders } from '@integrations/infrastructure/specs/spec-readers';
import { OutboundScope } from '@platform/outbound/outbound-scope';
import { scopedTo } from '@platform/outbound/outbound-scope.fake-spec';
import { scopeRecorder } from '@shared-kernel/application/ports/workspace-outbound-scope.fake-spec';
import { describe, expect, it } from 'vitest';

const UNREAD: SpecRead = { kind: 'unread', problem: 'unused' };

const recording = (seen: boolean[]): SpecReaderPort => ({
  read: async () => {
    seen.push(
      OutboundScope.allows('api.example.com'),
      OutboundScope.allows('elsewhere.example'),
    );
    return UNREAD;
  },
});

const CALL_AUTH = {
  workspace: async () => 'ws_1',
} as unknown as CallAuth;

describe('SpecReaders', () => {
  it.each([
    ['openapi', 'https://api.example.com/openapi.json'],
    ['mcp', 'https://api.example.com/mcp'],
  ] as const)(
    'reads a %s spec within the outbound scope of the workspace',
    async (kind, url) => {
      const documents: boolean[] = [];
      const servers: boolean[] = [];
      const readers = new SpecReaders(
        recording(documents),
        recording(servers),
        scopedTo('api.example.com'),
      );

      await readers.read(
        ApiSpec.of({ kind, url, fingerprint: 'f' }),
        CALL_AUTH,
      );

      expect([...documents, ...servers]).toEqual([true, false]);
    },
  );

  it('reads the workspace list fresh, since only a configuration write reads a spec', async () => {
    const recorder = scopeRecorder();
    const readers = new SpecReaders(
      recording([]),
      recording([]),
      recorder.scope,
    );

    await readers.read(
      ApiSpec.of({
        kind: 'openapi',
        url: 'https://api.example.com/openapi.json',
        fingerprint: 'f',
      }),
      CALL_AUTH,
    );

    expect(recorder.entered()).toEqual(['fresh']);
  });
});
