import type {
  RunSpan,
  SpanAttribute,
} from '@runs/application/contracts/run-journal.contract';
import {
  decoded,
  type Journalled,
} from '@runs/infrastructure/journal/journalled';
import { nonEmpty } from '@shared-kernel/domain/non-empty';

interface Exported {
  readonly spanId?: unknown;
  readonly parentSpanId?: unknown;
  readonly name?: unknown;
  readonly startTimeUnixNano?: unknown;
  readonly endTimeUnixNano?: unknown;
  readonly status?: unknown;
  readonly attributes?: unknown;
}

interface ExportedStatus {
  readonly code?: unknown;
}

interface ExportedAttribute {
  readonly key?: unknown;
  readonly value?: unknown;
}

const objectOr = (raw: unknown): object =>
  typeof raw === 'object' && raw !== null ? raw : {};

const filledText = (raw: unknown): string | null =>
  typeof raw === 'string' && raw !== '' ? raw : null;

const nanos = (raw: unknown): bigint | null => {
  if ((typeof raw !== 'string' && typeof raw !== 'number') || raw === '') {
    return null;
  }

  try {
    return BigInt(raw);
  } catch {
    return null;
  }
};

const NS_PER_MS = 1_000_000n;

const plainly = (value: unknown): string | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const entries: unknown[] = Object.values(value);
  for (const entry of entries) {
    if (entry === null || entry === undefined) {
      continue;
    }
    if (typeof entry === 'object') {
      return JSON.stringify(entry);
    }
    // oxlint-disable-next-line typescript/no-base-to-string -- every object was serialised above; what is left is a primitive
    return String(entry);
  }

  return null;
};

const attributesOf = (span: Exported): SpanAttribute[] => {
  const attributes: unknown[] = Array.isArray(span.attributes)
    ? span.attributes
    : [];

  return attributes.flatMap((each) => {
    const attribute: ExportedAttribute = objectOr(each);
    const name = filledText(attribute.key);
    const value = plainly(attribute.value);
    return name !== null && value !== null ? [{ name, value }] : [];
  });
};

const isError = (span: Exported): boolean => {
  const status: ExportedStatus = objectOr(span.status);
  return status.code === 2 || status.code === 'STATUS_CODE_ERROR';
};

export class Reported {
  readonly #spans: RunSpan[] = [];

  take(event: Journalled): void {
    if (event.type !== 'span' || !nonEmpty(event.data)) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded(event.data));
    } catch {
      return;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return;
    }

    const sent: Exported = parsed;
    const id = filledText(sent.spanId);
    const from = nanos(sent.startTimeUnixNano);
    const to = nanos(sent.endTimeUnixNano);

    if (id === null || from === null) {
      return;
    }

    this.#spans.push({
      id,
      parentId: filledText(sent.parentSpanId),
      name: typeof sent.name === 'string' ? sent.name : 'a span',
      startedAt: new Date(Number(from / NS_PER_MS)),
      ms: to === null ? 0 : Number((to - from) / NS_PER_MS),
      failed: isError(sent),
      attributes: attributesOf(sent),
    });
  }

  spans(): RunSpan[] {
    return this.#spans;
  }
}
