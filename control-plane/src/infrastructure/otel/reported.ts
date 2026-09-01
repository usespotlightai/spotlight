import type {
  RunSpan,
  SpanAttribute,
} from '@application/ports/run-journal-reader.port';
import { decoded, type Journalled } from '@infrastructure/journal/journalled';

/**
 * One span as the harness exported it. Nothing outside this file knows what
 * OpenTelemetry looks like: what leaves it is spans in Spotlight's own shape.
 */
interface Exported {
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  status?: { code?: number | string; message?: string };
  attributes?: {
    key?: string;
    value?: Record<string, unknown>;
  }[];
}

/** Nanoseconds, as a string when they will not survive a JSON number. */
const nanos = (raw: string | number | undefined): bigint | null => {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }

  try {
    return BigInt(raw);
  } catch {
    return null;
  }
};

const NS_PER_MS = 1_000_000n;

/** An attribute's value is wrapped in whichever type it turned out to be. */
const plainly = (value: Record<string, unknown> | undefined): string | null => {
  if (!value) {
    return null;
  }

  for (const held of Object.values(value)) {
    if (held === null || held === undefined) {
      continue;
    }
    if (typeof held === 'object') {
      // An array or a map of its own. Kept as it reads rather than walked:
      // this is a vocabulary that changes between releases.
      return JSON.stringify(held);
    }
    return String(held);
  }

  return null;
};

const said = (span: Exported): SpanAttribute[] =>
  (span.attributes ?? []).flatMap((each) => {
    const value = plainly(each?.value);
    return each?.key && value !== null ? [{ name: each.key, value }] : [];
  });

/**
 * Two is the error code in the specification, and the only one worth telling
 * apart: unset and ok both mean nothing went wrong.
 */
const wentWrong = (span: Exported): boolean =>
  span.status?.code === 2 || span.status?.code === 'STATUS_CODE_ERROR';

/**
 * Reads one run's spans, of the harnesses that report any. Ordered as the
 * journal has them, which is the order they were exported in rather than the
 * order they happened: a span is written down when it ends, and nesting is
 * what the ids are for.
 */
export class Reported {
  #spans: RunSpan[] = [];

  take(event: Journalled): void {
    if (event.type !== 'span' || !event.data) {
      return;
    }

    let sent: Exported;
    try {
      sent = JSON.parse(decoded(event.data)) as Exported;
    } catch {
      return;
    }

    const from = nanos(sent.startTimeUnixNano);
    const to = nanos(sent.endTimeUnixNano);

    // A span with no identity cannot be hung anywhere, and one with no start
    // cannot be laid against a clock. Either way there is nothing to draw.
    if (!sent.spanId || from === null) {
      return;
    }

    this.#spans.push({
      id: sent.spanId,
      parentId: sent.parentSpanId || null,
      name: sent.name ?? 'a span',
      startedAt: new Date(Number(from / NS_PER_MS)),
      ms: to === null ? 0 : Number((to - from) / NS_PER_MS),
      failed: wentWrong(sent),
      attributes: said(sent),
    });
  }

  spans(): RunSpan[] {
    return this.#spans;
  }
}
