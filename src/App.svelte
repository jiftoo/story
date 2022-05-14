<script>
	import {onDestroy, onMount} from "svelte";

	// const BACKEND_URL = "ws://www.jiftoo.dev/story/ws";
	const BACKEND_URL = "ws://192.168.0.154";

	let userInput = "";
	let wordsAfterLimit = -1;
	const handleInput = (ev) => {
		const filteredInput = ev.target.value.replaceAll(/[^A-Za-z0-9.,!?":\- ]/g, "");
		if (userInput.length >= maxCharacters && wordsAfterLimit === -1) {
			wordsAfterLimit = userInput.split(" ").length;
		}
		if (userInput.length < maxCharacters) {
			wordsAfterLimit = -1;
		}

		if (wordsAfterLimit === -1) {
			userInput = filteredInput;
		} else if (filteredInput.split(" ").length >= wordsAfterLimit) {
			const filteredWordLimitedInput = filteredInput.split(" ").slice(0, wordsAfterLimit).join(" ");
			userInput = filteredWordLimitedInput.substr(0, maxCharactersStretch);
		}
	};

	const maxCharacters = 180;
	const maxCharactersStretch = 195;

	$: counterColor = userInput.length === maxCharactersStretch ? "red" : "unset";
	$: vibrate = userInput.length > maxCharacters ? "vibrate" : "";

	let episodeArray = [];
	let isBooked = false;
	let bookedForMe = false;
	let bookedFor = null;

	let bookedUntilTimer = null;
	let bookId = localStorage.getItem("st-bookid");
	console.log("bookId", bookId);

	let isGibberish = false;

	let ws = null;
	const connect = () => {
		ws = new WebSocket(BACKEND_URL);
		ws.addEventListener("message", (ev) => {
			const msg = JSON.parse(ev.data);
			switch (msg.type) {
				case "update":
					episodeArray = msg.data.episodes;
					isBooked = msg.isBooked;
                    bookedForMe = msg.data.bookedForMe;
					bookedFor = msg.data.bookedFor;
					clearInterval(bookedUntilTimer);
					if (bookedFor > 0) {
						bookedUntilTimer = setInterval(() => {
							bookedFor -= 1000;
						}, 1000);
					}
					break;
				case "bookSuccess":
					isBooked = true;
					bookedForMe = true;
					bookId = msg.data;
					localStorage.setItem("st-bookid", bookId);
					console.log("you booked", bookId);
					break;
				case "booked":
					isBooked = true;
					bookedFor = msg.data.bookedFor;
					localStorage.setItem("st-booked-for", bookedFor.toString());
					console.log("someone booked for", bookedFor);
					bookedUntilTimer = setInterval(() => {
						bookedFor -= 1000;
					}, 1000);
					break;
				case "unbooked":
					isBooked = false;
					bookId = null;
					bookedFor = 0;
					clearInterval(bookedUntilTimer);
					localStorage.setItem("st-booked-for", bookedFor.toString());
					localStorage.setItem("st-bookid", "false");
					console.log("unbooked");
					break;
				case "error":
					isGibberish = msg.data === "gibberish";
					console.error(msg.data);
					break;
			}
		});
		ws.addEventListener("open", () => {
			ws.send(JSON.stringify({type: "get", bookId}));
		});
		ws.addEventListener("error", () => {
			setTimeout(connect, 2500);
		});
	};
	onMount(connect);

	onDestroy(() => {
		ws?.close();
		clearInterval(bookedUntilTimer);
	});

	const handleSubmit = () => {
		isGibberish = false;
		ws.send(JSON.stringify({type: "submit", bookId, data: userInput}));
	};

	let showBookDialog = false;

	const handleBook = () => {
		showBookDialog = false;
		ws.send(JSON.stringify({type: "book", bookId}));
	};
</script>

<main>
	<dialog open={showBookDialog}>
		<p>Booking allows you to prevent other users from submitting their episodes for a short period of time.</p>
		<center>
			<button on:click={handleBook}>Book!</button>
			<span>&nbsp;</span>
			<button on:click={() => (showBookDialog = false)}>Cancel</button>
		</center>
	</dialog>
	<center>
		<h1>Storytelling experiment</h1>
		<p>TODO: add description</p>
		<br />
		<blockquote>
			{#each episodeArray as episode}
				<cite>{episode}</cite>
			{/each}
			<div>
				<textarea placeholder="Your piece of the story!" type="text" bind:value={userInput} on:input={handleInput} />
				{#if isGibberish}
					<div>Submitted string is likely gibberish.</div>
				{/if}
				<div id="submit-region">
					<div id="counter" style="color: {counterColor}; animation-name: {vibrate}">{userInput.length} / {maxCharacters}</div>
					<button type="submit" disabled={isBooked && !bookedForMe} on:click={handleSubmit}>Submit!</button>
					<button disabled={isBooked} on:click={() => (showBookDialog = true)}>Book</button>
					{#if isBooked}
						<div style="float: right">
							Booked for: {((time) => {
								return `${Math.floor(time / 1000 / 60)}  minutes ${Math.floor((time / 1000) % 60)} seconds`;
							})(bookedFor)}
						</div>
					{/if}
				</div>
			</div>
		</blockquote>
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

		margin-bottom: 150px;
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
		display: block;
		max-width: 100%;
		border-left: 8px solid gainsboro;
		padding-left: 8px;
	}
	#submit-region * {
		display: inline-block;
		margin-top: 0;
	}
	#submit-region button {
		float: right;
		margin-left: 8px;
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
	dialog {
		position: fixed;
		top: 40%;
		border: 1px solid rgb(32, 32, 32);
	}
</style>
