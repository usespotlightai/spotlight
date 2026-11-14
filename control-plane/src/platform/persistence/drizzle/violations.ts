export const UNIQUE_VIOLATION = "23505";

export const FOREIGN_KEY_VIOLATION = "23503";

export const RESTRICT_VIOLATION = "23001";

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
    raised?.code === code && (raised.constraint ?? "").includes(constraint)
  );
};

export const TOO_MANY_CONNECTIONS = "53300";

const POOL_TIMEOUT_MESSAGE = "timeout exceeded when trying to connect";

const MAX_CAUSE_DEPTH = 10;

export const connectionsExhausted = (error: unknown): boolean => {
  for (
    let each = error as {
        code?: string;
        message?: string;
        cause?: unknown;
      } | null,
      depth = 0;
    each && depth < MAX_CAUSE_DEPTH;
    each = each.cause as typeof each, depth += 1
  ) {
    if (
      each.code === TOO_MANY_CONNECTIONS ||
      each.message === POOL_TIMEOUT_MESSAGE
    ) {
      return true;
    }
  }

  return false;
};
