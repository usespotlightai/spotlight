import type { RequestHeaders } from '@platform/http/request-headers';
import type { AuthenticatedUser } from '@shared-kernel/application/dto/authenticated-user.dto';

export const SESSION_READER = Symbol('SESSION_READER');

export interface SessionReaderPort {
  read(headers: RequestHeaders): Promise<AuthenticatedUser | null>;
  readBearer(token: string): Promise<AuthenticatedUser | null>;
}
