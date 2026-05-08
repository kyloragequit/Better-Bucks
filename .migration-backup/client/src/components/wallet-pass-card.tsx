import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Apple, QrCode, RefreshCw, Loader2, RotateCcw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Status = { configured: boolean; pushConfigured: boolean };
type QrToken = { token: string; expiresInSec: number; serialNumber: string };

export function WalletPassCard() {
  const [showQr, setShowQr] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reissuing, setReissuing] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: status } = useQuery<Status>({ queryKey: ["/api/wallet/status"] });
  const configured = status?.configured ?? false;

  async function reissuePass() {
    setReissuing(true);
    try {
      await apiRequest("POST", "/api/wallet/reissue");
      await queryClient.invalidateQueries({ queryKey: ["/api/wallet/qr-token"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/wallet/status"] });
      toast({ title: "Pass re-issued", description: "Your old pass is now invalid. Tap 'Add to Apple Wallet' to install the new one." });
    } catch (e: any) {
      toast({ title: "Could not re-issue pass", description: e?.message || "Try again", variant: "destructive" });
    } finally {
      setReissuing(false);
    }
  }
  const qrQuery = useQuery<QrToken>({
    queryKey: ["/api/wallet/qr-token"],
    enabled: showQr,
    refetchInterval: showQr ? 240_000 : false,
  });

  async function downloadPass() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/wallet/pass.pkpass", { credentials: "include" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ message: "Failed to build pass" }));
        throw new Error(j.message || "Failed to build pass");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "better-bucks.pkpass";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setDownloadError(e?.message || "Failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className="shadow-md border-border/60 mb-8" data-testid="card-wallet-pass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {configured ? (
            <><Apple className="h-5 w-5 text-primary" /> Apple Wallet pass</>
          ) : (
            <><QrCode className="h-5 w-5 text-primary" /> Payment QR code</>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {configured
            ? "Add your Better Bucks balance to Apple Wallet, then show the pass at participating merchants. Or display a QR code below to be scanned."
            : "Show this QR code at participating merchants to pay with your Better Bucks balance."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          {configured && (
            <Button onClick={downloadPass} disabled={downloading} className="w-full sm:w-auto" data-testid="button-add-to-wallet">
              {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Apple className="h-4 w-4 mr-2" />}
              <span className="sm:hidden">Apple Wallet</span>
              <span className="hidden sm:inline">Add to Apple Wallet</span>
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button variant={configured ? "outline" : "default"} onClick={() => setShowQr((v) => !v)} className="flex-1 sm:flex-initial" data-testid="button-show-qr">
              <QrCode className="h-4 w-4 mr-2" />
              <span className="sm:hidden">{showQr ? "Hide QR" : "Show QR"}</span>
              <span className="hidden sm:inline">{showQr ? "Hide QR" : "Show QR code"}</span>
            </Button>
            {configured && (
              <Button variant="ghost" onClick={reissuePass} disabled={reissuing} className="flex-1 sm:flex-initial" data-testid="button-reissue-pass">
                {reissuing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                <span className="sm:hidden">Re-issue</span>
                <span className="hidden sm:inline">Re-issue pass</span>
              </Button>
            )}
          </div>
        </div>
        {configured && (
          <p className="text-xs text-muted-foreground">
            Lost your phone or worried someone copied your pass? Re-issue invalidates the old pass and gives you a brand new one.
          </p>
        )}

        {downloadError && (
          <div className="text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2" data-testid="text-wallet-error">
            {downloadError}
          </div>
        )}

        {showQr && (
          <div className="rounded-lg border bg-card p-4 flex flex-col items-center gap-3">
            {qrQuery.isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {qrQuery.data && (
              <>
                <div className="bg-white p-3 rounded">
                  <QRCodeSVG value={qrQuery.data.token} size={200} data-testid="qr-employee-token" />
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Refreshes every few minutes for security.
                </div>
                <Button size="sm" variant="ghost" onClick={() => qrQuery.refetch()} data-testid="button-refresh-qr">Refresh now</Button>
              </>
            )}
            {qrQuery.error && (
              <div className="text-sm text-destructive">Could not load QR code. Try refreshing.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
