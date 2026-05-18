<script lang="ts">
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '../convex/_generated/api.js';

	const query = useQuery(api.tasks.health, {});
</script>

<h1>Information Society</h1>
<p>Convex schema foundation is installed and ready for the MVP data model.</p>
<p><a href={resolve('/chat')}>Open the agent chat workspace</a></p>
<p><a href={resolve('/network')}>Open the network Rolodex</a></p>

{#if query.isLoading}
	Loading...
{:else if query.error}
	failed to load: {query.error.toString()}
{:else}
	<p>Backend status: {query.data.status}</p>
{/if}
