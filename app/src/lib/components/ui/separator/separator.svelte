<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any */
	import { cn } from '$lib/utils.js';
	let {
		class: className,
		ref = $bindable(null),
		orientation = 'horizontal',
		...restProps
	}: any = $props();
</script>

<div
	bind:this={ref}
	role="separator"
	aria-orientation={orientation}
	class={cn(
		'shrink-0 bg-border',
		orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full',
		className
	)}
	{...restProps}
></div>
