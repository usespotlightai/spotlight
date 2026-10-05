import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { Reach } from '@integrations/application/ports/integration-runtime.port';
import type {
  SourceRead,
  SourceReaderPort,
} from '@integrations/application/ports/source-reader.port';
import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { OutboundRefusedError } from '@integrations/domain/exceptions/outbound-refused.error';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';
import type { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import type {
  DescriptionAnswered,
  DescriptionAsked,
} from '@integrations/infrastructure/sources/described-operations';
import {
  DescriptionUnreadable,
  type OperationRecord,
} from '@integrations/infrastructure/sources/operation-record';
import { ReadSlots } from '@integrations/infrastructure/sources/read-slots';
import {
  READ_WITHIN_MS,
  type SourceFetch,
} from '@integrations/infrastructure/sources/source-fetch';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
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

const HEAP_AT_MOST_MB = 1024;

const SLOTS = new ReadSlots(2);

const TOO_SLOW = `took longer than ${READ_WITHIN_MS / 1000} seconds to make sense of`;

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const hostOf = (url: string | null): string | null =>
  url ? new URL(url).host.toLowerCase() : null;

const operationOf = (record: OperationRecord): DescribedOperation =>
  DescribedOperation.of({
    ...record,
    inputs: record.inputs.map((each) => ({
      ...each,
      schema: InputSchema.of(each.schema),
    })),
  });

export class ThreadedSourceReader implements SourceReaderPort {
  constructor(private readonly fetching: SourceFetch) {}

  async read(source: DescribedSource, reach: Reach): Promise<SourceRead> {
    try {
      const text = await this.textOf(source, reach);
      const answered = await SLOTS.within(
        Date.now() + READ_WITHIN_MS,
        () => new DescriptionUnreadable(TOO_SLOW),
        (left) =>
          this.inWorker(
            {
              kind: source.kind,
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

      if (error instanceof OutboundRefusedError) {
        return {
          kind: 'unread',
          problem: `could not be read: ${error.message}`,
        };
      }

      throw error;
    }
  }

  private textOf(source: DescribedSource, reach: Reach): Promise<string> {
    if (source.document !== null) {
      return Promise.resolve(source.document);
    }

    const url = source.url ?? '';
    const wearing = {
      apiHost: hostOf(source.kind === 'graphql' ? url : source.baseUrl),
      secrets: source.wears.map((each) => each.value),
      connection: reach.connection?.value ?? null,
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
          wearing,
        )
      : this.fetching.text(
          {
            url,
            method: 'GET',
            accept: 'application/json, application/yaml;q=0.9, */*;q=0.1',
          },
          wearing,
        );
  }

  private described(
    source: DescribedSource,
    text: string,
    read: {
      operations: readonly OperationRecord[];
      passedOver: readonly string[];
    },
  ): SourceRead {
    const operations: DescribedOperation[] = [];
    const passedOver = [...read.passedOver];

    for (const record of read.operations) {
      try {
        operations.push(operationOf(record));
      } catch (error) {
        passedOver.push(
          `passes over ${record.upstream}, because ${
            error instanceof InvalidIntegrationPartError
              ? `it ${error.because}`
              : reasonOf(error)
          }`,
        );
      }
    }

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
      operations,
      passedOver,
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
        resourceLimits: { maxOldGenerationSizeMb: HEAP_AT_MOST_MB },
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
