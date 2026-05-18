<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any */
	import { cn } from '$lib/utils.js';
	let { class: className, children, child, ref = $bindable(null), ...restProps }: any = $props();
</script>

{#if child}
	{@render child({ props: restProps })}
{:else}
	<div bind:this={ref} class={cn(className)} {...restProps}>
		{@render children?.()}
	</div>
{/if}
