import { Component, Accessor, For, createSignal } from 'solid-js';
import { WINDOW_TABS, type WindowTab } from '../App';

interface TabsBarProps {
	tabs: WindowTab[];
	onTabChange: (value: string) => void;
	getCurrentTab: Accessor<string>;
}

export const initTabs = (): [Accessor<string>, (tabKey: string) => void] => {
	const [tab, setRawTab] = createSignal(sessionStorage.getItem('lastTab') || WINDOW_TABS[0].key);
	const setTab = (tabKey: string) => {
		if (WINDOW_TABS.some(t => t.key === tabKey)) {
			sessionStorage.setItem('lastTab', tabKey);
			setRawTab(tabKey);
		} else {
			console.warn(`Invalid tab key: ${tabKey}`);
		}
	};
	return [tab, setTab];
};

export const TabsBar: Component<TabsBarProps> = (props) => {

	return (
		<>
			<style>{`
.tabs-bar {
	display: flex;
	gap: 12px;
	margin: 0;
	background-color: var(--surface);
	border-bottom: 1px solid var(--border);
	padding: 8px 16px 0;
}
.tabs-bar .btn {
	border-bottom: none;
	border-bottom-left-radius: 0;
	border-bottom-right-radius: 0;
	padding-bottom: 8px;
}
			`}</style>
			<div class="tabs-bar">
				<For each={props.tabs}>
					{(tab) => (
						<button class={`btn ${props.getCurrentTab() === tab.key ? 'active' : ''}`} onClick={() => props.onTabChange(tab.key)}>
							{tab.name}
						</button>
					)}
				</For>
			</div>
		</>
	);
};
