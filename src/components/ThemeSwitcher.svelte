<script>
	import { onMount } from "svelte";

	const lightMode = "light";
	const darkMode = "dark";

	let currentTheme;
	let buttonText;

	onMount(() => {
		initializeColorTheme();
	})

	function initializeColorTheme() {
		const storedTheme = getStoredTheme();

		if (storedTheme) {
			currentTheme = storedTheme;
		} else {
			currentTheme = getSystemTheme();
		}


		buttonText = getThemeText(currentTheme);

		setCssVars(currentTheme);
		rotateImage(currentTheme);
		watchSystemTheme();
	}

	function setCssVars(colorTheme) {
		const root = document.documentElement;

		const attributesToChange = [
			"chat-background-color",
			"border-color",
			"border-off-color",
			"nav-color",
			"nav-off-color",
			"translucent-nav-color",
			"text-primary-color",
			"text-secondary-color",
			"ai-message-background-color",
			"user-message-background-color",
			"box-shadow-color",
			"link-color",
			"link-visited-color",
		]

		if (colorTheme === lightMode) {
			attributesToChange.forEach(attr => {
				const attrToChange = "--" + attr;
				const colorChange = `var(--light-${attr})`;
				root.style.setProperty(attrToChange, colorChange);
			});

		} else if (colorTheme === darkMode) {
			attributesToChange.forEach(attr => {
				const attrToChange = "--" + attr;
				const colorChange = `var(--dark-${attr})`;
				root.style.setProperty(attrToChange, colorChange);
			});
		}
	}

	function toggleTheme(colorTheme) {
		if (colorTheme === lightMode) {
			return darkMode;
		} else if (colorTheme === darkMode) {
			return lightMode;
		}

		return null;
	}

	function getThemeText(colorTheme) {

		if (colorTheme === lightMode) {
			return "Dark Mode";
		} else if (colorTheme === darkMode) {
			return "Light Mode";
		}

		return null;
	}

	function storeTheme(colorTheme) {
		localStorage.setItem("theme", colorTheme);
	}

	function getStoredTheme() {
		const storedTheme = localStorage.getItem("theme");
		if (storedTheme) {
			return storedTheme;
		} else {
			return null;
		}
	}

	function rotateImage(colorTheme) {
		const indicatorImage = document.getElementById("indicator-image");

		if (colorTheme === lightMode) {
			indicatorImage.style.transform = 'rotate(180deg)';
		} else if (colorTheme === darkMode) {
			indicatorImage.style.transform = 'rotate(0deg)';
		}
	}

	function getSystemTheme() {
		if (window.matchMedia) {
			if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
				// dark
				return darkMode;
			} else {
				// light
				return lightMode;
			}
		} else {
			// default light
			return lightMode;
		}
	}

	function watchSystemTheme() {
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
			const updatedSystemTheme = event.matches ? darkMode : lightMode;
			changeTheme(updatedSystemTheme);
		});
	}

	function changeTheme(colorTheme) {
		currentTheme = colorTheme;
		storeTheme(colorTheme);
		setCssVars(colorTheme);
		rotateImage(colorTheme);
		buttonText = getThemeText(colorTheme);
	}

	function handleChangeTheme() {
		const newTheme = toggleTheme(currentTheme);
		changeTheme(newTheme);
	}
</script>

<button class="w-full h-full p-1 flex justify-between items-center focus:outline-none" on:click={handleChangeTheme}>
	<p>{buttonText}</p>
	<img class="indicator" id="indicator-image" src="theme-indicator.svg" alt="Theme Indicator"/>
</button>

<style>
  button:focus-visible {
    outline: 5px auto -webkit-focus-ring-color; 
  }

	.indicator {
		height: 15px;
		width: 15px;
		transition: transform 0.3s ease;
	}

	#indicator-image {
		transform: rotate(180deg);
	}
</style>
