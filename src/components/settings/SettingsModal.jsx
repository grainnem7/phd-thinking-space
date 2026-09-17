import { useState } from 'react';
import Modal from '../common/Modal';
import AppearanceSettings from './AppearanceSettings';
import DataSettings from './DataSettings';

const TABS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'data', label: 'Data & backup' },
];

export default function SettingsModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('appearance');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="lg">
      <div role="tablist" aria-label="Settings sections" className="inline-flex p-0.5 mb-5 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`settings-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`settings-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tab === t.id
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
        {tab === 'appearance' ? <AppearanceSettings /> : <DataSettings />}
      </div>
    </Modal>
  );
}
