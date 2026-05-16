import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { buildAgentContextPayload, contextWindowConfig } from './chatContext';

const DEV_SESSION_TITLE = 'Agent Chat';
const REFRESH_MESSAGE_TEXT = 'The agent is working on refreshing themselves on the topic.';

const placeholderReplies = [
	'I hear you. I’m keeping track and will help you shape the next step.',
	'That makes sense. Tell me a little more and I’ll help organize it.',
	'Got it, I’m noting the important pieces as we go.',
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
	'Absolutely, I’ll keep the relationship context organized as we go.',
	'Yes. I’d start by identifying the specific outcome you want from that exchange.',
	'Good idea. A short note with one concrete reference usually works best.',
	'I can help you prioritize by recency, relevance, and strength of connection.',
	'Let’s keep the message focused and easy for them to respond to.',
	'I’m tracking that as useful context for future recommendations.',
	'That sounds like a good candidate for a thoughtful follow-up.',
	'We can turn that into a clear next step.'
];

type AuthScope = {
	authId: string;
	name: string;
	email: string;
	isAuthenticated: boolean;
};

function requireDevDeployment() {
	const deployment = process.env.CONVEX_DEPLOYMENT ?? '';
	const devToolsEnabled = process.env.CHAT_DEV_TOOLS_ENABLED === 'true';
	if (!deployment.startsWith('dev:') && !devToolsEnabled) {
		throw new Error(
			'Development chat data tools require a dev Convex deployment or CHAT_DEV_TOOLS_ENABLED=true.'
		);
	}
}

async function getAuthScope(
	ctx: QueryCtx | MutationCtx,
	clientSessionId?: string
): Promise<AuthScope> {
	const identity = await ctx.auth.getUserIdentity();

	if (identity) {
		return {
			authId: `auth:${identity.subject}`,
			name: identity.name ?? identity.nickname ?? 'Authenticated User',
			email: identity.email ?? `${identity.subject}@auth.local`,
			isAuthenticated: true
		};
	}

	const sessionId = clientSessionId?.trim();
	if (!sessionId || sessionId.length < 12) {
		throw new Error('An authenticated identity or valid anonymous session id is required.');
	}

	return {
		authId: `anonymous-session:${sessionId}`,
		name: 'Local Chat Tester',
		email: `${sessionId}@anonymous.local`,
		isAuthenticated: false
	};
}

async function getExistingUser(ctx: QueryCtx | MutationCtx, authId: string) {
	return await ctx.db
		.query('users')
		.withIndex('byAuthId', (q) => q.eq('authId', authId))
		.unique();
}

async function getOrCreateScopedUser(ctx: MutationCtx, scope: AuthScope) {
	const existing = await getExistingUser(ctx, scope.authId);
	if (existing) return existing._id;

	const now = Date.now();
	return await ctx.db.insert('users', {
		authId: scope.authId,
		name: scope.name,
		email: scope.email,
		createdAt: now,
		updatedAt: now
	});
}

async function createSession(ctx: MutationCtx, userId: Id<'users'>) {
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

async function getOrCreateSession(ctx: MutationCtx, scope: AuthScope) {
	const userId = await getOrCreateScopedUser(ctx, scope);
	const existing = await ctx.db
		.query('conversationSessions')
		.withIndex('byUserLastMessage', (q) => q.eq('userId', userId))
		.order('desc')
		.first();

	if (existing) return { sessionId: existing._id, userId };
	return await createSession(ctx, userId);
}

async function clearScopedChatData(ctx: MutationCtx, userId: Id<'users'>) {
	let deletedMessages = 0;
	const sessions = await ctx.db
		.query('conversationSessions')
		.withIndex('byUserLastMessage', (q) => q.eq('userId', userId))
		.take(100);

	for (const session of sessions) {
		const messages = await ctx.db
			.query('messages')
			.withIndex('byUserSession', (q) => q.eq('userId', userId).eq('sessionId', session._id))
			.take(500);

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

function pickPlaceholderReply(text: string, groupedMessageCount: number) {
	if (groupedMessageCount > 1) {
		return `I’m tracking your last ${groupedMessageCount} messages together and will respond to each thread in order.`;
	}

	const index = Math.abs([...text].reduce((sum, character) => sum + character.charCodeAt(0), 0));
	return placeholderReplies[index % placeholderReplies.length];
}

async function getRecentMessages(
	ctx: QueryCtx | MutationCtx,
	userId: Id<'users'>,
	sessionId: Id<'conversationSessions'>
) {
	return await ctx.db
		.query('messages')
		.withIndex('byUserSession', (q) => q.eq('userId', userId).eq('sessionId', sessionId))
		.order('desc')
		.take(
			contextWindowConfig.recentMessageLimit + contextWindowConfig.replySurroundingLimit * 2 + 12
		)
		.then((messages) => messages.reverse());
}

async function assertMessageInSession(
	ctx: QueryCtx | MutationCtx,
	messageId: Id<'messages'>,
	userId: Id<'users'>,
	sessionId: Id<'conversationSessions'>
) {
	const message = await ctx.db.get(messageId);
	if (!message || message.userId !== userId || message.sessionId !== sessionId) {
		throw new Error('Reply target is not in the current user session.');
	}
	return message;
}

export const listMessages = query({
	args: { clientSessionId: v.optional(v.string()) },
	handler: async (ctx, { clientSessionId }) => {
		const scope = await getAuthScope(ctx, clientSessionId);
		const user = await getExistingUser(ctx, scope.authId);
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
		clientSessionId: v.optional(v.string()),
		confirm: v.literal('CLEAR_DEV_CHAT_DATA')
	},
	handler: async (ctx, { clientSessionId }) => {
		requireDevDeployment();
		const scope = await getAuthScope(ctx, clientSessionId);
		const user = await getExistingUser(ctx, scope.authId);
		if (!user) return { deletedMessages: 0, deletedSessions: 0 };
		return await clearScopedChatData(ctx, user._id);
	}
});

export const seedDevData = mutation({
	args: {
		clientSessionId: v.optional(v.string()),
		count: v.optional(v.number()),
		confirm: v.literal('SEED_DEV_CHAT_DATA')
	},
	handler: async (ctx, { clientSessionId, count }) => {
		requireDevDeployment();
		const scope = await getAuthScope(ctx, clientSessionId);
		const userId = await getOrCreateScopedUser(ctx, scope);
		await clearScopedChatData(ctx, userId);

		const { sessionId } = await createSession(ctx, userId);
		const messageCount = Math.max(1, Math.min(50, Math.floor(count ?? 24)));
		const startAt = Date.now() - 4 * 24 * 60 * 60 * 1000;
		const spacing = Math.floor((4 * 24 * 60 * 60 * 1000) / messageCount);

		for (let index = 0; index < messageCount; index += 1) {
			const isUser = index % 2 === 0;
			const timestamp = startAt + index * spacing;
			const text = isUser
				? seedUserMessages[index % seedUserMessages.length]
				: seedAssistantMessages[index % seedAssistantMessages.length];

			await ctx.db.insert('messages', {
				userId,
				sessionId,
				role: isUser ? 'user' : 'assistant',
				text,
				provider: isUser ? undefined : 'app',
				model: isUser ? undefined : 'placeholder-agent',
				status: 'complete',
				source: isUser ? 'user_input' : 'assistant_placeholder',
				isAutomated: false,
				timestamp
			});
		}

		await ctx.db.patch(sessionId, { lastMessageAt: startAt + (messageCount - 1) * spacing });
		return { insertedMessages: messageCount, sessionId };
	}
});

export const sendMessage = mutation({
	args: {
		clientSessionId: v.optional(v.string()),
		text: v.string(),
		replyingToMessage: v.optional(v.id('messages'))
	},
	handler: async (ctx, { clientSessionId, text, replyingToMessage }) => {
		const trimmed = text.trim();
		if (!trimmed) return null;

		const scope = await getAuthScope(ctx, clientSessionId);
		const { sessionId, userId } = await getOrCreateSession(ctx, scope);
		if (replyingToMessage) await assertMessageInSession(ctx, replyingToMessage, userId, sessionId);

		const now = Date.now();
		const userMessageId = await ctx.db.insert('messages', {
			userId,
			sessionId,
			role: 'user',
			text: trimmed,
			replyingToMessage,
			status: 'complete',
			source: 'user_input',
			isAutomated: false,
			timestamp: now
		});

		const contextMessages = await getRecentMessages(ctx, userId, sessionId);
		const agentContext = buildAgentContextPayload({
			messages: contextMessages,
			triggerMessageId: userMessageId,
			replyTargetId: replyingToMessage
		});

		await ctx.db.patch(userMessageId, {
			contextWindowMessageIds: agentContext.messageIds,
			replyContextMessageIds: agentContext.replyContextMessageIds
		});

		await ctx.db.insert('messages', {
			userId,
			sessionId,
			role: 'assistant',
			text: pickPlaceholderReply(trimmed, agentContext.consecutiveUserMessageIds.length),
			provider: 'app',
			model: 'placeholder-agent',
			status: 'complete',
			source: 'assistant_placeholder',
			isAutomated: false,
			contextWindowMessageIds: agentContext.messageIds,
			replyContextMessageIds: agentContext.replyContextMessageIds,
			groupedMessageIds: agentContext.consecutiveUserMessageIds,
			timestamp: now + 1
		});

		await ctx.db.patch(sessionId, { lastMessageAt: now + 1 });
		return { userMessageId, agentContext };
	}
});

export const requestContextRefresh = mutation({
	args: {
		clientSessionId: v.optional(v.string()),
		reason: v.optional(v.string())
	},
	handler: async (ctx, { clientSessionId, reason }) => {
		const scope = await getAuthScope(ctx, clientSessionId);
		const { sessionId, userId } = await getOrCreateSession(ctx, scope);
		const now = Date.now();

		const messageId = await ctx.db.insert('messages', {
			userId,
			sessionId,
			role: 'system',
			text: REFRESH_MESSAGE_TEXT,
			status: 'complete',
			source: 'automated_context_refresh',
			isAutomated: true,
			refreshReason: reason,
			timestamp: now
		});

		await ctx.db.patch(sessionId, { lastMessageAt: now });
		return { messageId, text: REFRESH_MESSAGE_TEXT };
	}
});
