import type {
  RunSpan,
  SpanAttribute,
} from '@work/application/contracts/run-journal.contract';
import {
  decoded,
  type Journalled,
} from '@work/infrastructure/journal/journalled';

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

const plainly = (value: Record<string, unknown> | undefined): string | null => {
  if (!value) {
    return null;
  }

  for (const entry of Object.values(value)) {
    if (entry === null || entry === undefined) {
      continue;
    }
    if (typeof entry === 'object') {
      return JSON.stringify(entry);
    }
    return String(entry);
  }

  return null;
};

const said = (span: Exported): SpanAttribute[] =>
  (span.attributes ?? []).flatMap((each) => {
    const value = plainly(each?.value);
    return each?.key && value !== null ? [{ name: each.key, value }] : [];
  });

const isError = (span: Exported): boolean =>
  span.status?.code === 2 || span.status?.code === 'STATUS_CODE_ERROR';

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

    if (!sent.spanId || from === null) {
      return;
    }

    this.#spans.push({
      id: sent.spanId,
      parentId: sent.parentSpanId || null,
      name: sent.name ?? 'a span',
      startedAt: new Date(Number(from / NS_PER_MS)),
      ms: to === null ? 0 : Number((to - from) / NS_PER_MS),
      failed: isError(sent),
      attributes: said(sent),
    });
  }

  spans(): RunSpan[] {
    return this.#spans;
  }
}
