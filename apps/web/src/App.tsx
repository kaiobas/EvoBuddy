import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { AuthGuard } from "./components/layout/AuthGuard";
import { Layout } from "./components/layout/Layout";
import { LoginPage } from "./routes/login";
import { AuthCallbackPage } from "./routes/auth.callback";
import { DashboardPage } from "./routes/dashboard";
import { NotesPage } from "./routes/notes";
import { TasksPage } from "./routes/tasks";

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route
            element={
              <AuthGuard>
                <Layout />
              </AuthGuard>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="tasks" element={<TasksPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
