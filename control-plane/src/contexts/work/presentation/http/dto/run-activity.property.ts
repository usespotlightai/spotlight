import { RUN_ACTIVITY_NAMES } from '@work/application/dto/task-run.dto';

export const RUN_ACTIVITY_PROPERTY = {
  enum: [...RUN_ACTIVITY_NAMES, null],
  nullable: true,
  description:
    'What the run does now: queued, working or stopping. A paused run is queued or working again once its question has an answer. Null while it waits for a person or once it has ended',
};
