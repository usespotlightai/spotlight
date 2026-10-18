export interface ReviewOutboxWorkPort {
  syncDue(): Promise<void>;
}
