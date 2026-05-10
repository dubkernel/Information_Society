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

const seedUserMessages = [
	'I want to map out who I should reconnect with this week.',
	'Can you help me think through a warm introduction?',
	'I met someone at the alumni event and want to follow up well.',
	'Which relationships have gone stale recently?',
	'I need a concise note to send after coffee tomorrow.',
	'Let’s organize my networking priorities by company.',
	'I am trying to remember why this person was relevant.',
	'Can you summarize the next best action from this thread?'
];

const seedAssistantMessages = [
	'Absolutely — I’ll keep the relationship context organized as we go.',
	'Yes. I’d start by identifying the specific outcome you want from that exchange.',
	'Good idea. A short note with one concrete reference usually works best.',
	'I can help you prioritize by recency, relevance, and strength of connection.',
	'Let’s keep the message focused and easy for them to respond to.',
	'I’m tracking that as useful context for future recommendations.',
	'That sounds like a good candidate for a thoughtful follow-up.',
	'We can turn that into a clear next step.'
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

async function createDevSession(
	ctx: MutationCtx,
	userId: Awaited<ReturnType<typeof getOrCreateDevUser>>
) {
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

async function getOrCreateDevSession(ctx: MutationCtx) {
	const userId = await getOrCreateDevUser(ctx);
	const existing = await ctx.db
		.query('conversationSessions')
		.withIndex('byUserLastMessage', (q) => q.eq('userId', userId))
		.order('desc')
		.first();

	if (existing) return { sessionId: existing._id, userId };

	return await createDevSession(ctx, userId);
}

async function clearDevChatData(ctx: MutationCtx) {
	const user = await ctx.db
		.query('users')
		.withIndex('byAuthId', (q) => q.eq('authId', DEV_AUTH_ID))
		.unique();

	if (!user) return { deletedMessages: 0, deletedSessions: 0 };

	let deletedMessages = 0;
	const sessions = await ctx.db
		.query('conversationSessions')
		.withIndex('byUserLastMessage', (q) => q.eq('userId', user._id))
		.take(100);

	for (const session of sessions) {
		const messages = await ctx.db
			.query('messages')
			.withIndex('byUserSession', (q) => q.eq('userId', user._id).eq('sessionId', session._id))
			.take(200);

		for (const message of messages) {
			await ctx.db.delete(message._id);
			deletedMessages += 1;
		}
	}

	for (const session of sessions) {
		await ctx.db.delete(session._id);
	}

	return { deletedMessages, deletedSessions: sessions.length };
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

export const clearDevData = mutation({
	args: {
		confirm: v.literal('CLEAR_DEV_CHAT_DATA')
	},
	handler: async (ctx) => {
		return await clearDevChatData(ctx);
	}
});

export const seedDevData = mutation({
	args: {
		count: v.optional(v.number()),
		confirm: v.literal('SEED_DEV_CHAT_DATA')
	},
	handler: async (ctx, { count }) => {
		await clearDevChatData(ctx);

		const userId = await getOrCreateDevUser(ctx);
		const { sessionId } = await createDevSession(ctx, userId);
		const messageCount = Math.max(1, Math.min(50, Math.floor(count ?? 24)));
		const startAt = Date.now() - 4 * 24 * 60 * 60 * 1000;
		const spacing = Math.floor((4 * 24 * 60 * 60 * 1000) / messageCount);

		for (let index = 0; index < messageCount; index += 1) {
			const isUser = index % 2 === 0;
			const timestamp = startAt + index * spacing;
			const text = isUser
				? seedUserMessages[index % seedUserMessages.length]
				: seedAssistantMessages[index % seedAssistantMessages.length];

			await ctx.db.insert(
				'messages',
				isUser
					? {
							userId,
							sessionId,
							role: 'user',
							text,
							status: 'complete',
							timestamp
						}
					: {
							userId,
							sessionId,
							role: 'assistant',
							text,
							provider: 'app',
							model: 'placeholder-agent',
							status: 'complete',
							timestamp
						}
			);
		}

		await ctx.db.patch(sessionId, { lastMessageAt: startAt + (messageCount - 1) * spacing });
		return { insertedMessages: messageCount, sessionId };
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
