<!-- This is an example for a Svelte browser app, if you are using SvelteKit, please see the following example:
  https://codesandbox.io/p/sandbox/deep-chat-sveltekit-fn8h6x -->

  <script>
    import { DeepChat } from "deep-chat-dev";
    import { onMount } from 'svelte';
    import { BIDARA_SYS, PAPER_SEARCH_FUNC, GEN_IMAGE_FUNC } from './bidara';
    import { funcCalling } from './bidaraFunctions';
    import { getKeyAndAsst } from './openaiUtils';
    import hljs from "highlight.js";
    window.hljs = hljs;
  
    const initialMessages = [
      { role: "ai", text: "Hi, I'm **BIDARA**, Bio-Inspired Design and Research Assisant. I'm an OpenAI [GPT-4](https://openai.com/research/gpt-4) [assistant](https://platform.openai.com/docs/assistants/how-it-works), that was instructed by [NASA's PeTaL initiative](https://www1.grc.nasa.gov/research-and-engineering/vine/petal/) to help others understand, learn from, and emulate the strategies used by living things to create sustainable designs and technologies using the [Biomimicry Institute's design process](https://toolbox.biomimicry.org/methods/process/)." },
      { role: "ai", text: "Before we begin, please be advised:\n\n‣ **Do not share any sensitive information** in your conversations including but not limited to, personal information, sensitive or non-public government/company data, ITAR, CUI, export controlled, or trade secrets.  \n‣ While OpenAI has safeguards in place, BIDARA may occasionally generate incorrect or misleading information and produce offensive or biased content." },
      { role: "ai", text: "How can I assist you today?" }
    ];

    let openAIKeySet = false;
    let openAIAsstSet = false;
    let deepChatRef;
    let welcomeRef;

    function onError(error) {
      console.log(error);
    }

    function onNewMessage(message) {
      // save asst id to localStorage.
      // this function is called once for each message including initialMessages, ai messages, and user messages.
      if (!openAIAsstSet && deepChatRef._activeService.rawBody.assistant_id) {
        localStorage.setItem('openai-asst-id', deepChatRef._activeService.rawBody.assistant_id);
        openAIAsstSet = true;
      }
    }

    function onComponentRender() {
      // save key to localStorage.
      // The event occurs before key is set, and again, after key is set.
      if (!openAIKeySet && deepChatRef._activeService.key) {
        localStorage.setItem('openai-key', deepChatRef._activeService.key);
        openAIKeySet = true;
      }
      if(!openAIKeySet) {
        welcomeRef.style.display = "block";
      }
      else {
        welcomeRef.style.display = "none";
      }
    }

  </script>

  
  <main>
    <!--
      <h1>BIDARA</h1>
      <div
        style="
          width:100%;
          background-color: #f3f3f3;
          border-radius: 10px;
          padding: 12px;
          padding-bottom: 15px;
          text-align: left;
          margin-left: auto;
          margin-right: auto;
        "
      >
        <div>
          <div style="font-size: 15px; line-height: 20px">
            <p><strong>BIDARA</strong> is a GPT-4 chatbot that was instructed to help scientists and engineers understand, learn from, and emulate the strategies used by living things to create sustainable designs and technologies.</p>

            <p>BIDARA can guide users through the Biomimicry Institute’s Design Process, a step-by-step method to propose biomimetic solutions to challenges. This process includes defining the problem, biologizing the challenge, discovering natural models, abstracting design strategies, and emulating nature's lessons.</p>

            <p>
              <strong>WARNING</strong><br/>
              - Do not share any sensitive information in your conversations including but not limited to, personal information, sensitive or non-public government/company data, ITAR, CUI, export controlled, or trade secrets.<br/>
              - While OpenAI has safeguards in place, BIDARA may occasionally generate incorrect or misleading information and produce offensive or biased content.<br/>
              - The chatbot may produce inaccurate information about people, places, or facts.
            </p>
          </div>
        </div>
      </div>-->
    <div id="welcome" bind:this={welcomeRef}>
      <div id="header"><img src="bidara.png" alt="girl with dark hair" height="57" width="57" /><h2>BIDARA</h2><br/><span class="small">Bio-Inspired Design and Research Assistant</span></div>
      <h3>How to access</h3>
      <ol>
        <li><a href="https://platform.openai.com/signup">Create an OpenAI account</a></li>
        <li><a href="https://platform.openai.com/login">Login to OpenAI Platform</a></li>
        <li>In the left sidebar, navigate to <a href="https://platform.openai.com/account/billing/overview">Settings -&gt; Billing</a></li> <li>Click the 'Add payment details' button</li>
        <li>Add a minimum of $5 in credits. It is required to spend a minimum of $5 to <a href="https://platform.openai.com/docs/guides/rate-limits/usage-tiers?context=tier-free">access GPT-4</a>.</li>
        <li>In the left sidebar, navigate to <a href="https://platform.openai.com/api-keys">API Keys</a></li>
        <li>Verify your phone number, then click the 'Create new secret key' button.</li> <li>Copy your secret key.</li>
        <li>Paste your key into the input field below. Your browser will save the key, so you only have to enter it once.</li>
      </ol>
      <ul>
        <li>With OpenAI API you only pay for what you use. Track your usage and costs on the <a href="https://platform.openai.com/usage">Usage page</a>.</li>
        <li>After you send your first message to BIDARA, it will also be available to interact with through the <a href="https://platform.openai.com/assistants">OpenAI Assistants Playground</a>. This interface is more complex, but also provides more customizability. Just select BIDARA, then click the 'Test' button.</li>
      </ul>
    </div>
    <!-- demo/textInput are examples of passing an object directly into a property -->
    <!-- initialMessages is an example of passing a state object into a property -->
    {#await getKeyAndAsst() then keyAndAsst}
    <deep-chat bind:this={deepChatRef}
      id="chat-element"
      directConnection={{
        openAI: {
          key: keyAndAsst[0],
          validateKeyProperty: keyAndAsst[0] ? false : true, // if apiKey is not null it has already been validated.
          assistant: {
            assistant_id: keyAndAsst[1],
            new_assistant: {
              model: "gpt-4-1106-preview",
              name: "BIDARA",
              instructions: BIDARA_SYS,
              tools: [
                { type: "code_interpreter" },
                { type: "retrieval" },
                { 
                  type: "function",
                  function: PAPER_SEARCH_FUNC
                },
                {
                  type: "function",
                  function: GEN_IMAGE_FUNC
                },
              ]
            },
            function_handler: funcCalling
          }
        }
      }}
      errorMessages={{
        displayServiceErrorMessages: true
      }}
      onError={onError}
      onNewMessage={onNewMessage}
      onComponentRender={onComponentRender}
      _insertKeyViewStyles={{displayCautionText: false}}
      demo={false}
      speechToText={{
        webSpeech: "true",
        commands: {
          submit: "dude"
        },
        settings: {
          substrings: "false"
        },
        button: {
          default: {
            container: {
              default: {
                width: "1em",
                height: "1em",
                bottom: ".7em",
                borderRadius: "100vmax",
                padding: "0.5em",
                backgroundColor: "rgba(0, 0, 0, 0.1)",
                left: "calc(11px - 0.25em)"
              }
            },
            svg: {
              styles: {
                default: {
                  bottom: "0.35em",
                  left: "0.4em"
                }
              }
            }
          },
          position: "outside-right"
        }
      }}
      mixedFiles={{
        button: {
          styles: {
            container: {
              default: {
                width: "1em",
                height: "1em",
                right: "calc(10% + 0.4em)",
                bottom: ".7em",
                borderRadius: "100vmax",
                padding: "0.5em",
                backgroundColor: "rgba(0, 0, 0, 0.1)"
              }
            },
            svg: {
              styles: {
                default: {
                  bottom: "0.35em",
                  left: "0.4em"
                }
              }
            }
          },
          position: "outside-left"
        }
      }}
      attachmentContainerStyle={{
        backgroundColor: "rgba(255, 255, 255, 0.6)",
        borderRadius: "5px 5px 0 0",
        border: "1px solid rgba(0,0,0,0.2)",
        top: "-2.55em",
        height: "4em",
        width: "calc(100% - 6.2em)",
      }}
      textInput={{
        styles: {
          container: {
            width: "calc(100% - 6em)",
            boxShadow: "none",
            borderRadius: "1em",
            border: "1px solid rgba(0,0,0,0.2)"
          },
          text: {
            padding: "0.4em 2.5em 0.4em 0.8em",
          }
        },
        placeholder:{text: "How might we..."}
      }}
      initialMessages={initialMessages}
      chatStyle={{
        width: "100%",
        height: "100dvh",
        backgroundColor: "white",
        border: "none",
        fontSize: "17px",
        fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
      }}
      messageStyles={{
        default: {
          shared: {
            bubble: {
              maxWidth: "75%",
              borderRadius: "1em",
              padding: ".42em .7em"
            }
          }
        },
        loading: {
          shared: {
            bubble: {
              padding: "0.6em 0.75em 0.6em 1.3em"
            }
          }
        }
      }}
      submitButtonStyles={{
        submit: {
          container: {
            default: {
              width: "1em",
              height: "1em",
              right: "calc(10% + 0.3em)",
              bottom: ".87em",
              borderRadius: "100vmax",
              padding: "0.3em",
              backgroundColor: "rgb(0, 132, 255)"
            }
          },
          svg: {
            content: '<svg viewBox="2 2 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C12.2652 3 12.5196 3.10536 12.7071 3.29289L19.7071 10.2929C20.0976 10.6834 20.0976 11.3166 19.7071 11.7071C19.3166 12.0976 18.6834 12.0976 18.2929 11.7071L13 6.41421V20C13 20.5523 12.5523 21 12 21C11.4477 21 11 20.5523 11 20V6.41421L5.70711 11.7071C5.31658 12.0976 4.68342 12.0976 4.29289 11.7071C3.90237 11.3166 3.90237 10.6834 4.29289 10.2929L11.2929 3.29289C11.4804 3.10536 11.7348 3 12 3Z" fill="#ffffff" stroke="white" stroke-width="1"/></svg>'
          }
        }
      }}
    />
    {/await}
    
  </main>


  <style>
    main {
      font-family: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
      display: grid;
    }

    #welcome {
      margin-bottom: -30dvh;
      z-index: 1;
      line-height: 1.5em;
      padding-left: 1em;
      padding-right: 1em;
      display: none;
    }

    #welcome ol, #welcome ul {
      padding-inline-start: 1.7em;
    }

    #welcome h2 {
      font-weight: 200;
      font-size: 2em;
      line-height: 1em;
      display: inline;
    }

    #welcome h3 {
      margin-inline-start: .25em;
    }

    #header {
      padding-top: 1.3em;
      line-height: 1.15em;
    }

    #welcome #header img {
      float: left;
      margin-right: .1em;
    }

    #welcome #header .small {
      font-size: .8em;
      font-weight: 300;
    }
  </style>

