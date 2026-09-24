export interface AskedPermission {
  readonly sessionId: string | null;
  readonly kind: string;
  readonly title: string;
  readonly input: unknown;
}

export class AskPermissionCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly asked: AskedPermission,
  ) {}
}
