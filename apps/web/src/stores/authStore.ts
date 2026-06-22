import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    // Recupera sessão existente
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (session?.access_token) {
      localStorage.setItem("sb-token", session.access_token);
    }

    set({
      session,
      user: session?.user ?? null,
      loading: false,
      initialized: true,
    });

    // Escuta mudanças de auth em tempo real
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        localStorage.setItem("sb-token", session.access_token);
      } else {
        localStorage.removeItem("sb-token");
      }
      set({ session, user: session?.user ?? null });
    });
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  },

  signInWithGithub: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  },

  signInWithMagicLink: async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  },

  signOut: async () => {
    localStorage.removeItem("sb-token");
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));
