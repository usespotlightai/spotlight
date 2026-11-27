import { workerData } from 'node:worker_threads';

import { answerParent } from '@platform/threads/in-thread';
import { z } from 'zod';

const how = z.enum(['answer', 'fail', 'spin']).parse(workerData);

answerParent(() => {
  if (how === 'fail') {
    throw new Error('the input has no end');
  }

  while (how === 'spin') {
    // spins until the parent stops the thread
  }

  return 'answered';
});
