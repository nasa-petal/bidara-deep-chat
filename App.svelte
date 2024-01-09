<!-- This is an example for a Svelte browser app, if you are using SvelteKit, please see the following example:
  https://codesandbox.io/p/sandbox/deep-chat-sveltekit-fn8h6x -->

  <script>
    import { DeepChat } from "deep-chat-dev";
    import { onMount } from 'svelte';
  
    const initialMessages = [
      { role: "ai", text: "Hi, I'm **BIDARA**, bio-inspired design and research assisant. I'm an OpenAI [GPT-4](https://openai.com/research/gpt-4) [assistant](https://platform.openai.com/docs/assistants/how-it-works), that was instructed by [NASA's PeTaL initiative](https://www1.grc.nasa.gov/research-and-engineering/vine/petal/) to help others understand, learn from, and emulate the strategies used by living things to create sustainable designs and technologies using the [Biomimicry Institute's design process](https://toolbox.biomimicry.org/methods/process/)." },
      { role: "ai", text: "Before we begin, please be advised:\n\n‣ **Do not share any sensitive information** in your conversations including but not limited to, personal information, sensitive or non-public government/company data, ITAR, CUI, export controlled, or trade secrets.  \n‣ While OpenAI has safeguards in place, BIDARA may occasionally generate incorrect or misleading information and produce offensive or biased content." },
      { role: "ai", text: "How can I assist you today?" }
    ];

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
          key: localStorage.getItem('openai-key'),
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
      mixedFiles={true}
      textInput={{
        styles: {
          container: {
            boxShadow: "none",
            borderRadius: "100vmax",
            border: "1px solid rgba(0,0,0,0.2)"
          },
          text: {
            padding: "0.4em 0.8em"
          }
        },
        placeholder:{text: "Say something"}
      }}
      initialMessages={initialMessages}
      chatStyle={{
        width: "100%",
        height: "100dvh",
        backgroundColor: "white",
        border: "none",
        fontSize: "16px",
        fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
      }}
      messageStyles={{
        default: {
          shared: {
            bubble: {
              maxWidth: "75%"
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
              bottom: ".85em",
              borderRadius: "100vmax",
              padding: "0.3em",
              backgroundColor: "rgb(0, 132, 255)"
            }
          },
          svg: {
            content: '<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 115.4 122.88"><title>up-arrow</title><path d="M24.94,67.88A14.66,14.66,0,0,1,4.38,47L47.83,4.21a14.66,14.66,0,0,1,20.56,0L111,46.15A14.66,14.66,0,0,1,90.46,67.06l-18-17.69-.29,59.17c-.1,19.28-29.42,19-29.33-.25L43.14,50,24.94,67.88Z"/></svg>',
            styles: {
              default: {
                filter: "brightness(0) saturate(100%) invert(100%) sepia(0%) saturate(7500%) hue-rotate(315deg) brightness(99%) contrast(102%)"
              }
            }
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

