export const UNIQUE_VIOLATION = '23505';

export const FOREIGN_KEY_VIOLATION = '23503';

export const RESTRICT_VIOLATION = '23001';

type Raised = { code?: string; constraint?: string } | null;

const raisedBy = (error: unknown): Raised =>
  ((error as { cause?: unknown } | null)?.cause ?? error) as Raised;

export const codeOf = (error: unknown): string | undefined =>
  raisedBy(error)?.code;

export const violates = (
  error: unknown,
  code: string,
  constraint: string,
): boolean => {
  const raised = raisedBy(error);

  return (
    raised?.code === code &&
    String(raised.constraint ?? '').includes(constraint)
  );
};
