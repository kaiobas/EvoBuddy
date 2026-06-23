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
import { FinanceDashboard } from "./routes/finance";
import { TransactionsPage } from "./routes/finance.transactions";
import { AccountsPage } from "./routes/finance.accounts";
import { CategoriesPage } from "./routes/finance.categories";
import { GoalsPage } from "./routes/finance.goals";
import { RecurringPage } from "./routes/finance.recurring";
import { CalendarPage } from "./routes/calendar";

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
            <Route path="finance" element={<FinanceDashboard />} />
            <Route path="finance/transactions" element={<TransactionsPage />} />
            <Route path="finance/accounts" element={<AccountsPage />} />
            <Route path="finance/categories" element={<CategoriesPage />} />
            <Route path="finance/goals" element={<GoalsPage />} />
            <Route path="finance/recurring" element={<RecurringPage />} />
            <Route path="calendar" element={<CalendarPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
