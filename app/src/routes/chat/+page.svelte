<script lang="ts">
	import { browser, dev } from '$app/environment';
	import { resolve } from '$app/paths';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { tick } from 'svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';

	type ChatMessage = {
		id: Id<'messages'>;
		role: 'user' | 'assistant' | 'system' | 'tool';
		text: string;
		status?: 'pending' | 'complete' | 'failed';
		timestamp: Date;
		replyingToMessage?: Id<'messages'>;
	};

	type MessageDay = {
		dateKey: string;
		label: string;
		messages: ChatMessage[];
	};

	const client = useConvexClient();
	const clientSessionId = getClientSessionId();
	const persistedMessages = useQuery(api.chat.listMessages, { clientSessionId });

	let draft = $state('');
	let isSending = $state(false);
	let isDevToolRunning = $state(false);
	let devToolStatus = $state('');
	let replyingToMessageId = $state<Id<'messages'>>();
	let historyElement = $state<HTMLElement>();
	let composerTextarea = $state<HTMLTextAreaElement | null>(null);
	let isDateMenuOpen = $state(false);
	let isReplyPreviewOpen = $state<string>();
	let activeDateKey = $state<string>();
	let highlightedDateKey = $state<string>();
	let hasPositionedInitialViewport = $state(false);
	let themeMode = $state<'system' | 'light' | 'dark'>('system');
	let systemPrefersDark = $state(false);

	const dayFormatter = new Intl.DateTimeFormat('en', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});
	const timeFormatter = new Intl.DateTimeFormat('en', {
		hour: 'numeric',
		minute: '2-digit'
	});
	const messages = $derived.by<ChatMessage[]>(() =>
		(persistedMessages.data ?? []).map((message) => ({
			id: message._id,
			role: message.role,
			text: message.text,
			status: message.status,
			timestamp: new Date(message.timestamp),
			replyingToMessage: message.replyingToMessage
		}))
	);
	const messageDays = $derived.by<MessageDay[]>(() => groupMessagesByDay(messages));
	const activeDay = $derived(messageDays.find((day) => day.dateKey === activeDateKey));
	const currentDate = $derived(
		activeDay?.label ?? formatConversationDate(messages.at(-1)?.timestamp ?? new Date())
	);
	const currentDateSummary = $derived(
		activeDay ? `${activeDay.messages.length} messages in view` : 'No dated messages yet'
	);
	const messagesById = $derived(new Map(messages.map((message) => [message.id, message])));
	const replyTarget = $derived(
		replyingToMessageId ? messagesById.get(replyingToMessageId) : undefined
	);

	$effect(() => {
		if (!browser) return;

		const storedTheme = localStorage.getItem('is-chat-theme-mode');
		if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
			themeMode = storedTheme;
		}

		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const updateSystemTheme = () => {
			systemPrefersDark = media.matches;
		};

		updateSystemTheme();
		media.addEventListener('change', updateSystemTheme);
		return () => media.removeEventListener('change', updateSystemTheme);
	});

	$effect(() => {
		if (!browser) return;
		localStorage.setItem('is-chat-theme-mode', themeMode);
	});

	$effect(() => {
		if (!browser) return;
		document.documentElement.classList.toggle(
			'dark',
			themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark)
		);
	});

	$effect(() => {
		if (messageDays.length === 0) {
			activeDateKey = undefined;
			hasPositionedInitialViewport = false;
			return;
		}

		if (!activeDateKey || !messageDays.some((day) => day.dateKey === activeDateKey)) {
			activeDateKey = messageDays.at(-1)?.dateKey;
		}
	});

	$effect(() => {
		if (hasPositionedInitialViewport || persistedMessages.isLoading || messageDays.length === 0)
			return;
		hasPositionedInitialViewport = true;
		void tick().then(() => {
			if (!historyElement) return;
			historyElement.scrollTop = historyElement.scrollHeight;
			activeDateKey = messageDays.at(-1)?.dateKey;
		});
	});

	function getClientSessionId() {
		if (!browser) return 'server-render-session-placeholder';

		const storageKey = 'is-chat-client-session-id';
		const existing = localStorage.getItem(storageKey);
		if (existing) return existing;

		const next = crypto.randomUUID();
		localStorage.setItem(storageKey, next);
		return next;
	}

	function formatConversationDate(date: Date) {
		return dayFormatter.format(date);
	}

	function dateKey(date: Date) {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function groupMessagesByDay(chatMessages: ChatMessage[]) {
		return chatMessages.reduce<MessageDay[]>((days, message) => {
			const key = dateKey(message.timestamp);
			const currentDay = days.at(-1);

			if (currentDay?.dateKey === key) {
				currentDay.messages.push(message);
				return days;
			}

			days.push({
				dateKey: key,
				label: formatConversationDate(message.timestamp),
				messages: [message]
			});
			return days;
		}, []);
	}

	async function sendMessage() {
		const text = draft.trim();
		if (!text || isSending) return;

		isSending = true;
		try {
			const result = await client.mutation(api.chat.sendMessage, {
				clientSessionId,
				text,
				replyingToMessage: replyingToMessageId
			});
			draft = '';
			replyingToMessageId = undefined;
			await tick();
			historyElement?.scrollTo({ top: historyElement.scrollHeight, behavior: 'smooth' });

			if (result) {
				await client.mutation(api.chat.completePlaceholderReply, {
					clientSessionId,
					pendingAssistantMessageId: result.pendingAssistantMessageId
				});
			}
		} finally {
			isSending = false;
		}
	}

	function handleComposerKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;

		event.preventDefault();
		void sendMessage();
	}

	function selectReplyTarget(message: ChatMessage) {
		replyingToMessageId = message.id;
	}

	function getReplyLabel(message?: ChatMessage) {
		if (!message) return 'Original message unavailable';
		return `${message.role === 'user' ? 'You' : 'Agent'}: ${message.text}`;
	}

	function getReplyExcerpt(message?: ChatMessage) {
		return message?.text ?? 'This message is no longer in the loaded history.';
	}

	async function jumpToMessage(messageId: Id<'messages'>) {
		await tick();
		const target = historyElement?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
		target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		target?.animate(
			[
				{ transform: 'scale(1)', filter: 'brightness(1)' },
				{ transform: 'scale(1.012)', filter: 'brightness(1.04)' },
				{ transform: 'scale(1)', filter: 'brightness(1)' }
			],
			{ duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
		);
	}

	function clearReplyTarget() {
		replyingToMessageId = undefined;
	}

	async function jumpToDate(day: MessageDay) {
		activeDateKey = day.dateKey;
		highlightedDateKey = day.dateKey;
		isDateMenuOpen = false;
		await tick();

		const target = historyElement?.querySelector<HTMLElement>(`[data-date-key="${day.dateKey}"]`);
		target?.scrollIntoView({ block: 'start', behavior: 'smooth' });

		window.setTimeout(() => {
			if (highlightedDateKey === day.dateKey) highlightedDateKey = undefined;
		}, 900);
	}

	function updateActiveDateFromScroll() {
		if (!historyElement || messageDays.length === 0) return;

		const historyTop = historyElement.getBoundingClientRect().top;
		let visibleDateKey = messageDays[0]?.dateKey;

		for (const day of messageDays) {
			const divider = historyElement.querySelector<HTMLElement>(`[data-date-key="${day.dateKey}"]`);
			if (!divider) continue;

			if (divider.getBoundingClientRect().top - historyTop <= 12) {
				visibleDateKey = day.dateKey;
			}
		}

		activeDateKey = visibleDateKey;
	}

	function setThemeMode(mode: 'system' | 'light' | 'dark') {
		themeMode = mode;
	}

	async function seedDevChat() {
		if (isDevToolRunning) return;
		isDevToolRunning = true;
		devToolStatus = 'Seeding 50 development messages…';
		try {
			const result = await client.mutation(api.chat.seedDevData, {
				clientSessionId,
				count: 50,
				confirm: 'SEED_DEV_CHAT_DATA'
			});
			devToolStatus = `Seeded ${result.insertedMessages} development messages.`;
		} finally {
			isDevToolRunning = false;
		}
	}

	async function clearDevChat() {
		if (isDevToolRunning) return;
		isDevToolRunning = true;
		devToolStatus = 'Clearing development chat data…';
		try {
			const result = await client.mutation(api.chat.clearDevData, {
				clientSessionId,
				confirm: 'CLEAR_DEV_CHAT_DATA'
			});
			devToolStatus = `Cleared ${result.deletedMessages} messages across ${result.deletedSessions} sessions.`;
		} finally {
			isDevToolRunning = false;
		}
	}
</script>

<svelte:head>
	<title>Chat · Information Society</title>
	<meta
		name="description"
		content="A dedicated agent chat workspace with continuous history and polished composer layout."
	/>
</svelte:head>

<main
	class="chat-page"
	class:dark-theme={themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark)}
	aria-labelledby="chat-title"
>
	<section class="chat-card" aria-label="Agent conversation">
		<header class="chat-header">
			<div class="agent-lockup">
				<div class="agent-avatar" aria-hidden="true">IS</div>
				<div class="date-menu-anchor">
					<h1 id="chat-title">Agent Chat</h1>
					<Button
						variant="ghost"
						class="date-button"
						aria-expanded={isDateMenuOpen}
						aria-haspopup="menu"
						aria-label={`Conversation date, ${currentDate}. ${currentDateSummary}. Open date menu`}
						onclick={() => (isDateMenuOpen = !isDateMenuOpen)}
					>
						<span class="date-button-label">{currentDate}</span>
						<span class="date-button-meta">{currentDateSummary}</span>
						<span class="date-chevron" aria-hidden="true">⌄</span>
					</Button>
					{#if isDateMenuOpen}
						<div class="date-menu-panel" role="menu" aria-label="Conversation dates">
							{#if messageDays.length === 0}
								<p>No messages yet</p>
							{:else}
								{#each messageDays as day (day.dateKey)}
									<button class="date-menu-item" type="button" onclick={() => jumpToDate(day)}>
										<span>{day.label}</span>
										<small>{day.messages.length} messages</small>
									</button>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			</div>
			<div class="header-actions">
				<ButtonGroup.Root aria-label="Appearance">
					<Button
						size="sm"
						variant={themeMode === 'system' ? 'default' : 'outline'}
						aria-pressed={themeMode === 'system'}
						onclick={() => setThemeMode('system')}
					>
						System
					</Button>
					<Button
						size="sm"
						variant={themeMode === 'light' ? 'default' : 'outline'}
						aria-pressed={themeMode === 'light'}
						onclick={() => setThemeMode('light')}
					>
						Light
					</Button>
					<Button
						size="sm"
						variant={themeMode === 'dark' ? 'default' : 'outline'}
						aria-pressed={themeMode === 'dark'}
						onclick={() => setThemeMode('dark')}
					>
						Dark
					</Button>
				</ButtonGroup.Root>
				{#if dev}
					<Button
						class="top-action-button"
						variant="outline"
						size="sm"
						onclick={seedDevChat}
						disabled={isDevToolRunning}>Seed dev chat</Button
					>
					<Button
						class="top-action-button"
						variant="outline"
						size="sm"
						onclick={clearDevChat}
						disabled={isDevToolRunning}>Clear dev chat</Button
					>
				{/if}
				<Button class="top-action-button" href={resolve('/')} variant="ghost" size="sm">Home</Button
				>
			</div>
		</header>

		{#if dev && devToolStatus}
			<p class="dev-tool-status" aria-live="polite">{devToolStatus}</p>
		{/if}

		<div
			class="message-history"
			bind:this={historyElement}
			role="log"
			aria-label="Conversation history"
			aria-live="polite"
			aria-busy={persistedMessages.isLoading}
			onscroll={updateActiveDateFromScroll}
		>
			{#if persistedMessages.isLoading}
				<div class="message-skeletons" aria-label="Loading conversation">
					<Skeleton class="h-14 w-[min(72%,32rem)] rounded-2xl" />
					<Skeleton class="ms-auto h-14 w-[min(58%,28rem)] rounded-2xl" />
					<Skeleton class="h-14 w-[min(48%,22rem)] rounded-2xl" />
				</div>
			{:else if persistedMessages.error}
				<Empty.Root class="mx-auto my-16 max-w-md">
					<Empty.Header>
						<Empty.Title>Unable to load conversation</Empty.Title>
						<Empty.Description>{persistedMessages.error.toString()}</Empty.Description>
					</Empty.Header>
				</Empty.Root>
			{:else if messageDays.length === 0}
				<Empty.Root class="mx-auto my-16 max-w-md">
					<Empty.Header>
						<Empty.Title>No messages yet</Empty.Title>
						<Empty.Description>Send the first prompt to start this session.</Empty.Description>
					</Empty.Header>
					<Empty.Content>
						<Button onclick={() => composerTextarea?.focus()}>Write a message</Button>
					</Empty.Content>
				</Empty.Root>
			{:else}
				{#each messageDays as day (day.dateKey)}
					<div
						class="day-divider"
						data-date-key={day.dateKey}
						aria-label={`Messages from ${day.label}`}
					>
						<span>{day.label}</span>
					</div>
					{#each day.messages as message, messageIndex (message.id)}
						{@const referencedMessage = message.replyingToMessage
							? messagesById.get(message.replyingToMessage)
							: undefined}
						<article
							class={`message-row ${message.role}`}
							class:date-jump-highlight={highlightedDateKey === day.dateKey}
							aria-label={`${message.role} message`}
							data-message-id={message.id}
							data-day-first-message={messageIndex === 0 ? day.dateKey : undefined}
						>
							<div class="message-stack">
								<div class="message-bubble">
									{#if message.replyingToMessage}
										<div
											class="reply-reference-wrap"
											role="presentation"
											onpointerenter={() => (isReplyPreviewOpen = message.id)}
											onpointerleave={() => (isReplyPreviewOpen = undefined)}
											onfocusin={() => (isReplyPreviewOpen = message.id)}
											onfocusout={() => (isReplyPreviewOpen = undefined)}
										>
											<Button
												variant="ghost"
												size="sm"
												class="reply-reference"
												onclick={() => jumpToMessage(message.replyingToMessage!)}
												aria-label={`Jump to replied message: ${getReplyExcerpt(referencedMessage)}`}
											>
												<span>↩ {getReplyLabel(referencedMessage)}</span>
											</Button>
											{#if isReplyPreviewOpen === message.id}
												<div class="reply-hover-card" role="tooltip">
													<p class="reply-hover-title">Reply context</p>
													<p>{getReplyExcerpt(referencedMessage)}</p>
												</div>
											{/if}
										</div>
									{/if}
									<p>{message.text}</p>
									{#if message.status === 'pending'}
										<p class="message-status" aria-live="polite">Assistant response pending…</p>
									{/if}
									<time datetime={message.timestamp.toISOString()}
										>{timeFormatter.format(message.timestamp)}</time
									>
								</div>
								{#if message.role !== 'system'}
									<button
										class="reply-button"
										type="button"
										onclick={() => selectReplyTarget(message)}
										aria-label={`Reply to ${message.role} message: ${message.text}`}
										data-gesture-action="reply"
									>
										<span aria-hidden="true">↩</span>
										Reply
									</button>
								{/if}
							</div>
						</article>
					{/each}
				{/each}
			{/if}
		</div>

		<form
			class="composer"
			aria-label="Message composer"
			onsubmit={(event) => {
				event.preventDefault();
				sendMessage();
			}}
		>
			{#if replyTarget}
				<div class="reply-preview" data-gesture-action="clear-reply">
					<div>
						<strong>Replying to {replyTarget.role === 'user' ? 'you' : 'the agent'}</strong>
						<span>{replyTarget.text}</span>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onclick={clearReplyTarget}
						aria-label="Cancel reply target">Clear</Button
					>
				</div>
			{/if}
			<label class="sr-only" for="message-draft">Message the agent</label>
			<Textarea
				id="message-draft"
				bind:ref={composerTextarea}
				bind:value={draft}
				placeholder="Message the agent…"
				rows={1}
				aria-label="Message the agent"
				onkeydown={handleComposerKeydown}
				class="min-h-11 flex-1 resize-y rounded-2xl"
			/>
			<Button type="submit" disabled={!draft.trim() || isSending}>
				{isSending ? 'Sending…' : 'Send'}
			</Button>
		</form>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		min-width: 320px;
		overflow: hidden;
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

	.chat-page {
		--page: oklch(0.965 0 0);
		--surface: oklch(0.985 0 0);
		--surface-soft: oklch(0.955 0 0);
		--surface-muted: oklch(0.92 0 0);
		--surface-hover: oklch(0.9 0 0);
		--surface-translucent: oklch(0.94 0 0 / 0.92);
		--reply-reference: oklch(0.98 0 0 / 0.18);
		--reply-reference-hover: oklch(0.99 0 0 / 0.28);
		--input: oklch(0.99 0 0);
		--inset: oklch(0.18 0 0 / 0.04);
		--text: oklch(0.18 0 0);
		--text-invert: oklch(0.96 0 0);
		--text-muted: oklch(0.42 0 0);
		--text-subtle: oklch(0.5 0 0);
		--strong: oklch(0.16 0 0);
		--line: oklch(0.86 0 0);
		--line-strong: oklch(0.76 0 0);
		--shadow: oklch(0.16 0 0 / 0.12);
		--focus: oklch(0.35 0 0 / 0.28);
		display: grid;
		height: 100svh;
		padding: 0;
		background: var(--page);
		color: var(--text);
	}

	.chat-page.dark-theme {
		--page: oklch(0.13 0 0);
		--surface: oklch(0.18 0 0);
		--surface-soft: oklch(0.22 0 0);
		--surface-muted: oklch(0.25 0 0);
		--surface-hover: oklch(0.31 0 0);
		--surface-translucent: oklch(0.22 0 0 / 0.92);
		--reply-reference: oklch(1 0 0 / 0.1);
		--reply-reference-hover: oklch(1 0 0 / 0.16);
		--input: oklch(0.15 0 0);
		--inset: oklch(0 0 0 / 0.22);
		--text: oklch(0.93 0 0);
		--text-invert: oklch(0.12 0 0);
		--text-muted: oklch(0.72 0 0);
		--text-subtle: oklch(0.62 0 0);
		--strong: oklch(0.94 0 0);
		--line: oklch(0.31 0 0);
		--line-strong: oklch(0.42 0 0);
		--shadow: oklch(0 0 0 / 0.32);
		--focus: oklch(0.78 0 0 / 0.32);
	}

	.chat-card {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		width: 100%;
		height: 100svh;
		overflow: hidden;
		border: 0;
		border-radius: 0;
		background: var(--surface);
		box-shadow: none;
	}

	.chat-header,
	.composer {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem clamp(1rem, 3vw, 1.5rem);
	}

	.chat-header {
		position: relative;
		z-index: 30;
		flex-wrap: wrap;
		justify-content: space-between;
		border-bottom: 1px solid var(--line);
		background: var(--surface);
		container-type: inline-size;
	}

	.agent-lockup {
		display: flex;
		align-items: center;
		min-width: 0;
		gap: 0.8rem;
	}

	.agent-avatar {
		display: grid;
		width: 3rem;
		height: 3rem;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 1rem;
		background: var(--strong);
		color: var(--text-invert);
		font-weight: 800;
		letter-spacing: -0.04em;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.05rem, 2vw, 1.3rem);
		line-height: 1.1;
	}

	:global(.date-button) {
		border: 0;
		font: inherit;
		transition:
			transform 160ms ease,
			background 160ms ease,
			box-shadow 160ms ease;
	}

	.date-menu-anchor {
		position: relative;
		min-width: 0;
	}

	:global(.date-button) {
		display: inline-grid;
		grid-template-columns: minmax(0, auto) auto;
		align-items: center;
		height: auto;
		column-gap: 0.35rem;
		row-gap: 0.05rem;
		margin-top: 0.25rem;
		padding: 0.12rem 0.35rem 0.12rem 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.9rem;
		text-align: left;
	}

	.date-button-label {
		min-width: 0;
		font-weight: 650;
		line-height: 1.15;
	}

	.date-button-meta {
		grid-column: 1 / -1;
		color: var(--text-subtle);
		font-size: 0.72rem;
		line-height: 1.1;
	}

	.date-chevron {
		grid-column: 2;
		grid-row: 1;
		transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	:global(.date-button[aria-expanded='true'] .date-chevron) {
		transform: rotate(180deg);
	}

	:global(.date-button:hover),
	:global(.date-button:focus-visible) {
		color: var(--text);
	}

	:global(.date-button:hover .date-button-meta),
	:global(.date-button:focus-visible .date-button-meta) {
		color: var(--text);
	}

	.date-menu-panel {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		z-index: 20;
		display: grid;
		width: min(18rem, calc(100vw - 2rem));
		max-height: min(20rem, 50vh);
		overflow-y: auto;
		border: 1px solid var(--line);
		border-radius: 1rem;
		background: var(--surface);
		box-shadow: 0 20px 50px var(--shadow);
		padding: 0.35rem;
	}

	.date-menu-panel p {
		margin: 0;
		padding: 0.75rem;
		color: var(--text-muted);
		font-size: 0.86rem;
	}

	.date-menu-item {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border: 0;
		border-radius: 0.75rem;
		background: transparent;
		color: var(--text);
		cursor: pointer;
		font: inherit;
		padding: 0.65rem 0.75rem;
		text-align: left;
	}

	.date-menu-item:hover,
	.date-menu-item:focus-visible {
		background: var(--surface-hover);
	}

	.date-menu-item small {
		color: var(--text-muted);
		font-size: 0.72rem;
	}

	.header-actions {
		position: relative;
		z-index: 31;
		display: flex;
		flex: 0 1 auto;
		align-items: center;
		justify-content: flex-end;
		min-width: min(100%, 18rem);
		max-width: 100%;
		flex-wrap: wrap;
		gap: 0.55rem;
		isolation: isolate;
	}

	.header-actions :global([data-slot='button']),
	.header-actions :global([data-slot='button-group']) {
		position: relative;
		z-index: 32;
		display: inline-flex;
		visibility: visible;
		opacity: 1;
	}

	.header-actions :global([data-slot='button']) {
		min-width: max-content;
		border-color: var(--line-strong);
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 4px 12px oklch(0 0 0 / 0.06);
	}

	.header-actions :global([data-slot='button'][aria-pressed='true']) {
		background: var(--strong);
		color: var(--text-invert);
	}

	.dev-tool-status {
		margin: 0;
		border-bottom: 1px solid var(--line);
		background: var(--surface-translucent);
		padding: 0.55rem 1.5rem;
		color: var(--text);
		font-size: 0.85rem;
		text-align: center;
	}

	.message-history {
		overflow-y: auto;
		overscroll-behavior: contain;
		scroll-behavior: smooth;
		padding: 1rem clamp(1rem, 3vw, 1.5rem) 1.5rem;
		contain: layout paint;
	}

	.message-history:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: -3px;
	}

	.day-divider {
		position: sticky;
		top: 0;
		z-index: 1;
		scroll-margin-top: 0.75rem;
		display: flex;
		justify-content: center;
		padding: 0.25rem 0 1rem;
		pointer-events: none;
	}

	.day-divider span {
		border-radius: 999px;
		background: var(--surface-translucent);
		padding: 0.35rem 0.7rem;
		color: var(--text-muted);
		font-size: 0.78rem;
		box-shadow: 0 8px 20px var(--shadow);
	}

	.message-skeletons {
		display: grid;
		min-height: 14rem;
		align-content: start;
		gap: 0.75rem;
		padding-top: 2.5rem;
	}

	.message-row {
		display: flex;
		margin: 0.45rem 0;
		scroll-margin: 4.25rem;
	}

	.message-row.date-jump-highlight .message-bubble {
		animation: date-jump-settle 820ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	@keyframes date-jump-settle {
		0% {
			box-shadow: 0 6px 18px var(--shadow);
		}

		22% {
			box-shadow:
				0 0 0 3px var(--focus),
				0 10px 24px var(--shadow);
		}

		100% {
			box-shadow: 0 6px 18px var(--shadow);
		}
	}

	.message-row.user {
		justify-content: flex-end;
	}

	.message-row.system {
		justify-content: center;
	}

	.message-stack {
		display: grid;
		max-width: min(75%, 42rem);
		gap: 0.25rem;
		transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.message-row:hover .message-stack,
	.message-row:focus-within .message-stack {
		transform: translateX(0.15rem);
	}

	.message-row.user:hover .message-stack,
	.message-row.user:focus-within .message-stack {
		transform: translateX(-0.15rem);
	}

	.message-row.user .message-stack {
		justify-items: end;
	}

	.message-bubble {
		border-radius: 1.35rem;
		background: var(--surface-muted);
		padding: 0.75rem 0.9rem 0.55rem;
		box-shadow: 0 6px 18px var(--shadow);
	}

	.message-row.user .message-bubble {
		background: var(--text);
		color: var(--text-invert);
	}

	.message-row.system .message-stack {
		max-width: 90%;
	}

	.message-row.system .message-bubble {
		background: var(--surface-translucent);
		color: var(--text-muted);
		text-align: center;
	}

	.message-bubble p {
		margin: 0;
		line-height: 1.45;
	}

	.reply-reference-wrap {
		position: relative;
		width: 100%;
		max-width: 30rem;
	}

	.reply-hover-card {
		position: absolute;
		bottom: calc(100% + 0.45rem);
		left: 0;
		z-index: 10;
		width: min(22rem, 70vw);
		border: 1px solid var(--line);
		border-radius: 0.9rem;
		background: var(--surface);
		box-shadow: 0 18px 38px var(--shadow);
		padding: 0.85rem;
		color: var(--text);
		font-size: 0.86rem;
	}

	.reply-hover-title {
		margin-bottom: 0.25rem !important;
		font-weight: 750;
	}

	.reply-hover-card p:last-child {
		color: var(--text-muted);
	}

	:global(.message-bubble .reply-reference) {
		display: block;
		width: 100%;
		max-width: 30rem;
		height: auto;
		margin: 0 0 0.45rem;
		overflow: hidden;
		border: 1px solid currentColor;
		border-radius: 0.8rem;
		background: var(--reply-reference);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 0.78rem;
		opacity: 0.78;
		padding: 0.38rem 0.55rem;
		text-align: left;
		transition:
			opacity 160ms ease,
			transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
			background 160ms ease;
	}

	:global(.message-bubble .reply-reference span) {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.message-bubble .reply-reference:hover),
	:global(.message-bubble .reply-reference:focus-visible) {
		background: var(--reply-reference-hover);
		opacity: 1;
		outline: 2px solid currentColor;
		outline-offset: 2px;
		transform: translateY(-1px);
	}

	.message-bubble .message-status {
		margin-top: 0.35rem;
		opacity: 0.72;
		font-size: 0.78rem;
		font-style: italic;
	}

	.message-bubble time {
		display: block;
		margin-top: 0.35rem;
		opacity: 0.68;
		font-size: 0.72rem;
		text-align: right;
	}

	.reply-button {
		display: inline-flex;
		width: fit-content;
		align-items: center;
		gap: 0.25rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		font: inherit;
		font-size: 0.78rem;
		opacity: 0.28;
		padding: 0.24rem 0.55rem;
		touch-action: manipulation;
		transition:
			opacity 160ms ease,
			transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
			background 160ms ease,
			color 160ms ease;
	}

	.message-row:hover .reply-button,
	.message-row:focus-within .reply-button {
		opacity: 1;
	}

	.reply-button:hover,
	.reply-button:focus-visible {
		background: var(--surface-hover);
		color: var(--text);
		outline: 2px solid var(--focus);
		outline-offset: 2px;
		transform: translateY(-1px);
	}

	.composer {
		flex-wrap: wrap;
		border-top: 1px solid var(--line);
		background: var(--surface);
	}

	.reply-preview {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border: 1px solid var(--focus);
		border-radius: 1rem;
		background: var(--surface-hover);
		padding: 0.6rem 0.75rem;
		color: var(--text);
		font-size: 0.85rem;
		touch-action: manipulation;
	}

	.reply-preview div {
		display: grid;
		min-width: 0;
		gap: 0.12rem;
	}

	.reply-preview strong,
	.reply-preview span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.reply-preview strong {
		font-size: 0.72rem;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.reply-preview button {
		border: 0;
		background: transparent;
		color: var(--text);
		cursor: pointer;
		font: inherit;
		font-weight: 700;
	}

	.reply-preview button:hover,
	.reply-preview button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 3px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	@container (max-width: 34rem) {
		.agent-lockup {
			flex: 1 1 12rem;
		}

		.header-actions {
			flex: 1 1 100%;
			justify-content: flex-start;
			gap: 0.35rem;
		}
	}

	@media (max-width: 640px) {
		.chat-page {
			padding: 0;
		}

		.chat-card {
			width: 100%;
			height: 100svh;
			border-width: 0;
			border-radius: 0;
		}

		.chat-header {
			padding-block: 0.85rem;
		}

		.message-stack {
			max-width: 86%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			scroll-behavior: auto !important;
			transition-duration: 0.01ms !important;
			animation-duration: 0.01ms !important;
		}
	}
</style>
