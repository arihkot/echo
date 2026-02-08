"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  UserPlus,
  UserMinus,
  ShieldCheck,
  Users,
  RefreshCw,
  Key,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, StatCard } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { useAppStore } from "@/app/store";
import { useEchoAPI } from "@/app/hooks/useEchoAPI";
import { Role } from "@/src/contract/types";

export default function OrganizationPage() {
  const { role, wallet, orgName, orgStatus, addNotification } = useAppStore();
  const api = useEchoAPI();
  const [loading, setLoading] = useState<string | null>(null);
  const [employeeCommitment, setEmployeeCommitment] = useState("");
  const [hrPublicKey, setHrPublicKey] = useState("");
  const [offboardNullifier, setOffboardNullifier] = useState("");

  // Live data from API
  const [employeeCount, setEmployeeCount] = useState(0);
  const [hrOperators, setHrOperators] = useState(0);
  const [orgRound, setOrgRound] = useState(0);
  const [auditors, setAuditors] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const state = await api.getOrganizationState();
      setEmployeeCount(Number(state.employeeCount));
      setHrOperators(state.hrOperatorCount);
      setAuditors(state.auditorCount);
      setOrgRound(Number(state.round));
    } catch (err) {
      console.error("Failed to fetch org state:", err);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isAdmin = role === Role.ADMIN;
  const isHR = role === Role.HR;
  const canManage = isAdmin || isHR;

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setLoading(action);
    try {
      await fn();
      addNotification({ type: "success", title: `${action} completed successfully` });
      // Refetch state after mutation
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-heading flex items-center gap-3">
            <Building2 className="w-7 h-7 text-echo-accent" />
            Organization
          </h1>
          <p className="text-echo-muted text-sm mt-1">
            Manage employees, HR operators, and organization settings
          </p>
        </div>
        <Badge variant={orgStatus === "ACTIVE" ? "success" : "danger"} dot>
          {orgStatus}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Employees"
          value={employeeCount}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          label="HR Operators"
          value={hrOperators}
          icon={<ShieldCheck className="w-5 h-5" />}
        />
        <StatCard
          label="Organization Round"
          value={orgRound}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Auditors"
          value={auditors}
          icon={<Key className="w-5 h-5" />}
        />
      </div>

      {/* Onboard Employee */}
      {canManage && (
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-echo-success/10">
              <UserPlus className="w-5 h-5 text-echo-success" />
            </div>
            <div>
              <h2 className="section-heading">Onboard Employee</h2>
              <p className="text-xs text-echo-muted">
                Add an employee commitment to the Merkle tree (HR or Admin only)
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label-text">Employee Commitment Hash</label>
              <input
                type="text"
                className="input-field font-mono"
                placeholder="0x..."
                value={employeeCommitment}
                onChange={(e) => setEmployeeCommitment(e.target.value)}
              />
              <p className="text-xs text-echo-muted mt-1.5">
                The employee generates this commitment locally from their secret key.
                It never reveals their identity.
              </p>
            </div>
            <Button
              icon={<UserPlus className="w-4 h-4" />}
              loading={loading === "Onboard Employee"}
              disabled={!employeeCommitment}
              onClick={() =>
                handleAction("Onboard Employee", async () => {
                  await api.onboardEmployee(employeeCommitment);
                  setEmployeeCommitment("");
                })
              }
            >
              Onboard Employee
            </Button>
          </div>
        </Card>
      )}

      {/* Add HR Operator (Admin only) */}
      {isAdmin && (
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-echo-accent/10">
              <ShieldCheck className="w-5 h-5 text-echo-accent" />
            </div>
            <div>
              <h2 className="section-heading">Add HR Operator</h2>
              <p className="text-xs text-echo-muted">
                Register a new HR operator who can onboard/offboard employees (Admin only)
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label-text">HR Public Key</label>
              <input
                type="text"
                className="input-field font-mono"
                placeholder="0x..."
                value={hrPublicKey}
                onChange={(e) => setHrPublicKey(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              icon={<ShieldCheck className="w-4 h-4" />}
              loading={loading === "Add HR"}
              disabled={!hrPublicKey}
              onClick={() =>
                handleAction("Add HR", async () => {
                  await api.addHrOperator(hrPublicKey);
                  setHrPublicKey("");
                })
              }
            >
              Add HR Operator
            </Button>
          </div>
        </Card>
      )}

      {/* Prove Employment (Employee) */}
      {role === Role.EMPLOYEE && (
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-echo-success/10">
              <CheckCircle2 className="w-5 h-5 text-echo-success" />
            </div>
            <div>
              <h2 className="section-heading">Prove Employment</h2>
              <p className="text-xs text-echo-muted">
                Generate a zero-knowledge proof that you are a current employee without revealing your identity
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-echo-bg rounded-lg p-4 border border-echo-border">
              <h3 className="text-sm font-medium text-white mb-2">What this proves:</h3>
              <ul className="space-y-2 text-sm text-echo-muted">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-echo-success shrink-0" />
                  Your commitment exists in the employee Merkle tree
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-echo-success shrink-0" />
                  Your nullifier has not been revoked
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-echo-success shrink-0" />
                  The organization is in ACTIVE status
                </li>
              </ul>
            </div>
            <Button
              icon={<ShieldCheck className="w-4 h-4" />}
              loading={loading === "Prove Employment"}
              disabled={loading === "Prove Employment"}
              onClick={() =>
                handleAction("Prove Employment", async () => {
                  await api.proveEmployment();
                })
              }
            >
              Generate Employment Proof
            </Button>
          </div>
        </Card>
      )}

      {/* Offboard Employee (Admin/HR) */}
      {canManage && (
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-echo-danger/10">
              <UserMinus className="w-5 h-5 text-echo-danger" />
            </div>
            <div>
              <h2 className="section-heading">Offboard Employee</h2>
              <p className="text-xs text-echo-muted">
                Revoke an employee by adding their nullifier to the revocation set
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label-text">Employee Nullifier</label>
              <input
                type="text"
                className="input-field font-mono"
                placeholder="0x..."
                value={offboardNullifier}
                onChange={(e) => setOffboardNullifier(e.target.value)}
              />
              <p className="text-xs text-echo-muted mt-1.5">
                <AlertTriangle className="w-3 h-3 inline mr-1 text-echo-warning" />
                This action cannot be reversed. The employee will no longer be able to prove employment.
              </p>
            </div>
            <Button
              variant="danger"
              icon={<UserMinus className="w-4 h-4" />}
              loading={loading === "Offboard Employee"}
              disabled={!offboardNullifier}
              onClick={() =>
                handleAction("Offboard Employee", async () => {
                  await api.offboardEmployee(offboardNullifier);
                  setOffboardNullifier("");
                })
              }
            >
              Offboard Employee
            </Button>
          </div>
        </Card>
      )}

      {/* Not connected warning */}
      {!wallet.isConnected && (
        <Card className="border-echo-warning/20">
          <div className="flex items-center gap-3 text-echo-warning">
            <AlertTriangle className="w-5 h-5" />
            <p className="text-sm">
              Connect your wallet to interact with the organization contract.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
