import { workerData } from 'node:worker_threads';

import { specOperations } from '@integrations/infrastructure/specs/spec-operations';
import { answerParent } from '@platform/threads/in-thread';
import { z } from 'zod';

const specInput = z.object({
  kind: z.enum(['openapi', 'graphql']),
  text: z.string(),
  url: z.string().nullable(),
  baseUrl: z.string().nullable(),
  depth: z.number().nullable(),
  connected: z.boolean(),
});

answerParent(() => specOperations(specInput.parse(workerData)));
