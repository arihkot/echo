"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Banknote,
  MessageSquareText,
  BarChart3,
  Shield,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Card, StatCard } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { useAppStore } from "@/app/store";
import { useEchoAPI } from "@/app/hooks/useEchoAPI";

const quickActions = [
  {
    href: "/organization",
    icon: Users,
    label: "Organization",
    description: "Manage employees & HR operators",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
  {
    href: "/salary",
    icon: Banknote,
    label: "Salary",
    description: "Process payments & confirm receipts",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
  },
  {
    href: "/reviews",
    icon: MessageSquareText,
    label: "Reviews",
    description: "Submit anonymous workplace feedback",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
  },
  {
    href: "/analytics",
    icon: BarChart3,
    label: "Analytics",
    description: "View transparency metrics & trends",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
  },
];

export default function DashboardPage() {
  const { wallet, orgName, orgStatus, role } = useAppStore();
  const api = useEchoAPI();

  const [employees, setEmployees] = useState(0);
  const [payments, setPayments] = useState(0);
  const [reviews, setReviews] = useState(0);
  const [period, setPeriod] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [orgState, salaryState, reviewState] = await Promise.all([
        api.getOrganizationState(),
        api.getSalaryState(),
        api.getReviewState(),
      ]);
      setEmployees(Number(orgState.employeeCount));
      setPayments(Number(salaryState.totalPaymentsProcessed));
      setReviews(Number(reviewState.totalReviews));
      setPeriod(Number(salaryState.currentPeriod));
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div className="relative overflow-hidden glass-panel p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-echo-accent/5 to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-echo-accent/20 flex items-center justify-center">
              <Shield className="w-7 h-7 text-echo-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Echo</h1>
              <p className="text-echo-muted text-sm">
                Anonymous Workplace Transparency on Midnight
              </p>
            </div>
          </div>
          <p className="text-echo-muted max-w-2xl leading-relaxed">
            A privacy-first platform for salary transparency and workplace reviews.
            Powered by Midnight blockchain&apos;s zero-knowledge proofs, Echo enables
            employees to share compensation data and workplace experiences while
            maintaining complete anonymity.
          </p>
          {!wallet.isConnected && (
            <div className="mt-6 flex items-center gap-2 text-sm text-echo-warning">
              <CheckCircle2 className="w-4 h-4" />
              Connect your Lace wallet to get started
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Employees"
          value={employees}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          label="Payments Processed"
          value={payments}
          icon={<Banknote className="w-5 h-5" />}
        />
        <StatCard
          label="Reviews Submitted"
          value={reviews}
          icon={<MessageSquareText className="w-5 h-5" />}
        />
        <StatCard
          label="Current Period"
          value={period}
          icon={<BarChart3 className="w-5 h-5" />}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="section-heading mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <Card hover className="group cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2.5 rounded-lg ${action.bgColor}`}>
                      <Icon className={`w-5 h-5 ${action.color}`} />
                    </div>
                    <ArrowRight className="w-4 h-4 text-echo-muted group-hover:text-echo-accent group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{action.label}</h3>
                  <p className="text-xs text-echo-muted leading-relaxed">
                    {action.description}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* System status */}
      <Card>
        <h2 className="section-heading mb-4">System Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <Badge variant={wallet.isConnected ? "success" : "muted"} dot>
              Wallet
            </Badge>
            <span className="text-sm text-echo-muted">
              {wallet.isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="warning" dot>
              Network
            </Badge>
            <span className="text-sm text-echo-muted">Midnight Testnet</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={orgStatus === "ACTIVE" ? "success" : "danger"} dot>
              Organization
            </Badge>
            <span className="text-sm text-echo-muted">{orgStatus}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
