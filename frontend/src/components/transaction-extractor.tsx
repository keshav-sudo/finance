/**
 * Transaction Extractor Component
 * 
 * Provides a text area for users to paste raw bank statement texts,
 * with loading states and quick-fill samples. When parsed, shows a detailed
 * breakdown of the parsed transaction with a visual confidence score.
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { extractTransaction, type ExtractResult } from "@/lib/api";

const SAMPLES = [
  {
    name: "Sample 1 (Labelled)",
    text: `Date: 11 Dec 2025\nDescription: STARBUCKS COFFEE MUMBAI\nAmount: -420.00\nBalance after transaction: 18,420.50`,
  },
  {
    name: "Sample 2 (Arrow)",
    text: `Uber Ride * Airport Drop\n12/11/2025 → ₹1,250.00 debited\nAvailable Balance → ₹17,170.50`,
  },
  {
    name: "Sample 3 (Messy Inline)",
    text: `txn123 2025-12-10 Amazon.in Order #403-1234567-8901234 ₹2,999.00 Dr Bal 14171.50 Shopping`,
  },
];

interface TransactionExtractorProps {
  onExtracted: (transaction: ExtractResult["transaction"]) => void;
}

export function TransactionExtractor({ onExtracted }: TransactionExtractorProps) {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastParsed, setLastParsed] = useState<ExtractResult | null>(null);

  const handleExtract = async () => {
    if (!text.trim()) {
      toast.error("Please enter some transaction text to parse");
      return;
    }

    setIsLoading(true);
    setLastParsed(null);

    try {
      const result = await extractTransaction(text);
      setLastParsed(result);
      onExtracted(result.transaction);
      toast.success("Transaction extracted and saved successfully!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to extract transaction";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSample = (sampleText: string) => {
    setText(sampleText);
    setLastParsed(null);
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
    if (score >= 0.5) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
    return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
  };

  return (
    <div className="grid gap-6 md:grid-cols-12">
      {/* Input Form */}
      <Card className="md:col-span-7 border-border/60 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Raw Text Input</CardTitle>
          <CardDescription>
            Paste the bank notification or receipt content. Or load one of our samples:
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            {SAMPLES.map((sample, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => loadSample(sample.text)}
                className="text-xs h-8 cursor-pointer"
                disabled={isLoading}
              >
                {sample.name}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste transaction text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[160px] font-mono text-sm resize-none focus-visible:ring-1 border-border/80"
            disabled={isLoading}
          />
        </CardContent>
        <CardFooter className="flex justify-between items-center border-t border-border/40 pt-4">
          <span className="text-xs text-muted-foreground font-mono">
            {text.length} characters
          </span>
          <Button
            onClick={handleExtract}
            disabled={isLoading || !text.trim()}
            className="px-6 font-medium shadow-md shadow-primary/10 cursor-pointer"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Extracting...
              </span>
            ) : (
              "Parse & Save"
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Result Preview */}
      <Card className="md:col-span-5 border-border/60 shadow-md flex flex-col justify-between">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg font-semibold">Live Extraction Result</CardTitle>
              <CardDescription>Structured transaction preview</CardDescription>
            </div>
            {lastParsed && (
              <Badge variant="outline" className={`${getConfidenceColor(lastParsed.transaction.confidence)} font-mono`}>
                {(lastParsed.transaction.confidence * 100).toFixed(0)}% Confidence
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 pb-6">
          {lastParsed ? (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4 border border-border/40 rounded-xl p-4 bg-muted/40">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                    Amount
                  </span>
                  <span className={`text-xl font-bold ${lastParsed.transaction.type === "DEBIT" ? "text-destructive" : "text-emerald-600"}`}>
                    {lastParsed.transaction.type === "DEBIT" ? "-" : "+"}
                    ₹{lastParsed.transaction.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                    Type
                  </span>
                  <Badge variant="secondary" className="mt-1 font-semibold">
                    {lastParsed.transaction.type}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3 px-1 text-sm">
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Description</span>
                  <span className="font-medium max-w-[200px] text-right truncate" title={lastParsed.transaction.description}>
                    {lastParsed.transaction.description}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-mono">
                    {new Date(lastParsed.transaction.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Category</span>
                  <Badge variant="outline" className="font-normal capitalize">
                    {lastParsed.transaction.category || "Uncategorized"}
                  </Badge>
                </div>
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-muted-foreground">Balance After</span>
                  <span className="font-mono font-medium">
                    {lastParsed.transaction.balance !== null 
                      ? `₹${lastParsed.transaction.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                      : "—"
                    }
                  </span>
                </div>
                {lastParsed.transaction.reference && (
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono font-medium text-xs bg-muted px-1.5 py-0.5 rounded">
                      {lastParsed.transaction.reference}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-8">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 text-muted-foreground/60">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-6 h-6"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M7 8h10" />
                  <path d="M7 12h10" />
                  <path d="M7 16h6" />
                </svg>
              </div>
              <p className="text-sm font-medium">No transaction parsed yet</p>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-[200px]">
                Input raw text on the left and click &quot;Parse & Save&quot; to see details.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
