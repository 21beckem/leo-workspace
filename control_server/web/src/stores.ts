import { createStore } from 'solid-js/store';
import { createSignal } from 'solid-js';
import { WebSocketService } from './websocket.service';

export const MOTOR_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export enum JointType {
  ADDITIVE = 'additive',
  DIFFERENCE = 'difference',
}
export const JOINT_NAMES = ['L Ankle', 'L Lower', 'L Upper', 'L Hip', 'R Ankle', 'R Lower', 'R Upper', 'R Hip'] as const;
export const ROBOT_JOINTS: [Joint, Joint, Joint, Joint, Joint, Joint, Joint, Joint] = [
  {
    name: 'L Ankle',
    motors: ['A', 'B'],
    type: JointType.DIFFERENCE,
    value: 0
  },
  {
    name: 'L Lower',
    motors: ['A', 'B'],
    type: JointType.ADDITIVE,
    value: 0
  },
  
  {
    name: 'L Upper',
    motors: ['C', 'D'],
    type: JointType.ADDITIVE,
    value: 0
  },
  {
    name: 'L Hip',
    motors: ['C', 'D'],
    type: JointType.DIFFERENCE,
    value: 0
  },
  
  {
    name: 'R Ankle',
    motors: ['E', 'F'],
    type: JointType.DIFFERENCE,
    value: 0
  },
  {
    name: 'R Lower',
    motors: ['E', 'F'],
    type: JointType.ADDITIVE,
    value: 0
  },
  
  {
    name: 'R Upper',
    motors: ['G', 'H'],
    type: JointType.ADDITIVE,
    value: 0
  },
  {
    name: 'R Hip',
    motors: ['G', 'H'],
    type: JointType.DIFFERENCE,
    value: 0
  }
]
export type MotorName = typeof MOTOR_NAMES[number];
export type JointName = typeof JOINT_NAMES[number];
export type ConnectionState = '' | 'connecting' | 'connected';

// Motor store: fine-grained reactive motor state
export interface Motor {
  name: MotorName;
  value: number; // -1 to 1
}
export interface Joint {
  name: JointName;
  motors: [MotorName, MotorName];
  type: JointType;
  value: number; // -1 to 1
}

export const createMotionControlStore = (wsService: WebSocketService) => {
  return {
    setMotorValue: (name: MotorName, value: number) => {
      wsService.sendMotor(name, value, true);
    },
    stopMotor: (name: MotorName) => {
      wsService.sendMotor(name, 0, false);
    },
    resetAllMotors: () => {
      wsService.sendStopAll();
    }
  }
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
