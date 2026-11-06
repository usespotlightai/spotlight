import {
  CLOSES_A_CONVERSATION,
  OPENS_A_CONVERSATION,
  REOPENS_A_CONVERSATION,
} from '@work/domain/services/conversations';
import { READABLE_KIND } from '@work/domain/services/unread';
import {
  task,
  taskNote,
} from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { sql } from 'drizzle-orm';

export const closesAConversation = sql`${taskNote.kind} = ${CLOSES_A_CONVERSATION}
  and (select earlier.kind from ${taskNote} earlier
    where earlier.task_id = ${taskNote.taskId}
      and earlier.position < ${taskNote.position}
      and earlier.kind in (${OPENS_A_CONVERSATION}, ${CLOSES_A_CONVERSATION}, ${REOPENS_A_CONVERSATION})
    order by earlier.position desc limit 1) in (${OPENS_A_CONVERSATION}, ${REOPENS_A_CONVERSATION})
  and coalesce((select later.kind from ${taskNote} later
    where later.task_id = ${taskNote.taskId}
      and later.position > ${taskNote.position}
      and later.kind in (${OPENS_A_CONVERSATION}, ${REOPENS_A_CONVERSATION})
    order by later.position limit 1), ${OPENS_A_CONVERSATION}) <> ${REOPENS_A_CONVERSATION}`;

export const hasAnUnseenAsk = sql`exists (select 1 from ${taskNote} unseen
  where unseen.task_id = ${task.id}
    and unseen.kind = ${READABLE_KIND}
    and unseen.read_at is null)`;
