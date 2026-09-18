export class DraftReviewCommentCommand {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly viewerId: string,
    readonly body: string,
    readonly on:
      | {
          readonly path: string;
          readonly side: string;
          readonly line: number;
          readonly startLine: number | null;
        }
      | { readonly replyTo: string },
  ) {}
}
