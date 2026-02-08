"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Banknote,
  Send,
  CheckCircle2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Receipt,
  Scale,
  Gavel,
} from "lucide-react";
import { Card, StatCard } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { useAppStore } from "@/app/store";
import { useEchoAPI } from "@/app/hooks/useEchoAPI";
import { Role } from "@/src/contract/types";

const bandColors = ["bg-blue-400", "bg-echo-accent", "bg-purple-400", "bg-amber-400", "bg-echo-success"];
const bandLabels = ["0 - 5 LPA", "5 - 15 LPA", "15 - 30 LPA", "30 - 50 LPA", "50+ LPA"];

export default function SalaryPage() {
  const { role, wallet, addNotification } = useAppStore();
  const api = useEchoAPI();
  const [loading, setLoading] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [employeePk, setEmployeePk] = useState("");
  const [rangeLower, setRangeLower] = useState("");
  const [rangeUpper, setRangeUpper] = useState("");

  // Live data from API
  const [totalPayments, setTotalPayments] = useState(0);
  const [currentPeriod, setCurrentPeriod] = useState(0);
  const [activeDisputes, setActiveDisputes] = useState(0);
  const [totalPayroll, setTotalPayroll] = useState("₹0");
  const [bands, setBands] = useState([0, 0, 0, 0, 0]);

  const fetchData = useCallback(async () => {
    try {
      const state = await api.getSalaryState();
      const tp = Number(state.totalPaymentsProcessed);
      setTotalPayments(tp);
      setCurrentPeriod(Number(state.currentPeriod));
      setActiveDisputes(Number(state.activeDisputes));
      // Format payroll as crores or lakhs
      const payrollNum = Number(state.totalPayrollAmount);
      if (payrollNum >= 10000000) {
        setTotalPayroll(`₹${(payrollNum / 10000000).toFixed(2)} Cr`);
      } else if (payrollNum >= 100000) {
        setTotalPayroll(`₹${(payrollNum / 100000).toFixed(1)} L`);
      } else {
        setTotalPayroll(`₹${payrollNum.toLocaleString("en-IN")}`);
      }
      setBands([
        Number(state.salaryBands.band1),
        Number(state.salaryBands.band2),
        Number(state.salaryBands.band3),
        Number(state.salaryBands.band4),
        Number(state.salaryBands.band5),
      ]);
    } catch (err) {
      console.error("Failed to fetch salary state:", err);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isAdmin = role === Role.ADMIN;
  const isHR = role === Role.HR;
  const isEmployee = role === Role.EMPLOYEE;
  const canProcess = isAdmin || isHR;

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setLoading(action);
    try {
      await fn();
      addNotification({ type: "success", title: `${action} completed` });
      await fetchData();
    } catch (err) {
      addNotification({ type: "error", title: `${action} failed`, message: String(err) });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="page-heading flex items-center gap-3">
          <Banknote className="w-7 h-7 text-echo-accent" />
          Salary Management
        </h1>
        <p className="text-echo-muted text-sm mt-1">
          Process payments privately, confirm receipts, and prove salary ranges with zero-knowledge proofs
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Payments"
          value={totalPayments}
          icon={<Send className="w-5 h-5" />}
        />
        <StatCard
          label="Current Period"
          value={currentPeriod}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Active Disputes"
          value={activeDisputes}
          icon={<Gavel className="w-5 h-5" />}
        />
        <StatCard
          label="Total Payroll"
          value={totalPayroll}
          icon={<Banknote className="w-5 h-5" />}
        />
      </div>

      {/* Process Salary Payment (Admin/HR) */}
      {canProcess && (
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-echo-success/10">
              <Send className="w-5 h-5 text-echo-success" />
            </div>
            <div>
              <h2 className="section-heading">Process Salary Payment</h2>
              <p className="text-xs text-echo-muted">
                Create an on-chain commitment for a salary payment. The amount stays private.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label-text">Employee Public Key</label>
              <input
                type="text"
                className="input-field font-mono"
                placeholder="0x..."
                value={employeePk}
                onChange={(e) => setEmployeePk(e.target.value)}
              />
            </div>
            <div>
              <label className="label-text">Amount (tDUST)</label>
              <input
                type="number"
                className="input-field"
                placeholder="1200000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-echo-bg rounded-lg p-4 border border-echo-border mb-4">
            <p className="text-xs text-echo-muted">
              <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-echo-accent" />
              The payment amount is committed on-chain using a cryptographic hash.
              Only the employee with the correct preimage can claim the receipt.
              The salary band counter is incremented anonymously.
            </p>
          </div>

          <Button
            icon={<Send className="w-4 h-4" />}
            loading={loading === "Process Payment"}
            disabled={!employeePk || !amount}
            onClick={() =>
              handleAction("Process Payment", async () => {
                await api.processSalaryPayment({
                  employeePublicKey: employeePk,
                  amount: BigInt(amount),
                  period: BigInt(currentPeriod),
                  salaryBand: Number(amount) < 500000 ? 1 : Number(amount) < 1500000 ? 2 : Number(amount) < 3000000 ? 3 : Number(amount) < 5000000 ? 4 : 5,
                });
                setAmount("");
                setEmployeePk("");
              })
            }
          >
            Process Payment
          </Button>
        </Card>
      )}

      {/* Confirm Salary Receipt (Employee) */}
      {isEmployee && (
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-echo-accent/10">
              <Receipt className="w-5 h-5 text-echo-accent" />
            </div>
            <div>
              <h2 className="section-heading">Confirm Salary Receipt</h2>
              <p className="text-xs text-echo-muted">
                Prove you received your salary and get a review token in return
              </p>
            </div>
          </div>

          <div className="bg-echo-bg rounded-lg p-4 border border-echo-border mb-4 space-y-3">
            <h3 className="text-sm font-medium text-white">How this works:</h3>
            <ul className="space-y-2 text-sm text-echo-muted">
              <li className="flex items-start gap-2">
                <span className="text-echo-accent font-mono text-xs mt-0.5">1.</span>
                You prove knowledge of the payment commitment&apos;s preimage
              </li>
              <li className="flex items-start gap-2">
                <span className="text-echo-accent font-mono text-xs mt-0.5">2.</span>
                A receipt nullifier prevents double-claiming
              </li>
              <li className="flex items-start gap-2">
                <span className="text-echo-accent font-mono text-xs mt-0.5">3.</span>
                A review token is issued, enabling you to submit an anonymous review
              </li>
            </ul>
          </div>

          <Button
            icon={<CheckCircle2 className="w-4 h-4" />}
            loading={loading === "Confirm Receipt"}
            disabled={loading === "Confirm Receipt"}
            onClick={() =>
              handleAction("Confirm Receipt", async () => {
                await api.confirmSalaryReceipt();
              })
            }
          >
            Confirm Receipt & Get Review Token
          </Button>
        </Card>
      )}

      {/* Prove Salary Range (Employee) */}
      {isEmployee && (
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-purple-400/10">
              <Scale className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="section-heading">Prove Salary Range</h2>
              <p className="text-xs text-echo-muted">
                Prove your salary falls within a range without revealing the exact amount
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label-text">Lower Bound</label>
              <input
                type="number"
                className="input-field"
                placeholder="500000"
                value={rangeLower}
                onChange={(e) => setRangeLower(e.target.value)}
              />
            </div>
            <div>
              <label className="label-text">Upper Bound</label>
              <input
                type="number"
                className="input-field"
                placeholder="1500000"
                value={rangeUpper}
                onChange={(e) => setRangeUpper(e.target.value)}
              />
            </div>
          </div>

          <Button
            variant="secondary"
            icon={<Scale className="w-4 h-4" />}
            loading={loading === "Prove Range"}
            disabled={!rangeLower || !rangeUpper}
            onClick={() =>
              handleAction("Prove Range", async () => {
                await api.proveSalaryRange(BigInt(rangeLower), BigInt(rangeUpper));
              })
            }
          >
            Generate Range Proof
          </Button>
        </Card>
      )}

      {/* Salary Band Distribution */}
      <Card>
        <h2 className="section-heading mb-6">Salary Band Distribution</h2>
        <p className="text-xs text-echo-muted mb-4">
          Aggregate salary data from on-chain counters. No individual salaries are revealed.
        </p>
        <div className="space-y-4">
          {bands.map((count, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-sm text-echo-muted w-32 shrink-0">{bandLabels[i]}</span>
              <div className="flex-1 rating-bar">
                <div
                  className={`rating-bar-fill ${bandColors[i]}`}
                  style={{ width: `${count > 0 && totalPayments > 0 ? Math.max(4, (count / totalPayments) * 100) : 0}%` }}
                />
              </div>
              <span className="text-sm font-mono text-echo-muted w-8 text-right">
                {count}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Advance Period (Admin) */}
      {isAdmin && (
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-echo-warning/10">
                <ArrowUpRight className="w-5 h-5 text-echo-warning" />
              </div>
              <div>
                <h2 className="section-heading">Advance Pay Period</h2>
                <p className="text-xs text-echo-muted">
                  Move the contract to the next payment period (admin only)
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              icon={<ArrowUpRight className="w-4 h-4" />}
              loading={loading === "Advance Period"}
              disabled={loading === "Advance Period"}
              onClick={() =>
                handleAction("Advance Period", async () => {
                  await api.advancePeriod();
                })
              }
            >
              Advance Period
            </Button>
          </div>
        </Card>
      )}

      {!wallet.isConnected && (
        <Card className="border-echo-warning/20">
          <div className="flex items-center gap-3 text-echo-warning">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm">Connect your wallet to manage salary operations.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
