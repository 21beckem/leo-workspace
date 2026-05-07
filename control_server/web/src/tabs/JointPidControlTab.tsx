import { Component, For, onCleanup } from 'solid-js';
import { JointType, ROBOT_JOINTS, createMotionStore, createPidStore } from '../stores';
import { SliderCard } from '../components/SliderCard';
import { Graph } from '../components/Graph';

interface JointPidControlTabProps {
  motion: ReturnType<typeof createMotionStore>;
  pid: ReturnType<typeof createPidStore>;
}

export const JointPidControlTab: Component<JointPidControlTabProps> = (props) => {
  onCleanup(() => {
    props.pid.stop();
  });

  return (
    <div>
      <div class="pid-toolbar">
        <div>
          <div class="pid-title">JOINT PID CONTROL</div>
          <div class="pid-subtitle">Use the sliders to set each joint demand.</div>
        </div>
        <div class="pid-actions">
          <button class={`btn ${props.pid.isRunning() ? 'active' : ''}`} onClick={() => props.pid.start()}>
            START PID
          </button>
          <button class="btn-emergency" onClick={() => props.pid.stop()}>
            STOP PID
          </button>
        </div>
      </div>

      <div class="motor-grid">
        <For each={ROBOT_JOINTS}>
          {(joint) => (
            <div style={{ position: 'relative' }}>
              <SliderCard
                background={() => (
                  <Graph
                    sample={props.motion.getPots()[joint.name]}
                    demand={props.pid.getTargets()[joint.name]}
                    yBounds={[-0.1, 0.1]}
                  />
                )}
                value={() => props.pid.getTargets()[joint.name]*10}
                tag=''
                name={joint.name}
                snapToZero={false}
                stopText='■ ZERO'
                onChange={(value) => props.pid.setTarget(joint.name, value/10)}
                onStop={() => props.pid.setTarget(joint.name, 0)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
              >
                {props.motion.getPots()[joint.name].toFixed(5)}
              </div>
            </div>
          )}
        </For>
      </div>

      <style>{`
        .pid-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px 0;
        }
        .pid-title {
          font-size: 12px;
          letter-spacing: 0.2em;
          color: var(--text);
          font-weight: bold;
        }
        .pid-subtitle {
          margin-top: 6px;
          font-size: 11px;
          color: var(--text-dim);
          letter-spacing: 0.08em;
        }
        .pid-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        @media (max-width: 640px) {
          .pid-toolbar {
            flex-direction: column;
            align-items: flex-start;
            padding: 12px 12px 0;
          }
        }
      `}</style>
    </div>
  );
};