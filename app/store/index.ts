"use client";

import { create } from "zustand";
import { Role, OrgStatus } from "@/src/contract/types";
import type {
  EchoDeployment,
  EchoWalletState,
  MidnightWalletAPI,
  OrgAnalytics,
  ReviewLedgerState,
} from "@/src/contract/types";
import type { AuthUser } from "@/app/lib/auth";
import { loadSession, saveSession, clearSession } from "@/app/lib/auth";

// ============================================================
// App Store
// ============================================================

interface AppState {
  // Auth
  user: AuthUser | null;
  isAuthenticated: boolean;
  authHydrated: boolean;
  hydrateAuth: () => void;
  login: (user: AuthUser) => void;
  logout: () => void;

  // Wallet
  wallet: EchoWalletState;
  /** The live Lace v4 WalletAPI instance returned by connect() */
  walletApi: MidnightWalletAPI | null;
  setWallet: (wallet: Partial<EchoWalletState>) => void;
  setWalletApi: (api: MidnightWalletAPI | null) => void;
  disconnectWallet: () => void;

  // Deployment
  deployment: EchoDeployment | null;
  setDeployment: (deployment: EchoDeployment | null) => void;

  // User role (derived from auth)
  role: Role;

  // Organization
  orgName: string;
  orgStatus: OrgStatus;
  employeeCount: number;
  setOrgInfo: (info: { orgName?: string; orgStatus?: OrgStatus; employeeCount?: number }) => void;

  // Analytics cache
  analytics: OrgAnalytics | null;
  setAnalytics: (analytics: OrgAnalytics) => void;

  // Review state cache
  reviewState: ReviewLedgerState | null;
  setReviewState: (state: ReviewLedgerState) => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  activeModal: string | null;
  setActiveModal: (modal: string | null) => void;

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => void;
  dismissNotification: (id: string) => void;
}

export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  timestamp: number;
}

const defaultWallet: EchoWalletState = {
  isConnected: false,
  isLaceInstalled: false,
  isConnecting: false,
  address: "",
  error: null,
  serviceUriConfig: null,
};

export const useAppStore = create<AppState>((set) => ({
  // Auth — always starts null/false; hydrated client-side via hydrateAuth()
  user: null,
  isAuthenticated: false,
  authHydrated: false,
  hydrateAuth: () => {
    const restored = loadSession();
    if (restored) {
      set({ user: restored, isAuthenticated: true, role: restored.role, authHydrated: true });
    } else {
      set({ authHydrated: true });
    }
  },
  login: (user) => {
    saveSession(user);
    set({ user, isAuthenticated: true, role: user.role });
  },
  logout: () => {
    clearSession();
    set({
      user: null,
      isAuthenticated: false,
      role: Role.EMPLOYEE,
      wallet: defaultWallet,
      walletApi: null,
      deployment: null,
    });
  },

  // Wallet
  wallet: defaultWallet,
  walletApi: null,
  setWallet: (wallet) =>
    set((state) => ({ wallet: { ...state.wallet, ...wallet } })),
  setWalletApi: (api) => set({ walletApi: api }),
  disconnectWallet: () =>
    set({ wallet: defaultWallet, walletApi: null, deployment: null }),

  // Deployment
  deployment: null,
  setDeployment: (deployment) => set({ deployment }),

  // Role (derived from auth user, set during hydration or login)
  role: Role.EMPLOYEE,

  // Organization
  orgName: "IIITNR",
  orgStatus: OrgStatus.ACTIVE,
  employeeCount: 12,
  setOrgInfo: (info) =>
    set((state) => ({
      orgName: info.orgName ?? state.orgName,
      orgStatus: info.orgStatus ?? state.orgStatus,
      employeeCount: info.employeeCount ?? state.employeeCount,
    })),

  // Analytics
  analytics: null,
  setAnalytics: (analytics) => set({ analytics }),

  // Reviews
  reviewState: null,
  setReviewState: (reviewState) => set({ reviewState }),

  // UI
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  activeModal: null,
  setActiveModal: (modal) => set({ activeModal: modal }),

  // Notifications
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          ...notification,
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
        },
      ],
    })),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
