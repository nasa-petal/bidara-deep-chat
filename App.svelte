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
      textInput={{placeholder:{text: "Say something"}}}
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
    />
  </main>

  <style>
    main {
      font-family: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
      display: grid;
    }
  </style>

