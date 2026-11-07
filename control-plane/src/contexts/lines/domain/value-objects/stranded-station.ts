export type TaskCounts = ReadonlyMap<string, number>;

export interface StrandedStation {
  readonly key: string;
  readonly name: string;
  readonly tasks: number;
}
