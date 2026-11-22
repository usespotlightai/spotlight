import { workerData } from 'node:worker_threads';

import {
  type SpecInput,
  specOperations,
} from '@integrations/infrastructure/specs/spec-operations';
import { answerParent } from '@platform/threads/in-thread';

answerParent(() => specOperations(workerData as SpecInput));
