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
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-neutral-200 rounded-xl p-8">
          <div className="text-center mb-8">
            <h1 className="font-serif text-2xl font-medium text-neutral-900 tracking-tight">Thinking Space</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Organize your research and ideas
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 border border-neutral-200 rounded-lg text-sm text-neutral-600">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-900 text-white rounded-lg text-sm hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            <Chrome size={16} />
            Continue with Google
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-100" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-neutral-300">or</span>
            </div>
          </div>

          <button
            onClick={handleDemoMode}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-neutral-200 rounded-lg text-sm text-neutral-600 hover:text-neutral-900 hover:border-neutral-300 transition-colors disabled:opacity-50"
          >
            <Play size={16} />
            Try Demo
          </button>

          <p className="mt-6 text-center text-xs text-neutral-400">
            Preview the app without signing up.
            <br />
            Demo data is stored locally and will be lost on exit.
          </p>
        </div>
      </div>
    </div>
  );
}
