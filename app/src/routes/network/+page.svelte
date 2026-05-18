<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import NetworkRecordForm from '$lib/components/network/NetworkRecordForm.svelte';

	type CardKind = 'person' | 'organization';
	type NetworkCard = {
		id: string;
		kind: CardKind;
		name: string;
		workplace?: string;
		role?: string;
		lastReachedOut?: string;
		email?: string;
		location?: string;
		type?: string;
		notes: string;
		lastEvent?: string;
	};

	let cards = $state<NetworkCard[]>([
		{
			id: 'maya',
			kind: 'person',
			name: 'Maya Ivers',
			workplace: 'Civic Futures Lab',
			role: 'Program Director',
			lastReachedOut: '2026-05-02',
			email: 'maya@civicfutures.example',
			notes: 'Met after the salon on public-interest AI. Follow up about speaker recommendations.',
			lastEvent: 'Governance salon'
		},
		{
			id: 'civic-futures',
			kind: 'organization',
			name: 'Civic Futures Lab',
			type: 'Non-profit research studio',
			location: 'Brooklyn, NY',
			notes: 'Hosts monthly dinners with policy operators, organizers, and technologists.',
			lastEvent: 'Governance salon'
		},
		{
			id: 'jonah',
			kind: 'person',
			name: 'Jonah Reed',
			workplace: 'North Pier University',
			role: 'Assistant Professor',
			lastReachedOut: '2026-04-18',
			email: 'jreed@npu.example',
			notes: 'Shared notes on social graph data ethics. Invite to the next reading group.',
			lastEvent: 'Trust networks workshop'
		},
		{
			id: 'north-pier',
			kind: 'organization',
			name: 'North Pier University',
			type: 'University',
			location: 'Chicago, IL',
			notes: 'Several faculty work on institutions, mutual aid, and computational sociology.',
			lastEvent: 'Trust networks workshop'
		},
		{
			id: 'amir',
			kind: 'person',
			name: 'Amir Sol',
			workplace: 'Signal House',
			role: 'Community Lead',
			lastReachedOut: '2026-03-29',
			email: 'amir@signalhouse.example',
			notes: 'Knows several event organizers. Ask about partner venues for the summer series.',
			lastEvent: 'Member dinner'
		}
	]);

	let selectedId = $state('');
	let editingId = $state<string | null>(null);
	let draft = $state<NetworkCard | null>(null);
	let rolodexElement = $state<HTMLElement>();
	let scrollTop = $state(0);
	let actionStatus = $state('');
	let isActionsMenuOpen = $state(false);

	let selected = $derived(selectedId ? cards.find((card) => card.id === selectedId) : undefined);

	function selectCard(id: string) {
		selectedId = id;
		editingId = null;
		draft = null;
	}

	function focusCardAtIndex(index: number) {
		const card = cards[index];
		if (!card) return;

		const targetTop = Math.max(0, index * 188 - 230);
		const currentTop = rolodexElement?.scrollTop ?? 0;
		const shouldAutoscroll = Math.abs(currentTop - targetTop) > 24;

		if (shouldAutoscroll) {
			rolodexElement?.scrollTo({ top: targetTop, behavior: 'smooth' });
			window.setTimeout(() => selectCard(card.id), 260);
			return;
		}

		selectCard(card.id);
	}

	function handleRolodexClick(event: MouseEvent) {
		const rect = rolodexElement?.getBoundingClientRect();
		if (!rect) return;

		const yInScroll = event.clientY - rect.top + (rolodexElement?.scrollTop ?? 0);
		const index = Math.max(0, Math.min(cards.length - 1, Math.round((yInScroll - 170) / 188)));
		focusCardAtIndex(index);
	}

	function clearSelection() {
		selectedId = '';
		editingId = null;
		draft = null;
	}

	function handleScroll() {
		scrollTop = rolodexElement?.scrollTop ?? 0;
	}

	function handleFocusedWheel(event: WheelEvent) {
		if (!selectedId) return;
		event.preventDefault();
		clearSelection();
		window.setTimeout(() => {
			rolodexElement?.scrollBy({ top: event.deltaY * 0.35, behavior: 'smooth' });
		}, 120);
	}

	function isDraftDirty() {
		if (!draft) return false;
		const original = cards.find((card) => card.id === draft?.id);
		return original ? JSON.stringify(original) !== JSON.stringify(draft) : false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && selectedId) {
			event.preventDefault();
			clearSelection();
			return;
		}

		if (event.key === 'Enter' && editingId && draft && isDraftDirty()) {
			event.preventDefault();
			saveEdit();
		}
	}

	function cardStyle(index: number, isSelected: boolean) {
		const position = index * 188 - scrollTop;
		const apex = 230;
		const distance = position - apex;
		const rotation = isSelected ? 0 : Math.max(-8, Math.min(78, distance / 5.2));
		const lift = Math.max(0, 1 - Math.abs(distance) / 340) * 56;
		const depth = isSelected ? 260 : lift - Math.abs(distance) * 0.16;
		const pullForward = isSelected ? -48 : 0;
		const zIndex = isSelected ? 120 : Math.max(1, 60 - Math.round(Math.abs(distance) / 8));
		return `--slot: ${index}; --rotation: ${rotation}deg; --depth: ${depth}px; --pull-forward: ${pullForward}px; --z: ${zIndex}`;
	}

	function startEdit(card: NetworkCard) {
		selectedId = card.id;
		editingId = card.id;
		draft = { ...card };
	}

	function saveEdit() {
		if (!draft) return;
		cards = cards.map((card) => (card.id === draft?.id ? { ...draft } : card));
		editingId = null;
		draft = null;
	}

	function cancelEdit() {
		editingId = null;
		draft = null;
	}

	async function copyEmail(card: NetworkCard) {
		if (!card.email || !browser) return;
		await navigator.clipboard.writeText(card.email);
		actionStatus = `Copied ${card.email}`;
		window.setTimeout(() => {
			if (actionStatus === `Copied ${card.email}`) actionStatus = '';
		}, 1800);
	}

	const formatDate = (value?: string) =>
		value
			? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
					new Date(`${value}T12:00:00`)
				)
			: 'Not recorded';
</script>

<svelte:head>
	<title>Network Rolodex</title>
</svelte:head>

<svelte:window onwheel={handleFocusedWheel} onkeydown={handleKeydown} />

<main class="network-page">
	{#if selectedId}
		<button
			class="focus-dismiss"
			type="button"
			aria-label="Return to Rolodex"
			onclick={clearSelection}
			onwheel={handleFocusedWheel}
		></button>
	{/if}
	<section class="intro" aria-labelledby="network-title">
		<p class="eyebrow">Personal network</p>
		<h1 id="network-title">Network Rolodex</h1>
		<p>Scroll to flip through people and institutions. Select a card to open the full record.</p>
		{#if actionStatus}
			<p class="action-status" aria-live="polite">{actionStatus}</p>
		{/if}
	</section>

	{#if cards.length === 0}
		<Empty.Root class="mx-auto mt-16 max-w-md">
			<Empty.Header>
				<Empty.Title>No network records yet</Empty.Title>
				<Empty.Description
					>Add the first person or institution to start building the Rolodex.</Empty.Description
				>
			</Empty.Header>
			<Empty.Content>
				<Button>Add record</Button>
			</Empty.Content>
		</Empty.Root>
	{:else}
		<section
			class:has-selection={Boolean(selectedId)}
			class="rolodex-stage"
			aria-label="Network Rolodex"
			onwheel={handleFocusedWheel}
		>
			<div
				class="rolodex"
				bind:this={rolodexElement}
				onscroll={handleScroll}
				onclick={handleRolodexClick}
				aria-label="Scrollable 3D cards"
				role="presentation"
			>
				<div class="scroll-pad">
					{#each cards as card, index (card.id)}
						<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
						<article
							class="network-card"
							style={cardStyle(index, false)}
							onclick={(event) => {
								event.stopPropagation();
								focusCardAtIndex(index);
							}}
							onkeydown={(event) => event.key === 'Enter' && focusCardAtIndex(index)}
							tabindex="0"
							role="button"
						>
							{#if editingId === card.id && draft}
								<NetworkRecordForm bind:draft oncancel={cancelEdit} onsave={saveEdit} />
							{:else}
								<div class="card-head">
									<span>{card.kind === 'person' ? 'Person' : 'Place'}</span>
									<small>{card.lastEvent ?? 'Manual entry'}</small>
								</div>
								<h2>{card.name}</h2>
								{#if card.kind === 'person'}
									<p>{card.role} · {card.workplace}</p>
									<p class="quiet">Last reached out: {formatDate(card.lastReachedOut)}</p>
								{:else}
									<p>{card.type}</p>
									<p class="quiet">{card.location}</p>
								{/if}
							{/if}
						</article>
					{/each}
				</div>
			</div>
		</section>
	{/if}

	{#if selected}
		<article class="network-card selected focus-card" onwheel={handleFocusedWheel}>
			<div class="selected-card-actions">
				<Button
					class="card-back-button"
					variant="outline"
					size="icon"
					onclick={(event) => {
						event.stopPropagation();
						clearSelection();
					}}
					aria-label="Return to Rolodex">←</Button
				>
				{#if editingId !== selected.id}
					<div class="record-actions-menu">
						<Button
							variant="outline"
							size="icon"
							aria-label="Record actions"
							aria-haspopup="menu"
							aria-expanded={isActionsMenuOpen}
							onclick={() => (isActionsMenuOpen = !isActionsMenuOpen)}>•••</Button
						>
						{#if isActionsMenuOpen}
							<div class="record-actions-panel" role="menu" aria-label="Record actions">
								<button
									type="button"
									onclick={() => {
										startEdit(selected);
										isActionsMenuOpen = false;
									}}>Edit</button
								>
								{#if selected.email}
									<button
										type="button"
										onclick={() => {
											copyEmail(selected);
											isActionsMenuOpen = false;
										}}>Copy email</button
									>
								{/if}
								<hr />
								<button
									type="button"
									onclick={() => {
										clearSelection();
										isActionsMenuOpen = false;
									}}>Close record</button
								>
							</div>
						{/if}
					</div>
				{/if}
			</div>
			{#if editingId === selected.id && draft}
				<NetworkRecordForm bind:draft oncancel={cancelEdit} onsave={saveEdit} />
			{:else}
				<div class="card-head">
					<span>{selected.kind === 'person' ? 'Person' : 'Place'}</span><small
						>{selected.lastEvent ?? 'Manual entry'}</small
					>
				</div>
				<h2>{selected.name}</h2>
				{#if selected.kind === 'person'}
					<p>{selected.role} · {selected.workplace}</p>
					<p class="quiet">Last reached out: {formatDate(selected.lastReachedOut)}</p>
				{:else}
					<p>{selected.type}</p>
					<p class="quiet">{selected.location}</p>
				{/if}
				<div class="expanded-fields">
					{#if selected.kind === 'person'}
						<div><span>Where they work</span><strong>{selected.workplace}</strong></div>
						<div><span>Role</span><strong>{selected.role}</strong></div>
						<div><span>Email</span><strong>{selected.email}</strong></div>
					{:else}
						<div><span>Type</span><strong>{selected.type}</strong></div>
						<div><span>Location</span><strong>{selected.location}</strong></div>
						<div><span>Source</span><strong>{selected.lastEvent}</strong></div>
					{/if}
				</div>
				<p class="notes">{selected.notes}</p>
			{/if}
		</article>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		min-width: 320px;
		background: oklch(0.965 0 0);
		color: oklch(0.18 0 0);
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	.network-page {
		--page: oklch(0.965 0 0);
		--surface: oklch(0.985 0 0);
		--surface-soft: oklch(0.955 0 0);
		--surface-muted: oklch(0.92 0 0);
		--surface-hover: oklch(0.9 0 0);
		--text: oklch(0.18 0 0);
		--text-invert: oklch(0.96 0 0);
		--text-muted: oklch(0.42 0 0);
		--strong: oklch(0.16 0 0);
		--line: oklch(0.86 0 0);
		--line-strong: oklch(0.76 0 0);
		--shadow: oklch(0.16 0 0 / 0.12);
		min-height: 100vh;
		padding: clamp(1.25rem, 3vw, 3rem);
		background: var(--page);
		color: var(--text);
	}

	.intro {
		max-width: 760px;
		margin-bottom: 1.25rem;
	}
	.eyebrow {
		margin: 0 0 0.45rem;
		color: var(--text-muted);
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-size: clamp(2.6rem, 7vw, 6rem);
		line-height: 0.9;
		letter-spacing: -0.06em;
	}
	.intro p {
		max-width: 62ch;
		color: var(--text-muted);
		font-size: 1.05rem;
		line-height: 1.65;
	}
	.action-status {
		margin-top: 0.75rem;
		font-size: 0.9rem;
		font-weight: 700;
	}

	.rolodex-stage {
		position: relative;
		max-width: none;
		margin: 0;
	}
	.rolodex {
		height: 70vh;
		min-height: 520px;
		overflow-y: auto;
		perspective: 1300px;
		perspective-origin: 50% 360px;
		scrollbar-color: var(--line-strong) transparent;
	}
	.scroll-pad {
		position: relative;
		height: 1240px;
		padding-top: 80px;
		transform-style: preserve-3d;
	}

	.network-card {
		position: absolute;
		top: 80px;
		left: 50%;
		z-index: var(--z);
		width: min(82vw, 720px);
		min-height: 148px;
		box-sizing: border-box;
		padding: 1.25rem 1.35rem 1.5rem;
		transform: translateX(-50%) translateY(calc(var(--slot) * 188px + var(--pull-forward, 0px)))
			translateZ(var(--depth)) rotateX(var(--rotation));
		transform-origin: 50% 100%;
		transform-style: preserve-3d;
		cursor: pointer;
		border: 1px solid var(--line);
		border-radius: 1.05rem;
		background: var(--surface);
		box-shadow: 0 20px 50px var(--shadow);
		transition:
			min-height 240ms cubic-bezier(0.22, 1, 0.36, 1),
			background 160ms ease,
			filter 180ms ease,
			opacity 180ms ease,
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.network-card.selected {
		position: fixed;
		top: 50vh;
		left: 50vw;
		z-index: 120;
		width: min(88vw, 780px);
		max-height: min(78vh, 680px);
		min-height: 470px;
		overflow: auto;
		background: var(--surface);
		border-color: var(--line-strong);
		box-shadow: 0 34px 90px oklch(0.16 0 0 / 0.22);
		transform: translate(-50%, -50%) rotateX(0deg) !important;
	}
	.focus-card {
		cursor: default;
	}
	.has-selection .network-card:not(.selected) {
		filter: blur(2.5px);
		opacity: 0.46;
	}
	.network-card:hover {
		background: var(--surface-soft);
	}
	.has-selection .network-card:not(.selected):hover {
		filter: blur(1.2px);
		opacity: 0.7;
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h2 {
		margin: 1.35rem 0 0.45rem;
		font-size: clamp(2rem, 5vw, 4.2rem);
		line-height: 0.92;
		letter-spacing: -0.055em;
	}
	.network-card p {
		margin: 0.25rem 0;
		font-size: 1.02rem;
	}
	.quiet,
	.notes {
		color: var(--text-muted);
	}

	.expanded-fields {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 1.35rem;
	}
	.expanded-fields div {
		display: grid;
		gap: 0.42rem;
		border: 1px solid var(--line);
		border-radius: 0.9rem;
		background: var(--surface-soft);
		padding: 0.85rem;
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.expanded-fields strong {
		color: var(--text);
		font-size: 0.95rem;
		letter-spacing: 0;
		text-transform: none;
	}
	.notes {
		max-width: 64ch;
		margin-top: 1.25rem;
		line-height: 1.65;
	}

	.selected-card-actions {
		position: absolute;
		top: 1rem;
		right: 1rem;
		left: 1rem;
		z-index: 3;
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		pointer-events: none;
	}
	.selected-card-actions :global(button) {
		pointer-events: auto;
	}
	.record-actions-menu {
		position: relative;
		pointer-events: auto;
	}
	.record-actions-panel {
		position: absolute;
		top: calc(100% + 0.45rem);
		right: 0;
		z-index: 4;
		display: grid;
		min-width: 11rem;
		border: 1px solid var(--line);
		border-radius: 0.9rem;
		background: var(--surface);
		box-shadow: 0 18px 38px var(--shadow);
		padding: 0.35rem;
	}
	.record-actions-panel button {
		border: 0;
		border-radius: 0.65rem;
		background: transparent;
		color: var(--text);
		cursor: pointer;
		font: inherit;
		padding: 0.55rem 0.7rem;
		text-align: left;
	}
	.record-actions-panel button:hover,
	.record-actions-panel button:focus-visible {
		background: var(--surface-soft);
	}
	.record-actions-panel hr {
		width: 100%;
		border: 0;
		border-top: 1px solid var(--line);
		margin: 0.25rem 0;
	}
	button.focus-dismiss {
		position: fixed;
		inset: 0;
		z-index: 90;
		display: block;
		width: 100vw;
		height: 100vh;
		border: 0;
		border-radius: 0;
		background: transparent;
		padding: 0;
		appearance: none;
		cursor: default;
	}
	.network-card.selected .card-head,
	.network-card.selected h2 {
		margin-left: 3.25rem;
	}

	@media (max-width: 760px) {
		.rolodex {
			height: 74vh;
		}
		.expanded-fields {
			grid-template-columns: 1fr;
		}
		.network-card.selected {
			min-height: 620px;
		}
	}
</style>
