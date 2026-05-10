<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';

	type ChatMessage = {
		id: string;
		role: 'user' | 'assistant' | 'system';
		text: string;
		timestamp: Date;
	};

	const initialMessages: ChatMessage[] = [
		{
			id: 'm-1',
			role: 'assistant',
			text: 'Good morning — I’m ready whenever you are.',
			timestamp: new Date('2026-05-09T09:16:00')
		},
		{
			id: 'm-2',
			role: 'user',
			text: 'I want to talk through my outreach plan for this week.',
			timestamp: new Date('2026-05-09T09:17:00')
		},
		{
			id: 'm-3',
			role: 'assistant',
			text: 'Absolutely. Send me the details and I’ll help you organize the next step.',
			timestamp: new Date('2026-05-09T09:17:30')
		},
		{
			id: 'm-4',
			role: 'system',
			text: 'The agent is ready to use recent conversation context.',
			timestamp: new Date('2026-05-09T09:18:00')
		}
	];

	let messages = $state<ChatMessage[]>(initialMessages);
	let draft = $state('');
	let historyElement = $state<HTMLElement>();
	const currentDate = new Intl.DateTimeFormat('en', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	}).format(initialMessages.at(-1)?.timestamp ?? new Date());

	const timeFormatter = new Intl.DateTimeFormat('en', {
		hour: 'numeric',
		minute: '2-digit'
	});

	async function sendDemoMessage() {
		const text = draft.trim();
		if (!text) return;

		messages = [
			...messages,
			{
				id: `local-${Date.now()}`,
				role: 'user',
				text,
				timestamp: new Date()
			}
		];
		draft = '';
		await tick();
		historyElement?.scrollTo({ top: historyElement.scrollHeight, behavior: 'smooth' });
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
				<div>
					<h1 id="chat-title">Agent Chat</h1>
					<button class="date-button" type="button" aria-label="Open conversation date menu">
						{currentDate}
						<span aria-hidden="true">⌄</span>
					</button>
				</div>
			</div>
			<a class="home-link" href={resolve('/')}>Home</a>
		</header>

		<div
			class="message-history"
			bind:this={historyElement}
			role="log"
			aria-label="Conversation history"
		>
			<div class="day-divider"><span>{currentDate}</span></div>
			{#each messages as message (message.id)}
				<article class={`message-row ${message.role}`} aria-label={`${message.role} message`}>
					<div class="message-bubble">
						<p>{message.text}</p>
						<time datetime={message.timestamp.toISOString()}
							>{timeFormatter.format(message.timestamp)}</time
						>
					</div>
				</article>
			{/each}
		</div>

		<form
			class="composer"
			aria-label="Message composer"
			onsubmit={(event) => {
				event.preventDefault();
				sendDemoMessage();
			}}
		>
			<label class="sr-only" for="message-draft">Message the agent</label>
			<textarea
				id="message-draft"
				bind:value={draft}
				placeholder="Message the agent…"
				rows="1"
				aria-label="Message the agent"
			></textarea>
			<button type="submit" disabled={!draft.trim()}>Send</button>
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
		justify-content: space-between;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
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
	.composer button {
		border: 0;
		font: inherit;
		transition:
			transform 160ms ease,
			background 160ms ease,
			box-shadow 160ms ease;
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

	.date-button:hover,
	.date-button:focus-visible,
	.home-link:hover,
	.home-link:focus-visible {
		color: #4f46e5;
	}

	.home-link {
		border-radius: 999px;
		color: #64748b;
		font-size: 0.9rem;
		text-decoration: none;
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

	.message-bubble {
		max-width: min(75%, 42rem);
		border-radius: 1.35rem;
		background: #f1f5f9;
		padding: 0.75rem 0.9rem 0.55rem;
		box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
	}

	.message-row.user .message-bubble {
		background: #4f46e5;
		color: white;
	}

	.message-row.system .message-bubble {
		max-width: 90%;
		background: rgba(226, 232, 240, 0.7);
		color: #64748b;
		text-align: center;
	}

	.message-bubble p {
		margin: 0;
		line-height: 1.45;
	}

	.message-bubble time {
		display: block;
		margin-top: 0.35rem;
		opacity: 0.68;
		font-size: 0.72rem;
		text-align: right;
	}

	.composer {
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(255, 255, 255, 0.72);
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

		.message-bubble {
			max-width: 86%;
		}

		.home-link {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			scroll-behavior: auto !important;
			transition-duration: 0.01ms !important;
		}
	}
</style>
