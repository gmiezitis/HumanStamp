export const aiClaimOptions = [
  { value: 'human', label: 'Human-made — no AI tools declared' },
  { value: 'human+ai', label: 'Human + AI tools' },
  { value: 'ai-generated', label: 'AI-generated' },
] as const;

export function aiClaimLabel(claim: string) {
  if (claim === 'ai-assisted') return 'Human + AI tools'; // Historical label.
  return (
    aiClaimOptions.find((option) => option.value === claim)?.label ||
    'Unrecognized declaration — ask the agency'
  );
}
