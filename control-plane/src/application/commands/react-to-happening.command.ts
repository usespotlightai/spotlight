export class ReactToHappeningCommand {
  constructor(
    /** What the host called this delivery, so a second one changes nothing. */
    readonly delivery: string,
    /** The host's own words, which only its adapter reads. */
    readonly event: string | undefined,
    readonly payload: unknown,
  ) {}
}
