import test from 'node:test';
import assert from 'node:assert/strict';
import {
	buildAgentContextPayload,
	contextWindowConfig,
	findConsecutiveUserMessageIds,
	type ContextMessage
} from './chatContext.ts';
import type { Id } from './_generated/dataModel';

function id(value: string) {
	return value as Id<'messages'>;
}

function message(index: number, role: ContextMessage['role'] = 'assistant'): ContextMessage {
	return {
		_id: id(`m${index}`),
		role,
		text: `Message ${index}`,
		timestamp: index,
		replyingToMessage: undefined
	};
}

test('normal send includes trigger and fixed recent message window', () => {
	const messages = Array.from({ length: 14 }, (_, index) => message(index + 1));
	const triggerMessageId = id('m14');
	const payload = buildAgentContextPayload({ messages, triggerMessageId });

	assert.deepEqual(
		payload.recentMessageIds,
		messages.slice(-contextWindowConfig.recentMessageLimit).map((item) => item._id)
	);
	assert.equal(payload.messageIds.includes(triggerMessageId), true);
	assert.equal(payload.replyContextMessageIds.length, 0);
	assert.equal(payload.messageIds.includes(id('m1')), false);
});

test('reply send includes reply target surroundings plus bounded recent context', () => {
	const messages = Array.from({ length: 20 }, (_, index) => message(index + 1));
	const triggerMessageId = id('m20');
	const replyTargetId = id('m5');
	const payload = buildAgentContextPayload({ messages, triggerMessageId, replyTargetId });

	assert.deepEqual(payload.replyContextMessageIds, [
		id('m3'),
		id('m4'),
		id('m5'),
		id('m6'),
		id('m7')
	]);
	assert.equal(payload.messageIds.includes(replyTargetId), true);
	assert.equal(payload.messageIds.includes(triggerMessageId), true);
	assert.deepEqual(
		payload.recentMessageIds,
		messages.slice(-contextWindowConfig.recentMessageLimit).map((item) => item._id)
	);
});

test('context payload excludes full history by default when older messages exist', () => {
	const messages = Array.from({ length: 30 }, (_, index) => message(index + 1));
	const payload = buildAgentContextPayload({ messages, triggerMessageId: id('m30') });

	assert.equal(payload.messageIds.length, contextWindowConfig.recentMessageLimit);
	assert.equal(payload.messageIds.includes(id('m1')), false);
	assert.equal(payload.messageIds.includes(id('m30')), true);
});

test('consecutive user grouping identifies latest bounded user run without changing order', () => {
	const messages = [
		message(1, 'assistant'),
		message(2, 'user'),
		message(3, 'user'),
		message(4, 'user'),
		message(5, 'user'),
		message(6, 'user')
	];

	assert.deepEqual(findConsecutiveUserMessageIds(messages), [
		id('m3'),
		id('m4'),
		id('m5'),
		id('m6')
	]);
});
