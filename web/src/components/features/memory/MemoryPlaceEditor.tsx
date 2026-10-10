import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { FieldInput } from '@/components/shared/form/FieldInput';
import type { MemoryDraft } from '@/hooks/useMemoryDraft';
import type { LineResponseDto } from '@/lib/api';

const CONTROL = 'w-full rounded-md';

const BRANCH = 'relative min-w-0 pl-5';

const LEAF =
  'relative min-w-0 pt-1.5 before:absolute before:-top-0.5 before:left-[-14px] before:h-5 before:border-muted-foreground/50 before:border-l before:border-dotted after:absolute after:top-[18px] after:left-[-14px] after:w-[13px] after:border-muted-foreground/50 after:border-t after:border-dotted';

type MemoryPlaceEditorProps = {
  draft: MemoryDraft;
  lines: readonly LineResponseDto[];
};

export function MemoryPlaceEditor({ draft, lines }: MemoryPlaceEditorProps) {
  return (
    <ul aria-label="Where it applies" className="min-w-0">
      <li className="min-w-0">
        <ChoiceSelect
          compact
          label="Line"
          choices={lines.map((each) => ({ value: each.id, label: each.name }))}
          value={draft.lineId}
          placeholder="The whole team"
          className={CONTROL}
          onChange={draft.chooseLine}
        />
        <ul className={BRANCH}>
          <li className={LEAF}>
            <ChoiceSelect
              compact
              label="Station"
              choices={draft.stations.map((each) => ({
                value: each.id,
                label: each.name,
              }))}
              value={draft.stationId}
              placeholder="Every station"
              disabled={!draft.line}
              className={CONTROL}
              onChange={draft.setStationId}
            />
            <ul className={BRANCH}>
              <li className={LEAF}>
                <ChoiceSelect
                  compact
                  label="Repository"
                  choices={draft.repositories.map((each) => ({
                    value: each,
                    label: each,
                  }))}
                  value={draft.repository}
                  placeholder="Any repository"
                  className={CONTROL}
                  onChange={draft.setRepository}
                />
                <ul className={BRANCH}>
                  <li className={LEAF}>
                    <FieldInput
                      value={draft.paths}
                      disabled={!draft.repository}
                      onChange={(event) => draft.setPaths(event.target.value)}
                      placeholder="Paths, separated by commas"
                      aria-label="Paths"
                      className={`${CONTROL} h-6 border bg-card px-2 text-[0.7rem] md:text-[0.7rem]`}
                    />
                  </li>
                </ul>
              </li>
            </ul>
          </li>
        </ul>
      </li>
    </ul>
  );
}
