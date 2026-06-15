// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ---------------------------------------------------------------------------
  // Core users
  // ---------------------------------------------------------------------------
  users: defineTable({
    authId: v.string(),              // external auth provider ID
    name: v.string(),
    email: v.string(),
    timeZone: v.optional(v.string()),
    createdAt: v.number(),           // Date.now()
  }).index("byAuthId", ["authId"]),

  // ---------------------------------------------------------------------------
  // People in a user's network
  // ---------------------------------------------------------------------------
  people: defineTable({
    userId: v.id("users"),
    fullName: v.string(),
    primaryEmail: v.optional(v.string()),
    headline: v.optional(v.string()), // current role summary
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserName", ["userId", "fullName"]),

  // ---------------------------------------------------------------------------
  // Organizations (companies, teams, etc.)
  // ---------------------------------------------------------------------------
  organizations: defineTable({
    userId: v.id("users"),
    name: v.string(),
    domain: v.optional(v.string()),  // e.g. "company.com"
    type: v.optional(v.string()),    // company, non-profit, university, etc.
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserName", ["userId", "name"]),

  // ---------------------------------------------------------------------------
  // Employment / memberships (person <-> organization)
  // ---------------------------------------------------------------------------
  memberships: defineTable({
    userId: v.id("users"),
    personId: v.id("people"),
    organizationId: v.id("organizations"),
    roleTitle: v.optional(v.string()),
    startDate: v.optional(v.number()), // timestamp
    endDate: v.optional(v.number()),   // null/undefined = current
    isCurrent: v.boolean(),
    source: v.optional(v.string()),    // manual, import_linkedin, etc.
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUserPerson", ["userId", "personId"])
    .index("byUserOrg", ["userId", "organizationId"])
    .index("byUserOrgCurrent", ["userId", "organizationId", "isCurrent"]),

  // ---------------------------------------------------------------------------
  // Connections (person <-> person edges)
  // ---------------------------------------------------------------------------
  connections: defineTable({
    userId: v.id("users"),
    personAId: v.id("people"),
    personBId: v.id("people"),
    // store an undirected edge with normalized ordering (enforced in code)
    strength: v.optional(v.number()),   // e.g. 0–1 or 0–100
    direction: v.optional(v.string()),  // "mutual" | "userToPerson" | ...
    lastEventAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    // find all connections around a person
    .index("byUserPersonA", ["userId", "personAId"])
    .index("byUserPersonB", ["userId", "personBId"])
    // quickly get a specific edge between two people
    .index("byUserPersons", ["userId", "personAId", "personBId"]),

  // ---------------------------------------------------------------------------
  // Events (meetings, emails, compliments, shares, etc.)
  // ---------------------------------------------------------------------------
  events: defineTable({
    userId: v.id("users"),

    // graph context
    actorPersonId: v.id("people"),       // usually "me" or my persona
    targetPersonId: v.id("people"),
    connectionId: v.optional(v.id("connections")),
    organizationId: v.optional(v.id("organizations")),

    // event content
    type: v.string(),                    // "meeting_coffee", "email_sent", ...
    medium: v.optional(v.string()),      // "in_person", "email", "social", ...
    timestamp: v.number(),
    summary: v.optional(v.string()),
    metadata: v.optional(v.any()),       // { emailId, location, topicTags, ... }

    createdAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserTarget", ["userId", "targetPersonId"])
    .index("byUserConnection", ["userId", "connectionId"])
    .index("byUserTime", ["userId", "timestamp"]),

  // ---------------------------------------------------------------------------
  // AI chat: conversation sessions + messages
  // ---------------------------------------------------------------------------
  conversationSessions: defineTable({
    userId: v.id("users"),
    title: v.optional(v.string()),
    createdAt: v.number(),
    lastMessageAt: v.number(),
  })
    .index("byUser", ["userId"])
    .index("byUserLastMessage", ["userId", "lastMessageAt"]),

  messages: defineTable({
    userId: v.id("users"),
    sessionId: v.id("conversationSessions"),
    role: v.string(),                 // "user" | "assistant" | "system"
    text: v.string(),
    // optional linkage to people/events if the message references them
    relatedPersonId: v.optional(v.id("people")),
    relatedEventId: v.optional(v.id("events")),

    timestamp: v.number(),
  })
    .index("bySession", ["sessionId", "timestamp"])
    .index("byUserSession", ["userId", "sessionId", "timestamp"]),
});
