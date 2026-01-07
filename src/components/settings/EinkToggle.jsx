import { useEink } from '../../contexts/EinkContext';
import { Monitor } from 'lucide-react';

export default function EinkToggle() {
  const { einkMode, toggleEinkMode } = useEink();

  return (
    <button
      onClick={toggleEinkMode}
      className="w-full flex items-center justify-between py-3 group text-left"
    >
      <div className="flex items-center gap-2">
        <Monitor size={16} className={einkMode ? 'text-neutral-900' : 'text-neutral-400'} />
        <div>
          <p className="text-sm text-neutral-700">E-reader mode</p>
          <p className="text-xs text-neutral-400">
            For Kindle, reMarkable, Boox
          </p>
        </div>
      </div>
      <span className={`text-sm ${einkMode ? 'text-neutral-900 font-medium' : 'text-neutral-400'}`}>
        {einkMode ? 'On' : 'Off'}
      </span>
    </button>
  );
}
