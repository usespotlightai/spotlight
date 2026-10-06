import { parentPort, workerData } from 'node:worker_threads';
import {
  type DescriptionAsked,
  describedOperations,
} from '@integrations/infrastructure/sources/described-operations';

parentPort?.postMessage(describedOperations(workerData as DescriptionAsked));
