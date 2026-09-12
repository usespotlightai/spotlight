/**
 * A person speaks to the agent working a run. Said while it works, this is how
 * they steer it — the runner takes the words up mid-turn — and said between
 * turns it simply joins the trail for the next one. Either way the act is the
 * same, which is why it is one command and not two; it is distinct from
 * answering an inbox item, which replies to a run that has already settled and
 * asked.
 */
export class SayToRunCommand {
  constructor(
    readonly runId: string,
    readonly saidBy: string,
    readonly body: string,
    readonly attachments: readonly string[] = [],
  ) {}
}
