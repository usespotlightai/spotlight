import { InvalidJobFunctionError } from '@identity/domain/exceptions/invalid-job-function.error';

export const JOB_FUNCTIONS = [
  'marketing',
  'leadership',
  'product-management',
  'sales-success',
  'data',
  'student',
  'engineering',
  'founder',
  'other',
] as const;

export type JobFunctionName = (typeof JOB_FUNCTIONS)[number];

const isJobFunction = (raw: string): raw is JobFunctionName =>
  (JOB_FUNCTIONS as readonly string[]).includes(raw);

export class JobFunction {
  private constructor(readonly value: JobFunctionName) {}

  static of(raw: string): JobFunction {
    const named = raw.trim().toLowerCase();

    if (!isJobFunction(named)) {
      throw new InvalidJobFunctionError(raw.trim());
    }

    return new JobFunction(named);
  }

  equals(other: JobFunction): boolean {
    return this.value === other.value;
  }
}
