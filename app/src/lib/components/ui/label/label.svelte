<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any */
	import { cn } from '$lib/utils.js';
	let { class: className, children, ref = $bindable(null), ...restProps }: any = $props();
</script>

<label bind:this={ref} class={cn(className)} {...restProps}>
	{@render children?.()}
</label>
