export interface HasPendingJob<Self> {
  readonly hasPendingJob: boolean;
  readonly jobExhausted: boolean;
  leaseJob(now: Date): Self;
  scheduleRetry(now: Date): Self;
  deadLetter(now: Date): Self;
}
