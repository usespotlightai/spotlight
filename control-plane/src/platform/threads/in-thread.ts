import { extname } from 'node:path';
import { parentPort, Worker } from 'node:worker_threads';

const FROM_SOURCE_WITH = {
  execArgv: [
    '-r',
    'ts-node/register/transpile-only',
    '-r',
    'tsconfig-paths/register',
  ],
  // oxlint-disable-next-line node/no-process-env -- the worker runs with the parent environment
  env: { ...process.env, TS_NODE_PROJECT: 'tsconfig.build.json' },
};

const MAX_HEAP_MB = 1024;

type Answer<O> =
  | { readonly kind: 'answered'; readonly value: O }
  | { readonly kind: 'failed'; readonly reason: string };

export interface ThreadRun {
  readonly within: number;
  readonly late: () => Error;
  readonly failed: (reason: string) => Error;
}

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const answerParent = <O>(work: () => O | Promise<O>): void => {
  void (async () => {
    try {
      parentPort?.postMessage({
        kind: 'answered',
        value: await work(),
      } satisfies Answer<O>);
    } catch (error) {
      parentPort?.postMessage({
        kind: 'failed',
        reason: reasonOf(error),
      } satisfies Answer<O>);
    }
  })();
};

export const inThread = <I, O>(
  file: string,
  input: I,
  run: ThreadRun,
): Promise<O> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(file, {
      workerData: input,
      ...(extname(file) === '.ts' ? FROM_SOURCE_WITH : {}),
      resourceLimits: { maxOldGenerationSizeMb: MAX_HEAP_MB },
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(run.late());
    }, run.within);
    const stopTimer = () => clearTimeout(timer);

    worker.once('message', (answer: Answer<O>) => {
      stopTimer();
      void worker.terminate();

      if (answer.kind === 'answered') {
        resolve(answer.value);
      } else {
        reject(run.failed(answer.reason));
      }
    });
    worker.once('error', (error) => {
      stopTimer();
      reject(run.failed(reasonOf(error)));
    });
    worker.once('exit', (code) => {
      stopTimer();
      reject(run.failed(`its thread stopped with code ${code}`));
    });
  });
