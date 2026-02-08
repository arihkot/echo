"use client";

import { useState } from "react";
import { Shield, LogIn, AlertCircle } from "lucide-react";
import { authenticate, CREDENTIAL_HINTS } from "@/app/lib/auth";
import { useAppStore } from "@/app/store";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const login = useAppStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Simulate a slight delay for UX
    await new Promise((r) => setTimeout(r, 300));

    const user = authenticate(username, password);
    if (!user) {
      setError("Invalid username or password");
      setLoading(false);
      return;
    }

    login(user);
    router.push("/");
  };

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div className="min-h-screen bg-echo-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-echo-accent mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gradient mb-2">Echo</h1>
          <p className="text-echo-muted text-sm">
            Anonymous Workplace Transparency Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel p-8">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-echo-accent" />
            Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-echo-muted mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="Enter username"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm text-echo-muted mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-echo-danger text-sm bg-echo-danger/10 border border-echo-danger/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                         bg-echo-accent text-white font-medium text-sm
                         hover:bg-echo-accent/90 transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        {/* Credential Hints */}
        <div className="glass-panel p-6 mt-4">
          <h3 className="text-sm font-medium text-echo-muted mb-3">Demo Credentials</h3>
          <div className="space-y-2">
            {CREDENTIAL_HINTS.map((hint) => (
              <button
                key={hint.username}
                onClick={() => handleQuickLogin(hint.username, hint.password)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg
                           bg-echo-bg border border-echo-border text-sm
                           hover:border-echo-accent/30 hover:bg-echo-surface transition-all duration-200 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white font-mono">{hint.username}</span>
                  <span className="text-echo-muted">/</span>
                  <span className="text-echo-muted font-mono">{hint.password}</span>
                </div>
                <span className="text-xs text-echo-accent">{hint.role}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-echo-muted mt-3">
            Click a row to auto-fill credentials, then sign in.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-echo-muted mt-6">
          Powered by Midnight blockchain zero-knowledge proofs
        </p>
      </div>
    </div>
  );
}
