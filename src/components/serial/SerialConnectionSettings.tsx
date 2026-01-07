/**
 * Web Serial Connection Settings Component
 *
 * UI for managing Web Serial API connection to Meshtastic device.
 * Works like flasher.meshtastic.org - browser connects directly to USB device.
 */

"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Usb, AlertCircle, CheckCircle2, Plug, Unplug, Chrome } from "lucide-react";
import { useWebSerial } from "@/hooks/useWebSerial";

export function SerialConnectionSettings() {
  const {
    isSupported,
    isConnected,
    isConnecting,
    error,
    myNodeNum,
    nodeCount,
    connect,
    disconnect,
  } = useWebSerial();

  const formatNodeId = (num: number): string => {
    return `!${num.toString(16).padStart(8, '0')}`;
  };

  // Browser doesn't support Web Serial
  if (!isSupported) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Chrome className="h-5 w-5" />
            <span className="font-medium">Browser Not Supported</span>
          </div>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Web Serial API requires <strong>Chrome</strong>, <strong>Edge</strong>, or <strong>Opera</strong>.
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Firefox and Safari do not support direct USB connections.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Usb className="h-4 w-4" />
          <span className="text-sm font-medium">USB Connection</span>
        </div>
        <Badge variant={isConnected ? "default" : "secondary"}>
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      {/* Connected Info */}
      {isConnected && (
        <div className="p-3 bg-green-50 dark:bg-green-950/50 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Connected to Meshtastic Device</span>
          </div>
          {myNodeNum && (
            <div className="text-sm text-green-600 dark:text-green-400">
              My Node: <span className="font-mono">{formatNodeId(myNodeNum)}</span>
            </div>
          )}
          {nodeCount > 0 && (
            <div className="text-sm text-green-600 dark:text-green-400">
              Nodes discovered: {nodeCount}
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Connect/Disconnect Button */}
      <div className="pt-2">
        {isConnected ? (
          <Button
            variant="destructive"
            className="w-full"
            onClick={disconnect}
          >
            <Unplug className="h-4 w-4 mr-2" />
            Disconnect
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={connect}
            disabled={isConnecting}
          >
            <Plug className="h-4 w-4 mr-2" />
            {isConnecting ? "Connecting..." : "Connect USB Device"}
          </Button>
        )}
      </div>

      {/* Help Text */}
      {!isConnected && (
        <div className="text-xs text-muted-foreground space-y-2">
          <p>
            Click <strong>Connect USB Device</strong> and select your Meshtastic radio from the popup.
          </p>
          <p>
            Your device should be connected via USB cable. Works just like{" "}
            <a
              href="https://flasher.meshtastic.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              flasher.meshtastic.org
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
