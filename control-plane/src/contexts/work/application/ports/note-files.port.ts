export const NOTE_FILES = Symbol('NOTE_FILES');

export interface NoteFilesPort {
  open(taskId: string, attachmentId: string): Promise<Uint8Array | null>;
}
