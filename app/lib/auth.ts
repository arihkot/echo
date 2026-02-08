import { Role } from "@/src/contract/types";

// ============================================================
// Auth Types
// ============================================================

export interface AuthUser {
  username: string;
  role: Role;
  displayName: string;
}

interface Credential {
  password: string;
  role: Role;
  displayName: string;
}

// ============================================================
// Credentials
// ============================================================

const CREDENTIALS: Record<string, Credential> = {
  admin: { password: "admin123", role: Role.ADMIN, displayName: "Admin" },
  hr: { password: "hr123", role: Role.HR, displayName: "HR Operator" },
  employee: { password: "employee123", role: Role.EMPLOYEE, displayName: "Employee" },
  auditor: { password: "auditor123", role: Role.AUDITOR, displayName: "Auditor" },
};

const SESSION_KEY = "echo_session";

// ============================================================
// Authentication
// ============================================================

export function authenticate(username: string, password: string): AuthUser | null {
  const cred = CREDENTIALS[username.toLowerCase()];
  if (!cred || cred.password !== password) return null;
  return {
    username: username.toLowerCase(),
    role: cred.role,
    displayName: cred.displayName,
  };
}

// ============================================================
// Session Persistence (localStorage)
// ============================================================

export function saveSession(user: AuthUser): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // localStorage unavailable (SSR, private mode, etc.)
  }
}

export function loadSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    // Validate the stored session has the expected shape
    if (parsed.username && parsed.role && parsed.displayName) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

// ============================================================
// Credential hints (for the login page)
// ============================================================

export const CREDENTIAL_HINTS = [
  { username: "admin", password: "admin123", role: "Admin" },
  { username: "hr", password: "hr123", role: "HR Operator" },
  { username: "employee", password: "employee123", role: "Employee" },
  { username: "auditor", password: "auditor123", role: "Auditor" },
];
