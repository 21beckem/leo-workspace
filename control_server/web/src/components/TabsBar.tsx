import { Component, Accessor, For, createSignal } from 'solid-js';
import { WINDOW_TABS, type WindowTab } from '../App';

interface TabsBarProps {
	tabs: WindowTab[];
	onTabChange: (value: string) => void;
	getCurrentTab: Accessor<string>;
}

export const initTabs = (): [Accessor<string>, (tabKey: string) => void] => {
	function scrollIntoViewIfNeeded(key: string) {
		const btn = document.getElementById('tab-btn-for-' + key);
		if (btn) {
			const rect = btn.getBoundingClientRect();
			if (rect.left < 0 || rect.right > window.innerWidth) {
				btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
			}
		}
	}
	const [tab, setRawTab] = createSignal(sessionStorage.getItem('lastTab') || WINDOW_TABS[0].key);
	const setTab = (tabKey: string) => {
		if (WINDOW_TABS.some(t => t.key === tabKey)) {
			sessionStorage.setItem('lastTab', tabKey);
			setRawTab(tabKey);
			scrollIntoViewIfNeeded(tabKey);
		} else {
			console.warn(`Invalid tab key: ${tabKey}`);
		}
	};
	setTimeout(() => scrollIntoViewIfNeeded(tab()), 10);
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
	padding: 8px 12px 0;
	overflow-x: auto;
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
						<button id={'tab-btn-for-'+tab.key} class={`btn ${props.getCurrentTab() === tab.key ? 'active' : ''}`} onClick={() => props.onTabChange(tab.key)}>
							{tab.name}
						</button>
					)}
				</For>
			</div>
		</>
	);
};
