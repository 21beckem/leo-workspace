import { ConnectionState, MotorName } from './stores';

export interface WebSocketServiceConfig {
  onStateChange: (state: ConnectionState) => void;
  onStatusChange: (status: string) => void;
  onMotorSend?: (motor: MotorName, value: number) => void;
  onError?: (message: string) => void;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketServiceConfig;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMotorSends: Map<MotorName, number> = new Map();
  private readonly THROTTLE_MS = 33; // ~30 fps

  constructor(config: WebSocketServiceConfig) {
    this.config = config;
  }

  connect(host: string, port: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    if (!host.trim()) {
      this.config.onStatusChange('Enter a host address');
      return;
    }

    const url = `ws://${host}:${port}/ws`;
    this.config.onStateChange('connecting');
    this.config.onStatusChange(`Connecting to ${url} …`);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.config.onStateChange('connected');
      this.config.onStatusChange(`Connected — ${host}:${port}`);
    };

    this.ws.onclose = () => {
      this.config.onStateChange('');
      this.config.onStatusChange('Disconnected');
      this.ws = null;
      this.clearThrottleTimer();
    };

    this.ws.onerror = () => {
      this.config.onStateChange('');
      this.config.onStatusChange('Connection error — is the server running?');
    };

    this.ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'error') {
          console.warn('[Server]', d.message);
          this.config.onError?.(d.message);
        }
      } catch {}
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.sendMessage({ type: 'stop_all' });
      this.ws.close();
      this.ws = null;
    }
    this.clearThrottleTimer();
    this.config.onStateChange('');
    this.config.onStatusChange('Disconnected');
  }

  sendMotor(motor: MotorName, value: number, throttle: boolean = true): void {
    if (!this.isConnected()) return;

    if (throttle) {
      this.pendingMotorSends.set(motor, value);
      if (!this.throttleTimer) {
        this.throttleTimer = setTimeout(() => {
          this.flushPendingMotorSends();
        }, this.THROTTLE_MS);
      }
    } else {
      this.pendingMotorSends.delete(motor);
      this.sendMessage({ type: 'motor', motor, value });
    }
  }

  private flushPendingMotorSends(): void {
    this.pendingMotorSends.forEach((value, motor) => {
      this.sendMessage({ type: 'motor', motor, value });
    });
    this.pendingMotorSends.clear();
    this.clearThrottleTimer();
  }

  sendStopAll(): void {
    if (!this.isConnected()) return;
    this.flushPendingMotorSends(); // Send any pending before stopping
    this.sendMessage({ type: 'stop_all' });
  }

  sendPowerOff(): void {
    if (!this.isConnected()) return;
    this.sendMessage({ type: 'poweroff' });
  }

  private sendMessage(obj: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private clearThrottleTimer(): void {
    if (this.throttleTimer !== null) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
  }
}
