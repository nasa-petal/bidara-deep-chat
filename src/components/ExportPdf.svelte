<script>
  import { jsPDF } from "jspdf";

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

  function getMessageHtmlTree(chatName, messages) {
    const contents = messages.map((message) => {
			const msgFileLinkRegEx = /\]\(data:[\S]+\)/igm;
			message.text = findReplaceRegEx(message.text, msgFileLinkRegEx, '](Removed file source because it exceeded limit.)')


      if (!message.files) {
        return {
          h2: message.role,
          p: message.text,
        }
      } else {
        const files = message.files.map(file => { 
          const src = file.src ? file.src : "no source";
          const type = file.type ? file.type : "";
          return { name: file.name, src: src, type: type } 
        })

        if (message.text) {
          return {
            h2: message.role,
            p: message.text,
            files: files
          }
        } else {
          return {
            h2: message.role,
            files: files
          }
        }
      }
    })

    const title = {
      h1: chatName,
    }

    return {
      title,
      contents
    }
  }

  function getNode(type, text) {
    const node = document.createElement(type);
    if (text) {
      const textNode = document.createTextNode(text);
      node.appendChild(textNode);
    }

    return node;
  }

  function getH1Node(text) {
    const node = getNode("h1", text);
    node.style.fontSize = "3rem";
    return node;
  }

  function getH2Node(text) {
    const node = getNode("h2", text);
    node.style.fontSize = "2rem";
    return node;
  }

  function getPNode(text) {
    const node = getNode("p", text);
    node.style.fontSize = "1rem";
    return node;
  }

  function getImgNode(src) {
    const node = getNode("img");
    node.src = src;
    node.style.maxHeight = "500px";
    return node;
  }

  function createTitleNode(title) {
    const root = getNode("div");
    root.style.display = "flex";
    root.style.justifyContent = "space-between";
    root.style.alignItems = "center";

    const titleNode = getH1Node(title.h1);
    root.appendChild(titleNode);

    const creditsNode = getPNode("Bidara by NASA PeTaL");
    root.appendChild(creditsNode);

    return root;
  }

  function htmlTreeToHtml(tree) {
    const title = tree.title;
    const contents = tree.contents;

    const root = getNode("div");
    root.style.fontSize = "32px";

    const titleNode = createTitleNode(title);
    root.appendChild(titleNode);

    const contentsNode = getNode("div");

    contents.forEach(content => {
      const contentNode = getNode("div");

      const roleNode = getH2Node(content.h2);
      contentNode.appendChild(roleNode);

      if (content.p) {
        const textNode = getPNode(content.p);
        contentNode.appendChild(textNode)
      } 

      if (content.files) {
        content.files.forEach((file) => {
          if (file.type === "image") {
            const breakNode = getNode("br");
            contentNode.appendChild(breakNode);

            const imgNode = getImgNode(file.src);
            contentNode.appendChild(imgNode);

          } else if (file.name) {
            const fileNameNode = getPNode(`(file) : [${file.name}]`);
            contentNode.appendChild(fileNameNode);

          } else {
            const fileNameNode = getPNode("(file) : [unnamed file]");
            contentNode.appendChild(fileNameNode);
          }
        })
      }

      contentsNode.appendChild(contentNode);
    })

    root.appendChild(contentsNode);

    return root;
  }

  function htmlToPdf(title, html) {
    const doc = new jsPDF('p', 'pt', 'a4')

    doc.html(html, {
      callback: function(doc) {
        doc.save(`${title}.pdf`);
      },
      margin: [20, 20, 20, 20],
      autoPaging: "text",
      x: 20,
      y: 20,
      width: 500,
      windowWidth: 675
    })
  }

  function exportAsPdf(){
    const title = chatName;
    const messages = getMessages();

    const messagesTree = getMessageHtmlTree(title, messages);

    const messagesHtml = htmlTreeToHtml(messagesTree);

    console.log(messagesHtml);
    htmlToPdf(title, messagesHtml);
  }


  function handleExport() {
    exportAsPdf();
  }

</script>

<button class="w-full h-full p-1 flex justify-between items-center focus:outline-none" on:click={handleExport}>
	<p>Export to PDF</p>
</button>

<style>
  button:focus-visible {
    outline: 5px auto -webkit-focus-ring-color; 
  }
</style>
