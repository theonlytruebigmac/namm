/**
 * useWebSerial Hook
 *
 * React hook for Web Serial API connection to Meshtastic device
 */

"use client";

import { useState, useEffect, useCallback } from 'react';
import { webSerial, type FromRadioMessage } from '@/lib/webserial/web-serial';

interface UseWebSerialReturn {
  // State
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  myNodeNum: number | null;
  nodeCount: number;

  // Actions
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  sendMessage: (text: string, options?: { channel?: number; to?: number; wantAck?: boolean }) => Promise<boolean>;
}

export function useWebSerial(): UseWebSerialReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myNodeNum, setMyNodeNum] = useState<number | null>(null);
  const [nodeCount, setNodeCount] = useState(0);

  // Check support on mount
  useEffect(() => {
    setIsSupported(webSerial.isSupported());
    setIsConnected(webSerial.isConnected());
  }, []);

  // Subscribe to status changes
  useEffect(() => {
    const unsubStatus = webSerial.onStatusChange((connected) => {
      setIsConnected(connected);
      if (!connected) {
        setMyNodeNum(null);
        setNodeCount(0);
      }
    });

    const unsubMessage = webSerial.onMessage((message) => {
      handleMessage(message);
    });

    return () => {
      unsubStatus();
      unsubMessage();
    };
  }, []);

  const handleMessage = useCallback((message: FromRadioMessage) => {
    // Handle different message types
    switch (message.type) {
      case 'myInfo':
        if (message.data.myInfo && typeof message.data.myInfo === 'object') {
          const myInfo = message.data.myInfo as { myNodeNum?: number };
          if (myInfo.myNodeNum) {
            setMyNodeNum(myInfo.myNodeNum);
          }
        }
        break;

      case 'nodeInfo':
        setNodeCount((c) => c + 1);
        // Forward to server for storage
        forwardToServer(message);
        break;

      case 'packet':
        // Forward to server for storage
        forwardToServer(message);
        break;

      case 'channel':
        // Forward channel info to server for key storage
        forwardChannelToServer(message);
        break;

      case 'configComplete':
        console.log('[WebSerial] Config complete');
        break;
    }
  }, []);

  const forwardToServer = async (message: FromRadioMessage) => {
    try {
      await fetch('/api/serial/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: message.type,
          data: message.data,
        }),
      });
    } catch {
      // Ignore - server might not be ready
    }
  };

  const forwardChannelToServer = async (message: FromRadioMessage) => {
    try {
      const channel = message.data.channel as {
        index?: number;
        name?: string;
        psk?: Uint8Array | null;
        role?: number
      } | undefined;

      if (!channel) return;

      // Convert PSK Uint8Array to base64 string
      let pskBase64 = '';
      if (channel.psk && channel.psk.length > 0) {
        // Convert Uint8Array to base64
        const bytes = channel.psk instanceof Uint8Array
          ? channel.psk
          : new Uint8Array(Object.values(channel.psk));
        pskBase64 = btoa(String.fromCharCode(...bytes));
      }

      console.log(`[WebSerial] Forwarding channel ${channel.index}: ${channel.name || 'unnamed'} (role: ${channel.role}, hasKey: ${!!pskBase64})`);

      await fetch('/api/channels/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          index: channel.index,
          name: channel.name,
          psk: pskBase64,
          role: channel.role,
        }),
      });
    } catch (error) {
      console.error('[WebSerial] Failed to forward channel:', error);
    }
  };

  const connect = useCallback(async (): Promise<boolean> => {
    setError(null);
    setIsConnecting(true);

    try {
      const success = await webSerial.connect();
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    await webSerial.disconnect();
  }, []);

  const sendMessage = useCallback(async (
    text: string,
    options?: { channel?: number; to?: number; wantAck?: boolean }
  ): Promise<boolean> => {
    if (!isConnected) {
      setError('Not connected to device');
      return false;
    }
    return webSerial.sendTextMessage(text, options);
  }, [isConnected]);

  return {
    isSupported,
    isConnected,
    isConnecting,
    error,
    myNodeNum,
    nodeCount,
    connect,
    disconnect,
    sendMessage,
  };
}
