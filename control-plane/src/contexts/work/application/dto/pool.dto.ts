export interface PoolQueueDto {
  readonly pending: number;
  readonly running: number;
  readonly capacity: number | null;
  readonly labels: Readonly<Record<string, number>>;
}
