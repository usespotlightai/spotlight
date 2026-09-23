export const UNIQUE_VIOLATION = '23505';

export const FOREIGN_KEY_VIOLATION = '23503';

export const RESTRICT_VIOLATION = '23001';

export const violates = (
  error: unknown,
  code: string,
  constraint: string,
): boolean => {
  const raised = ((error as { cause?: unknown } | null)?.cause ?? error) as {
    code?: string;
    constraint?: string;
  } | null;

  return (
    raised?.code === code &&
    String(raised.constraint ?? '').includes(constraint)
  );
};
