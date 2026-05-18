<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';

	export type NetworkRecordDraft = {
		id: string;
		kind: 'person' | 'organization';
		name: string;
		workplace?: string;
		role?: string;
		lastReachedOut?: string;
		email?: string;
		location?: string;
		type?: string;
		notes: string;
		lastEvent?: string;
	};

	let {
		draft = $bindable(),
		oncancel,
		onsave
	}: {
		draft: NetworkRecordDraft;
		oncancel: () => void;
		onsave: () => void;
	} = $props();
</script>

<Field.Group class="network-record-form">
	<Field.Field class="wide title-field">
		<Field.Label for={`network-name-${draft.id}`}>Name</Field.Label>
		<Input id={`network-name-${draft.id}`} bind:value={draft.name} class="title-input" />
	</Field.Field>

	{#if draft.kind === 'person'}
		<Field.Field>
			<Field.Label for={`network-workplace-${draft.id}`}>Where they work</Field.Label>
			<Input id={`network-workplace-${draft.id}`} bind:value={draft.workplace} />
		</Field.Field>
		<Field.Field>
			<Field.Label for={`network-role-${draft.id}`}>Role</Field.Label>
			<Input id={`network-role-${draft.id}`} bind:value={draft.role} />
		</Field.Field>
		<Field.Field>
			<Field.Label for={`network-last-reached-${draft.id}`}>Last reached out</Field.Label>
			<Input
				id={`network-last-reached-${draft.id}`}
				type="date"
				bind:value={draft.lastReachedOut}
			/>
		</Field.Field>
		<Field.Field>
			<Field.Label for={`network-email-${draft.id}`}>Email</Field.Label>
			<Input id={`network-email-${draft.id}`} bind:value={draft.email} />
		</Field.Field>
	{:else}
		<Field.Field>
			<Field.Label for={`network-type-${draft.id}`}>Institution type</Field.Label>
			<Input id={`network-type-${draft.id}`} bind:value={draft.type} />
		</Field.Field>
		<Field.Field>
			<Field.Label for={`network-location-${draft.id}`}>Location</Field.Label>
			<Input id={`network-location-${draft.id}`} bind:value={draft.location} />
		</Field.Field>
		<Field.Field>
			<Field.Label for={`network-last-event-${draft.id}`}>Last event</Field.Label>
			<Input id={`network-last-event-${draft.id}`} bind:value={draft.lastEvent} />
		</Field.Field>
	{/if}

	<Field.Field class="wide">
		<Field.Label for={`network-notes-${draft.id}`}>Notes</Field.Label>
		<Textarea id={`network-notes-${draft.id}`} bind:value={draft.notes} />
	</Field.Field>

	<ButtonGroup.Root class="wide justify-end">
		<Button variant="outline" onclick={oncancel}>Cancel</Button>
		<Button onclick={onsave}>Save changes</Button>
	</ButtonGroup.Root>
</Field.Group>

<style>
	:global(.network-record-form) {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 1.35rem;
	}

	:global(.network-record-form [data-slot='field']) {
		gap: 0.42rem;
		border: 1px solid var(--line);
		border-radius: 0.9rem;
		background: var(--surface-soft);
		padding: 0.85rem;
	}

	:global(.network-record-form [data-slot='field-label']) {
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	:global(.network-record-form .wide) {
		grid-column: 1 / -1;
	}

	:global(.network-record-form .title-field) {
		border: 0;
		background: transparent;
		padding: 0;
	}

	:global(.network-record-form .title-input) {
		height: auto;
		border: 0;
		background: transparent;
		padding: 0;
		font-size: clamp(2rem, 5vw, 4.2rem);
		font-weight: 800;
		line-height: 0.92;
		letter-spacing: -0.055em;
	}

	:global(.network-record-form textarea) {
		min-height: 110px;
		resize: vertical;
	}

	@media (max-width: 760px) {
		:global(.network-record-form) {
			grid-template-columns: 1fr;
		}
	}
</style>
