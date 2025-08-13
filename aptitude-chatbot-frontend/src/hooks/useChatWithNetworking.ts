import { useEffect } from 'react';
import { useChatStore } from '@/lib/stores/chat';
import { getNetworkMonitor } from '@/lib/api/networkMonitor';

export function useChatWithNetworking() {
  const chatStore = useChatStore();

  useEffect(() => {
    // Initialize network monitoring when the hook is first used
    chatStore.initializeNetworkMonitoring();

    // Cleanup function
    return () => {
      chatStore.destroyNetworkMonitoring();
    };
  }, []);

  return {
    ...chatStore,
    // Additional network-aware methods
    isNetworkAvailable: () => chatStore.networkStatus?.isOnline ?? true,
    getConnectionQuality: () => {
      const monitor = getNetworkMonitor();
      return monitor.getConnectionQuality();
    },
    testConnection: async () => {
      const monitor = getNetworkMonitor();
      return monitor.testConnection();
    },
  };
}

// Hook for network status only
export function useNetworkStatus() {
  const { networkStatus, connectionStatus } = useChatStore();
  
  return {
    networkStatus,
    connectionStatus,
    isOnline: networkStatus?.isOnline ?? true,
    connectionQuality: (() => {
      if (!networkStatus) return 'unknown';
      const { effectiveType, rtt, downlink } = networkStatus;
      
      if (effectiveType === 'unknown' || !rtt) return 'unknown';
      if (effectiveType === '4g' && rtt < 100 && downlink > 10) return 'excellent';
      if (effectiveType === '4g' || (effectiveType === '3g' && rtt < 200)) return 'good';
      if (effectiveType === '3g' || effectiveType === '2g') return 'fair';
      return 'poor';
    })(),
  };
}