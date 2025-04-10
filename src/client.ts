import {
  DefaultAzureCredential,
  getBearerTokenProvider,
} from "@azure/identity";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import dotenv from "dotenv";
import { AzureOpenAI, OpenAI } from "openai";
import {
  ChatCompletion,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat";

const getMessageFromArg = () => {
  const DEFAULT_MESSAGE = "What is the sum of 2 and 3?";
  const args = process.argv;
  const idxOfLastSystemArg = args.findIndex((arg) => arg.includes("client.js"));
  const idxNotFound = idxOfLastSystemArg === -1;
  const idxIsLastArg = idxOfLastSystemArg === args.length - 1;

  if (idxNotFound || idxIsLastArg) {
    return DEFAULT_MESSAGE;
  }

  return args[idxOfLastSystemArg + 1];
};

function initializeEnvironment() {
  dotenv.config();
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const endpoint = process.env["AZURE_OPENAI_ENDPOINT"] as string;

  if (!OPENAI_API_KEY || !endpoint) {
    throw new Error("Missing required environment variables");
  }

  return { OPENAI_API_KEY, endpoint };
}

function createOpenAIClient({
  endpoint,
  apiKey,
  deployment,
}: {
  endpoint: string;
  apiKey: string;
  deployment: string;
}) {
  const apiVersion = "2025-01-01-preview";

  if (apiKey && !endpoint) {
    console.log("Using OpenAI API Key");
    // Initialize the OpenAI client with API Key
    return new OpenAI({ apiKey });
  } else if (!apiKey && endpoint) {
    // Initialize the AzureOpenAI client with Entra ID (Azure AD) authentication (keyless)
    console.log("Using Azure OpenAI Keyless authentication");

    // Initialize the DefaultAzureCredential
    const credential = new DefaultAzureCredential();
    const scope = "https://cognitiveservices.azure.com/.default";
    const azureADTokenProvider = getBearerTokenProvider(credential, scope);
    return new AzureOpenAI({
      endpoint,
      azureADTokenProvider,
      apiVersion,
      deployment,
    });
  }

  return new AzureOpenAI({
    endpoint,
    apiVersion,
    deployment,
    apiKey,
  });
}

const getMcpClient = async (serverUrl: string) => {
  const client = new Client({ name: "azure-mcp-client", version: "1.0.0" });
  const transport = new SSEClientTransport(new URL(serverUrl));
  await client.connect(transport);

  return client;
};

const getTools = async (client: Client): Promise<ChatCompletionTool[]> => {
  const toolsResult = await client.listTools();
  return toolsResult.tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required,
      },
    },
  }));
};

const fetchOpenAiResponse = async (
  openai: AzureOpenAI,
  props: {
    deployment: string;
    messages: ChatCompletionMessageParam[];
    tools: ChatCompletionTool[];
  }
) => {
  return await openai.chat.completions.create({
    model: props.deployment,
    max_tokens: 800,
    messages: props.messages,
    tools: props.tools,
  });
};

const getMessagesFromChatCompletion = async (
  response: ChatCompletion,
  mcp: Client
): Promise<string[]> => {
  const messageResults = await Promise.all(
    response.choices.map(async ({ message }) => {
      if (!message.tool_calls) {
        return message.content || "";
      }

      const toolResults = await Promise.allSettled(
        message.tool_calls.map((tool_call) => {
          const toolName = tool_call.function.name;
          const args = tool_call.function.arguments;
          return mcp.callTool({
            name: toolName,
            arguments: JSON.parse(args),
          });
        })
      );

      const toolTexts = toolResults
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value)
        .map((result) => result.content as { type: "text"; text: string }[])
        .flat()
        .map((item) => item.text);

      return [message.content || "", ...toolTexts];
    })
  );

  return messageResults.flat().filter(Boolean);
};

const main = async () => {
  const SERVER_URL = "http://localhost:4321/sse";
  const DEPLOYMENT = "gpt-4o";

  const message = getMessageFromArg();
  console.log("Message: ", message);

  const { OPENAI_API_KEY, endpoint } = initializeEnvironment();
  const openai = createOpenAIClient({
    endpoint,
    apiKey: OPENAI_API_KEY,
    deployment: DEPLOYMENT,
  });
  console.log("Connected to OpenAI Agent.");

  const mcpClient = await getMcpClient(SERVER_URL);
  console.log("Connected to MCP server");

  const tools = await getTools(mcpClient);
  console.log("Tools: ", JSON.stringify(tools, null, 2));

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: "This is an agent for teaching kindergarten math.",
    },
    {
      role: "user",
      content: message,
      // content: "What is the sum of 2 and 3?", // basic math question
      // content: "How many legs do 2 cats and 3 dogs have?", // require some math and logic
      // content: "Why does the sun shine?", // irrelevant question
    },
  ];
  console.log("Message: ", JSON.stringify(messages, null, 2));

  const response = await fetchOpenAiResponse(openai, {
    deployment: DEPLOYMENT,
    messages,
    tools,
  });
  console.log("Response: ", JSON.stringify(response, null, 2));

  const messagesFromResponse = await getMessagesFromChatCompletion(
    response,
    mcpClient
  );
  console.log(
    "Messages from response: ",
    JSON.stringify(messagesFromResponse, null, 2)
  );

  await mcpClient.close();
  console.log("Disconnected from MCP server.");
};

main();
