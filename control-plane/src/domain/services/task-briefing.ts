import type { Task } from '@domain/aggregates/task.aggregate';
import type { Station } from '@domain/entities/station.entity';

export const TaskBriefing = {
  brief(station: Station, task: Task): string {
    const notes = task.notes.map(
      (note) => `### ${note.station.value}\n\n${note.body.value}`,
    );

    return [
      station.agentPrompt?.value,
      `## ${task.title.value}`,
      task.description?.value,
      notes.length > 0 ? ['## Already done', ...notes].join('\n\n') : null,
    ]
      .filter(Boolean)
      .join('\n\n');
  },
};
