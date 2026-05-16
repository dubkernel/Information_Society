<script lang="ts">
	import { dev } from '$app/environment';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api.js';
	import type { Id } from '../../convex/_generated/dataModel.js';

	type ChatMessage = {
		id: Id<'messages'>;
		role: 'user' | 'assistant' | 'system' | 'tool';
		text: string;
		timestamp: Date;
		replyingToMessage?: Id<'messages'>;
	};

	type MessageDay = {
		dateKey: string;
		label: string;
		messages: ChatMessage[];
	};

	const client = useConvexClient();
	const persistedMessages = useQuery(api.chat.listMessages, {});

	let draft = $state('');
	let isSending = $state(false);
	let isDevToolRunning = $state(false);
	let devToolStatus = $state('');
	let replyingToMessageId = $state<Id<'messages'>>();
	let historyElement = $state<HTMLElement>();
	let isDateMenuOpen = $state(false);
	let activeDateKey = $state<string>();

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
			timestamp: new Date(message.timestamp),
			replyingToMessage: message.replyingToMessage
		}))
	);
	const messageDays = $derived.by<MessageDay[]>(() => groupMessagesByDay(messages));
	const activeDay = $derived(messageDays.find((day) => day.dateKey === activeDateKey));
	const currentDate = $derived(
		activeDay?.label ?? formatConversationDate(messages.at(-1)?.timestamp ?? new Date())
	);
	const replyTarget = $derived(messages.find((message) => message.id === replyingToMessageId));

	$effect(() => {
		if (messageDays.length === 0) {
			activeDateKey = undefined;
			return;
		}

		if (!activeDateKey || !messageDays.some((day) => day.dateKey === activeDateKey)) {
			activeDateKey = messageDays.at(-1)?.dateKey;
		}
	});

	function formatConversationDate(date: Date) {
		return dayFormatter.format(date);
	}

	function dateKey(date: Date) {
		return date.toISOString().slice(0, 10);
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
			await client.mutation(api.chat.sendMessage, { text, replyingToMessage: replyingToMessageId });
			draft = '';
			replyingToMessageId = undefined;
			await tick();
			historyElement?.scrollTo({ top: historyElement.scrollHeight, behavior: 'smooth' });
		} finally {
			isSending = false;
		}
	}

	function selectReplyTarget(message: ChatMessage) {
		replyingToMessageId = message.id;
	}

	function clearReplyTarget() {
		replyingToMessageId = undefined;
	}

	function toggleDateMenu() {
		isDateMenuOpen = !isDateMenuOpen;
	}

	async function jumpToDate(day: MessageDay) {
		activeDateKey = day.dateKey;
		isDateMenuOpen = false;
		await tick();

		const target = historyElement?.querySelector<HTMLElement>(`[data-date-key="${day.dateKey}"]`);
		target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
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

	async function handleDateKeydown(event: KeyboardEvent, day: MessageDay) {
		if (event.key !== 'Enter' && event.key !== ' ') return;

		event.preventDefault();
		await jumpToDate(day);
	}

	async function seedDevChat() {
		if (isDevToolRunning) return;
		isDevToolRunning = true;
		devToolStatus = 'Seeding 50 development messages…';
		try {
			const result = await client.mutation(api.chat.seedDevData, {
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

<main class="chat-page" aria-labelledby="chat-title">
	<section class="chat-card" aria-label="Agent conversation">
		<header class="chat-header">
			<div class="agent-lockup">
				<div class="agent-avatar" aria-hidden="true">IS</div>
				<div class="date-menu-anchor">
					<h1 id="chat-title">Agent Chat</h1>
					<button
						class="date-button"
						type="button"
						aria-label="Open conversation date menu"
						aria-haspopup="listbox"
						aria-expanded={isDateMenuOpen}
						onclick={toggleDateMenu}
					>
						{currentDate}
						<span aria-hidden="true">⌄</span>
					</button>
					{#if isDateMenuOpen}
						<div class="date-menu" role="listbox" aria-label="Conversation dates">
							{#if messageDays.length === 0}
								<p>No messages yet</p>
							{:else}
								{#each messageDays as day (day.dateKey)}
									<button
										class="date-option"
										type="button"
										role="option"
										aria-selected={day.label === currentDate}
										onclick={() => jumpToDate(day)}
										onkeydown={(event) => handleDateKeydown(event, day)}
									>
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
				{#if dev}
					<button type="button" onclick={seedDevChat} disabled={isDevToolRunning}
						>Seed dev chat</button
					>
					<button type="button" onclick={clearDevChat} disabled={isDevToolRunning}
						>Clear dev chat</button
					>
				{/if}
				<a class="home-link" href={resolve('/')}>Home</a>
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
					<div class="skeleton-message assistant"></div>
					<div class="skeleton-message user"></div>
					<div class="skeleton-message assistant short"></div>
				</div>
			{:else if persistedMessages.error}
				<p class="empty-state">Unable to load conversation. {persistedMessages.error.toString()}</p>
			{:else if messageDays.length === 0}
				<p class="empty-state">Start the conversation by sending a message.</p>
			{:else}
				{#each messageDays as day (day.dateKey)}
					<div
						class="day-divider"
						data-date-key={day.dateKey}
						aria-label={`Messages from ${day.label}`}
					>
						<span>{day.label}</span>
					</div>
					{#each day.messages as message (message.id)}
						<article class={`message-row ${message.role}`} aria-label={`${message.role} message`}>
							<div class="message-stack">
								<div class="message-bubble">
									{#if message.replyingToMessage}
										<p class="reply-reference">Replying to earlier message</p>
									{/if}
									<p>{message.text}</p>
									<time datetime={message.timestamp.toISOString()}
										>{timeFormatter.format(message.timestamp)}</time
									>
								</div>
								{#if message.role === 'assistant'}
									<button
										class="reply-button"
										type="button"
										onclick={() => selectReplyTarget(message)}
										aria-label={`Reply to assistant message: ${message.text}`}
									>
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
				<div class="reply-preview">
					<span>Replying to: {replyTarget.text}</span>
					<button type="button" onclick={clearReplyTarget} aria-label="Cancel reply target"
						>Cancel</button
					>
				</div>
			{/if}
			<label class="sr-only" for="message-draft">Message the agent</label>
			<textarea
				id="message-draft"
				bind:value={draft}
				placeholder="Message the agent…"
				rows="1"
				aria-label="Message the agent"
			></textarea>
			<button type="submit" disabled={!draft.trim() || isSending}>
				{isSending ? 'Sending…' : 'Send'}
			</button>
		</form>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		min-width: 320px;
		background:
			radial-gradient(circle at top left, rgba(99, 102, 241, 0.2), transparent 30rem),
			linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #f8fafc 100%);
		color: #111827;
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
		display: grid;
		min-height: 100svh;
		place-items: center;
		padding: clamp(0.75rem, 2vw, 2rem);
	}

	.chat-card {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		width: min(100%, 62rem);
		height: min(100svh - 1.5rem, 54rem);
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.28);
		border-radius: 2rem;
		background: rgba(255, 255, 255, 0.86);
		box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
		backdrop-filter: blur(18px);
	}

	.chat-header,
	.composer {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem clamp(1rem, 3vw, 1.5rem);
	}

	.chat-header {
		flex-wrap: wrap;
		justify-content: space-between;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
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
		background: linear-gradient(135deg, #111827, #4f46e5);
		color: white;
		font-weight: 800;
		letter-spacing: -0.04em;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.05rem, 2vw, 1.3rem);
		line-height: 1.1;
	}

	.date-button,
	.home-link,
	.header-actions button,
	.composer button {
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

	.date-button {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.25rem;
		padding: 0;
		background: transparent;
		color: #64748b;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.date-menu {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		z-index: 5;
		display: grid;
		width: min(18rem, calc(100vw - 2rem));
		max-height: min(20rem, 50vh);
		overflow-y: auto;
		border: 1px solid rgba(148, 163, 184, 0.28);
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.98);
		box-shadow: 0 20px 50px rgba(15, 23, 42, 0.16);
		padding: 0.35rem;
	}

	.date-menu p {
		margin: 0;
		padding: 0.75rem;
		color: #64748b;
		font-size: 0.86rem;
	}

	.date-option {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border: 0;
		border-radius: 0.75rem;
		background: transparent;
		color: #111827;
		cursor: pointer;
		font: inherit;
		padding: 0.65rem 0.75rem;
		text-align: left;
	}

	.date-option:hover,
	.date-option:focus-visible,
	.date-option[aria-selected='true'] {
		background: #eef2ff;
		color: #4338ca;
	}

	.date-option small {
		flex: 0 0 auto;
		color: #64748b;
		font-size: 0.72rem;
	}

	.date-button:hover,
	.date-button:focus-visible,
	.home-link:hover,
	.home-link:focus-visible {
		color: #4f46e5;
	}

	.header-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-width: 0;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.header-actions button,
	.home-link {
		border-radius: 999px;
		color: #64748b;
		font-size: 0.9rem;
		text-decoration: none;
	}

	.header-actions button {
		border: 1px solid rgba(148, 163, 184, 0.28);
		background: rgba(255, 255, 255, 0.68);
		cursor: pointer;
		padding: 0.45rem 0.7rem;
	}

	.header-actions button:hover:not(:disabled),
	.header-actions button:focus-visible:not(:disabled) {
		background: #eef2ff;
		color: #4f46e5;
	}

	.header-actions button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.dev-tool-status {
		margin: 0;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(238, 242, 255, 0.72);
		padding: 0.55rem 1.5rem;
		color: #4f46e5;
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
		outline: 3px solid rgba(79, 70, 229, 0.32);
		outline-offset: -3px;
	}

	.day-divider {
		position: sticky;
		top: 0;
		z-index: 1;
		scroll-margin-top: 1rem;
		display: flex;
		justify-content: center;
		padding: 0.25rem 0 1rem;
		pointer-events: none;
	}

	.day-divider span {
		border-radius: 999px;
		background: rgba(241, 245, 249, 0.92);
		padding: 0.35rem 0.7rem;
		color: #64748b;
		font-size: 0.78rem;
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
	}

	.empty-state {
		margin: 4rem auto;
		max-width: 24rem;
		color: #64748b;
		text-align: center;
	}

	.message-skeletons {
		display: grid;
		min-height: 14rem;
		align-content: start;
		gap: 0.75rem;
		padding-top: 2.5rem;
	}

	.skeleton-message {
		width: min(72%, 32rem);
		height: 3.7rem;
		border-radius: 1.35rem;
		background: linear-gradient(90deg, #eef2ff 0%, #f8fafc 48%, #eef2ff 100%);
		background-size: 200% 100%;
		box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
		animation: skeleton-shimmer 1.6s ease-in-out infinite;
	}

	.skeleton-message.user {
		justify-self: end;
		width: min(58%, 28rem);
	}

	.skeleton-message.short {
		width: min(48%, 22rem);
	}

	@keyframes skeleton-shimmer {
		0% {
			background-position: 100% 0;
		}

		100% {
			background-position: -100% 0;
		}
	}

	.message-row {
		display: flex;
		margin: 0.45rem 0;
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
	}

	.message-row.user .message-stack {
		justify-items: end;
	}

	.message-bubble {
		border-radius: 1.35rem;
		background: #f1f5f9;
		padding: 0.75rem 0.9rem 0.55rem;
		box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
	}

	.message-row.user .message-bubble {
		background: #4f46e5;
		color: white;
	}

	.message-row.system .message-stack {
		max-width: 90%;
	}

	.message-row.system .message-bubble {
		background: rgba(226, 232, 240, 0.7);
		color: #64748b;
		text-align: center;
	}

	.message-bubble p {
		margin: 0;
		line-height: 1.45;
	}

	.message-bubble .reply-reference {
		margin-bottom: 0.35rem;
		border-left: 2px solid currentColor;
		padding-left: 0.45rem;
		opacity: 0.7;
		font-size: 0.78rem;
	}

	.message-bubble time {
		display: block;
		margin-top: 0.35rem;
		opacity: 0.68;
		font-size: 0.72rem;
		text-align: right;
	}

	.reply-button {
		width: fit-content;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: #64748b;
		cursor: pointer;
		font: inherit;
		font-size: 0.78rem;
		padding: 0.2rem 0.45rem;
	}

	.reply-button:hover,
	.reply-button:focus-visible {
		background: #eef2ff;
		color: #4f46e5;
	}

	.composer {
		flex-wrap: wrap;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(255, 255, 255, 0.72);
	}

	.reply-preview {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-left: 3px solid #4f46e5;
		border-radius: 0.8rem;
		background: #eef2ff;
		padding: 0.55rem 0.7rem;
		color: #4338ca;
		font-size: 0.85rem;
	}

	.reply-preview span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.reply-preview button {
		border: 0;
		background: transparent;
		color: #4338ca;
		cursor: pointer;
		font: inherit;
		font-weight: 700;
	}

	.composer textarea {
		min-height: 2.75rem;
		max-height: 9rem;
		flex: 1;
		resize: vertical;
		border: 1px solid rgba(148, 163, 184, 0.35);
		border-radius: 1.25rem;
		padding: 0.78rem 1rem;
		background: white;
		box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
		font: inherit;
	}

	.composer textarea:focus {
		border-color: #818cf8;
		outline: 3px solid rgba(129, 140, 248, 0.25);
	}

	.composer button {
		border-radius: 999px;
		background: #111827;
		color: white;
		cursor: pointer;
		padding: 0.78rem 1rem;
		font-weight: 700;
	}

	.composer button:hover:not(:disabled),
	.composer button:focus-visible:not(:disabled) {
		transform: translateY(-1px);
		background: #4f46e5;
		box-shadow: 0 10px 24px rgba(79, 70, 229, 0.28);
	}

	.composer button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
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
			flex: 0 1 10.5rem;
			align-self: flex-start;
			gap: 0.35rem;
		}

		.header-actions button {
			padding: 0.4rem 0.55rem;
			font-size: 0.78rem;
		}

		.home-link {
			display: none;
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
