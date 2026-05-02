import { Component, createEffect, onCleanup, Show } from 'solid-js';
import { Dynamic } from "solid-js/web";
import {
  createConnectionStore,
  createThemeStore,
  createMotionStore
} from './stores';
import { WebSocketService } from './websocket.service';
import { Header } from './components/Header';
import { ConnectionBar } from './components/ConnectionBar';
import { MotorControlTab } from './tabs/MotorControlTab';
import { JointControlTab } from './tabs/JointControlTab';
import { TabsBar, initTabs } from './components/TabsBar';
import './styles.css';


export interface WindowTab {
  key: string;
  name: string;
  Renderer: Component<any>;
}
export const WINDOW_TABS: WindowTab[] = [
  {
    key: 'motor',
    name: 'Motor Control',
    Renderer: MotorControlTab
  },
  {
    key: 'joint',
    name: 'Joint Control',
    Renderer: JointControlTab
  }
];


const App: Component = () => {
  // initialize tabs
  const [currentTab, setCurrentTab] = initTabs();

  // Initialize stores
  const connectionStore = createConnectionStore();
  const themeStore = createThemeStore();

  const wsService = new WebSocketService({
    onStateChange: (state) => {
      connectionStore.setState(state);
    },
    onStatusChange: (status) => {
      connectionStore.setStatusLabel(status);
    },
    onError: (message) => {
      console.error('WS Error:', message);
    }
  });
  const motion = createMotionStore(wsService);

  // Handle power off with confirmation
  const handlePowerOff = () => {
    if (!connectionStore.connection.isConnected) {
      alert(
        'Not connected to the robot — connect first before powering off.'
      );
      return;
    }
    const confirmed = confirm(
      'Power off the Raspberry Pi?\n\nThis will stop all motors and shut the robot down. You will need physical access to turn it back on.'
    );
    if (confirmed) {
      wsService.sendStopAll();
      wsService.sendPowerOff();
      wsService.disconnect();
      connectionStore.setStatusLabel('Shutting down…');
    }
  };

  // Handle connection
  const handleConnect = () => {
    wsService.connect(connectionStore.connection.host, connectionStore.connection.port);
  };

  const handleDisconnect = () => {
    motion.resetAllMotors();
    wsService.disconnect();
  };

  // Auto-connect if host is available
  createEffect(() => {
    if (connectionStore.connection.host) {
      handleConnect();
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    wsService.disconnect();
  });

  return (
    <>
      <Header
        connectionState={() => connectionStore.connection.state}
        statusLabel={() => connectionStore.connection.statusLabel}
        onToggleTheme={() => themeStore.toggleTheme()}
        themeLabel={() => themeStore.getThemeLabel()}
        onPowerOff={handlePowerOff}
        motion={motion}
      />
      <ConnectionBar
        host={() => connectionStore.connection.host}
        onHostChange={(host) => connectionStore.setHost(host)}
        port={() => connectionStore.connection.port}
        onPortChange={(port) => connectionStore.setPort(port)}
        isConnected={() => connectionStore.connection.isConnected}
        statusLabel={() => connectionStore.connection.statusLabel}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
      <TabsBar
        tabs={WINDOW_TABS}
        onTabChange={(tabKey) => setCurrentTab(tabKey)}
        getCurrentTab={currentTab}
      />
      <Show when={connectionStore.connection.isConnected}>
        <Dynamic component={
            WINDOW_TABS.find(tab => tab.key === currentTab())?.Renderer || (() => <div>Invalid tab</div>)
          }
          motion={motion}
        />
      </Show>
    </>
  );
};

export default App;
