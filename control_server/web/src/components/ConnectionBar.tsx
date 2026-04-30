import { Component, Accessor } from 'solid-js';

interface ConnectionBarProps {
  host: Accessor<string>;
  onHostChange: (value: string) => void;
  port: Accessor<string>;
  onPortChange: (value: string) => void;
  isConnected: Accessor<boolean>;
  statusLabel: Accessor<string>;
  onConnect: () => void;
  onDisconnect: () => void;
  onModeChange: (mode: 'motors' | 'joints') => void;
  getCurrentMode: Accessor<'motors' | 'joints'>;
}

export const ConnectionBar: Component<ConnectionBarProps> = (props) => {
  const handleConnectClick = () => {
    if (props.isConnected()) {
      props.onDisconnect();
    } else {
      props.onConnect();
    }
  };

  return (
    <>
      <div class="connect-bar">
        <div class="field-group">
          <label for="hostInput">HOST</label>
          <input
            id="hostInput"
            type="text"
            placeholder="192.168.1.100"
            autocomplete="off"
            spellcheck={false}
            value={props.host()}
            onInput={(e) => props.onHostChange(e.currentTarget.value)}
          />
        </div>
        <div class="field-group">
          <label for="portInput">PORT</label>
          <input
            id="portInput"
            type="text"
            inputmode="numeric"
            value={props.port()}
            onInput={(e) => props.onPortChange(e.currentTarget.value)}
          />
        </div>
        <button
          class={`btn-connect ${props.isConnected() ? 'live' : ''}`}
          onClick={handleConnectClick}
        >
          {props.isConnected() ? 'DISCONNECT' : 'CONNECT'}
        </button>
        <span class="status-label">{props.statusLabel()}</span>
      </div>
      <div class="connect-bar">
        <button class={`btn ${props.getCurrentMode() === 'motors' ? 'active' : ''}`} onClick={() => props.onModeChange('motors')}>
          Motor Control
        </button>
        <button class={`btn ${props.getCurrentMode() === 'joints' ? 'active' : ''}`} onClick={() => props.onModeChange('joints')}>
          Joint Control
        </button>
      </div>
    </>
  );
};
