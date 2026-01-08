"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileJson,
  Shield,
  Key,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api/http";

interface BackupResult {
  success: boolean;
  message: string;
  results?: {
    settings: number;
    channels: number;
    nodeAliases: number;
    users: number;
    errors: string[];
  };
}

export function BackupRestoreCard() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [includeUsers, setIncludeUsers] = useState(false);
  const [result, setResult] = useState<BackupResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setResult(null);

    try {
      const params = new URLSearchParams();
      if (includeSecrets) params.set("includeSecrets", "true");
      if (includeUsers) params.set("includeUsers", "true");

      const response = await fetch(`/api/backup?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Get filename from Content-Disposition header or generate one
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `namm-backup-${new Date().toISOString().split("T")[0]}.json`;

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setResult({
        success: true,
        message: `Backup exported as ${filename}`,
      });
    } catch (error) {
      setResult({
        success: false,
        message: "Failed to export backup",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const response = await apiPost<BackupResult>("/api/backup", backup);
      setResult(response);
    } catch (error) {
      setResult({
        success: false,
        message: "Failed to import backup. Make sure the file is a valid NAMM backup.",
      });
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileJson className="h-5 w-5 text-[hsl(var(--green))]" />
          <CardTitle>Backup & Restore</CardTitle>
        </div>
        <CardDescription>
          Export your settings and configuration to a file, or restore from a previous backup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Export Backup</h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="include-secrets" className="text-sm">Include Channel Keys</Label>
                <p className="text-xs text-muted-foreground">
                  Include PSK keys for private channels (sensitive)
                </p>
              </div>
              <Switch
                id="include-secrets"
                checked={includeSecrets}
                onCheckedChange={setIncludeSecrets}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="include-users" className="text-sm">Include Users</Label>
                <p className="text-xs text-muted-foreground">
                  Include user accounts and auth configuration
                </p>
              </div>
              <Switch
                id="include-users"
                checked={includeUsers}
                onCheckedChange={setIncludeUsers}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export Backup
            </Button>

            {includeSecrets && (
              <Badge variant="outline" className="text-orange-500 border-orange-500">
                <Key className="h-3 w-3 mr-1" />
                Contains Secrets
              </Badge>
            )}
          </div>
        </div>

        <div className="border-t border-[hsl(var(--border))]" />

        {/* Import Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Restore from Backup</h4>
          <p className="text-sm text-muted-foreground">
            Upload a NAMM backup file to restore your settings and configuration.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button variant="outline" onClick={handleImportClick} disabled={importing}>
            {importing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Import Backup
          </Button>
        </div>

        {/* Result Display */}
        {result && (
          <div
            className={`flex items-start gap-3 p-4 rounded-lg ${
              result.success
                ? "bg-green-500/10 text-green-500"
                : "bg-red-500/10 text-red-500"
            }`}
          >
            {result.success ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">{result.message}</p>
              {result.results && (
                <div className="text-xs space-y-0.5">
                  <p>Settings restored: {result.results.settings}</p>
                  <p>Channels restored: {result.results.channels}</p>
                  <p>Node aliases restored: {result.results.nodeAliases}</p>
                  {result.results.errors.length > 0 && (
                    <p className="text-orange-500">
                      Warnings: {result.results.errors.join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
