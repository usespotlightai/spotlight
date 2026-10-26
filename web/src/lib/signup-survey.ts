import type { SignupSurveyRequestDto } from '@/lib/api';

export type JobFunction = SignupSurveyRequestDto['jobFunction'];

export const JOB_FUNCTIONS: readonly {
  readonly value: JobFunction;
  readonly label: string;
}[] = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'product-management', label: 'Product Management' },
  { value: 'sales-success', label: 'Sales / Success' },
  { value: 'data', label: 'Data' },
  { value: 'student', label: 'Student' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'founder', label: 'Founder' },
  { value: 'other', label: 'Other' },
];

export const jobFunctionOf = (value: string | null): JobFunction | null =>
  JOB_FUNCTIONS.find((each) => each.value === value)?.value ?? null;
