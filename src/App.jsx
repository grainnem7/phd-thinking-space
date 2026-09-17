import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { EinkProvider } from './contexts/EinkContext';
import { FocusModeProvider } from './contexts/FocusModeContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ConfirmProvider } from './components/common/ConfirmDialog';
import { SectionsProvider } from './contexts/SectionsContext';
import { ReadingListProvider } from './hooks/useReadingList';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 dark:border-neutral-800 border-t-neutral-900 dark:border-t-neutral-100" />
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 dark:border-neutral-800 border-t-neutral-900 dark:border-t-neutral-100" />
      </div>
    );
  }

  return user ? <Navigate to="/" /> : children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <SectionsProvider>
              <ReadingListProvider>
                <SidebarProvider>
                  <FocusModeProvider>
                    <Dashboard />
                  </FocusModeProvider>
                </SidebarProvider>
              </ReadingListProvider>
            </SectionsProvider>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <EinkProvider>
          <AuthProvider>
            <ConfirmProvider>
              <AppRoutes />
            </ConfirmProvider>
          </AuthProvider>
        </EinkProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
