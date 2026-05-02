import { createStore } from 'solid-js/store';
import { createSignal } from 'solid-js';
import { WebSocketService } from './websocket.service';

export const MOTOR_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export enum JointType {
  ADDITIVE = 'additive',
  DIFFERENCE = 'difference',
}
export const JOINT_NAMES = ['R-H', 'R-U', 'R-L', 'R-A', 'L-H', 'L-U', 'L-L', 'L-A'] as const;
export const ROBOT_JOINTS: [Joint, Joint, Joint, Joint, Joint, Joint, Joint, Joint] = [
  {
    name: 'L-A',
    motors: ['A', 'B'],
    type: JointType.DIFFERENCE,
    value: 0
  },
  {
    name: 'L-L',
    motors: ['A', 'B'],
    type: JointType.ADDITIVE,
    value: 0
  },
  
  {
    name: 'L-U',
    motors: ['C', 'D'],
    type: JointType.ADDITIVE,
    value: 0
  },
  {
    name: 'L-H',
    motors: ['C', 'D'],
    type: JointType.DIFFERENCE,
    value: 0
  },
  
  {
    name: 'R-A',
    motors: ['E', 'F'],
    type: JointType.DIFFERENCE,
    value: 0
  },
  {
    name: 'R-L',
    motors: ['E', 'F'],
    type: JointType.ADDITIVE,
    value: 0
  },
  
  {
    name: 'R-U',
    motors: ['G', 'H'],
    type: JointType.ADDITIVE,
    value: 0
  },
  {
    name: 'R-H',
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

export interface Pots {
  [jointName: string]: number;
}

export const createMotionStore = (wsService: WebSocketService) => {
  const [pots, setPots] = createStore<Pots>({
      "R-H": 0.0,
      "R-U": 0.0,
      "R-L": 0.0,
      "R-A": 0.0,
      "L-H": 0.0,
      "L-U": 0.0,
      "L-L": 0.0,
      "L-A": 0.0,
  });
  wsService.updateConfig({
    onPotsUpdate: (values) => {
      // Update the pots store with the new values
      Object.entries(values).forEach(([jointName, value]) => {
        setPots(jointName, value);
      });
    }
  });
  return {
    setMotorValue: (name: MotorName, value: number) => {
      wsService.sendMotor(name, value, true);
    },
    stopMotor: (name: MotorName) => {
      wsService.sendMotor(name, 0, false);
    },
    resetAllMotors: () => {
      wsService.sendStopAll();
    },
    getPots: () => pots,
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
