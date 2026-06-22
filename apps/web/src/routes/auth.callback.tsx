import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

/**
 * Rota de callback do OAuth.
 * O Supabase redireciona para cá após login com Google/GitHub.
 * Troca o code da URL por uma sessão e redireciona pro dashboard.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.access_token) {
          localStorage.setItem("sb-token", session.access_token);
        }
        navigate("/", { replace: true });
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Erro ao autenticar: {error}</p>
          <button
            onClick={() => navigate("/login")}
            className="mt-4 text-brand-500 hover:underline"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
    </div>
  );
}
