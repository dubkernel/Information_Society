<script lang="ts">
	import { useQuery } from 'convex-svelte';
	import { api } from '../convex/_generated/api.js';

	const query = useQuery(api.tasks.health, {});
</script>

<h1>Information Society</h1>
<p>Convex schema foundation is installed and ready for the MVP data model.</p>

{#if query.isLoading}
	Loading...
{:else if query.error}
	failed to load: {query.error.toString()}
{:else}
	<p>Backend status: {query.data.status}</p>
{/if}
