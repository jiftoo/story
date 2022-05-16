<script>
	import {onDestroy, onMount} from "svelte";
	import ConnectingSpinner from "./lib/ConnectingSpinner.svelte";
	import WSErrors from "./lib/WSErrors";

	const BACKEND_URL = "ws://217.15.202.178:8013/story";
	// const BACKEND_URL = "ws://192.168.0.154";
	// const BACKEND_URL = "ws://192.168.0.200";

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

	const maxCharacters = 140;
	const maxCharactersStretch = 150;

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
	let isConnected = false;
	let connectionError = null;

	let bookTimeConst = -1;

	const connect = () => {
		ws = new WebSocket(BACKEND_URL);
		ws.addEventListener("message", (ev) => {
			const msg = JSON.parse(ev.data);
			switch (msg.type) {
				case "update":
					msg.data.bookDuration && (bookTimeConst = msg.data.bookDuration);
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
				case "submitSuccess":
					userInput = "";
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
				case "bookTimeQuery":
					bookTimeConst = msg.data;
					break;
				case "adminAttempt":
					if (msg.data === true) {
						alert("admin access granted");
						adminActive = true;
					} else {
						alert("admin access denied");
					}
					break;
			}
		});
		ws.addEventListener("open", () => {
			ws.send(JSON.stringify({type: "get", bookId}));
			isConnected = true;
			connectionError = null;
		});
		ws.addEventListener("close", (err) => {
			setTimeout(connect, 2500);
			isConnected = false;

			connectionError = `Error: ${WSErrors[err.code] ?? err.code}`;
		});
	};
	onMount(connect);

	onDestroy(() => {
		ws?.close();
		ws = null;
		clearInterval(bookedUntilTimer);
	});

	const handleSubmit = () => {
		isGibberish = false;
		ws.send(JSON.stringify({type: "submit", bookId, data: userInput}));
	};

	let centerBind;
	let showBookDialog = false;
	$: centerBind && (centerBind.style.pointerEvents = showBookDialog || tryingToAccessAdmin ? "none" : null);

	const handleBook = () => {
		showBookDialog = false;
		ws.send(JSON.stringify({type: "book", bookId}));
	};

	// admin panel fuckery

	let tryingToAccessAdmin = false;
	let adminActive = false;
	let adminPassword = null;
	$: {
		tryingToAccessAdmin = userInput === `"""veeryseecreet"!""`;
		if (tryingToAccessAdmin) {
			userInput = "";
			adminPassword = prompt("Enter password");
			ws.send(JSON.stringify({type: "admin", data: adminPassword}));
			tryingToAccessAdmin = false;
		}
	}
	const handleEpisodeRemoval = (i) => {
		console.log("removed", i);
		ws.send(JSON.stringify({type: "deleteLine", data: i, pwd: adminPassword}));
	};
	const handleEpisodeEdit = (i, ev) => {
		const target = ev.currentTarget;
		target.classList.add("used");
		setTimeout(() => {
			target.classList.remove("used");
			target.innerText = "*";
		}, 1000);
		target.innerText = "✔";
		console.log("edited", i);
		const newText = ev.currentTarget.parentElement.querySelector("textarea").value;
		ws.send(JSON.stringify({type: "replaceLine", data: {i, line: newText}, pwd: adminPassword}));
	};
	const handleForceSubmit = () => {
		ws.send(JSON.stringify({type: "forceSubmit", data: userInput, pwd: adminPassword}));
	};
</script>

<main>
	<dialog open={showBookDialog}>
		<p>Booking allows you to prevent other users from submitting their episodes for a short period of time. ({bookTimeConst / 1000} seconds)</p>
		<center>
			<button on:click={handleBook}>Book!</button>
			<span>&nbsp;</span>
			<button on:click={() => (showBookDialog = false)}>Cancel</button>
		</center>
	</dialog>
	<center bind:this={centerBind}>
		<h1>Storytelling experiment</h1>
		<p>TODO: add description</p>
		<br />
		<blockquote>
			{#if !adminActive}
				{#each episodeArray as episode}
					<cite>{episode}</cite>
				{/each}
			{:else}
				{#each episodeArray as episode, i}
					<div class="admin-episode">
						<button on:click={() => handleEpisodeRemoval(i)}>x</button>
						<button on:click={(ev) => handleEpisodeEdit(i, ev)}>*</button>
						<textarea on:input={(ev) => (ev.currentTarget.value = ev.currentTarget.value.substr(0, maxCharactersStretch))}>{episode}</textarea>
					</div>
				{/each}
			{/if}
			<div>
				<textarea disabled={!isConnected && !userInput.length} placeholder="Your piece of the story!" type="text" bind:value={userInput} on:input={handleInput} />
				{#if isGibberish}
					<div>Submitted string is likely gibberish.</div>
				{/if}

				<div id="submit-region">
					{#if isConnected}
						<div id="counter" style="color: {counterColor}; animation-name: {vibrate}">{userInput.length} / {maxCharacters}</div>
						<button type="submit" disabled={isBooked && !bookedForMe} on:click={handleSubmit}>Submit!</button>
						<button disabled={isBooked} on:click={() => (showBookDialog = true)}>Book</button>
						{#if adminActive}
							<button id="force-submit-btn" type="submit" on:click={handleForceSubmit}>Force submit</button>
						{/if}
					{:else}
						<ConnectingSpinner {connectionError} />
					{/if}
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
	@media only screen and (max-width: 1150px) {
		blockquote {
			max-width: 70%;
		}
	}
	@media only screen and (max-width: 700px) {
		blockquote {
			max-width: 100%;
			margin-left: 8px;
			margin-right: 8px;
			--padding: 16px;
		}
		dialog {
			margin: 4px;
		}
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
		top: 45%;
		transform: translateY(-100%);
		border: 1px solid rgb(32, 32, 32);
	}

	.admin-episode {
		display: flex !important;
		align-items: center;
	}
	.admin-episode textarea {
		display: inline;
		margin: 4px;
	}
	.admin-episode button:nth-child(1) {
		background-color: tomato;
	}
	.admin-episode button:nth-child(2) {
		line-height: 4.9em;
		background-color: cornflowerblue;
		margin-top: 0;
		margin-left: 4px;
	}
	.admin-episode button {
		color: white;
		border: none;
		border-radius: 4px;
		height: calc(1.25 * 3rem + 1rem);
		cursor: pointer;
		width: 2.25ch !important;
	}
	:global(button.used) {
		background-color: rgb(119, 228, 11) !important;
	}
	#force-submit-btn {
		background-color: tomato;
		border: 1px solid rgb(227, 76, 49);
		border-radius: 4px;
		height: 29px;
		color: white;
		cursor: pointer;
	}
</style>
