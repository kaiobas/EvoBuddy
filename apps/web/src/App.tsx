import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/layout/AuthGuard";
import { LoginPage } from "./routes/login";
import { AuthCallbackPage } from "./routes/auth.callback";
import { DashboardPage } from "./routes";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/"
        element={
          <AuthGuard>
            <DashboardPage />
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
