# Convex Context7 Documentation Snapshot

Fetched with Context7 on 2026-05-10.

Library: `Convex` / Context7 ID `/llmstxt/convex_dev_llms_txt`

Query: `Convex current documentation overview schema queries mutations actions indexes pagination authentication TypeScript best practices`

## Notes for this project

- Define schema with `defineSchema`, `defineTable`, and `v` validators.
- Public Convex functions must have argument validators and enforce access control for user-owned data.
- Use indexes with `.withIndex()` for frequently accessed query shapes, especially chat messages scoped by user/session/time.
- Prefer paginated or bounded queries for potentially long histories.
- Keep query/mutation/action wrappers thin and move reusable business logic into plain TypeScript helpers/model modules.

## Context7 excerpts

### Define Convex Schema with Tables and Indexes

Source: https://docs.convex.dev/database/schemas

This snippet defines a Convex schema with `messages` and `users` tables. It uses `v.id` for references and `index` for efficient querying based on `tokenIdentifier`.

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    body: v.string(),
    user: v.id("users")
  }),
  users: defineTable({
    name: v.string(),
    tokenIdentifier: v.string()
  }).index("by_token", ["tokenIdentifier"])
});
```

### Convex Query and Mutation Functions in TypeScript

Source: https://docs.convex.dev/understanding

This snippet defines a Convex query function (`getAllOpenTasks`) to read data and a mutation function (`setTaskCompleted`) to write data, demonstrating basic database interaction within server functions.

```typescript
// A Convex query function

export const getAllOpenTasks = query({
  args: {},
  handler: async (ctx, args) => {
    // Query the database to get all items that are not completed
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_completed", (q) => q.eq("completed", false))
      .collect();
    return tasks;
  }
});

// A Convex mutation function

export const setTaskCompleted = mutation({
  args: { taskId: v.id("tasks"), completed: v.boolean() },
  handler: async (ctx, { taskId, completed }) => {
    // Update the database using TypeScript
    await ctx.db.patch("tasks", taskId, { completed });
  }
});
```

### Query: Build Database Queries

Source: https://docs.convex.dev/api/interfaces/server.GenericDatabaseReader

Starts building a query for fetching multiple documents from a table. Supports chaining methods for filtering with indexes, ordering results, and pagination. Best practice is to use `.withIndex()` for efficient queries on frequently accessed fields.

```typescript
const messages = await ctx.db
  .query("messages")
  .withIndex("by_channel", (q) => q.eq("channelId", channelId))
  .order("desc")
  .take(50);
```

Best practices:

- Use `.withIndex()` instead of `.filter()` for efficient queries.
- Define indexes in your schema for fields you query frequently.
- Indexes significantly improve query performance on large datasets.

### Paginated Query with Additional Arguments in Convex

Source: https://docs.convex.dev/database/pagination

This example demonstrates how to define a paginated query function that accepts additional arguments alongside `paginationOpts`. It filters messages by author using an index.

```typescript
export const listWithExtraArg = query({
  args: { paginationOpts: paginationOptsValidator, author: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_author", (q) => q.eq("author", args.author))
      .order("desc")
      .paginate(args.paginationOpts);
  }
});
```

### Define index in Convex schema

Source: https://docs.convex.dev/database/reading-data/indexes/indexes-and-query-perf

Create an index on a table field in the schema definition. The index will be automatically maintained as documents are inserted, updated, or deleted.

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  books: defineTable({
    author: v.string(),
    title: v.string(),
    text: v.string(),
  }).index("by_author", ["author"]),
});
```
