"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Users,
  Banknote,
  MessageSquareText,
  TrendingUp,
  Star,
  IndianRupee,
  Heart,
  Briefcase,
  Clock,
  Shield,
  Eye,
} from "lucide-react";
import { Card, StatCard } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { useAppStore } from "@/app/store";
import { useEchoAPI } from "@/app/hooks/useEchoAPI";
import type { PeriodTrend } from "@/src/dapp/api";

const categoryMeta = [
  { key: "culture", label: "Work Culture", icon: Heart, color: "text-pink-400", bgColor: "bg-pink-400" },
  { key: "compensation", label: "Compensation", icon: IndianRupee, color: "text-emerald-400", bgColor: "bg-emerald-400" },
  { key: "management", label: "Management", icon: Briefcase, color: "text-blue-400", bgColor: "bg-blue-400" },
  { key: "workLifeBalance", label: "Work-Life Balance", icon: Clock, color: "text-amber-400", bgColor: "bg-amber-400" },
  { key: "careerGrowth", label: "Career Growth", icon: TrendingUp, color: "text-purple-400", bgColor: "bg-purple-400" },
];

const bandLabels = ["0 - 5 LPA", "5 - 15 LPA", "15 - 30 LPA", "30 - 50 LPA", "50+ LPA"];

// Helper: compute weighted average from distribution
function computeAvg(dist: { rating1: bigint; rating2: bigint; rating3: bigint; rating4: bigint; rating5: bigint }): number {
  const total = Number(dist.rating1) + Number(dist.rating2) + Number(dist.rating3) + Number(dist.rating4) + Number(dist.rating5);
  if (total === 0) return 0;
  const weighted = Number(dist.rating1) * 1 + Number(dist.rating2) * 2 + Number(dist.rating3) * 3 + Number(dist.rating4) * 4 + Number(dist.rating5) * 5;
  return weighted / total;
}

// Find median band given counts array
function medianBand(counts: number[]): string {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return "--";
  let cum = 0;
  for (let i = 0; i < counts.length; i++) {
    cum += counts[i];
    if (cum >= Math.ceil(total / 2)) return bandLabels[i];
  }
  return "--";
}

export default function AnalyticsPage() {
  const { orgName } = useAppStore();
  const api = useEchoAPI();

  // Live data
  const [employeeCount, setEmployeeCount] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [overallRating, setOverallRating] = useState(0);
  const [catRatings, setCatRatings] = useState<{ key: string; avg: number }[]>([]);
  const [bandCounts, setBandCounts] = useState<number[]>([0, 0, 0, 0, 0]);
  const [medianBandLabel, setMedianBandLabel] = useState("--");
  const [reviewPaymentRatio, setReviewPaymentRatio] = useState("--");
  const [gini, setGini] = useState("--");
  const [periodTrends, setPeriodTrends] = useState<PeriodTrend[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [orgState, salaryState, reviewState, trends] = await Promise.all([
        api.getOrganizationState(),
        api.getSalaryState(),
        api.getReviewState(),
        api.getPeriodTrends(),
      ]);

      setEmployeeCount(Number(orgState.employeeCount));
      setPeriodTrends(trends);
      const tp = Number(salaryState.totalPaymentsProcessed);
      setTotalPayments(tp);
      const tr = Number(reviewState.totalReviews);
      setTotalReviews(tr);

      // Ratings
      const agg = reviewState.ratingAggregates;
      const cats = categoryMeta.map((c) => ({
        key: c.key,
        avg: computeAvg((agg as any)[c.key]),
      }));
      setCatRatings(cats);
      const avgAll = cats.reduce((s, c) => s + c.avg, 0) / cats.length;
      setOverallRating(avgAll);

      // Salary bands
      const bc = [
        Number(salaryState.salaryBands.band1),
        Number(salaryState.salaryBands.band2),
        Number(salaryState.salaryBands.band3),
        Number(salaryState.salaryBands.band4),
        Number(salaryState.salaryBands.band5),
      ];
      setBandCounts(bc);
      setMedianBandLabel(medianBand(bc));

      // Pay equity
      if (tp > 0) {
        setReviewPaymentRatio(`${Math.round((tr / tp) * 100)}%`);
      }

      // Simple Gini approximation from band distribution
      const totalBand = bc.reduce((a, b) => a + b, 0);
      if (totalBand > 0) {
        const shares = bc.map((c) => c / totalBand);
        let giniSum = 0;
        for (let i = 0; i < shares.length; i++) {
          for (let j = 0; j < shares.length; j++) {
            giniSum += Math.abs(shares[i] - shares[j]);
          }
        }
        const giniVal = giniSum / (2 * shares.length);
        setGini(giniVal.toFixed(2));
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxBand = Math.max(...bandCounts, 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-heading flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-echo-accent" />
          Analytics Dashboard
        </h1>
        <p className="text-echo-muted text-sm mt-1">
          Public on-chain analytics derived from aggregate counters. No individual data is exposed.
        </p>
      </div>

      {/* Privacy notice */}
      <Card className="border-echo-accent/20">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-echo-accent/10 shrink-0">
            <Eye className="w-5 h-5 text-echo-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Privacy-Preserving Analytics</h3>
            <p className="text-xs text-echo-muted leading-relaxed">
              All data on this page is derived from public on-chain counters maintained by the
              Compact smart contracts. These counters increment with each transaction but never
              store individual records. The data is provably correct (enforced by ZK proofs)
              and cannot be traced back to any specific employee.
            </p>
          </div>
        </div>
      </Card>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Employees"
          value={employeeCount}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          label="Payments Processed"
          value={totalPayments}
          icon={<Banknote className="w-5 h-5" />}
        />
        <StatCard
          label="Reviews Submitted"
          value={totalReviews}
          icon={<MessageSquareText className="w-5 h-5" />}
        />
        <StatCard
          label="Overall Rating"
          value={overallRating > 0 ? overallRating.toFixed(1) : "--"}
          icon={<Star className="w-5 h-5" />}
        />
      </div>

      {/* Rating breakdown */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="section-heading">Workplace Rating Breakdown</h2>
            <p className="text-xs text-echo-muted mt-1">
              Aggregated from all anonymous employee reviews
            </p>
          </div>
          <Badge variant={totalReviews > 0 ? "accent" : "muted"}>{totalReviews} reviews</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bar ratings */}
          <div className="space-y-5">
            {categoryMeta.map((cat, i) => {
              const Icon = cat.icon;
              const avg = catRatings[i]?.avg ?? 0;
              const pct = (avg / 5) * 100;
              return (
                <div key={cat.key}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${cat.color}`} />
                      <span className="text-sm text-white">{cat.label}</span>
                    </div>
                    <span className="text-sm font-mono text-echo-muted">
                      {avg > 0 ? avg.toFixed(1) : "--"}/5.0
                    </span>
                  </div>
                  <div className="rating-bar">
                    <div
                      className={`rating-bar-fill ${cat.bgColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall score */}
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="w-36 h-36 rounded-full border-4 border-echo-border flex items-center justify-center mx-auto mb-4 relative">
                <div className="absolute inset-0 rounded-full" style={{
                  background: overallRating > 0
                    ? `conic-gradient(from 0deg, #6366f1 ${overallRating / 5 * 360}deg, transparent ${overallRating / 5 * 360}deg)`
                    : "none"
                }} />
                <div className="w-28 h-28 rounded-full bg-echo-surface flex items-center justify-center relative z-10">
                  <div>
                    <span className="text-3xl font-bold text-white">
                      {overallRating > 0 ? overallRating.toFixed(1) : "--"}
                    </span>
                    <span className="text-echo-muted text-sm">/5.0</span>
                  </div>
                </div>
              </div>
              <p className="text-sm font-medium text-white">Overall Score</p>
              <p className="text-xs text-echo-muted mt-1">
                Averaged across all categories
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Salary Distribution */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="section-heading">Salary Band Distribution</h2>
            <p className="text-xs text-echo-muted mt-1">
              Anonymous salary ranges from on-chain band counters
            </p>
          </div>
          <Badge variant={totalPayments > 0 ? "accent" : "muted"}>{totalPayments} payments</Badge>
        </div>

        <div className="space-y-4">
          {bandCounts.map((count, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-sm text-echo-muted w-36 shrink-0">{bandLabels[i]}</span>
              <div className="flex-1 h-8 bg-echo-bg rounded-lg border border-echo-border overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-echo-accent to-midnight-400 rounded-lg transition-all duration-500"
                  style={{ width: `${count > 0 ? Math.max(5, (count / maxBand) * 100) : 0}%` }}
                />
                {count > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-echo-muted">
                    {count}
                  </span>
                )}
              </div>
              <span className="text-sm font-mono text-echo-muted w-12 text-right">
                {count}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-echo-border">
          <div className="flex items-center gap-2 text-xs text-echo-muted">
            <Shield className="w-3.5 h-3.5 text-echo-accent" />
            Salary bands are incremented anonymously during payment processing.
            No individual salary amounts are ever recorded.
          </div>
        </div>
      </Card>

      {/* Pay equity indicators */}
      <Card>
        <h2 className="section-heading mb-6">Pay Equity Indicators</h2>
        <p className="text-xs text-echo-muted mb-4">
          Statistical measures derived from anonymous on-chain salary data
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-echo-bg rounded-lg p-4 border border-echo-border">
            <p className="text-xs text-echo-muted mb-1">Median Salary Band</p>
            <p className="text-lg font-bold text-white">{medianBandLabel}</p>
            <p className="text-xs text-echo-muted mt-1">
              {totalPayments > 0 ? `Based on ${totalPayments} payment commitments` : "Insufficient data"}
            </p>
          </div>
          <div className="bg-echo-bg rounded-lg p-4 border border-echo-border">
            <p className="text-xs text-echo-muted mb-1">Band Concentration</p>
            <p className="text-lg font-bold text-white">{gini}</p>
            <p className="text-xs text-echo-muted mt-1">Gini coefficient of band distribution</p>
          </div>
          <div className="bg-echo-bg rounded-lg p-4 border border-echo-border">
            <p className="text-xs text-echo-muted mb-1">Review-to-Payment Ratio</p>
            <p className="text-lg font-bold text-white">{reviewPaymentRatio}</p>
            <p className="text-xs text-echo-muted mt-1">
              {totalPayments > 0 ? `${totalReviews} reviews from ${totalPayments} paid employees` : "Insufficient data"}
            </p>
          </div>
        </div>
      </Card>

      {/* Period Trends */}
      <Card>
        <h2 className="section-heading mb-4">Period Trends</h2>
        <p className="text-xs text-echo-muted mb-6">
          Tracking review counts, rating averages, and payment activity across pay periods
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {periodTrends.map((p, idx) => (
            <div key={p.period} className="bg-echo-bg rounded-lg p-4 border border-echo-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">Period {p.period}</span>
                <Badge variant={idx === periodTrends.length - 1 ? "success" : "muted"}>
                  {idx === periodTrends.length - 1 ? "Current" : "Completed"}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-echo-muted">Payments</span>
                  <span className="text-white font-mono">{p.payments}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-echo-muted">Reviews</span>
                  <span className="text-white font-mono">{p.reviews}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-echo-muted">Avg Rating</span>
                  <span className="text-white font-mono">{p.avgRating.toFixed(1)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
