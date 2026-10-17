export interface PendingJobsPort {
  readonly name: string;

  processDue(): Promise<void>;
}
