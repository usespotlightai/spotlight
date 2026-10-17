import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { CallAuth } from '@integrations/application/ports/integration-runtime.port';
import type {
  SpecRead,
  SpecReaderPort,
} from '@integrations/application/ports/spec-reader.port';
import { EgressBlockedError } from '@integrations/domain/exceptions/egress-blocked.error';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import {
  type ReadOperations,
  SpecUnreadable,
} from '@integrations/infrastructure/specs/operation-record';
import { operationsRead } from '@integrations/infrastructure/specs/operations-read';
import { ReadSlots } from '@integrations/infrastructure/specs/read-slots';
import {
  READ_WITHIN_MS,
  type SpecFetch,
  SpecUnauthorized,
} from '@integrations/infrastructure/specs/spec-fetch';
import type {
  SpecInput,
  SpecParsed,
} from '@integrations/infrastructure/specs/spec-operations';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { getIntrospectionQuery } from 'graphql';

const FROM_SOURCE = extname(__filename) === '.ts';

const WORKER = join(__dirname, `spec.worker${extname(__filename)}`);

const FROM_SOURCE_WITH = {
  execArgv: [
    '-r',
    'ts-node/register/transpile-only',
    '-r',
    'tsconfig-paths/register',
  ],
  env: { ...process.env, TS_NODE_PROJECT: 'tsconfig.build.json' },
};

const MAX_HEAP_MB = 1024;

const SLOTS = new ReadSlots(2);

const TOO_SLOW = `took longer than ${READ_WITHIN_MS / 1000} seconds to make sense of`;

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const hostOf = (url: string | null): string | null =>
  url ? new URL(url).host.toLowerCase() : null;

export class ThreadedSpecReader implements SpecReaderPort {
  constructor(private readonly fetching: SpecFetch) {}

  async read(spec: ApiSpec, callAuth: CallAuth): Promise<SpecRead> {
    const kind = spec.kind;

    if (kind === 'mcp') {
      throw new InconsistentStateError(
        'API spec',
        'lists its tools from an MCP server, which is not parsed as a spec',
      );
    }

    try {
      const text = await this.textOf(spec, callAuth);
      const answered = await SLOTS.within(
        Date.now() + READ_WITHIN_MS,
        () => new SpecUnreadable(TOO_SLOW),
        (left) =>
          this.inWorker(
            {
              kind,
              text,
              url: spec.url,
              baseUrl: spec.baseUrl,
              depth: spec.depth,
              connected: spec.connected,
            },
            left,
          ),
      );

      return answered.kind === 'unread'
        ? answered
        : this.parsed(spec, text, answered.read);
    } catch (error) {
      if (error instanceof SpecUnreadable) {
        return { kind: 'unread', problem: error.because };
      }

      if (error instanceof EgressBlockedError) {
        return {
          kind: 'unread',
          problem: `could not be read: ${error.message}`,
        };
      }

      throw error;
    }
  }

  private async textOf(spec: ApiSpec, callAuth: CallAuth): Promise<string> {
    if (spec.document !== null) {
      return spec.document;
    }

    const connection = spec.connected ? callAuth.connection : null;

    try {
      return await this.fetched(spec, callAuth, connection?.token ?? null);
    } catch (error) {
      if (!(error instanceof SpecUnauthorized) || !connection) {
        throw error;
      }

      const refreshed = await connection.unauthorized(connection.token);

      if (!refreshed) {
        throw error;
      }

      return this.fetched(spec, callAuth, refreshed);
    }
  }

  private fetched(
    spec: ApiSpec,
    callAuth: CallAuth,
    connection: AccessToken | null,
  ): Promise<string> {
    const url = spec.url ?? '';
    const injection = {
      apiHost: hostOf(spec.kind === 'graphql' ? url : spec.baseUrl),
      secrets: spec.injectedSecrets.map((each) => each.value),
      connection: connection?.value ?? null,
      credentials: callAuth.credentials,
    };

    return spec.kind === 'graphql'
      ? this.fetching.text(
          {
            url,
            method: 'POST',
            accept: 'application/json',
            body: JSON.stringify({ query: getIntrospectionQuery() }),
          },
          injection,
        )
      : this.fetching.text(
          {
            url,
            method: 'GET',
            accept: 'application/json, application/yaml;q=0.9, */*;q=0.1',
          },
          injection,
        );
  }

  private parsed(spec: ApiSpec, text: string, read: ReadOperations): SpecRead {
    return {
      kind: 'read',
      hash: ContentHash.of(
        createHash('sha256')
          .update(
            JSON.stringify([
              spec.kind,
              spec.url,
              spec.baseUrl,
              spec.depth,
              spec.connected,
            ]),
          )
          .update('\n')
          .update(text)
          .digest('hex'),
      ),
      ...operationsRead(read),
    };
  }

  private inWorker(input: SpecInput, left: number): Promise<SpecParsed> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER, {
        workerData: input,
        ...(FROM_SOURCE ? FROM_SOURCE_WITH : {}),
        resourceLimits: { maxOldGenerationSizeMb: MAX_HEAP_MB },
      });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new SpecUnreadable(TOO_SLOW));
      }, left);
      const stopTimer = () => clearTimeout(timer);

      worker.once('message', (answered: SpecParsed) => {
        stopTimer();
        void worker.terminate();
        resolve(answered);
      });
      worker.once('error', (error) => {
        stopTimer();
        reject(
          new SpecUnreadable(`could not be made sense of: ${reasonOf(error)}`),
        );
      });
      worker.once('exit', (code) => {
        stopTimer();
        reject(
          new SpecUnreadable(
            `could not be made sense of: reading it stopped with code ${code}`,
          ),
        );
      });
    });
  }
}
