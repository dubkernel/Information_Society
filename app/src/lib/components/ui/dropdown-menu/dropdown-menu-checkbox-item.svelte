<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any */
	import { cn } from '$lib/utils.js';
	let { class: className, children, child, ref = $bindable(null), ...restProps }: any = $props();
</script>

{#if child}
	{@render child({ props: restProps })}
{:else}
	<button
		bind:this={ref}
		type="button"
		class={cn(
			'rounded-md px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
			className
		)}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
