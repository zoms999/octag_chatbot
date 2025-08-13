export interface NetworkStatus {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  downlink: number;
  rtt: number;
}

export interface NetworkMonitorOptions {
  onStatusChange?: (status: NetworkStatus) => void;
  onOnline?: () => void;
  onOffline?: () => void;
  pingInterval?: number;
  pingUrl?: string;
}

export class NetworkMonitor {
  private status: NetworkStatus;
  private options: NetworkMonitorOptions;
  private pingTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(status: NetworkStatus) => void> = new Set();

  constructor(options: NetworkMonitorOptions = {}) {
    this.options = {
      pingInterval: 30000, // 30 seconds
      pingUrl: '/api/health',
      ...options,
    };

    this.status = this.getCurrentStatus();
    this.setupEventListeners();
    this.startPinging();
  }

  private getCurrentStatus(): NetworkStatus {
    const navigator = window.navigator as any;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    return {
      isOnline: navigator.onLine,
      connectionType: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0,
    };
  }

  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Listen for connection changes
    const navigator = window.navigator as any;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (connection) {
      connection.addEventListener('change', this.handleConnectionChange);
    }
  }

  private handleOnline = (): void => {
    this.updateStatus({ isOnline: true });
    this.options.onOnline?.();
  };

  private handleOffline = (): void => {
    this.updateStatus({ isOnline: false });
    this.options.onOffline?.();
  };

  private handleConnectionChange = (): void => {
    const newStatus = this.getCurrentStatus();
    this.updateStatus(newStatus);
  };

  private updateStatus(updates: Partial<NetworkStatus>): void {
    const oldStatus = { ...this.status };
    this.status = { ...this.status, ...updates };

    // Notify listeners if status changed
    if (JSON.stringify(oldStatus) !== JSON.stringify(this.status)) {
      this.options.onStatusChange?.(this.status);
      this.listeners.forEach((listener) => {
        try {
          listener(this.status);
        } catch (error) {
          console.error('Error in network status listener:', error);
        }
      });
    }
  }

  private startPinging(): void {
    if (!this.options.pingInterval || !this.options.pingUrl) {
      return;
    }

    this.pingTimer = setInterval(async () => {
      try {
        const startTime = Date.now();
        const response = await fetch(this.options.pingUrl!, {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        const rtt = Date.now() - startTime;
        const isOnline = response.ok;

        this.updateStatus({
          isOnline,
          rtt: Math.min(rtt, this.status.rtt || rtt), // Use minimum RTT
        });
      } catch (error) {
        // Ping failed, likely offline
        this.updateStatus({ isOnline: false });
      }
    }, this.options.pingInterval);
  }

  addListener(listener: (status: NetworkStatus) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (status: NetworkStatus) => void): void {
    this.listeners.delete(listener);
  }

  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  isOnline(): boolean {
    return this.status.isOnline;
  }

  getConnectionQuality(): 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' {
    const { effectiveType, rtt, downlink } = this.status;

    if (effectiveType === 'unknown' || !rtt) {
      return 'unknown';
    }

    if (effectiveType === '4g' && rtt < 100 && downlink > 10) {
      return 'excellent';
    }

    if (effectiveType === '4g' || (effectiveType === '3g' && rtt < 200)) {
      return 'good';
    }

    if (effectiveType === '3g' || effectiveType === '2g') {
      return 'fair';
    }

    return 'poor';
  }

  async testConnection(url?: string): Promise<{
    isReachable: boolean;
    responseTime: number;
    error?: string;
  }> {
    const testUrl = url || this.options.pingUrl || '/api/health';
    const startTime = Date.now();

    try {
      const response = await fetch(testUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      return {
        isReachable: response.ok,
        responseTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        isReachable: false,
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  destroy(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    const navigator = window.navigator as any;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (connection) {
      connection.removeEventListener('change', this.handleConnectionChange);
    }

    this.listeners.clear();
  }
}

// Singleton instance
let networkMonitorInstance: NetworkMonitor | null = null;

export function getNetworkMonitor(options?: NetworkMonitorOptions): NetworkMonitor {
  if (!networkMonitorInstance) {
    networkMonitorInstance = new NetworkMonitor(options);
  }
  return networkMonitorInstance;
}

export function destroyNetworkMonitor(): void {
  if (networkMonitorInstance) {
    networkMonitorInstance.destroy();
    networkMonitorInstance = null;
  }
}