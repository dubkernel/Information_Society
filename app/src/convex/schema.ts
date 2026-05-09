import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const provider = v.union(
	v.literal('openai'),
	v.literal('openrouter'),
	v.literal('anthropic'),
	v.literal('app')
);

const ingestionStatus = v.union(
	v.literal('pending'),
	v.literal('processing'),
	v.literal('needs_review'),
	v.literal('merged'),
	v.literal('failed'),
	v.literal('discarded')
);

export default defineSchema({
	// ---------------------------------------------------------------------------
	// Core users (external auth provider identity + app profile metadata)
	// ---------------------------------------------------------------------------
	users: defineTable({
		authId: v.string(),
		name: v.string(),
		email: v.string(),
		timeZone: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.optional(v.number())
	}).index('byAuthId', ['authId']),

	// ---------------------------------------------------------------------------
	// People in a user's network
	// ---------------------------------------------------------------------------
	people: defineTable({
		userId: v.id('users'),
		fullName: v.string(),
		primaryEmail: v.optional(v.string()),
		headline: v.optional(v.string()),
		linkedInUrl: v.optional(v.string()),
		notes: v.optional(v.string()),
		source: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number()
	})
		.index('byUser', ['userId'])
		.index('byUserName', ['userId', 'fullName']),

	// ---------------------------------------------------------------------------
	// Organizations (companies, teams, schools, communities, etc.)
	// ---------------------------------------------------------------------------
	organizations: defineTable({
		userId: v.id('users'),
		name: v.string(),
		domain: v.optional(v.string()),
		type: v.optional(v.string()),
		industry: v.optional(v.string()),
		location: v.optional(v.string()),
		websiteUrl: v.optional(v.string()),
		linkedInUrl: v.optional(v.string()),
		notes: v.optional(v.string()),
		source: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number()
	})
		.index('byUser', ['userId'])
		.index('byUserName', ['userId', 'name'])
		.index('byUserDomain', ['userId', 'domain']),

	// ---------------------------------------------------------------------------
	// Employment / memberships (person <-> organization)
	// ---------------------------------------------------------------------------
	memberships: defineTable({
		userId: v.id('users'),
		personId: v.id('people'),
		organizationId: v.id('organizations'),
		roleTitle: v.optional(v.string()),
		department: v.optional(v.string()),
		startDate: v.optional(v.number()),
		endDate: v.optional(v.number()),
		isCurrent: v.boolean(),
		source: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number()
	})
		.index('byUserPerson', ['userId', 'personId'])
		.index('byUserOrg', ['userId', 'organizationId'])
		.index('byUserOrgCurrent', ['userId', 'organizationId', 'isCurrent']),

	// ---------------------------------------------------------------------------
	// Connections (person <-> person edges)
	// ---------------------------------------------------------------------------
	connections: defineTable({
		userId: v.id('users'),
		personAId: v.id('people'),
		personBId: v.id('people'),
		strength: v.optional(v.number()),
		direction: v.optional(v.string()),
		lastEventAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number()
	})
		.index('byUserPersonA', ['userId', 'personAId'])
		.index('byUserPersonB', ['userId', 'personBId'])
		.index('byUserPersons', ['userId', 'personAId', 'personBId']),

	// ---------------------------------------------------------------------------
	// Events (meetings, emails, compliments, shares, etc.)
	// ---------------------------------------------------------------------------
	events: defineTable({
		userId: v.id('users'),
		actorPersonId: v.id('people'),
		targetPersonId: v.id('people'),
		connectionId: v.optional(v.id('connections')),
		organizationId: v.optional(v.id('organizations')),
		type: v.string(),
		medium: v.optional(v.string()),
		timestamp: v.number(),
		summary: v.optional(v.string()),
		metadata: v.optional(v.any()),
		createdAt: v.number()
	})
		.index('byUser', ['userId'])
		.index('byUserTarget', ['userId', 'targetPersonId'])
		.index('byUserConnection', ['userId', 'connectionId'])
		.index('byUserTime', ['userId', 'timestamp']),

	// ---------------------------------------------------------------------------
	// AI chat: conversation sessions + messages
	// ---------------------------------------------------------------------------
	conversationSessions: defineTable({
		userId: v.id('users'),
		title: v.optional(v.string()),
		provider: v.optional(provider),
		model: v.optional(v.string()),
		createdAt: v.number(),
		lastMessageAt: v.number()
	})
		.index('byUser', ['userId'])
		.index('byUserLastMessage', ['userId', 'lastMessageAt']),

	messages: defineTable({
		userId: v.id('users'),
		sessionId: v.id('conversationSessions'),
		role: v.union(
			v.literal('user'),
			v.literal('assistant'),
			v.literal('system'),
			v.literal('tool')
		),
		text: v.string(),
		provider: v.optional(provider),
		model: v.optional(v.string()),
		status: v.optional(v.union(v.literal('pending'), v.literal('complete'), v.literal('failed'))),
		error: v.optional(v.string()),
		relatedPersonId: v.optional(v.id('people')),
		relatedEventId: v.optional(v.id('events')),
		timestamp: v.number()
	})
		.index('bySession', ['sessionId', 'timestamp'])
		.index('byUserSession', ['userId', 'sessionId', 'timestamp']),

	// ---------------------------------------------------------------------------
	// BYO/provider settings. encryptedKeyCiphertext must contain encrypted key
	// material only; browser queries should return redacted metadata instead.
	// ---------------------------------------------------------------------------
	apiKeys: defineTable({
		userId: v.id('users'),
		provider,
		label: v.optional(v.string()),
		encryptedKeyCiphertext: v.string(),
		keyLastFour: v.optional(v.string()),
		isActive: v.boolean(),
		validationStatus: v.union(v.literal('unchecked'), v.literal('valid'), v.literal('invalid')),
		validationError: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
		lastUsedAt: v.optional(v.number())
	})
		.index('byUser', ['userId'])
		.index('byUserProvider', ['userId', 'provider']),

	providerPreferences: defineTable({
		userId: v.id('users'),
		mode: v.union(v.literal('byo'), v.literal('app_provisioned'), v.literal('disabled')),
		defaultProvider: provider,
		defaultModel: v.string(),
		allowByoKeys: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number()
	}).index('byUser', ['userId']),

	// ---------------------------------------------------------------------------
	// User interests for networking context and future agent personalization
	// ---------------------------------------------------------------------------
	interestSettings: defineTable({
		userId: v.id('users'),
		organizations: v.array(v.string()),
		fields: v.array(v.string()),
		industries: v.array(v.string()),
		roles: v.array(v.string()),
		networkingGoals: v.array(v.string()),
		notes: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number()
	}).index('byUser', ['userId']),

	// ---------------------------------------------------------------------------
	// Manual/mock LinkedIn or website ingestion results awaiting user review
	// ---------------------------------------------------------------------------
	ingestionRecords: defineTable({
		userId: v.id('users'),
		sourceType: v.union(
			v.literal('linkedin'),
			v.literal('website'),
			v.literal('manual'),
			v.literal('mock')
		),
		sourceUrl: v.optional(v.string()),
		status: ingestionStatus,
		rawPayload: v.optional(v.any()),
		cleanedExtraction: v.optional(v.any()),
		error: v.optional(v.string()),
		mergeDecision: v.optional(
			v.union(v.literal('approved'), v.literal('rejected'), v.literal('partial'))
		),
		mergedOrganizationId: v.optional(v.id('organizations')),
		mergedPersonId: v.optional(v.id('people')),
		mergedMembershipId: v.optional(v.id('memberships')),
		createdAt: v.number(),
		updatedAt: v.number(),
		reviewedAt: v.optional(v.number())
	})
		.index('byUser', ['userId'])
		.index('byUserStatus', ['userId', 'status'])
		.index('byUserCreated', ['userId', 'createdAt'])
});
