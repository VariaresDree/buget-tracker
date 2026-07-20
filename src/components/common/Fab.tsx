import { Plus } from 'lucide-react';

interface Props {
  label: string;
  onClick: () => void;
}

/** Floating quick-add. 56px, clears the tab bar and the home indicator. */
export default function Fab({ label, onClick }: Props) {
  return (
    <button className="fab" aria-label={label} onClick={onClick}>
      <Plus size={24} aria-hidden="true" />
    </button>
  );
}
