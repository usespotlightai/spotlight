import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { Reach } from '@integrations/application/ports/integration-runtime.port';
import type {
  SourceRead,
  SourceReaderPort,
} from '@integrations/application/ports/source-reader.port';
import { EgressBlockedError } from '@integrations/domain/exceptions/egress-blocked.error';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import type {
  DescriptionAnswered,
  DescriptionAsked,
} from '@integrations/infrastructure/sources/described-operations';
import {
  DescriptionUnreadable,
  type ReadOperations,
} from '@integrations/infrastructure/sources/operation-record';
import { operationsRead } from '@integrations/infrastructure/sources/operations-read';
import { ReadSlots } from '@integrations/infrastructure/sources/read-slots';
import {
  DescriptionUnauthorized,
  READ_WITHIN_MS,
  type SourceFetch,
} from '@integrations/infrastructure/sources/source-fetch';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { getIntrospectionQuery } from 'graphql';

const FROM_SOURCE = extname(__filename) === '.ts';

const WORKER = join(__dirname, `description.worker${extname(__filename)}`);

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

export class ThreadedSourceReader implements SourceReaderPort {
  constructor(private readonly fetching: SourceFetch) {}

  async read(source: DescribedSource, reach: Reach): Promise<SourceRead> {
    const kind = source.kind;

    if (kind === 'mcp') {
      throw new InconsistentStateError(
        'described source',
        'lists its tools from an MCP server, which is not read as a description',
      );
    }

    try {
      const text = await this.textOf(source, reach);
      const answered = await SLOTS.within(
        Date.now() + READ_WITHIN_MS,
        () => new DescriptionUnreadable(TOO_SLOW),
        (left) =>
          this.inWorker(
            {
              kind,
              text,
              url: source.url,
              baseUrl: source.baseUrl,
              depth: source.depth,
              connected: source.connected,
            },
            left,
          ),
      );

      return answered.kind === 'unread'
        ? answered
        : this.described(source, text, answered.read);
    } catch (error) {
      if (error instanceof DescriptionUnreadable) {
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

  private async textOf(source: DescribedSource, reach: Reach): Promise<string> {
    if (source.document !== null) {
      return source.document;
    }

    const connection = source.connected ? reach.connection : null;

    try {
      return await this.fetched(source, reach, connection?.token ?? null);
    } catch (error) {
      if (!(error instanceof DescriptionUnauthorized) || !connection) {
        throw error;
      }

      const renewed = await connection.unauthorized(connection.token);

      if (!renewed) {
        throw error;
      }

      return this.fetched(source, reach, renewed);
    }
  }

  private fetched(
    source: DescribedSource,
    reach: Reach,
    connection: AccessToken | null,
  ): Promise<string> {
    const url = source.url ?? '';
    const injection = {
      apiHost: hostOf(source.kind === 'graphql' ? url : source.baseUrl),
      secrets: source.injectedSecrets.map((each) => each.value),
      connection: connection?.value ?? null,
      credentials: reach.credentials,
    };

    return source.kind === 'graphql'
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

  private described(
    source: DescribedSource,
    text: string,
    read: ReadOperations,
  ): SourceRead {
    return {
      kind: 'read',
      hash: ContentHash.of(
        createHash('sha256')
          .update(
            JSON.stringify([
              source.kind,
              source.url,
              source.baseUrl,
              source.depth,
              source.connected,
            ]),
          )
          .update('\n')
          .update(text)
          .digest('hex'),
      ),
      ...operationsRead(read),
    };
  }

  private inWorker(
    asked: DescriptionAsked,
    left: number,
  ): Promise<DescriptionAnswered> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER, {
        workerData: asked,
        ...(FROM_SOURCE ? FROM_SOURCE_WITH : {}),
        resourceLimits: { maxOldGenerationSizeMb: MAX_HEAP_MB },
      });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new DescriptionUnreadable(TOO_SLOW));
      }, left);
      const settled = () => clearTimeout(timer);

      worker.once('message', (answered: DescriptionAnswered) => {
        settled();
        void worker.terminate();
        resolve(answered);
      });
      worker.once('error', (error) => {
        settled();
        reject(
          new DescriptionUnreadable(
            `could not be made sense of: ${reasonOf(error)}`,
          ),
        );
      });
      worker.once('exit', (code) => {
        settled();
        reject(
          new DescriptionUnreadable(
            `could not be made sense of: reading it stopped with code ${code}`,
          ),
        );
      });
    });
  }
}
