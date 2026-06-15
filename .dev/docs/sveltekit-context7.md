# SvelteKit Context7 Documentation Snapshot

Fetched with Context7 on 2026-05-10.

Library: `SvelteKit` / Context7 ID `/sveltejs/kit`

Query: `SvelteKit current documentation overview routing forms load server client TypeScript best practices`

## Notes for this project

- Use SvelteKit route files (`+page.svelte`, `+page.ts`, `+page.server.ts`) according to whether data can run client-side or must remain server-only.
- Use generated `$types` for route load/page props when route load functions are introduced.
- Keep returned load data serializable.
- Use Svelte 5 idioms and local project patterns; do not introduce React-style abstractions.

## Context7 excerpts

### Load Data with Client-Side and Server-Side Load Functions

Source: https://github.com/sveltejs/kit/blob/main/documentation/docs/20-core-concepts/10-routing.md

Export a `load` function from `+page.js` that runs on both server and client. The function receives route parameters and should return serializable data. Throw errors using the `error()` function for invalid states.

```javascript
/// file: src/routes/blog/[slug]/+page.js
import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageLoad} */
export function load({ params }) {
	if (params.slug === 'hello-world') {
		return {
			title: 'Hello world!',
			content: 'Welcome to our blog. Lorem ipsum dolor sit amet...'
		};
	}

	error(404, 'Not found');
}
```

### Load Data from Database with Server-Only Load Function

Source: https://github.com/sveltejs/kit/blob/main/documentation/docs/20-core-concepts/10-routing.md

Use `+page.server.js` for load functions that must run only on the server, such as database queries or accessing private environment variables. Data is automatically fetched from server during client-side navigation and must be serializable with devalue.

```javascript
/// file: src/routes/blog/[slug]/+page.server.js

// @filename: ambient.d.ts
declare global {
	const getPostFromDatabase: (slug: string) => {
		title: string;
		content: string;
	}
}

export {};

// @filename: index.js
// ---cut---
import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
	const post = await getPostFromDatabase(params.slug);

	if (post) {
		return post;
	}

	error(404, 'Not found');
}
```

### Receive Data in Page Component with Typed Props

Source: https://github.com/sveltejs/kit/blob/main/documentation/docs/20-core-concepts/10-routing.md

Pages can receive data from load functions via the `data` prop and route parameters via the `params` prop. Use Svelte 5 runes syntax with `$props()` and TypeScript type imports from `$types` for full type safety.

```svelte
<!--- file: src/routes/blog/[slug]/+page.svelte --->
<script>
	/** @type {import('./$types').PageProps} */
	let { data } = $props();
</script>

<h1>{data.title}</h1>
<div>{@html data.content}</div>
```

```svelte
<!--- file: src/routes/blog/[slug]/+page.svelte --->
<script>
	import { getPost } from '../blog.remote';

	/** @type {import('./$types').PageProps} */
	let { params } = $props();

	const post = $derived(await getPost(params.slug));
</script>

<h1>{post.title}</h1>
<div>{@html post.content}</div>
```

### Import and Use Generated PageLoad Types in SvelteKit Page Load Function

Source: https://github.com/sveltejs/kit/blob/main/documentation/docs/98-reference/54-types.md

```js
/** @type {import('./$types').PageLoad} */
export async function load({ params, fetch }) {
	// ...
}
```

### Routing > +page > +page.server.js

Source: https://github.com/sveltejs/kit/blob/main/documentation/docs/20-core-concepts/10-routing.md

If your `load` function can only run on the server — for example, if it needs to fetch data from a database or access private environment variables like API keys — you can rename `+page.js` to `+page.server.js` and change the `PageLoad` type to `PageServerLoad`. During client-side navigation, SvelteKit will load this data from the server, which means that the returned value must be serializable using devalue. Like `+page.js`, `+page.server.js` can export page options and can also export actions, allowing you to write data to the server using the `<form>` element.
