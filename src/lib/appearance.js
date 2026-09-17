import { useSyncExternalStore } from 'react';

// Appearance settings (colour scheme, accent, fonts, text size).
// Light/dark lives in ThemeContext and e-reader mode in EinkContext.
//
// Stored in localStorage under APPEARANCE_STORAGE_KEY and mirrored onto <html>
// as data-scheme / data-accent / data-body-font / data-heading-font /
// data-text-size, which src/index.css reads. The inline script in index.html
// applies the same attributes before first paint — keep the key and attribute
// names in sync with it.

export const APPEARANCE_STORAGE_KEY = 'appearance';

// Swatch colours are only for the settings UI; the real values are in index.css.
export const SCHEMES = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Neutral grey',
    light: { page: '#fafafa', surface: '#ffffff', line: '#e5e5e5', ink: '#171717', muted: '#a3a3a3' },
    dark: { page: '#0a0a0a', surface: '#171717', line: '#262626', ink: '#f5f5f5', muted: '#737373' },
  },
  {
    id: 'paper',
    label: 'Paper',
    description: 'Warm cream and stone',
    light: { page: '#faf7f0', surface: '#fffdf8', line: '#e6e0d4', ink: '#1e1b17', muted: '#a69d8f' },
    dark: { page: '#12100d', surface: '#1e1b17', line: '#2b2621', ink: '#f3efe6', muted: '#80776a' },
  },
  {
    id: 'sage',
    label: 'Sage',
    description: 'Soft green-grey',
    light: { page: '#f6f8f4', surface: '#fdfefc', line: '#dde4d9', ink: '#181d17', muted: '#98a494' },
    dark: { page: '#0d110c', surface: '#181d17', line: '#252b23', ink: '#eef2ec', muted: '#737f70' },
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Cool blue-grey',
    light: { page: '#f8f9fb', surface: '#ffffff', line: '#e2e6eb', ink: '#171b22', muted: '#99a2ae' },
    dark: { page: '#0c0f14', surface: '#171b22', line: '#232932', ink: '#f1f3f6', muted: '#737d8c' },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Crisp by day, navy by night',
    light: { page: '#f6f8fc', surface: '#ffffff', line: '#dce3ee', ink: '#131b31', muted: '#8e9ab0' },
    dark: { page: '#0a1024', surface: '#131b31', line: '#1d2640', ink: '#edf1f8', muted: '#6b7894' },
  },
];

export const ACCENTS = [
  { id: 'graphite', label: 'Graphite', light: '#171717', dark: '#f5f5f5' },
  { id: 'indigo', label: 'Indigo', light: '#4f46e5', dark: '#818cf8' },
  { id: 'blue', label: 'Blue', light: '#2563eb', dark: '#60a5fa' },
  { id: 'teal', label: 'Teal', light: '#0f766e', dark: '#2dd4bf' },
  { id: 'green', label: 'Green', light: '#15803d', dark: '#4ade80' },
  { id: 'amber', label: 'Amber', light: '#b45309', dark: '#fbbf24' },
  { id: 'rose', label: 'Rose', light: '#e11d48', dark: '#fb7185' },
  { id: 'violet', label: 'Violet', light: '#7c3aed', dark: '#a78bfa' },
];

export const BODY_FONTS = [
  { id: 'inter', label: 'Inter', description: 'Clean and compact', family: "'Inter', system-ui, sans-serif" },
  { id: 'system', label: 'System', description: "Your device's UI font", family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: 'literata', label: 'Literata', description: 'Serif for long reading', family: "'Literata', Georgia, serif" },
];

export const HEADING_FONTS = [
  { id: 'serif', label: 'Serif' },
  { id: 'sans', label: 'Sans' },
];

export const TEXT_SIZES = [
  { id: 'small', label: 'Small', px: 15 },
  { id: 'default', label: 'Default', px: 16 },
  { id: 'large', label: 'Large', px: 17.5 },
];

export const BACKGROUNDS = [
  { id: 'crisp', label: 'Crisp', description: 'Pure white and deep black' },
  { id: 'soft', label: 'Soft', description: 'Gently tinted, easier on the eyes' },
  { id: 'softer', label: 'Softer', description: 'Warmer paper tones and charcoal' },
];

export const DEFAULT_APPEARANCE = Object.freeze({
  scheme: 'classic',
  accent: 'graphite',
  bodyFont: 'inter',
  headingFont: 'serif',
  textSize: 'default',
  background: 'soft',
});

const OPTIONS = {
  scheme: SCHEMES,
  accent: ACCENTS,
  bodyFont: BODY_FONTS,
  headingFont: HEADING_FONTS,
  textSize: TEXT_SIZES,
  background: BACKGROUNDS,
};

const ATTRIBUTES = {
  scheme: 'data-scheme',
  accent: 'data-accent',
  bodyFont: 'data-body-font',
  headingFont: 'data-heading-font',
  textSize: 'data-text-size',
  background: 'data-background',
};

const LITERATA_LINK_ID = 'font-literata';
const LITERATA_HREF =
  'https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,500;7..72,600;7..72,700&display=swap';

// Keeps only known option ids; anything missing or unknown falls back to the default.
export function normalizeAppearance(value) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  for (const key of Object.keys(DEFAULT_APPEARANCE)) {
    result[key] = OPTIONS[key].some((option) => option.id === source[key])
      ? source[key]
      : DEFAULT_APPEARANCE[key];
  }
  return result;
}

function sameAppearance(a, b) {
  return Object.keys(DEFAULT_APPEARANCE).every((key) => a[key] === b[key]);
}

function readStored() {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return { settings: { ...DEFAULT_APPEARANCE }, explicit: false };
    return { settings: normalizeAppearance(JSON.parse(raw)), explicit: true };
  } catch {
    return { settings: { ...DEFAULT_APPEARANCE }, explicit: false };
  }
}

function ensureLiterata() {
  if (document.getElementById(LITERATA_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = LITERATA_LINK_ID;
  link.rel = 'stylesheet';
  link.href = LITERATA_HREF;
  document.head.appendChild(link);
}

export function applyAppearance(settings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [key, attribute] of Object.entries(ATTRIBUTES)) {
    root.setAttribute(attribute, settings[key]);
  }
  // Only fetch the reading serif once someone actually picks it
  if (settings.bodyFont === 'literata') ensureLiterata();
}

// --- Store -------------------------------------------------------------------

let state = typeof window !== 'undefined' ? readStored() : { settings: { ...DEFAULT_APPEARANCE }, explicit: false };
const listeners = new Set();

if (typeof window !== 'undefined') applyAppearance(state.settings);

function emit(source) {
  listeners.forEach((listener) => listener(source));
}

// listener(source): source is 'local' (changed on this device), 'remote'
// (adopted from the account) or 'storage' (changed in another tab).
export function subscribeAppearance(listener) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function onStorage(event) {
  if (event.key !== APPEARANCE_STORAGE_KEY && event.key !== null) return;
  state = readStored();
  applyAppearance(state.settings);
  emit('storage');
}

export function getAppearance() {
  return state.settings;
}

// True once this device has its own saved choice (so a synced value from the
// account shouldn't replace it).
export function hasLocalAppearance() {
  return state.explicit;
}

export function setAppearance(patch, { source = 'local' } = {}) {
  const next = normalizeAppearance({ ...state.settings, ...patch });
  const changed = !sameAppearance(next, state.settings);
  state = { settings: changed ? next : state.settings, explicit: true };
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(state.settings));
  } catch {
    // Storage unavailable - the choice lasts for this session only
  }
  if (!changed) return;
  applyAppearance(state.settings);
  emit(source);
}

export function resetAppearance() {
  setAppearance(DEFAULT_APPEARANCE);
}

export function useAppearance() {
  return useSyncExternalStore(subscribeAppearance, getAppearance, getAppearance);
}
