<script>
	export let chatName;

	function getMessages() {
		const deepChatRef = document.getElementById("chat-element");
		const messages = deepChatRef.getMessages();

		return messages;
	}

	function findReplaceRegEx(string, regex, replacement) {

		if (!string) {
			return string;
		}

		const matches = (string.match(regex) || [])

		matches.forEach(match => {
			string = string.replace(match, replacement)
		})

		return string
	}

	function getMessageAsMarkdown(author, text, files) {
		const msgFileLinkRegEx = /\]\(data:[\S]+\)/igm;
		text = findReplaceRegEx(text, msgFileLinkRegEx, '](Removed file source because it exceeded limit.)')

		if (!files || files.length < 1) {
			return `## ${author}\n ${text}\n\n`
		}

		let fileContent = ""
		files.forEach(file => {
			if (file.src && file.src.length > 200) {
				file.src = "Removed file source because it exceeded limit."
			}

			if (file.type === "image") {
				if (file.name) {
					fileContent += `[${file.name}](${file.src})`;
				} else {
					fileContent += `[image](${file.src})`;
				}

			} else if (file.name){
				fileContent += `[${file.name}]`;

			} else {
				fileContent += "[Unidentified file]";
			}
		});

		if (text) {
			return `## ${author}\n ${text}\n ${fileContent}\n\n`
		} else {
			return `## ${author}\n ${fileContent}\n\n`
		}

	}

	function getMarkdownContent() {
		let markdownContent = `# ${chatName}\n`

		let messages = getMessages();

		messages.forEach((message) => {
			const author = message.role
			const text = message.text
			const files = message.files
			const messageMarkdown = getMessageAsMarkdown(author, text, files);

			markdownContent += messageMarkdown
		})

		return markdownContent;
	}

	function exportAsMarkdown(){
		const markdownContent = getMarkdownContent();

		const blob = new Blob([markdownContent], { type: 'text/markdown' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.download = `${chatName}.md`
		a.href = url
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	}


	function handleExport() {
		exportAsMarkdown();
	}

</script>

<button class="w-full h-full p-1 flex justify-between items-center focus:outline-none" on:click={handleExport}>
	<p>Export to Markdown</p>
</button>

<style>
	button:focus-visible {
		outline: 5px auto -webkit-focus-ring-color; 
	}
</style>
