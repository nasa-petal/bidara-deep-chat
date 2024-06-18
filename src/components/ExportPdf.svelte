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

  function getImagesInText(text) {
    if (!text) {
      return [];
    }

    const msgFileLinkRegEx = /\[.*\]\(data:[\S]+\)/igm;
    const matches = (text.match(msgFileLinkRegEx) || [])

    const fileNameRegex = /\[.*\]/;
    const fileSrcRegex = /\(data:[\S]+\)/igm;

    const files = matches.map((match) => {
      let name = (match.match(fileNameRegex) || [""])[0];
      let src = (match.match(fileSrcRegex) || [""])[0];
      let type = "";

      if (src.startsWith("(data:image")) {
        type = "image";
      } else {
        return {};
      }

      if (name.length > 0) {
        name = name.slice(1,-1);
      }
      if (src.length > 0) {
        src = src.slice(1,-1);
      }

      return {
        name,
        src,
        type
      }
    })

    const imageFiles = files.filter(file => file?.type === "image");

    return imageFiles;
  }

  function getMessageHtmlTree(chatName, messages) {
    const contents = messages.map((message) => {
      const filesInText = getImagesInText(message.text);

      const msgImgLinkRegEx = /\]\(data:image[\S]+\)/igm;
      const msgFileLinkRegEx = /\]\(data:[\S]+\)/igm;

      message.text = findReplaceRegEx(message.text, msgImgLinkRegEx, '](Image attached below)');
      message.text = findReplaceRegEx(message.text, msgFileLinkRegEx, '](Removed file source because it exceeded limit.)');

      const role = message.role === "ai" ? "Bidara:" : "User:";

      if (!message.files) {
        return {
          role: role,
          text: message.text,
        }
      } else {
        let files = message.files.map(file => { 
          const src = file.src ? file.src : "no source";
          const type = file.type ? file.type : "";
          return { name: file.name, src: src, type: type } 
        })

        files = files.concat(filesInText);

        if (message.text) {
          return {
            role: role,
            text: message.text,
            files: files
          }
        } else {
          return {
            role: role,
            files: files
          }
        }
      }
    })

    const title = {
      name: chatName,
      credits: "Bidara by NASA PeTaL"
    }

    return {
      title,
      contents
    }
  }

  function getNewNode(type, text) {
    const node = document.createElement(type);
    if (text) {
      const textNode = document.createTextNode(text);
      node.appendChild(textNode);
    }

    return node;
  }

  function getNewH1Node(text) {
    const node = getNewNode("h1", text);
    node.style.fontSize = "0.75em";
    node.style.paddingBottom = "0.5em";
    return node;
  }

  function getNewH2Node(text) {
    const node = getNewNode("h2", text);
    node.style.fontSize = "0.4em";
    return node;
  }

  function getNewPNode(text) {
    const node = getNewNode("p", text);
    node.style.fontSize = "0.4em";
    node.style.paddingBottom = "0.8em";
    return node;
  }

  function getNewBoldNode(text) {
    const node = getNewNode("strong");
    const textNode = getNewPNode(text);
    node.appendChild(textNode);
    return node;
  }

  function getNewImgNode(src) {
    const node = getNewNode("img");
    node.src = src;
    node.style.maxHeight = "500px";
    node.style.maxWidth = "500px";
    node.style.margin = "auto";

    return node; 
  }

  function createTitleNode(name, credits) {
    const root = getNewNode("div");
    root.style.display = "flex";
    root.style.justifyContent = "space-between";
    root.style.alignItems = "end";
    root.style.borderBottom = "1px solid black";

    const titleNode = getNewH1Node(name);
    root.appendChild(titleNode);

    const creditsNode = getNewPNode(credits);
    root.appendChild(creditsNode);

    return root;
  }

  function createMessageNode(role, text, files) {
    const root = getNewNode("div");
    root.style.display = "flex";
    root.style.justifyContent = "start";
    root.style.paddingTop = "0.5em";
    root.style.paddingBottom = "0.5em";
    root.style.alignItems = "start";
    root.style.borderBottom = "1px solid rgb(180,180,180)";

    const roleNode = getNewNode("div");
    roleNode.style.paddingRight = "1.75em";
    roleNode.style.paddingTop = "0";
    roleNode.style.paddingBottom= "0";
    roleNode.style.marginTop = "0";
    roleNode.style.marginBottom= "0";
    roleNode.style.width = "1.75em";
    roleNode.style.height = "0.6em";
    roleNode.style.lineHeight = "0.6em";
    const roleHeading = getNewBoldNode(role);
    roleNode.appendChild(roleHeading);
    root.appendChild(roleNode);

    const contentNode = getNewNode("div");
    contentNode.style.width = "100%";
    const textNode = getNewPNode(text);
    contentNode.appendChild(textNode)

    if (files) {
      files.forEach((file) => {
        if (file.type === "image") {

          const imgNode = getNewImgNode(file.src);
          contentNode.appendChild(imgNode);

        } else if (file.name) {
          const fileNameNode = getNewPNode(`(file) : [${file.name}]`);
          contentNode.appendChild(fileNameNode);

        } else {
          const fileNameNode = getNewPNode("(file) : [unnamed file]");
          contentNode.appendChild(fileNameNode);
        }
      })
    }

    root.appendChild(contentNode);

    return root;
  }

  function htmlTreeToHtml(tree) {
    const title = tree.title;
    const contents = tree.contents;

    const root = getNewNode("div");
    root.style.fontSize = "32px";

    const titleNode = createTitleNode(title.name, title.credits);
    root.appendChild(titleNode);

    const contentsNode = getNewNode("div");

    contents.forEach(content => {
      const role = content.role;
      const text = content.text;
      const files = content.files;

      const messageNode = createMessageNode(role, text, files);

      contentsNode.appendChild(messageNode);
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
