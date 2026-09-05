"use client";

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseReady } from "@/lib/supabase";
import type { Staff } from "@/store/data";

const staffEmail = (staffId: string) => `staff-${staffId}@kebayaoma.local`;

const demoStaff: Staff = {
  id: "demo-manager",
  name: "Demo Kasir",
  role: "manager",
  active: true,
};

interface AuthState {
  initialized: boolean;
  session: Session | null;
  staff: Staff | null;
  init: () => Promise<void>;
  login: (staffId: string, pin: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

async function loadStaffProfile(userId: string): Promise<Staff | null> {
  const { data } = await supabase
    .from("staff")
    .select("id, name, role, phone, active")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    role: data.role,
    phone: data.phone,
    active: data.active,
  };
}

export const useAuth = create<AuthState>()((set) => ({
  initialized: false,
  session: null,
  staff: null,

  init: async () => {
    if (!isSupabaseReady) {
      set({ initialized: true, staff: demoStaff });
      return;
    }

    const { data } = await supabase.auth.getSession();
    let session = data.session;

    if (session) {
      const profile = await loadStaffProfile(session.user.id);
      if (!profile || !profile.active) {
        // Session valid tapi staff tidak ada / sudah dinonaktifkan
        await supabase.auth.signOut();
        session = null;
      } else {
        set({ staff: profile });
      }
    }

    set({ session, initialized: true });

    supabase.auth.onAuthStateChange(async (event, next) => {
      if (event === "SIGNED_IN" && next) {
        const profile = await loadStaffProfile(next.user.id);
        if (!profile || !profile.active) {
          await supabase.auth.signOut();
          set({ session: null, staff: null });
        } else {
          set({ session: next, staff: profile });
        }
      } else if (event === "TOKEN_REFRESHED" && next) {
        // Token diperbarui — jangan log out staff; sesi tetap valid.
        set({ session: next });
      } else if (event === "SIGNED_OUT") {
        set({ session: next, staff: null });
      }
    });
  },

  login: async (staffId, pin) => {
    if (!isSupabaseReady) {
      set({ staff: demoStaff });
      return null;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: staffEmail(staffId),
      password: pin,
    });
    if (error) return "PIN salah atau kasir tidak aktif";
    return null;
  },

  logout: async () => {
    if (isSupabaseReady) {
      await supabase.auth.signOut();
    }
    set({ session: null, staff: null });
  },
}));
