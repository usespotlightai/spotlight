import type { MemoryGroundNoteDto } from '@memory/application/dto/memory-review.dto';
import type { TaskNote } from '@memory/application/ports/work.port';
import type { PersonLookup } from '@memory/application/services/people-lookup';

export const groundNotes = async (
  notes: readonly TaskNote[],
  cited: readonly number[],
  person: PersonLookup,
): Promise<MemoryGroundNoteDto[]> =>
  Promise.all(
    notes
      .filter((each) => cited.includes(each.position))
      .map(async (each) => ({
        position: each.position,
        by: each.by,
        author: each.author ? await person(each.author) : null,
        text: each.text,
      })),
  );
