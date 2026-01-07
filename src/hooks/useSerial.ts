/**
 * useSerial Hook
 *
 * React hook for managing serial connection to Meshtastic device
 */

import { useState, useEffect, useCallback } from 'react';

interface SerialPort {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  vendorId?: string;
  productId?: string;
}

interface SerialStats {
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  lastMessageTime: number | null;
  myNodeNum: number | null;
  myNodeId: string | null;
  isConnected: boolean;
}

interface UseSerialReturn {
  // State
  ports: SerialPort[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  stats: SerialStats | null;

  // Actions
  refreshPorts: () => Promise<void>;
  connect: (port: string, baudRate?: number) => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  getStatus: () => Promise<void>;
}

export function useSerial(): UseSerialReturn {
  const [ports, setPorts] = useState<SerialPort[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SerialStats | null>(null);

  /**
   * Refresh the list of available serial ports
   */
  const refreshPorts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/serial?action=ports');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to list ports');
      }

      setPorts(data.ports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list ports');
      setPorts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get current connection status
   */
  const getStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/serial');
      const data = await response.json();

      if (response.ok) {
        setIsConnected(data.connected);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to get serial status:', err);
    }
  }, []);

  /**
   * Connect to a serial port
   */
  const connect = useCallback(async (port: string, baudRate = 115200): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/serial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          port,
          baudRate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      setIsConnected(data.connected);
      setStats(data.stats);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Disconnect from serial port
   */
  const disconnect = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/serial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect');
      }

      setIsConnected(false);
      setStats(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get initial status on mount
  useEffect(() => {
    getStatus();
    refreshPorts();
  }, [getStatus, refreshPorts]);

  // Poll for status updates when connected
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(getStatus, 5000);
    return () => clearInterval(interval);
  }, [isConnected, getStatus]);

  return {
    ports,
    isConnected,
    isLoading,
    error,
    stats,
    refreshPorts,
    connect,
    disconnect,
    getStatus,
  };
}
