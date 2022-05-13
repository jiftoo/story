<script>
	// const BACKEND_URL = "https://www.jiftoo.dev/story/api/";
	const BACKEND_URL = "http://localhost/";

	let userInput = "Your piece of the story!";
	let wordsAfterLimit = -1;
	const handleInput = (ev) => {
		const filteredInput = ev.target.value.replaceAll(/[^A-Za-z0-9.,!?"\- ]/g, "");
		if (userInput.length >= maxCharacters && wordsAfterLimit === -1) {
			wordsAfterLimit = userInput.split(" ").length;
		}
		if (userInput.length < maxCharacters) {
			wordsAfterLimit = -1;
		}

		if (wordsAfterLimit === -1) {
			userInput = filteredInput;
		} else if (filteredInput.split(" ").length >= wordsAfterLimit) {
			console.log(123);
			const filteredWordLimitedInput = filteredInput.split(" ").slice(0, wordsAfterLimit).join(" ");
			userInput = filteredWordLimitedInput.substr(0, maxCharactersStretch);
		}
	};

	const maxCharacters = 180;
	const maxCharactersStretch = 195;

	$: counterColor = userInput.length === maxCharactersStretch ? "red" : "unset";
	$: vibrate = userInput.length > maxCharacters ? "vibrate" : "";

	const fetchPreviousEpisodes = async () => {
		return await fetch(BACKEND_URL + "get", {
			method: "GET",
			cache: "no-cache",
		}).then((r) => r.json());
	};

    const submitEpisode = async () => {
        
    }
</script>

<main>
	<center>
		<h1>Storytelling experiment</h1>
		<p>TODO: add description</p>
		<br />
		<form>
			<blockquote>
				{#await fetchPreviousEpisodes() then episodeArray}
					{#each episodeArray as episode}
						<cite>{episode}</cite>
					{/each}
				{/await}
				<div>
					<textarea type="text" bind:value={userInput} on:input={handleInput} />
					<div id="submit-region">
						<div id="counter" style="color: {counterColor}; animation-name: {vibrate}">{userInput.length} / {maxCharacters}</div>
						<input type="submit" value="Submit!" />
					</div>
				</div>
			</blockquote>
		</form>
	</center>
</main>

<style>
	* {
		font-family: "Open Sans";
		box-sizing: border-box;
	}
	blockquote {
		background-color: whitesmoke;

		--padding: 24px;
		padding: var(--padding);

		max-width: 50%;
		text-align: left;
	}
	blockquote *:not(:first-child) {
		margin-top: var(--padding);
		font-size: 16px;
		display: block;
	}
	textarea {
		resize: none;
		border: none;
		background-color: inherit;
		background-color: gainsboro;
		font-family: "Open Sans";
		width: fit-content;

		width: 100%;

		--pad: 8px;
		padding: var(--pad);

		--lh: 1.25;
		line-height: var(--lh);
		height: calc(var(--lh) * 3rem + var(--pad) * 2);
	}
	cite {
		max-width: 100%;
		border-left: 8px solid gainsboro;
		padding-left: 8px;
	}
	#submit-region * {
		display: inline-block;
		margin-top: 0;
	}
	#submit-region input {
		float: right;
	}
	#counter {
		animation-duration: 100ms;
		animation-iteration-count: infinite;
	}
	@keyframes -global-vibrate {
		25% {
			transform: translate(0.7px, 0.7px);
		}
		50% {
			transform: translate(-0.7px, 0.7px);
		}
		75% {
			transform: translate(0.7px, -0.7px);
		}
		100% {
			transform: translate(-0.7px, -0.7px);
		}
	}
</style>
