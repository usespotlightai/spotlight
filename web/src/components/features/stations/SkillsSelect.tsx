import { SquareMousePointer } from 'lucide-react';
import { CheckboxSelect } from '@/components/features/stations/CheckboxSelect';
import { useTeamSkills } from '@/hooks/api/useTeamSkills';

type SkillsSelectProps = {
  teamId: string | undefined;
  value: readonly string[];
  onChange: (skills: string[]) => void;
};

export function SkillsSelect({ teamId, value, onChange }: SkillsSelectProps) {
  const { data } = useTeamSkills(teamId);

  const names = [
    ...new Set([...(data?.skills ?? []).map((each) => each.key), ...value]),
  ].sort();

  return (
    <CheckboxSelect
      label="Skills"
      icon={SquareMousePointer}
      options={names}
      value={value}
      onChange={onChange}
      none="No skills"
      many={(count) => `${count} skills`}
      empty="This team defines no skills yet"
    />
  );
}
