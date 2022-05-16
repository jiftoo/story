<script>
	import {onDestroy, onMount} from "svelte";

	export let connectionError;

	let ellipsis = "|";
	let charNum = 0;
	let timer = null;
	onMount(() => {
		setInterval(() => {
			const characters = "|/-\\";
			charNum = (charNum + 1) % characters.length;
			ellipsis = characters[charNum];
		}, 100);
	});
	onDestroy(() => {
		clearInterval(timer);
	});
</script>

{#if connectionError}
	<div>{connectionError}</div>
{:else}
	<div>
		Connecting
		<tt>{ellipsis}</tt>
	</div>
{/if}
