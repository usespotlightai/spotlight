export const SESSION_READER = Symbol('SESSION_READER');

export type SessionHeaders = Readonly<
  Record<string, string | string[] | undefined>
>;

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export interface SessionReaderPort {
  read(headers: SessionHeaders): Promise<SessionUser | null>;
  readBearer(token: string): Promise<SessionUser | null>;
}
