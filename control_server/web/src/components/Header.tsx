import { Component, Accessor, createSignal } from 'solid-js';
import { ConnectionState, createMotionStore } from '../stores';

interface HeaderProps {
  connectionState: Accessor<ConnectionState>;
  statusLabel: Accessor<string>;
  onToggleTheme: () => void;
  themeLabel: Accessor<string>;
  onPowerOff: () => void;
  motion: ReturnType<typeof createMotionStore>;
}

const MenuBtns: Component<HeaderProps> = (props) => {
  return (
    <>
      <button class="btn-theme" onClick={props.onToggleTheme}>
        {props.themeLabel()}
      </button>
      <button
        class="btn"
        onClick={props.onPowerOff}
        title="Safely power off the Raspberry Pi"
      >
        ⏻ POWER OFF
      </button>
      <button class="btn-emergency" onClick={() => props.motion.resetAllMotors()}>
        ■ STOP ALL
      </button>
    </>
  );
};

export const Header: Component<HeaderProps> = (props) => {
  const getStatusClass = () => props.connectionState();
  const [mobileOpen, setMobileOpen] = createSignal(false);

  const toggleMobile = () => setMobileOpen((v) => !v);

  return (
    <header>
      <div class="brand">
        <span class={`status-pip ${getStatusClass()}`}></span>
        CONTROL PANEL
      </div>
      <div>
        <div class="menu-desktop" style={{ display: 'flex', gap: '12px' }}>
          <MenuBtns {...props} />
        </div>

        <div class="menu-mobile">
          <button class="btn btn-hamburger" onClick={toggleMobile} aria-label="Menu">
            ☰
          </button>
          {mobileOpen() && (
            <div class="mobile-dropdown">
              <MenuBtns {...props} />
            </div>
          )}
        </div>
      </div>
      <style>
        {`
        .menu-mobile { display: none; position: relative; }
        .btn-hamburger { font-size: 20px; padding: 6px 10px; }
        .mobile-dropdown { position: absolute; right: 0; top: 40px; background: var(--surface); border: var(--border); padding: 8px; display: flex; flex-direction: column; gap: 8px; z-index: 50; }
        @media (max-width: 640px) {
          .menu-desktop { display: none !important; }
          .menu-mobile { display: block; }
        }
        `}
      </style>
    </header>
  );
};
