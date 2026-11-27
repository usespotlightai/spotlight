type RetirementLapsedNoteProps = {
  inactive: string[];
};

export function RetirementLapsedNote({ inactive }: RetirementLapsedNoteProps) {
  if (inactive.length === 0) return null;
  return (
    <p className="pt-2 text-muted-foreground text-sm">
      {`${inactive.join(' and ')} ${inactive.length === 1 ? 'is' : 'are'} no longer active, so this retirement no longer applies.`}
    </p>
  );
}
