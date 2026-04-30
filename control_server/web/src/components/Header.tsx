import { Component, Accessor } from 'solid-js';
import { ConnectionState } from '../stores';

interface HeaderProps {
  connectionState: Accessor<ConnectionState>;
  statusLabel: Accessor<string>;
  onToggleTheme: () => void;
  themeLabel: Accessor<string>;
  onPowerOff: () => void;
  onStopAll: () => void;
}

export const Header: Component<HeaderProps> = (props) => {
  const getStatusClass = () => props.connectionState();

  return (
    <header>
      <div class="brand">
        <span class={`status-pip ${getStatusClass()}`}></span>
        CONTROL PANEL
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button class="btn-theme" onClick={props.onToggleTheme}>
          {props.themeLabel()}
        </button>
        <button
          class="btn-poweroff"
          onClick={props.onPowerOff}
          title="Safely power off the Raspberry Pi"
        >
          ⏻ POWER OFF
        </button>
        <button class="btn-emergency" onClick={props.onStopAll}>
          ■ STOP ALL
        </button>
      </div>
    </header>
  );
};
