import { useEffect, useState } from "react";
import { User, Palette, Bell, HelpCircle, Shield, Sun, Moon, Monitor, Link2, Unlink, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { usersApi, googleApi, type ProfileDTO, type GoogleStatusDTO } from "../lib/api";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { useAuthStore } from "../stores/authStore";
import { useTour } from "../hooks/useTour";
import { supabase } from "../lib/supabase";
import { DeleteAccountModal } from "../components/features/settings/DeleteAccountModal";

export function SettingsPage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuthStore();
  const { resetTour } = useTour();

  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatusDTO | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    usersApi.getProfile().then((data) => {
      setProfile(data);
      setDisplayName(data.display_name ?? "");
    }).catch(() => {
      toast("Erro ao carregar perfil.", "error");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Detecta retorno do OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      toast("Google Calendar conectado com sucesso.", "success");
      window.history.replaceState({}, "", "/settings");
    } else if (params.get("google") === "error") {
      const msg = params.get("message") || "Erro ao conectar Google Calendar.";
      toast(msg, "error");
      window.history.replaceState({}, "", "/settings");
    }

    // Carrega status
    googleApi
      .getStatus()
      .then(setGoogleStatus)
      .catch(() =>
        setGoogleStatus({
          connected: false,
          last_synced_at: null,
          sync_error: null,
        })
      )
      .finally(() => setLoadingGoogle(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await usersApi.updateProfile({ display_name: displayName });
      setProfile(updated);
      toast("Perfil atualizado.", "success");
    } catch {
      toast("Erro ao atualizar perfil.", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordReset() {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
      if (error) throw error;
      toast("Email de redefinição de senha enviado.", "success");
    } catch {
      toast("Erro ao enviar email de redefinição.", "error");
    } finally {
      setSendingReset(false);
    }
  }

  async function handleGoogleConnect() {
    try {
      const { url } = await googleApi.getAuthUrl();
      window.location.href = url;
    } catch {
      toast("Erro ao iniciar conexão com Google.", "error");
    }
  }

  async function handleGoogleDisconnect() {
    setDisconnecting(true);
    try {
      await googleApi.disconnect();
      setGoogleStatus({
        connected: false,
        last_synced_at: null,
        sync_error: null,
      });
      toast("Google Calendar desconectado.", "success");
    } catch {
      toast("Erro ao desconectar Google Calendar.", "error");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      await usersApi.deleteAccount();
      await signOut();
    } catch {
      toast("Erro ao excluir conta.", "error");
      setDeletingAccount(false);
      setShowDeleteModal(false);
    }
  }

  const initial = (profile?.display_name || user?.email)?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-display text-2xl font-bold text-ink dark:text-neutral-100">
        Configurações
      </h1>

      <div className="space-y-6">
        {/* Perfil */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-brand-500" />
            <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100">Perfil</h2>
          </div>

          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
              {initial}
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {profile?.display_name || "Sem nome definido"}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Nome de exibição
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome"
                maxLength={100}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Email
              </label>
              <input
                type="email"
                value={user?.email ?? ""}
                readOnly
                className="w-full cursor-not-allowed rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-2.5 text-sm text-neutral-500 outline-none dark:border-border-dark dark:bg-surface-dark/60 dark:text-neutral-500"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
            >
              {savingProfile ? "Salvando..." : "Salvar alterações"}
            </button>
          </form>
        </section>

        {/* Aparência */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-brand-500" />
            <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100">Aparência</h2>
          </div>

          <div className="flex gap-3">
            {(["light", "dark", "system"] as const).map((t) => {
              const Icon = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
              const labels: Record<string, string> = { light: "Claro", dark: "Escuro", system: "Sistema" };
              return (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex flex-1 flex-col items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium transition ${
                    theme === t
                      ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-900/20 dark:text-brand-300"
                      : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-border-dark dark:text-neutral-400 dark:hover:bg-neutral-800/60"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {labels[t]}
                </button>
              );
            })}
          </div>
        </section>

        {/* Notificações */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-500" />
            <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100">Notificações</h2>
          </div>
          <div className="space-y-3">
            {["Lembretes de tarefas", "Alertas de metas financeiras"].map((label) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500">
                    Em breve
                  </span>
                  <div className="h-5 w-10 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Integrações */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
          <div className="mb-4 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-brand-500" />
            <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100">Integrações</h2>
          </div>

          {loadingGoogle ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              Verificando conexão...
            </div>
          ) : !googleStatus?.connected ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Google Calendar</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Sincronize eventos com sua conta Google</p>
              </div>
              <button
                onClick={handleGoogleConnect}
                className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95"
              >
                <Link2 className="h-4 w-4" />
                Conectar
              </button>
            </div>
          ) : googleStatus.sync_error ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Google Calendar — Erro</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{googleStatus.sync_error}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGoogleConnect}
                  className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 active:scale-95"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reconectar
                </button>
                <button
                  onClick={handleGoogleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-border-dark dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  <Unlink className="h-4 w-4" />
                  Desconectar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Google Calendar</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {googleStatus.last_synced_at
                      ? `Último sync: ${new Date(googleStatus.last_synced_at).toLocaleString("pt-BR")}`
                      : "Conectado — aguardando primeiro sync"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleGoogleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-border-dark dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <Unlink className="h-4 w-4" />
                {disconnecting ? "Desconectando..." : "Desconectar"}
              </button>
            </div>
          )}
        </section>

        {/* Tour & Ajuda */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
          <div className="mb-4 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-brand-500" />
            <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100">Tour & Ajuda</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Tour de introdução</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Revisita o tutorial guiado do EvoBuddy</p>
            </div>
            <button
              onClick={resetTour}
              className="rounded-xl border border-brand-300 px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-900/20"
            >
              Refazer tour
            </button>
          </div>
        </section>

        {/* Conta */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-card-dark">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-500" />
            <h2 className="font-display text-base font-bold text-ink dark:text-neutral-100">Conta</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Alterar senha</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Envia um email de redefinição</p>
              </div>
              <button
                onClick={handlePasswordReset}
                disabled={sendingReset}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-border-dark dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                {sendingReset ? "Enviando..." : "Enviar email"}
              </button>
            </div>

            <div className="border-t border-neutral-100 pt-3 dark:border-border-dark">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Excluir conta</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Ação irreversível — todos os dados serão apagados</p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        loading={deletingAccount}
      />
    </div>
  );
}
