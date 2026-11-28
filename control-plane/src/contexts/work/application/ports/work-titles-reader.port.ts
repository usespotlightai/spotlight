export const WORK_TITLES_READER = Symbol('WORK_TITLES_READER');

export interface WorkTitlesReaderPort {
  /** The title of each task found, by its id. */
  taskTitles(taskIds: readonly string[]): Promise<ReadonlyMap<string, string>>;

  /** The title of each chat found, by its id. */
  chatTitles(chatIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
