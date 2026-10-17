import type { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import type {
  AttachmentsIR,
  EventIR,
  RaiseIR,
  RequestIR,
} from '@integrations/infrastructure/integrations/integration.compile';
import { type Bindings, bound } from '@platform/expressions/bindings';
import { evaluateText, isTrue, value } from '@platform/expressions/readings';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import type {
  Arriving,
  Happened,
  TaskMark,
} from '@work/application/contracts/happenings.contract';

const identity = async (
  _event: EventIR,
  against: Bindings,
): Promise<Bindings> => against;

export type Fetching = (
  request: RequestIR,
  against: Bindings,
) => Promise<Uint8Array>;

export const readEvents = async (
  events: readonly EventIR[],
  declaring: (happening: string) => DeclaredHappening | null,
  against: Bindings,
  ourOwn: (against: Bindings) => boolean,
  enrich: (event: EventIR, against: Bindings) => Promise<Bindings> = identity,
  fetching: Fetching | null = null,
): Promise<Happened[]> => {
  const raised: Happened[] = [];

  for (const event of events) {
    const declared = declaring(event.raise.happening);

    if (!declared) {
      continue;
    }

    if (event.forEach) {
      const list = value(event.forEach, against);

      if (Array.isArray(list)) {
        for (const item of list) {
          const per = { ...against, item: bound(item) };

          if (isTrue(event.when, per)) {
            const filled = await enrich(event, per);
            raised.push(
              raiseFrom(
                event.raise,
                declared,
                filled,
                ourOwn(filled),
                fetching,
              ),
            );
          }
        }
      }

      continue;
    }

    if (isTrue(event.when, against)) {
      const filled = await enrich(event, against);
      raised.push(
        raiseFrom(event.raise, declared, filled, ourOwn(filled), fetching),
      );
    }
  }

  return raised;
};

const arriving = (
  attachments: AttachmentsIR,
  against: Bindings,
  fetching: Fetching,
): Arriving[] => {
  const files = value(attachments.each, against);

  if (!Array.isArray(files)) {
    return [];
  }

  return files.flatMap((file) => {
    const per = { ...against, file: bound(file) };
    const name = evaluateText(attachments.name, per);
    const size = attachments.size
      ? Number(value(attachments.size, per))
      : Number.NaN;

    return name
      ? [
          {
            name,
            contentType: attachments.type
              ? evaluateText(attachments.type, per)
              : null,
            size: Number.isFinite(size) ? size : null,
            fetch: () => fetching(attachments.fetch, per),
          },
        ]
      : [];
  });
};

const raiseFrom = (
  raise: RaiseIR,
  declared: DeclaredHappening,
  against: Bindings,
  ourOwn: boolean,
  fetching: Fetching | null,
): Happened => {
  const marked = raise.marks
    .map((mark) => {
      const read = evaluateText(mark.value, against);

      return read
        ? { mark: { kind: mark.kind.value, value: read }, finds: mark.finds }
        : null;
    })
    .filter(
      (each): each is { mark: TaskMark; finds: boolean } => each !== null,
    );

  const marks = marked.map((each) => each.mark);

  const branch = raise.branch
    ? evaluateText(raise.branch, against) || null
    : null;
  const finding = marked.filter((each) => each.finds).map((each) => each.mark);

  if (!branch && finding.length === 0) {
    throw new UpstreamError(
      `reading a ${declared.happening.value}`,
      'it names neither a branch nor anything this line knows a task by',
    );
  }

  const title = raise.opens ? evaluateText(raise.opens.title, against) : null;
  const messageText = raise.message
    ? (evaluateText(raise.message, against) ?? '').trim()
    : '';

  return {
    happening: declared.happening.value,
    summary: declared.summary,
    answers: declared.answers,
    state: 'raised',
    concerns: { branch, marks: finding },
    message: messageText ? { body: messageText } : null,
    ourOwn,
    opens:
      declared.opens && raise.opens && title
        ? {
            lineRole: declared.opens.lineRole,
            station: declared.opens.station,
            title,
            description: raise.opens.description
              ? evaluateText(raise.opens.description, against)
              : null,
            assignEmail: raise.opens.assignBy
              ? evaluateText(raise.opens.assignBy.email, against)
              : null,
            marks,
          }
        : null,
    attachments:
      raise.attachments && fetching
        ? arriving(raise.attachments, against, fetching)
        : [],
  };
};
