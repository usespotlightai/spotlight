export const MEMBER_MAIL = Symbol('MEMBER_MAIL');

export type MemberMailKind = 'suspended' | 'unsuspended' | 'left';

export interface MemberMailToSend {
  readonly kind: MemberMailKind;
  readonly to: string;
  readonly workspaceName: string;
  readonly by: string | null;
}

export interface MemberMailPort {
  send(mail: MemberMailToSend): Promise<void>;
}
