export interface HasPendingJob<Self> {
  readonly hasPendingJob: boolean;
  readonly jobExhausted: boolean;
  leaseJob(now: Date): Self;
  scheduleRetry(now: Date): Self;
  /** Puts the job back to wait for something outside it, without counting the attempt (`PendingJob.wait`). */
  waitJob(now: Date): Self;
  deadLetter(now: Date): Self;
}
