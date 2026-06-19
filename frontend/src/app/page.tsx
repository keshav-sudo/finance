/**
 * Dashboard Page (Protected Root)
 * 
 * The main application page that provides:
 * 1. Transaction text extraction form
 * 2. Paginated transaction history table
 * 3. User session info in the header
 * 
 * This page checks for an active Better Auth session.
 * If no session exists, it redirects to /login.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { TransactionExtractor } from "@/components/transaction-extractor";
import { TransactionTable } from "@/components/transaction-table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { type Transaction, getCurrentUser } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);
  const [orgName, setOrgName] = useState<string>("");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  // Fetch current user details including active workspace name
  useEffect(() => {
    if (session) {
      getCurrentUser()
        .then((user) => setOrgName(user.organizationName))
        .catch((err) => console.error("Failed to fetch organization context:", err));
    }
  }, [session]);

  /** Called after a new transaction is extracted to refresh the table */
  const handleTransactionExtracted = useCallback((_transaction: Transaction) => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  // Show loading state while checking session
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-mesh">
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg shadow-primary/20">
            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show nothing (redirect will happen)
  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-mesh">
      {/* ────────────────────────────────────────────── */}
      {/* Header */}
      {/* ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3l-2-2" />
                  <path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3l-2-2" />
                  <path d="M7 7a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3l-2-2" />
                </svg>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <h1 className="text-lg font-semibold tracking-tight">
                  Vessify Finance
                </h1>
                {orgName && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 animate-fade-in">
                    Workspace: {orgName}
                  </span>
                )}
              </div>
            </div>

            {/* User info + Sign out */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{session.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {session.user.email}
                </p>
              </div>
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                {session.user.name?.[0]?.toUpperCase() || "U"}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 mr-2"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────── */}
      {/* Main Content */}
      {/* ────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="animate-fade-in">
          <h2 className="text-2xl font-bold tracking-tight">
            Transaction Extractor
          </h2>
          <p className="text-muted-foreground mt-1">
            Paste your bank statement text below to extract and save transaction data.
          </p>
        </div>

        {/* Extraction Form */}
        <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <TransactionExtractor onExtracted={handleTransactionExtracted} />
        </div>

        <Separator className="my-8" />

        {/* Transaction History */}
        <div
          className="animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Transaction History
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your extracted transactions, sorted by most recent
              </p>
            </div>
          </div>

          <TransactionTable key={refreshKey} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© 2025 Vessify Finance. Secure, isolated, enterprise-grade.</p>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success pulse-dot" />
              <span>All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
