<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { useQuery } from 'convex-svelte';
	import { api } from '../convex/_generated/api.js';

	const query = useQuery(api.tasks.health, {});
</script>

<svelte:head>
	<title>Information Society</title>
</svelte:head>

<main class="min-h-svh bg-background px-6 py-12 text-foreground sm:px-10 lg:px-16">
	<section class="mx-auto flex w-full max-w-3xl flex-col gap-8">
		<div class="space-y-4">
			<Badge variant="secondary" class="w-fit">MVP foundation</Badge>
			<div class="space-y-3">
				<h1 class="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
					Information Society
				</h1>
				<p class="max-w-2xl text-lg leading-8 text-muted-foreground">
					Convex schema foundation is installed and ready for the MVP data model.
				</p>
			</div>
		</div>

		<div class="flex flex-wrap gap-3">
			<Button href={resolve('/chat')}>Open chat workspace</Button>
			<Button href={resolve('/network')} variant="outline">Open network Rolodex</Button>
		</div>

		<Card.Root class="max-w-xl">
			<Card.Header>
				<Card.Title>Backend status</Card.Title>
				<Card.Description>Live health check from Convex.</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if query.isLoading}
					<div class="space-y-3" aria-label="Loading backend status">
						<Skeleton class="h-4 w-40" />
						<Skeleton class="h-8 w-56" />
					</div>
				{:else if query.error}
					<Alert.Root variant="destructive">
						<Alert.Title>Failed to load backend status</Alert.Title>
						<Alert.Description>{query.error.toString()}</Alert.Description>
					</Alert.Root>
				{:else}
					<div class="flex items-center justify-between gap-4">
						<p class="text-sm text-muted-foreground">Current service state</p>
						<Badge>{query.data.status}</Badge>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</section>
</main>
