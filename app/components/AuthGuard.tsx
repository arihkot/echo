"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppStore } from "@/app/store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const authHydrated = useAppStore((s) => s.authHydrated);
  const hydrateAuth = useAppStore((s) => s.hydrateAuth);
  const router = useRouter();
  const pathname = usePathname();

  // Hydrate auth from localStorage on mount (client-side only)
  useEffect(() => {
    if (!authHydrated) {
      hydrateAuth();
    }
  }, [authHydrated, hydrateAuth]);

  // After hydration, redirect if not authenticated
  useEffect(() => {
    if (authHydrated && !isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    }
  }, [authHydrated, isAuthenticated, pathname, router]);

  // Wait for hydration before rendering anything
  if (!authHydrated) {
    return null;
  }

  // After hydration, hide content while redirecting to login
  if (!isAuthenticated && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}
