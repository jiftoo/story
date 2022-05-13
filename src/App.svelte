<script>
	let line1 = "Lorem ipsum dolor sit amet con sectetur adipisicing elit. Maiores nihil facilis dolores ipsam blanditiis dicta.";
	let line2 = "Dolorem repellendus impedit aliquam!";

	let userInput = "Your piece of the story!";
	const handleInput = (ev) => {
		userInput = ev.target.value.replaceAll(/[^A-Za-z0-9.,!?"\- ]/g, "");
	};

	const maxCharacters = 180;
	$: counterColor = userInput.length >= maxCharacters - 10 ? "red" : "unset";
</script>

<main>
	<center>
		<h1>Storytelling experiment</h1>
		<p>TODO: add description</p>
		<br />
		<form>
			<blockquote>
				<cite>{line2}</cite>
				<cite>{line1}</cite>
				<div>
					<textarea type="text" bind:value={userInput} on:input={handleInput} />
					<div id="submit-region">
						<div style="color: {counterColor}">{userInput.length} / {maxCharacters}</div>
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
		border: none;
		background-color: inherit;
		filter: brightness(98%);
		font-family: "Open Sans";
		width: fit-content;

		width: 100%;

		--lh: 1.25;
		line-height: var(--lh);
		height: calc(var(--lh) * 3rem);
	}
	cite,
	textarea {
		resize: none;
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
</style>
