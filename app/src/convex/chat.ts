import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { MutationCtx } from './_generated/server';

const DEV_AUTH_ID = 'dev-local-chat-user';
const DEV_SESSION_TITLE = 'Agent Chat';

const placeholderReplies = [
	'I hear you. I’m keeping track and will help you shape the next step.',
	'That makes sense. Tell me a little more and I’ll help organize it.',
	'Got it — I’m noting the important pieces as we go.',
	'Thanks. I can work with that context and help you move it forward.'
];

async function getOrCreateDevUser(ctx: MutationCtx) {
	const existing = await ctx.db
		.query('users')
		.withIndex('byAuthId', (q) => q.eq('authId', DEV_AUTH_ID))
		.unique();

	if (existing) return existing._id;

	const now = Date.now();
	return await ctx.db.insert('users', {
		authId: DEV_AUTH_ID,
		name: 'Local Chat Tester',
		email: 'local-chat-tester@example.invalid',
		createdAt: now,
		updatedAt: now
	});
}

async function getOrCreateDevSession(ctx: MutationCtx) {
	const userId = await getOrCreateDevUser(ctx);
	const existing = await ctx.db
		.query('conversationSessions')
		.withIndex('byUserLastMessage', (q) => q.eq('userId', userId))
		.order('desc')
		.first();

	if (existing) return { sessionId: existing._id, userId };

	const now = Date.now();
	const sessionId = await ctx.db.insert('conversationSessions', {
		userId,
		title: DEV_SESSION_TITLE,
		provider: 'app',
		model: 'placeholder-agent',
		createdAt: now,
		lastMessageAt: now
	});

	return { sessionId, userId };
}

function pickPlaceholderReply(text: string) {
	const index = Math.abs([...text].reduce((sum, character) => sum + character.charCodeAt(0), 0));
	return placeholderReplies[index % placeholderReplies.length];
}

export const listMessages = query({
	args: {},
	handler: async (ctx) => {
		const user = await ctx.db
			.query('users')
			.withIndex('byAuthId', (q) => q.eq('authId', DEV_AUTH_ID))
			.unique();

		if (!user) return [];

		const session = await ctx.db
			.query('conversationSessions')
			.withIndex('byUserLastMessage', (q) => q.eq('userId', user._id))
			.order('desc')
			.first();

		if (!session) return [];

		return await ctx.db
			.query('messages')
			.withIndex('byUserSession', (q) => q.eq('userId', user._id).eq('sessionId', session._id))
			.order('asc')
			.take(100);
	}
});

export const sendMessage = mutation({
	args: {
		text: v.string()
	},
	handler: async (ctx, { text }) => {
		const trimmed = text.trim();
		if (!trimmed) return null;

		const { sessionId, userId } = await getOrCreateDevSession(ctx);
		const now = Date.now();

		const userMessageId = await ctx.db.insert('messages', {
			userId,
			sessionId,
			role: 'user',
			text: trimmed,
			status: 'complete',
			timestamp: now
		});

		await ctx.db.insert('messages', {
			userId,
			sessionId,
			role: 'assistant',
			text: pickPlaceholderReply(trimmed),
			provider: 'app',
			model: 'placeholder-agent',
			status: 'complete',
			timestamp: now + 1
		});

		await ctx.db.patch(sessionId, { lastMessageAt: now + 1 });

		return userMessageId;
	}
});
