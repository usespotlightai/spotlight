export interface TaskNoteDto {
  // What identifies it: notes are appended and never reordered.
  readonly position: number;
  readonly station: string;
  readonly body: string;
}

export interface TaskPersonDto {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

export interface TaskDto {
  readonly id: string;
  readonly stationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly createdAt: string;
  readonly running: boolean;
  readonly awaitingReview: boolean;
  readonly note: TaskNoteDto | null;
  readonly raisedBy: TaskPersonDto | null;
}
