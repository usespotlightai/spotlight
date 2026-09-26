export const HOOK_CALLBACKS = Symbol('HOOK_CALLBACKS');

export interface CallbackHolder {
  readonly workspaceId: string;
  readonly taskId: string;
  readonly hook: string;
  readonly firing: string | null;
}

export interface HookCallbacksPort {
  minted(holder: CallbackHolder, until: Date): Promise<string>;

  heldBy(token: string, now: Date): Promise<CallbackHolder | null>;
}
