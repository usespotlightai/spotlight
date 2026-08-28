export interface TaskRunDto {
  readonly id: string;
  readonly state: string;
  readonly attempt: number;
  readonly exitCode: number | null;
  readonly startedAt: string;
  readonly updatedAt: string;
}
