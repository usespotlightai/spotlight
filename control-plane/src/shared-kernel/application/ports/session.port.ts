export const SESSION_READER = Symbol('SESSION_READER');

export type RequestHeaders = Record<string, string | string[] | undefined>;

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export interface SessionReaderPort {
  read(headers: RequestHeaders): Promise<AuthenticatedUser | null>;
  readBearer(token: string): Promise<AuthenticatedUser | null>;
}
