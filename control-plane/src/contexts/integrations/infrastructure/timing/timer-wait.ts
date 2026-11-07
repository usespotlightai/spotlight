import type { WaitPort } from '@integrations/application/ports/wait.port';

export class TimerWait implements WaitPort {
  for(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
