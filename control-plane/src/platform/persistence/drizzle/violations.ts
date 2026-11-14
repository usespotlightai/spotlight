import { DrizzleQueryError } from "drizzle-orm";

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

const TOO_MANY_CONNECTIONS = "53300";

const POOL_TIMEOUT_MESSAGE = "timeout exceeded when trying to connect";

const UNAVAILABLE_SQLSTATES = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  TOO_MANY_CONNECTIONS,
  "57P01",
  "57P02",
  "57P03",
]);

const CONNECTION_LOSS_MESSAGES = new Set([
  POOL_TIMEOUT_MESSAGE,
  "Connection terminated unexpectedly",
  "Connection terminated due to connection timeout",
]);

const UNREACHABLE_CODES = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
]);

const MAX_CAUSE_DEPTH = 10;

type CauseLink = { code?: unknown; message?: unknown; cause?: unknown };

function* causeChain(error: unknown): Generator<CauseLink> {
  for (
    let each = error, depth = 0;
    typeof each === "object" && each !== null && depth < MAX_CAUSE_DEPTH;
    depth += 1
  ) {
    const link: CauseLink = each;

    yield link;
    each = link.cause;
  }
}

export const connectionsExhausted = (error: unknown): boolean =>
  [...causeChain(error)].some(
    (each) =>
      each.code === TOO_MANY_CONNECTIONS ||
      each.message === POOL_TIMEOUT_MESSAGE,
  );

const textOf = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

export const unavailabilityReason = (error: unknown): string | null => {
  const links = [...causeChain(error)];
  const query = links.findIndex((each) => each instanceof DrizzleQueryError);

  for (const [at, each] of links.entries()) {
    const code = textOf(each.code);
    const message = textOf(each.message);

    if (code !== null && UNAVAILABLE_SQLSTATES.has(code)) {
      return code;
    }

    if (message !== null && CONNECTION_LOSS_MESSAGES.has(message)) {
      return message;
    }

    if (query !== -1 && at > query && code !== null && UNREACHABLE_CODES.has(code)) {
      return code;
    }
  }

  return null;
};
