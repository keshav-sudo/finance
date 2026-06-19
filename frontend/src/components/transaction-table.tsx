/**
 * Transaction Table Component
 * 
 * Lists transactions with cursor-based pagination.
 * Features a "Load More" action, loading skeleton state,
 * error boundaries, and highlights category, amount sign, and confidence scores.
 */

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listTransactions, type Transaction } from "@/lib/api";

export function TransactionTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchTransactions = async (cursor?: string) => {
    try {
      const result = await listTransactions(cursor, 10);
      if (cursor) {
        setTransactions((prev) => [...prev, ...result.transactions]);
      } else {
        setTransactions(result.transactions);
      }
      setNextCursor(result.pagination.nextCursor);
      setHasMore(result.pagination.hasMore);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load transactions";
      toast.error(message);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const result = await listTransactions(undefined, 10);
        if (isMounted) {
          setTransactions(result.transactions);
          setNextCursor(result.pagination.nextCursor);
          setHasMore(result.pagination.hasMore);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Failed to load transactions";
          toast.error(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLoadMore = () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    fetchTransactions(nextCursor);
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-mono text-[11px]">
          High
        </Badge>
      );
    }
    if (score >= 0.5) {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 font-mono text-[11px]">
          Medium
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 font-mono text-[11px]">
        Low
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-[200px] w-full rounded-xl shimmer border border-border/40" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="border border-dashed border-border/80 rounded-2xl p-12 text-center bg-card">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-6 h-6"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <h3 className="font-semibold text-lg">No transactions yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-[280px] mx-auto">
          Start by pasting some raw text statements above to populate your finance dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-border/60 rounded-2xl overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[130px]">Category</TableHead>
              <TableHead className="w-[120px]">Ref ID</TableHead>
              <TableHead className="text-right w-[140px]">Amount</TableHead>
              <TableHead className="text-right w-[140px]">Balance</TableHead>
              <TableHead className="text-center w-[100px]">Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((txn) => (
              <TableRow key={txn.id} className="hover:bg-muted/10 transition-colors">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {new Date(txn.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell className="font-medium max-w-[240px] truncate" title={txn.description}>
                  {txn.description}
                </TableCell>
                <TableCell>
                  {txn.category ? (
                    <Badge variant="secondary" className="font-normal text-xs capitalize">
                      {txn.category}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">—</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {txn.reference || <span className="text-muted-foreground/60">—</span>}
                </TableCell>
                <TableCell className={`text-right font-bold ${txn.type === "DEBIT" ? "text-destructive" : "text-emerald-600"}`}>
                  {txn.type === "DEBIT" ? "-" : "+"}
                  ₹{txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground font-medium">
                  {txn.balance !== null 
                    ? `₹${txn.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                    : <span className="text-muted-foreground/40">—</span>
                  }
                </TableCell>
                <TableCell className="text-center">
                  {getConfidenceBadge(txn.confidence)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="px-8 cursor-pointer shadow-sm"
          >
            {isLoadingMore ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading more...
              </span>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
