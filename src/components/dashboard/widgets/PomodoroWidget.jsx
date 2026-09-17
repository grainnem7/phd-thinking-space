import { useState, useEffect, useEffectEvent, useCallback, useId } from 'react';
import { Play, Pause, RotateCcw, Settings, Volume2, VolumeX } from 'lucide-react';
import WidgetHeader from './WidgetHeader';
import { labelClass, linkButton } from './styles';

const POMODORO_DEFAULTS = { workDuration: 25, breakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 };

function loadPomodoroSettings() {
  try {
    const raw = localStorage.getItem('pomodoroSettings');
    if (!raw) return POMODORO_DEFAULTS;
    return { ...POMODORO_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return POMODORO_DEFAULTS;
  }
}

const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

// Ask for notification permission only in response to the user starting a timer
function requestNotificationPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  try {
    Notification.requestPermission()?.catch?.(() => {});
  } catch {
    /* older browsers: callback-only API or blocked; notifications stay off */
  }
}

const iconToggleClass =
  'text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-300 transition-colors p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600';

const numberInputClass =
  'w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-neutral-300 dark:focus:border-neutral-600';

const controlButtonClass =
  'flex items-center gap-2 text-base rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600';

const settingsButtonClass =
  'flex-1 py-2 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600';

export default function PomodoroWidget() {
  const [settings, setSettings] = useState(loadPomodoroSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => loadPomodoroSettings().workDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessions, setSessions] = useState(() => {
    const v = parseInt(localStorage.getItem('pomodoroSessions') || '0', 10);
    return Number.isFinite(v) ? v : 0;
  });
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('pomodoroSound') !== 'false');
  const idPrefix = useId();

  useEffect(() => { localStorage.setItem('pomodoroSettings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('pomodoroSound', String(soundEnabled)); }, [soundEnabled]);
  useEffect(() => { localStorage.setItem('pomodoroSessions', String(sessions)); }, [sessions]);

  const playNotification = useCallback((isWorkComplete) => {
    if (!soundEnabled) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(isWorkComplete ? 'Focus complete!' : 'Break over!', {
        body: isWorkComplete ? 'Time for a break.' : 'Ready to focus?',
      });
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beep = (f, t, d) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.frequency.value = f;
        g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.01, t + d);
        o.start(t); o.stop(t + d);
      };
      const now = ctx.currentTime;
      beep(523, now, 0.2); beep(659, now + 0.25, 0.2); beep(784, now + 0.5, 0.4);
      setTimeout(() => ctx.close(), 1500);
    } catch { /* audio unavailable, fall back to silent */ }
  }, [soundEnabled]);

  // Phase finished: notify, count the session and queue up the next phase
  const finishPhase = useEffectEvent(() => {
    playNotification(!isBreak);
    if (!isBreak) setSessions((p) => p + 1);
    const nextIsBreak = !isBreak;
    const nextDuration = nextIsBreak
      ? ((sessions + 1) % settings.sessionsBeforeLongBreak === 0 ? settings.longBreakDuration : settings.breakDuration)
      : settings.workDuration;
    setIsBreak(nextIsBreak);
    setTimeLeft(nextDuration * 60);
    setIsRunning(false);
  });

  useEffect(() => {
    if (!isRunning) return undefined;
    const id = timeLeft > 0
      ? setTimeout(() => setTimeLeft((p) => p - 1), 1000)
      : setTimeout(() => finishPhase(), 0);
    return () => clearTimeout(id);
  }, [isRunning, timeLeft]);

  const start = () => {
    requestNotificationPermission();
    setIsRunning(true);
  };

  const reset = () => {
    setIsRunning(false);
    setIsBreak(false);
    setTimeLeft(settings.workDuration * 60);
  };

  const fields = [
    { key: 'workDuration', label: 'Work (min)', fallback: 25, min: 1, max: 120 },
    { key: 'breakDuration', label: 'Break (min)', fallback: 5, min: 1, max: 60 },
    { key: 'longBreakDuration', label: 'Long break (min)', fallback: 15, min: 1, max: 60 },
    { key: 'sessionsBeforeLongBreak', label: 'Long every', fallback: 4, min: 2, max: 10 },
  ];

  return (
    <>
      <WidgetHeader
        title="Focus Timer"
        actions={
          <>
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              aria-label={soundEnabled ? 'Mute pomodoro' : 'Unmute pomodoro'}
              aria-pressed={!soundEnabled}
              className={`${iconToggleClass} ${!soundEnabled ? 'text-neutral-500 dark:text-neutral-300' : ''}`}
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              aria-label="Pomodoro settings"
              aria-expanded={showSettings}
              className={iconToggleClass}
              title="Settings"
            >
              <Settings size={16} aria-hidden="true" />
            </button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {showSettings ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {fields.map((field) => {
                const id = `${idPrefix}-${field.key}`;
                return (
                  <div key={field.key}>
                    <label htmlFor={id} className={labelClass}>{field.label}</label>
                    <input
                      id={id}
                      type="number"
                      value={settings[field.key]}
                      onChange={(e) => setSettings({ ...settings, [field.key]: +e.target.value || field.fallback })}
                      className={numberInputClass}
                      min={field.min}
                      max={field.max}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => playNotification(true)} className={settingsButtonClass}>
                Test sound
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSettings(false);
                  if (!isRunning) {
                    setTimeLeft(settings.workDuration * 60);
                    setIsBreak(false);
                  }
                }}
                className={settingsButtonClass}
              >
                Done
              </button>
            </div>
            <button type="button" onClick={() => setSessions(0)} className={`w-full text-xs ${linkButton}`}>
              Reset session count ({sessions})
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              {isRunning && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" aria-hidden="true" />}
              <span className="font-serif text-4xl sm:text-5xl font-medium text-neutral-900 dark:text-neutral-100 tabular-nums tracking-tight">
                {formatTime(timeLeft)}
              </span>
            </div>
            <p className="text-sm sm:text-base text-neutral-400 mb-5" aria-live="polite">
              {isBreak ? 'Break time' : isRunning ? 'Focusing' : 'Ready to focus'}
            </p>
            <div className="flex items-center gap-4">
              {!isRunning ? (
                <button
                  type="button"
                  onClick={start}
                  className={`${controlButtonClass} text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100`}
                >
                  <Play size={16} aria-hidden="true" /> Start
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsRunning(false)}
                  className={`${controlButtonClass} text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100`}
                >
                  <Pause size={16} aria-hidden="true" /> Pause
                </button>
              )}
              <button
                type="button"
                onClick={reset}
                className={`${controlButtonClass} text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200`}
              >
                <RotateCcw size={16} aria-hidden="true" /> Reset
              </button>
              <span className="ml-auto text-sm text-neutral-400">
                {sessions} {sessions === 1 ? 'session' : 'sessions'}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
