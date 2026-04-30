import { Component, createEffect, createSignal, onCleanup, Show } from 'solid-js';
import {
  createMotorStore,
  createConnectionStore,
  createThemeStore,
  MotorName,
} from './stores';
import { WebSocketService } from './websocket.service';
import { Header } from './components/Header';
import { ConnectionBar } from './components/ConnectionBar';
import { MotorGrid } from './components/MotorGrid';
import { JointGrid } from './components/JointGrid';
import './styles.css';

const App: Component = () => {
  // Initialize stores
  const motorStore = createMotorStore();
  const connectionStore = createConnectionStore();
  const themeStore = createThemeStore();

  // Initialize WebSocket service
  const wsService = new WebSocketService({
    onStateChange: (state) => {
      connectionStore.setState(state);
    },
    onStatusChange: (status) => {
      connectionStore.setStatusLabel(status);
    },
    onError: (message) => {
      console.error('WS Error:', message);
    },
  });

  // Handle motor value changes
  const handleMotorChange = (motor: MotorName, value: number, live = true) => {
    motorStore.setMotorValue(motor, value);
    wsService.sendMotor(motor, value, live);
  };

  // Handle motor stop
  const handleMotorStop = (motor: MotorName) => {
    motorStore.setMotorValue(motor, 0);
    wsService.sendMotor(motor, 0, false);
  };

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
      connectionStore.setStatusLabel('Shutting down…');
    }
  };

  // Handle stop all
  const handleStopAll = () => {
    motorStore.resetAllMotors();
    wsService.sendStopAll();
  };

  // Handle connection
  const handleConnect = () => {
    wsService.connect(connectionStore.connection.host, connectionStore.connection.port);
  };

  const handleDisconnect = () => {
    motorStore.resetAllMotors();
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

  const [controlMode, setControlMode] = createSignal<'motors' | 'joints'>('motors');

  return (
    <>
      <Header
        connectionState={() => connectionStore.connection.state}
        statusLabel={() => connectionStore.connection.statusLabel}
        onToggleTheme={() => themeStore.toggleTheme()}
        themeLabel={() => themeStore.getThemeLabel()}
        onPowerOff={handlePowerOff}
        onStopAll={handleStopAll}
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
        onModeChange={(mode) => setControlMode(mode)}
        getCurrentMode={() => controlMode()}
      />
      <Show when={connectionStore.connection.isConnected && controlMode() === 'motors'}>
        <MotorGrid
          motors={() => motorStore.motors}
          onMotorChange={handleMotorChange}
          onMotorStop={handleMotorStop}
        />
      </Show>
      <Show when={connectionStore.connection.isConnected && controlMode() === 'joints'}>
        <JointGrid
          motors={() => motorStore.motors}
          onMotorChange={handleMotorChange}
          onMotorStop={handleMotorStop}
        />
      </Show>
    </>
  );
};

export default App;
