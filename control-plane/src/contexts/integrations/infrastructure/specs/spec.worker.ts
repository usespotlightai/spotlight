import { parentPort, workerData } from 'node:worker_threads';
import {
  type SpecInput,
  specOperations,
} from '@integrations/infrastructure/specs/spec-operations';

parentPort?.postMessage(specOperations(workerData as SpecInput));
