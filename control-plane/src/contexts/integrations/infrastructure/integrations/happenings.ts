import type { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import type { RaisedMark } from '@integrations/domain/value-objects/raised-happening.vo';
import type {
  AttachmentsIR,
  EventIR,
  RaiseIR,
  RequestIR,
} from '@integrations/infrastructure/integrations/integration.compile';
import {
  type CelVariables,
  sanitizedForCel,
} from '@platform/expressions/cel-variables';
import { evaluateText, isTrue, value } from '@platform/expressions/readings';
import type {
  Happened,
  InboundAttachment,
  TaskMark,
} from '@work/application/contracts/happenings.contract';

const identity = async (
  _event: EventIR,
  against: CelVariables,
): Promise<CelVariables> => against;

export type Fetching = (
  request: RequestIR,
  against: CelVariables,
) => Promise<Uint8Array>;

export const readEvents = async (
  events: readonly EventIR[],
  declaring: (happening: string) => DeclaredHappening | null,
  against: CelVariables,
  ourOwn: (against: CelVariables) => boolean,
  enrich: (
    event: EventIR,
    against: CelVariables,
  ) => Promise<CelVariables> = identity,
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
          const per = { ...against, item: sanitizedForCel(item) };

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
  against: CelVariables,
  fetching: Fetching,
): InboundAttachment[] => {
  const files = value(attachments.each, against);

  if (!Array.isArray(files)) {
    return [];
  }

  return files.flatMap((file) => {
    const per = { ...against, file: sanitizedForCel(file) };
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
  against: CelVariables,
  ourOwn: boolean,
  fetching: Fetching | null,
): Happened => {
  const raised = declared.raised({
    branch: raise.branch ? evaluateText(raise.branch, against) : null,
    marks: raise.marks.map((mark) => ({
      kind: mark.kind,
      value: evaluateText(mark.value, against) ?? '',
      finds: mark.finds,
    })),
    opening: raise.opens
      ? {
          title: evaluateText(raise.opens.title, against),
          description: raise.opens.description
            ? evaluateText(raise.opens.description, against)
            : null,
          assignEmail: raise.opens.assignBy
            ? evaluateText(raise.opens.assignBy.email, against)
            : null,
        }
      : null,
  });
  const markOf = (each: RaisedMark): TaskMark => ({
    kind: each.kind.value,
    value: each.value,
  });
  const messageText = raise.message
    ? (evaluateText(raise.message, against) ?? '').trim()
    : '';

  return {
    happening: declared.happening.value,
    summary: declared.summary,
    answers: declared.answers,
    state: 'raised',
    correlationKeys: {
      branch: raised.branch,
      marks: raised.finding.map(markOf),
    },
    message: messageText ? { body: messageText } : null,
    authorEmail: raise.author
      ? evaluateText(raise.author.email, against) || null
      : null,
    ourOwn,
    opens: raised.opens
      ? {
          lineRole: raised.opens.opening.lineRole,
          station: raised.opens.opening.station,
          title: raised.opens.title,
          description: raised.opens.description,
          assignEmail: raised.opens.assignEmail,
          marks: raised.marks.map(markOf),
        }
      : null,
    chat: raise.chat
      ? {
          email: evaluateText(raise.chat.by.email, against) || null,
          harness: raise.chat.harness,
          marks: raised.marks.map((each) => ({
            ...markOf(each),
            finds: each.finds,
          })),
        }
      : null,
    attachments:
      raise.attachments && fetching
        ? arriving(raise.attachments, against, fetching)
        : [],
  };
};
