export interface OwedWorkPort {
  readonly name: string;

  workDue(): Promise<void>;
}
