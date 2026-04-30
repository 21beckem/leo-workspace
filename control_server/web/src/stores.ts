import { createStore } from 'solid-js/store';
import { createSignal } from 'solid-js';

export const MOTOR_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type MotorName = typeof MOTOR_NAMES[number];
export type ConnectionState = '' | 'connecting' | 'connected';

// Motor store: fine-grained reactive motor state
export interface Motor {
  name: MotorName;
  value: number; // -1 to 1
}

export const createMotorStore = () => {
  const [motors, setMotors] = createStore<Record<MotorName, Motor>>(
    MOTOR_NAMES.reduce((acc, name) => {
      acc[name] = { name, value: 0 };
      return acc;
    }, {} as Record<MotorName, Motor>)
  );

  return {
    motors,
    setMotorValue: (name: MotorName, value: number) => {
      setMotors(name, 'value', Math.max(-1, Math.min(1, value)));
    },
    resetAllMotors: () => {
      MOTOR_NAMES.forEach(name => {
        setMotors(name, 'value', 0);
      });
    },
  };
};

// Connection store
export interface ConnectionStore {
  state: ConnectionState;
  host: string;
  port: string;
  statusLabel: string;
  isConnected: boolean;
}

export const createConnectionStore = () => {
  const [connection, setConnection] = createStore<ConnectionStore>({
    state: '',
    host: localStorage.getItem('robot_host') || detectHostFromLocation(),
    port: localStorage.getItem('robot_port') || '9300',
    statusLabel: 'Not connected',
    isConnected: false,
  });

  const setState = (state: ConnectionState) => {
    setConnection('state', state);
    setConnection('isConnected', state === 'connected');
  };

  const setHost = (host: string) => {
    setConnection('host', host);
    localStorage.setItem('robot_host', host);
  };

  const setPort = (port: string) => {
    setConnection('port', port);
    localStorage.setItem('robot_port', port);
  };

  const setStatusLabel = (label: string) => {
    setConnection('statusLabel', label);
  };

  return {
    connection,
    setState,
    setHost,
    setPort,
    setStatusLabel,
  };
};

// Theme store
export const createThemeStore = () => {
  const initialDarkMode = localStorage.getItem('robot_theme') === 'light';
  const [darkMode, setDarkMode] = createSignal(initialDarkMode);

  const toggleTheme = () => {
    setDarkMode(prev => !prev);
    localStorage.setItem('robot_theme', !darkMode() ? 'dark' : 'light');
    applyTheme(darkMode());
  };

  const applyTheme = (dark: boolean) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  };

  // Initial application
  applyTheme(darkMode());

  return {
    darkMode,
    toggleTheme,
    getThemeLabel: () => darkMode() ? '☽ DARK' : '☀ LIGHT',
  };
};

function detectHostFromLocation(): string {
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== '') {
    return window.location.hostname;
  }
  return '';
}
