"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquareText,
  Star,
  Send,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  Heart,
  Users,
  TrendingUp,
  IndianRupee,
  Eye,
} from "lucide-react";
import { Card, StatCard } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { useAppStore } from "@/app/store";
import { useEchoAPI } from "@/app/hooks/useEchoAPI";
import { Role } from "@/src/contract/types";
import type { PublishedReview } from "@/src/dapp/api";

interface CategoryRating {
  key: string;
  label: string;
  icon: typeof Star;
  value: number;
  color: string;
}

// Helper: compute weighted average from distribution
function computeAvg(dist: { rating1: bigint; rating2: bigint; rating3: bigint; rating4: bigint; rating5: bigint }): number {
  const total = Number(dist.rating1) + Number(dist.rating2) + Number(dist.rating3) + Number(dist.rating4) + Number(dist.rating5);
  if (total === 0) return 0;
  const weighted = Number(dist.rating1) * 1 + Number(dist.rating2) * 2 + Number(dist.rating3) * 3 + Number(dist.rating4) * 4 + Number(dist.rating5) * 5;
  return weighted / total;
}

export default function ReviewsPage() {
  const { role, wallet, addNotification } = useAppStore();
  const api = useEchoAPI();
  const [loading, setLoading] = useState(false);
  const [reviewContent, setReviewContent] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({
    culture: 0,
    compensation: 0,
    management: 0,
    workLifeBalance: 0,
    careerGrowth: 0,
  });

  // Live data from API
  const [totalReviews, setTotalReviews] = useState(0);
  const [reviewPeriod, setReviewPeriod] = useState(0);
  const [avgRating, setAvgRating] = useState("--");
  const [ratingAggregates, setRatingAggregates] = useState<Record<string, { avg: number }>>({});
  const [publishedReviews, setPublishedReviews] = useState<PublishedReview[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [state, reviews] = await Promise.all([
        api.getReviewState(),
        api.getPublishedReviews(),
      ]);
      setTotalReviews(Number(state.totalReviews));
      setReviewPeriod(Number(state.currentReviewPeriod));
      setPublishedReviews(reviews);

      const agg = state.ratingAggregates;
      const catAvgs: Record<string, { avg: number }> = {
        culture: { avg: computeAvg(agg.culture) },
        compensation: { avg: computeAvg(agg.compensation) },
        management: { avg: computeAvg(agg.management) },
        workLifeBalance: { avg: computeAvg(agg.workLifeBalance) },
        careerGrowth: { avg: computeAvg(agg.careerGrowth) },
      };
      setRatingAggregates(catAvgs);

      const vals = Object.values(catAvgs).map((c) => c.avg);
      const overall = vals.reduce((a, b) => a + b, 0) / vals.length;
      setAvgRating(overall > 0 ? overall.toFixed(1) : "--");
    } catch (err) {
      console.error("Failed to fetch review state:", err);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isEmployee = role === Role.EMPLOYEE;

  const ratingColor = (score: number) => {
    if (score >= 4) return "bg-echo-success/20 text-echo-success border-echo-success/30";
    if (score >= 3) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-echo-danger/20 text-echo-danger border-echo-danger/30";
  };

  const categories: CategoryRating[] = [
    { key: "culture", label: "Work Culture", icon: Heart, value: ratings.culture, color: "text-pink-400" },
    { key: "compensation", label: "Compensation", icon: IndianRupee, value: ratings.compensation, color: "text-emerald-400" },
    { key: "management", label: "Management", icon: Briefcase, value: ratings.management, color: "text-blue-400" },
    { key: "workLifeBalance", label: "Work-Life Balance", icon: Clock, value: ratings.workLifeBalance, color: "text-amber-400" },
    { key: "careerGrowth", label: "Career Growth", icon: TrendingUp, value: ratings.careerGrowth, color: "text-purple-400" },
  ];

  const setRating = (key: string, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const allRated = Object.values(ratings).every((r) => r > 0);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Generate a simple content hash from the review text
      const encoder = new TextEncoder();
      const data = encoder.encode(reviewContent || "no-content");
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const contentHash = "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      await api.submitReview({
        ratings: {
          culture: ratings.culture,
          compensation: ratings.compensation,
          management: ratings.management,
          workLifeBalance: ratings.workLifeBalance,
          careerGrowth: ratings.careerGrowth,
        },
        content: reviewContent,
        contentHash,
      });
      addNotification({
        type: "success",
        title: "Review submitted anonymously",
        message: "Your review token has been consumed. Rating aggregates updated on-chain.",
      });
      setRatings({ culture: 0, compensation: 0, management: 0, workLifeBalance: 0, careerGrowth: 0 });
      setReviewContent("");
      // Refetch to show updated aggregates
      await fetchData();
    } catch (err) {
      addNotification({ type: "error", title: "Review submission failed", message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-heading flex items-center gap-3">
          <MessageSquareText className="w-7 h-7 text-echo-accent" />
          Anonymous Reviews
        </h1>
        <p className="text-echo-muted text-sm mt-1">
          Submit workplace reviews using your review token. Your identity is never revealed.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Reviews"
          value={totalReviews}
          icon={<MessageSquareText className="w-5 h-5" />}
        />
        <StatCard
          label="Review Period"
          value={reviewPeriod}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Avg Rating"
          value={avgRating}
          icon={<Star className="w-5 h-5" />}
        />
      </div>

      {/* Review Token Status */}
      {isEmployee && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-echo-accent/10">
              <ShieldCheck className="w-5 h-5 text-echo-accent" />
            </div>
            <div>
              <h2 className="section-heading">Review Token Status</h2>
              <p className="text-xs text-echo-muted">
                You need a valid review token (from confirming a salary receipt) to submit a review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-echo-bg rounded-lg p-4 border border-echo-border">
            <Badge variant="warning" dot>
              No Token
            </Badge>
            <span className="text-sm text-echo-muted">
              Confirm a salary receipt on the Salary page to receive a review token.
            </span>
          </div>
        </Card>
      )}

      {/* Submit Review */}
      {isEmployee && (
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-echo-success/10">
              <Send className="w-5 h-5 text-echo-success" />
            </div>
            <div>
              <h2 className="section-heading">Submit Review</h2>
              <p className="text-xs text-echo-muted">
                Rate your workplace across 5 categories. All ratings are aggregated on-chain anonymously.
              </p>
            </div>
          </div>

          {/* Rating categories */}
          <div className="space-y-5 mb-6">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.key}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${cat.color}`} />
                    <span className="text-sm font-medium text-white">{cat.label}</span>
                    {cat.value > 0 && (
                      <Badge variant="accent" className="ml-auto">
                        {cat.value}/5
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(cat.key, star)}
                        className={`
                          w-10 h-10 rounded-lg border transition-all duration-200
                          flex items-center justify-center text-sm font-medium
                          ${
                            star <= cat.value
                              ? "bg-echo-accent/20 border-echo-accent/40 text-echo-accent"
                              : "bg-echo-bg border-echo-border text-echo-muted hover:border-echo-accent/30 hover:text-white"
                          }
                        `}
                      >
                        {star}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Written review */}
          <div className="mb-6">
            <label className="label-text">Written Review (optional)</label>
            <textarea
              className="input-field min-h-[120px] resize-y"
              placeholder="Share your experience... This will be stored as a content hash on-chain, with the full text on IPFS."
              value={reviewContent}
              onChange={(e) => setReviewContent(e.target.value)}
            />
            <p className="text-xs text-echo-muted mt-1.5">
              <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-echo-accent" />
              The review text is hashed and stored on IPFS/Arweave. Only the hash is on-chain.
            </p>
          </div>

          <Button
            icon={<Send className="w-4 h-4" />}
            loading={loading}
            disabled={!allRated}
            onClick={handleSubmit}
          >
            Submit Anonymous Review
          </Button>
        </Card>
      )}

      {/* Rating Aggregates */}
      <Card>
        <h2 className="section-heading mb-6">Rating Aggregates</h2>
        <p className="text-xs text-echo-muted mb-4">
          Live on-chain aggregated ratings from {totalReviews} anonymous reviews. These counters update with each submission.
        </p>
        <div className="space-y-4">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const agg = ratingAggregates[cat.key];
            const pct = agg ? (agg.avg / 5) * 100 : 0;
            return (
              <div key={cat.key} className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-40 shrink-0">
                  <Icon className={`w-4 h-4 ${cat.color}`} />
                  <span className="text-sm text-echo-muted">{cat.label}</span>
                </div>
                <div className="flex-1 rating-bar">
                  <div className="rating-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-mono text-echo-muted w-12 text-right">
                  {agg ? agg.avg.toFixed(1) : "--"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Published Reviews */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-echo-accent/10">
            <Eye className="w-5 h-5 text-echo-accent" />
          </div>
          <div>
            <h2 className="section-heading">Published Reviews</h2>
            <p className="text-xs text-echo-muted">
              Verified anonymous reviews from employees. Identity is never revealed — only the ZK proof is on-chain.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {publishedReviews.map((review) => (
            <div
              key={review.id}
              className="bg-echo-bg rounded-lg border border-echo-border p-4 space-y-3"
            >
              {/* Review header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-echo-surface border border-echo-border flex items-center justify-center">
                    <Users className="w-4 h-4 text-echo-muted" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">{review.anonId}</span>
                    <div className="flex items-center gap-2 text-xs text-echo-muted">
                      <span>{review.date}</span>
                      <span>·</span>
                      <span>Period {review.period}</span>
                    </div>
                  </div>
                </div>
                {review.verified && (
                  <div className="flex items-center gap-1.5 text-xs text-echo-success">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified on-chain</span>
                  </div>
                )}
              </div>

              {/* Rating badges */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Culture", value: review.ratings.culture },
                  { label: "Comp", value: review.ratings.compensation },
                  { label: "Mgmt", value: review.ratings.management },
                  { label: "WLB", value: review.ratings.workLifeBalance },
                  { label: "Growth", value: review.ratings.careerGrowth },
                ].map((r) => (
                  <span
                    key={r.label}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${ratingColor(r.value)}`}
                  >
                    {r.label}
                    <span className="font-bold">{r.value}/5</span>
                  </span>
                ))}
              </div>

              {/* Review content */}
              {review.content && (
                <p className="text-sm text-echo-muted leading-relaxed">
                  &ldquo;{review.content}&rdquo;
                </p>
              )}
              {!review.content && (
                <p className="text-xs text-echo-muted italic">
                  Ratings only — no written review submitted.
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* How Anonymous Reviews Work */}
      <Card>
        <h2 className="section-heading mb-4">How Anonymous Reviews Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-echo-accent/20 text-echo-accent text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-medium text-white">Earn a Token</h3>
            </div>
            <p className="text-xs text-echo-muted leading-relaxed pl-8">
              Confirm a salary receipt to prove you&apos;re a verified employee. This issues a
              one-time review token.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-echo-accent/20 text-echo-accent text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h3 className="text-sm font-medium text-white">Submit Anonymously</h3>
            </div>
            <p className="text-xs text-echo-muted leading-relaxed pl-8">
              A ZK proof verifies your token ownership without revealing who you are.
              A nullifier prevents double-reviewing.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-echo-accent/20 text-echo-accent text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h3 className="text-sm font-medium text-white">Public Aggregates</h3>
            </div>
            <p className="text-xs text-echo-muted leading-relaxed pl-8">
              Rating counters increment on-chain. Anyone can see aggregate scores,
              but no one can link a review to a specific person.
            </p>
          </div>
        </div>
      </Card>

      {!wallet.isConnected && (
        <Card className="border-echo-warning/20">
          <div className="flex items-center gap-3 text-echo-warning">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm">Connect your wallet to submit reviews.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
