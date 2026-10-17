import type { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import type {
  AttachesIR,
  EventIR,
  RaiseIR,
  RequestIR,
} from '@integrations/infrastructure/integrations/integration.compile';
import { type Bindings, bound } from '@platform/expressions/bindings';
import { isTrue, reads, value } from '@platform/expressions/readings';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
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
  attaches: AttachesIR,
  against: Bindings,
  fetching: Fetching,
): Arriving[] => {
  const files = value(attaches.each, against);

  if (!Array.isArray(files)) {
    return [];
  }

  return files.flatMap((file) => {
    const per = { ...against, file: bound(file) };
    const name = reads(attaches.name, per);
    const size = attaches.size ? Number(value(attaches.size, per)) : Number.NaN;

    return name
      ? [
          {
            name,
            contentType: attaches.type ? reads(attaches.type, per) : null,
            size: Number.isFinite(size) ? size : null,
            fetch: () => fetching(attaches.fetch, per),
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
      const read = reads(mark.value, against);

      return read
        ? { mark: { kind: mark.kind.value, value: read }, finds: mark.finds }
        : null;
    })
    .filter(
      (each): each is { mark: TaskMark; finds: boolean } => each !== null,
    );

  const marks = marked.map((each) => each.mark);

  const branch = raise.branch ? reads(raise.branch, against) || null : null;
  const finding = marked.filter((each) => each.finds).map((each) => each.mark);

  if (!branch && finding.length === 0) {
    throw new UpstreamRefusedError(
      `reading a ${declared.happening.value}`,
      'it names neither a branch nor anything this line knows a task by',
    );
  }

  const title = raise.opens ? reads(raise.opens.title, against) : null;
  const saying = raise.say ? (reads(raise.say, against) ?? '').trim() : '';

  return {
    happening: declared.happening.value,
    told: declared.told,
    spoken: declared.spoken,
    state: 'raised',
    concerns: { branch, marks: finding },
    said: saying ? { body: saying } : null,
    ourOwn,
    opens:
      declared.opens && raise.opens && title
        ? {
            onto: declared.opens.onto,
            at: declared.opens.at,
            title,
            description: raise.opens.description
              ? reads(raise.opens.description, against)
              : null,
            assignEmail: raise.opens.assignBy
              ? reads(raise.opens.assignBy.email, against)
              : null,
            marks,
          }
        : null,
    attachments:
      raise.attaches && fetching
        ? arriving(raise.attaches, against, fetching)
        : [],
  };
};
