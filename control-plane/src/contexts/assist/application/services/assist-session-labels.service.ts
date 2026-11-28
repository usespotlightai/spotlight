import type {
  AssistSessionLabelSource,
  AssistSessionLabelsPort,
} from '@assist/application/ports/assist-session-labels.port';
import type {
  AssistSessionReaderPort,
  NamedSessionRow,
} from '@assist/application/ports/assist-session-reader.port';
import {
  ASSIST_OWNER,
  ASSIST_REQUESTER_KIND,
  type RunsPort,
  type RunWork,
} from '@assist/application/ports/runs.port';
import { ASSISTING_TITLE } from '@assist/application/rendering/session-label.text';
import { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import {
  type LabelledRequester,
  type RequesterLabel,
  type RunRequesterLabelSource,
  requesterRefOf,
} from '@runs/application/ports/run-requester-labels.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

/**
 * Names a session's run as the context that ordered the session names its purpose. Whoever may read the run the
 * session is based on sees the name. Where the session is gone, the members of its run's team do.
 */
export class AssistSessionLabels
  implements AssistSessionLabelsPort, RunRequesterLabelSource
{
  readonly owner = ASSIST_OWNER;

  private readonly sources = new Map<string, AssistSessionLabelSource>();

  constructor(
    private readonly sessions: AssistSessionReaderPort,
    private readonly runs: RunsPort,
  ) {}

  register(source: AssistSessionLabelSource): void {
    this.sources.set(source.context, source);
  }

  async labelsOf(
    requesters: readonly LabelledRequester[],
  ): Promise<ReadonlyMap<string, RequesterLabel>> {
    const ofSessions = requesters.filter(
      (each) =>
        each.owner === ASSIST_OWNER && each.kind === ASSIST_REQUESTER_KIND,
    );
    const sessions = await this.sessions.sessionsOf(
      ofSessions.map((each) => each.id),
    );
    const work = await this.runs.workOf(
      sessions.map((each) => RunId.of(each.basedOnRun)),
    );

    return new Map(
      ofSessions.flatMap((requester) => {
        const session = sessions.find((each) => each.id === requester.id);
        const label = session
          ? this.labelOf(session, work)
          : this.goneLabelOf(requester);

        return label ? [[requesterRefOf(requester), label] as const] : [];
      }),
    );
  }

  private labelOf(
    session: NamedSessionRow,
    work: readonly RunWork[],
  ): RequesterLabel {
    const basedOn = RunId.of(session.basedOnRun);
    const worked = work.find((each) => each.runId.equals(basedOn));
    const named = this.sources
      .get(AssistPurpose.of(session.purpose).context)
      ?.labelOf({
        purpose: session.purpose,
        key: session.key,
        basedOn: {
          runId: basedOn.value,
          task: worked?.task ?? null,
          station: worked?.station ?? null,
        },
      });

    return {
      title: named?.title ?? ASSISTING_TITLE,
      readers: { of: 'run', runId: basedOn, opens: named?.opens ?? false },
    };
  }

  private goneLabelOf(requester: LabelledRequester): RequesterLabel | null {
    return requester.team === null
      ? null
      : {
          title: ASSISTING_TITLE,
          readers: {
            of: 'team-members',
            teamId: TeamId.of(requester.team),
          },
        };
  }
}
