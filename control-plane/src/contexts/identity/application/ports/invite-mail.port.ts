export const INVITE_MAIL = Symbol('INVITE_MAIL');

export interface InviteToSend {
  readonly to: string;
  readonly token: string;
  readonly teamName: string;
  readonly workspaceName: string;
  readonly invitedBy: string;
}

export interface InviteMailPort {
  send(invite: InviteToSend): Promise<void>;
}
