import type { Doc, Id } from './_generated/dataModel';

export const contextWindowConfig = {
	recentMessageLimit: 8,
	replySurroundingLimit: 2,
	consecutiveUserLimit: 4
} as const;

export type ContextMessage = Pick<
	Doc<'messages'>,
	'_id' | 'role' | 'text' | 'timestamp' | 'replyingToMessage'
>;

export type OrganizedUserMessage = {
	messageId: Id<'messages'>;
	position: number;
	text: string;
	excerpt: string;
};

export type OrganizedUserMessageGroup = {
	messageIds: Id<'messages'>[];
	messages: OrganizedUserMessage[];
	shouldAddressIndividually: boolean;
};

export type AgentContextPayload = {
	triggerMessageId: Id<'messages'>;
	replyTargetId?: Id<'messages'>;
	messageIds: Id<'messages'>[];
	recentMessageIds: Id<'messages'>[];
	replyContextMessageIds: Id<'messages'>[];
	consecutiveUserMessageIds: Id<'messages'>[];
};

function uniqueIds(ids: Id<'messages'>[]) {
	return [...new Set(ids)];
}

export function findConsecutiveUserMessageIds(messages: ContextMessage[]) {
	return getConsecutiveUserMessages(messages).map((message) => message._id);
}

export function getConsecutiveUserMessages(messages: ContextMessage[]) {
	const grouped: ContextMessage[] = [];
	const ordered = [...messages].sort((a, b) => a.timestamp - b.timestamp);

	for (let index = ordered.length - 1; index >= 0; index -= 1) {
		const message = ordered[index];
		if (!message || message.role !== 'user') break;
		grouped.unshift(message);
		if (grouped.length >= contextWindowConfig.consecutiveUserLimit) break;
	}

	return grouped;
}

export function organizeConsecutiveUserMessages(
	messages: Pick<ContextMessage, '_id' | 'text' | 'timestamp' | 'role'>[]
): OrganizedUserMessageGroup {
	const grouped = getConsecutiveUserMessages(messages as ContextMessage[]);
	return {
		messageIds: grouped.map((message) => message._id),
		messages: grouped.map((message, index) => ({
			messageId: message._id,
			position: index + 1,
			text: message.text,
			excerpt: message.text.length > 110 ? `${message.text.slice(0, 107)}…` : message.text
		})),
		shouldAddressIndividually: grouped.length > 1
	};
}

export function buildAgentContextPayload(params: {
	messages: ContextMessage[];
	triggerMessageId: Id<'messages'>;
	replyTargetId?: Id<'messages'>;
}): AgentContextPayload {
	const ordered = [...params.messages].sort((a, b) => a.timestamp - b.timestamp);
	const recent = ordered.slice(-contextWindowConfig.recentMessageLimit);
	const replyContext: ContextMessage[] = [];

	if (params.replyTargetId) {
		const targetIndex = ordered.findIndex((message) => message._id === params.replyTargetId);
		if (targetIndex >= 0) {
			const start = Math.max(0, targetIndex - contextWindowConfig.replySurroundingLimit);
			const end = Math.min(
				ordered.length,
				targetIndex + contextWindowConfig.replySurroundingLimit + 1
			);
			replyContext.push(...ordered.slice(start, end));
		}
	}

	const recentMessageIds = recent.map((message) => message._id);
	const replyContextMessageIds = replyContext.map((message) => message._id);
	const consecutiveUserMessageIds = findConsecutiveUserMessageIds(ordered);

	return {
		triggerMessageId: params.triggerMessageId,
		replyTargetId: params.replyTargetId,
		messageIds: uniqueIds([
			...replyContextMessageIds,
			...recentMessageIds,
			params.triggerMessageId
		]),
		recentMessageIds,
		replyContextMessageIds,
		consecutiveUserMessageIds
	};
}
