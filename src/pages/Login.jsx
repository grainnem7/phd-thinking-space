import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../components/common/ConfirmDialog';
import { Chrome, Play } from 'lucide-react';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signInWithGoogle, enterDemoMode, hasDemoData, migrateDemoData, clearDemoData } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      // If the user explored demo first, ask whether to bring that work along.
      // Demo data lives in sessionStorage and would otherwise be discarded.
      let shouldMigrate = false;
      if (hasDemoData()) {
        shouldMigrate = await confirm({
          title: 'Keep your demo work?',
          body: 'You have items from your demo session (notes, deadlines, captures, etc.). Import them into your new account, or start fresh?',
          confirmLabel: 'Import to my account',
          cancelLabel: 'Start fresh',
          danger: false,
        });
      }

      const { user } = await signInWithGoogle({ skipDefaults: shouldMigrate });

      if (shouldMigrate) {
        await migrateDemoData(user.uid);
      } else {
        clearDemoData();
      }

      navigate('/');
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = () => {
    enterDemoMode();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-8">
          <div className="text-center mb-8">
            <h1 className="font-serif text-2xl font-medium text-neutral-900 dark:text-neutral-100 tracking-tight">Thinking Space</h1>
            <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
              Organize your research and ideas
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-4 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            aria-busy={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-accent text-accent-fg rounded-lg text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 dark:focus-visible:ring-neutral-500 dark:focus-visible:ring-offset-neutral-900"
          >
            <Chrome size={16} aria-hidden="true" />
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div className="relative my-6" aria-hidden="true">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-100 dark:border-neutral-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white dark:bg-neutral-900 text-neutral-300 dark:text-neutral-600">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDemoMode}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2 dark:focus-visible:ring-neutral-600 dark:focus-visible:ring-offset-neutral-900"
          >
            <Play size={16} aria-hidden="true" />
            Try Demo
          </button>

          <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-500">
            Preview the app without signing up.
            <br />
            Demo data is stored locally and will be lost on exit.
          </p>
        </div>
      </div>
    </div>
  );
}
