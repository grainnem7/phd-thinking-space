import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Settings, Volume2, VolumeX } from 'lucide-react';
import WidgetWrapper from './WidgetWrapper';

const DEFAULT_SETTINGS = { workDuration: 25, breakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 };

export default function PomodoroWidget({ onRemove, onSessionComplete }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [timeLeft, setTimeLeft] = useState(settings.workDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  const playNotification = useCallback((isWorkComplete) => {
    if (!soundEnabled) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(isWorkComplete ? 'Focus complete!' : 'Break over!', { body: isWorkComplete ? 'Time for a break.' : 'Ready to focus?' });
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beep = (f, t, d) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.frequency.value = f;
        g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.01, t + d);
        o.start(t); o.stop(t + d);
      };
      const now = ctx.currentTime;
      beep(523, now, 0.2); beep(659, now + 0.25, 0.2); beep(784, now + 0.5, 0.4);
      beep(523, now + 1.2, 0.2); beep(659, now + 1.45, 0.2); beep(784, now + 1.7, 0.4);
      setTimeout(() => ctx.close(), 2500);
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    let interval;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    } else if (timeLeft === 0 && isRunning) {
      playNotification(!isBreak);
      if (!isBreak) { setSessions((p) => p + 1); onSessionComplete?.(); }
      setIsBreak(!isBreak);
      const next = !isBreak ? ((sessions + 1) % settings.sessionsBeforeLongBreak === 0 ? settings.longBreakDuration : settings.breakDuration) : settings.workDuration;
      setTimeLeft(next * 60);
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, isBreak, sessions, settings, playNotification, onSessionComplete]);

  const reset = () => { setIsRunning(false); setIsBreak(false); setTimeLeft(settings.workDuration * 60); };

  return (
    <WidgetWrapper
      title="Focus Timer"
      onRemove={onRemove}
      actions={
        <>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`text-neutral-300 hover:text-neutral-500 transition-colors ${!soundEnabled ? 'text-neutral-500' : ''}`}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-neutral-300 hover:text-neutral-500 transition-colors"
          >
            <Settings size={15} />
          </button>
        </>
      }
    >
      {showSettings ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">Work (min)</label>
              <input
                type="number"
                value={settings.workDuration}
                onChange={(e) => setSettings({ ...settings, workDuration: +e.target.value || 25 })}
                className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
                min="1"
                max="60"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1.5 block">Break (min)</label>
              <input
                type="number"
                value={settings.breakDuration}
                onChange={(e) => setSettings({ ...settings, breakDuration: +e.target.value || 5 })}
                className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-300"
                min="1"
                max="30"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => playNotification(true)}
              className="flex-1 py-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Test
            </button>
            <button
              onClick={() => { setShowSettings(false); if (!isRunning) { setTimeLeft(settings.workDuration * 60); setIsBreak(false); } }}
              className="flex-1 py-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Large time display */}
          <div className="flex items-center gap-3 mb-6">
            {isRunning && <span className="w-2 h-2 rounded-full bg-rose-500" />}
            <span className="font-serif text-5xl font-medium text-neutral-900 tabular-nums tracking-tight">
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Status */}
          <p className="text-sm text-neutral-400 mb-6">
            {isBreak ? 'Break time' : isRunning ? 'Focusing' : 'Ready to focus'}
          </p>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {!isRunning ? (
              <button
                onClick={() => setIsRunning(true)}
                className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <Play size={16} /> Start
              </button>
            ) : (
              <button
                onClick={() => setIsRunning(false)}
                className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <Pause size={16} /> Pause
              </button>
            )}
            <button
              onClick={reset}
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <RotateCcw size={16} /> Reset
            </button>
            <span className="ml-auto text-sm text-neutral-400">
              {sessions} sessions
            </span>
          </div>
        </div>
      )}
    </WidgetWrapper>
  );
}
