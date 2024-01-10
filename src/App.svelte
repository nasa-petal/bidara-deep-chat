<!-- This is an example for a Svelte browser app, if you are using SvelteKit, please see the following example:
  https://codesandbox.io/p/sandbox/deep-chat-sveltekit-fn8h6x -->

  <script>
    import { DeepChat } from "deep-chat-dev";
    import { onMount } from 'svelte';
    import hljs from "highlight.js";
    window.hljs = hljs;
  
    const initialMessages = [
      { role: "ai", text: "Hi, I'm **BIDARA**, bio-inspired design and research assisant. I'm an OpenAI [GPT-4](https://openai.com/research/gpt-4) [assistant](https://platform.openai.com/docs/assistants/how-it-works), that was instructed by [NASA's PeTaL initiative](https://www1.grc.nasa.gov/research-and-engineering/vine/petal/) to help others understand, learn from, and emulate the strategies used by living things to create sustainable designs and technologies using the [Biomimicry Institute's design process](https://toolbox.biomimicry.org/methods/process/)." },
      { role: "ai", text: "Before we begin, please be advised:\n\n‣ **Do not share any sensitive information** in your conversations including but not limited to, personal information, sensitive or non-public government/company data, ITAR, CUI, export controlled, or trade secrets.  \n‣ While OpenAI has safeguards in place, BIDARA may occasionally generate incorrect or misleading information and produce offensive or biased content." },
      { role: "ai", text: "How can I assist you today?" }
    ];

    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    let openai_key = urlParams.get('key')
    if (openai_key === null) {
      openai_key = localStorage.getItem('openai-key');
    }

    function getCurrentWeather(location) {
      location = location.toLowerCase();
      if (location.includes('tokyo')) {
        return 'Good';
      } else if (location.includes('san francisco')) {
        return 'Mild';
      } else {
        return 'Very Hot';
      }
    }

    function getCurrentTime(location) {
      location = location.toLowerCase();
      if (location.includes('tokyo')) {
        return '10p';
      } else if (location.includes('san francisco')) {
        return '6p';
      } else {
        return '12p';
      }
    }

    onMount(async () => { // runs after the component has finished loading.
      const deepChatRef = document.getElementById('chat-element');

      deepChatRef.onNewMessage = (message) => {
        // save messages to localStorage.
        // this function is called once for each message including initialMessages, ai messages, and user messages.
      };

      deepChatRef.onComponentRender = () => {
        // save key to localStorage.
        // The event occurs before key is set, and again, after key is set.
        if (deepChatRef._activeService.key) {
          if (localStorage.getItem("openai-key") === null) {
            localStorage.setItem('openai-key', deepChatRef._activeService.key);
          }
        }
      };

      deepChatRef.responseInterceptor = (response) => {
        //console.log(response); // printed above
        return response;
      };
    });    
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
    <!-- demo/textInput are examples of passing an object directly into a property -->
    <!-- initialMessages is an example of passing a state object into a property -->
    <deep-chat
      id="chat-element"
      directConnection={{
        openAI: {
          key: openai_key,
          validateKeyProperty: true,
          assistant: {
            assistant_id: "asst_0qjNhzjIMuwfjJJ2e4Cl8vdY",
            function_handler: (functionsDetails) => {
              return functionsDetails.map((functionDetails) => {
                let tmp = null;
                if(functionDetails.name == "get_weather") {
                  tmp = getCurrentWeather(functionDetails.arguments);
                }
                else if(functionDetails.name == "get_time") {
                  tmp = getCurrentTime(functionDetails.arguments);
                }
                return tmp;
              });
            }
          }
        }
      }}
      _insertKeyViewStyles={{displayCautionText: false}}
      demo={false}
      mixedFiles={{
        button: {
          styles: {
            container: {
              default: {
                width: "1em",
                height: "1em",
                right: "calc(10%)",
                bottom: ".7em",
                borderRadius: "100vmax",
                padding: "0.5em",
                backgroundColor: "rgba(0, 0, 0, 0.1)"
              }
            },
            svg: {
              styles: {
                default: {
                  bottom: "0.3em",
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
        top: "-2.6em",
        height: "4em",
        left: "10vw"
      }}
      textInput={{
        styles: {
          container: {
            boxShadow: "none",
            borderRadius: "1em",
            border: "1px solid rgba(0,0,0,0.2)",
            left: "10px"
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
              right: "calc(10% - 0.3em)",
              bottom: ".85em",
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
  </main>

  <style>
    main {
      font-family: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
      display: grid;
    }
  </style>

