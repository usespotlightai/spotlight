export const USER_EMAIL_MAIL = Symbol('USER_EMAIL_MAIL');

export interface VerificationToSend {
  readonly to: string;
  readonly token: string;
  readonly signInEmail: string;
}

export interface UserEmailMailPort {
  send(verification: VerificationToSend): Promise<void>;
}
