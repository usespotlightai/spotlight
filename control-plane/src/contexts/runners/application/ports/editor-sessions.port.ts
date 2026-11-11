import type { Duplex } from 'node:stream';

import type { EditorConnectionDto } from '@runners/application/dto/sandbox-editor.dto';
import type { EditorLeasesPort } from '@runners/application/ports/editor-leases.port';
import type { EditorSandbox } from '@runners/application/ports/editor-sandboxes.port';

export const EDITOR_SESSIONS = Symbol('EDITOR_SESSIONS');

export interface EditorSessionsPort extends EditorLeasesPort {
  admits(connection: EditorConnectionDto): Promise<boolean>;

  renew(connection: EditorConnectionDto): Promise<EditorSandbox | null>;

  release(connection: EditorConnectionDto): Promise<void>;

  stateOf(connection: EditorConnectionDto): Promise<EditorSandbox | null>;

  stream(connection: EditorConnectionDto): Promise<Duplex | null>;

  renewEvery(): number;
}
