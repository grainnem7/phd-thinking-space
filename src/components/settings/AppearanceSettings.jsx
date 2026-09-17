import { useId } from 'react';
import { BookOpenText, Check, Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useEink } from '../../contexts/EinkContext';
import { useAuth } from '../../hooks/useAuth';
import { useConfirm } from '../common/ConfirmDialog';
import Button from '../common/Button';
import {
  ACCENTS,
  BACKGROUNDS,
  BODY_FONTS,
  DEFAULT_APPEARANCE,
  HEADING_FONTS,
  SCHEMES,
  TEXT_SIZES,
  setAppearance,
  useAppearance,
} from '../../lib/appearance';

const MODES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

// Illustrative light/dark swatches for the background options (Classic greys)
const BACKGROUND_SWATCH = {
  crisp: { light: '#ffffff', dark: '#0a0a0a' },
  soft: { light: '#f5f5f5', dark: '#141414' },
  softer: { light: '#ececec', dark: '#1f1f1f' },
};

const HEADING_SAMPLE_FONT = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "'Inter', system-ui, sans-serif",
};

// Focus ring for a visually hidden radio, drawn on its label
const FOCUS_WITHIN = 'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-white dark:has-[:focus-visible]:ring-offset-neutral-900';

// A group of native radio buttons (arrow keys move between options) rendered
// as custom cards, swatches or a segmented control.
function ChoiceGroup({ legend, hint, value, options, onChange, className, optionClassName, renderOption }) {
  const name = useId();
  const hintId = `${name}-hint`;
  return (
    <fieldset className="min-w-0" aria-describedby={hint ? hintId : undefined}>
      <legend className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{legend}</legend>
      {hint && <p id={hintId} className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
      <div className={`mt-2.5 ${className}`}>
        {options.map((option) => {
          const checked = option.id === value;
          return (
            <label
              key={option.id}
              title={option.title}
              className={`relative cursor-pointer transition-colors ${FOCUS_WITHIN} ${optionClassName(checked)}`}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={checked}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
              {renderOption(option, checked)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const segmentClass = (checked) => `flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${checked
  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'}`;

const SEGMENTED = 'inline-flex flex-wrap p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg';

const cardClass = (checked) => `block rounded-xl border p-2 ${checked
  ? 'border-accent ring-1 ring-accent bg-white dark:bg-neutral-900'
  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700'}`;

function SelectedMark({ checked }) {
  if (!checked) return null;
  return (
    <span className="absolute top-1.5 right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-accent text-accent-fg shadow-sm">
      <Check size={12} strokeWidth={3} aria-hidden="true" />
    </span>
  );
}

function SchemeHalf({ colors }) {
  return (
    <div className="flex-1 p-1.5" style={{ background: colors.page }}>
      <div className="h-full rounded-md p-1.5 space-y-1" style={{ background: colors.surface, border: `1px solid ${colors.line}` }}>
        <div className="h-1.5 w-3/4 rounded-full" style={{ background: colors.ink }} />
        <div className="h-1 w-full rounded-full" style={{ background: colors.muted }} />
        <div className="h-1 w-2/3 rounded-full" style={{ background: colors.muted }} />
      </div>
    </div>
  );
}

// Uses the app's real classes, so it shows the current scheme, accent, fonts and size
function Preview() {
  return (
    <div
      aria-hidden="true"
      className="flex gap-3 p-3 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-[var(--bg-page)] select-none"
    >
      <div className="hidden sm:flex flex-col gap-1 w-28 shrink-0 text-sm">
        <span className="px-2 py-1.5 rounded-md bg-accent-soft text-accent-ink font-medium">Dashboard</span>
        <span className="px-2 py-1.5 rounded-md text-neutral-500 dark:text-neutral-400">Notes</span>
        <span className="px-2 py-1.5 rounded-md text-neutral-500 dark:text-neutral-400">Reading list</span>
      </div>
      <div className="flex-1 min-w-0 p-4 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <p className="section-label">Preview</p>
        <p className="mt-1 font-serif text-xl text-neutral-900 dark:text-neutral-100 tracking-tight">Chapter 3 — Methods</p>
        <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
          Interviews with twelve participants, coded in two passes. <span className="text-accent-ink underline underline-offset-2">See outline</span>
        </p>
        <div className="mt-3 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-accent" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">4 of 6 sections drafted</span>
          <span className="px-3 py-1.5 text-sm rounded-lg bg-accent text-accent-fg">Continue</span>
        </div>
      </div>
    </div>
  );
}

export default function AppearanceSettings() {
  const appearance = useAppearance();
  const { preference, setTheme, isDark, isDarkSuppressed } = useTheme();
  const { einkMode, setEinkMode } = useEink();
  const { isDemo } = useAuth();
  const confirm = useConfirm();
  const einkLabelId = useId();

  const update = (key) => (id) => setAppearance({ [key]: id });

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Reset appearance?',
      body: 'Colour scheme, accent, fonts, text size, light/dark and e-reader mode will go back to their defaults.',
      confirmLabel: 'Reset',
      danger: false,
    });
    if (!ok) return;
    setAppearance(DEFAULT_APPEARANCE);
    setTheme('system');
    setEinkMode(null);
  };

  const accentLabel = ACCENTS.find((a) => a.id === appearance.accent)?.label;

  return (
    <div className="space-y-7">
      <Preview />

      {/* Light / dark and e-reader */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-8">
        <ChoiceGroup
          legend="Mode"
          hint={isDarkSuppressed ? 'Dark mode is paused while e-reader mode is on.' : undefined}
          value={preference}
          options={MODES}
          onChange={setTheme}
          className={SEGMENTED}
          optionClassName={segmentClass}
          renderOption={(mode) => (
            <>
              <mode.icon size={14} aria-hidden="true" />
              {mode.label}
            </>
          )}
        />

        <div className="flex items-start justify-between gap-4 sm:flex-1 min-w-0">
          <div className="min-w-0">
            <p id={einkLabelId} className="text-sm font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <BookOpenText size={14} aria-hidden="true" /> E-reader mode
            </p>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              High contrast, no animation. Overrides colours.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={einkMode}
            aria-labelledby={einkLabelId}
            onClick={() => setEinkMode(!einkMode)}
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900 ${einkMode ? 'bg-accent' : 'bg-neutral-200 dark:bg-neutral-700'}`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${einkMode ? 'translate-x-[1.375rem]' : 'translate-x-0.5'}`}
            />
          </button>
        </div>
      </div>

      {einkMode && (
        <p className="text-xs text-neutral-600 dark:text-neutral-300 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
          E-reader mode uses its own black-and-white palette. Your colour choices apply again when you turn it off.
        </p>
      )}

      <ChoiceGroup
        legend="Colour scheme"
        hint="Each scheme has a light and a dark version."
        value={appearance.scheme}
        options={SCHEMES}
        onChange={update('scheme')}
        className="grid grid-cols-2 sm:grid-cols-3 gap-2"
        optionClassName={cardClass}
        renderOption={(scheme, checked) => (
          <>
            <div className="flex h-16 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
              <SchemeHalf colors={scheme.light} />
              <SchemeHalf colors={scheme.dark} />
            </div>
            <span className="block mt-2 px-0.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">{scheme.label}</span>
            <span className="block px-0.5 text-xs text-neutral-500 dark:text-neutral-400">{scheme.description}</span>
            <SelectedMark checked={checked} />
          </>
        )}
      />

      <ChoiceGroup
        legend="Background"
        hint="How bright the page and cards are. Soft tints them with the scheme's colour."
        value={appearance.background}
        options={BACKGROUNDS}
        onChange={update('background')}
        className="grid grid-cols-1 sm:grid-cols-3 gap-2"
        optionClassName={(checked) => `${cardClass(checked)} !p-3`}
        renderOption={(option, checked) => (
          <>
            <span data-background={option.id} className="flex h-10 rounded-md overflow-hidden border border-neutral-200 dark:border-neutral-700" aria-hidden="true">
              <span className="flex-1" style={{ background: BACKGROUND_SWATCH[option.id].light }} />
              <span className="flex-1" style={{ background: BACKGROUND_SWATCH[option.id].dark }} />
            </span>
            <span className="block mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">{option.label}</span>
            <span className="block text-xs text-neutral-500 dark:text-neutral-400">{option.description}</span>
            <SelectedMark checked={checked} />
          </>
        )}
      />

      <ChoiceGroup
        legend={<>Accent colour <span className="font-normal text-neutral-500 dark:text-neutral-400">· {accentLabel}</span></>}
        hint="Buttons, highlights, progress and selected items."
        value={appearance.accent}
        options={ACCENTS.map((a) => ({ ...a, title: a.label }))}
        onChange={update('accent')}
        className="flex flex-wrap gap-2.5"
        optionClassName={(checked) => `flex items-center justify-center w-9 h-9 rounded-full ${checked
          ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900 ring-neutral-400 dark:ring-neutral-500'
          : 'hover:scale-110 motion-reduce:hover:scale-100 transition-transform'}`}
        renderOption={(accent, checked) => (
          <>
            <span
              className="flex items-center justify-center w-9 h-9 rounded-full border border-black/10 dark:border-white/15"
              style={{ background: isDark ? accent.dark : accent.light }}
            >
              {checked && (
                <Check size={16} strokeWidth={3} aria-hidden="true" style={{ color: isDark ? '#0a0a0a' : '#ffffff' }} />
              )}
            </span>
            <span className="sr-only">{accent.label}</span>
          </>
        )}
      />

      <ChoiceGroup
        legend="Body font"
        hint="Used for the interface and your notes."
        value={appearance.bodyFont}
        options={BODY_FONTS}
        onChange={update('bodyFont')}
        className="grid grid-cols-1 sm:grid-cols-3 gap-2"
        optionClassName={(checked) => `${cardClass(checked)} !p-3`}
        renderOption={(font, checked) => (
          <>
            <span className="block text-2xl leading-none text-neutral-900 dark:text-neutral-100" style={{ fontFamily: font.family }}>Aa</span>
            <span className="block mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">{font.label}</span>
            <span className="block text-xs text-neutral-500 dark:text-neutral-400">{font.description}</span>
            <SelectedMark checked={checked} />
          </>
        )}
      />

      <div className="flex flex-col sm:flex-row gap-5 sm:gap-8">
        <ChoiceGroup
          legend="Headings"
          value={appearance.headingFont}
          options={HEADING_FONTS}
          onChange={update('headingFont')}
          className={SEGMENTED}
          optionClassName={segmentClass}
          renderOption={(font) => <span style={{ fontFamily: HEADING_SAMPLE_FONT[font.id] }}>{font.label}</span>}
        />

        <ChoiceGroup
          legend="Text size"
          value={appearance.textSize}
          options={TEXT_SIZES}
          onChange={update('textSize')}
          className={SEGMENTED}
          optionClassName={segmentClass}
          renderOption={(size) => (
            <>
              <span aria-hidden="true" className="font-serif leading-none" style={{ fontSize: `${size.px - 2}px` }}>A</span>
              {size.label}
            </>
          )}
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-5 border-t border-neutral-100 dark:border-neutral-800">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {isDemo
            ? 'Demo mode: saved on this device only.'
            : 'Colours, fonts and text size sync to your account. Mode and e-reader are per device.'}
        </p>
        <Button variant="secondary" size="sm" onClick={handleReset} className="self-start sm:self-auto shrink-0">
          <RotateCcw size={14} aria-hidden="true" />
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
