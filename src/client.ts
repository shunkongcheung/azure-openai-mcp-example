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
import { getDefaultLogger } from "./logger.js";

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
    // Initialize the OpenAI client with API Key
    return new OpenAI({ apiKey });
  } else if (!apiKey && endpoint) {
    // Initialize the AzureOpenAI client with Entra ID (Azure AD) authentication (keyless)

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
  const client = new Client(
    { name: "azure-mcp-client", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );
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
  openai: AzureOpenAI | OpenAI,
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
): Promise<ChatCompletionMessageParam[]> => {
  const messageResults = await Promise.all(
    response.choices.map(async ({ message }) => {
      if (!message.tool_calls) {
        return [];
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

      const MAX_TOOL_RESPONSE_FOR_THROTTLING = 10000;
      const allToolResponses = toolResults
        .filter((result) => result.status === "fulfilled")
        .map(
          (result) =>
            result.value as { content: { type: string; text: string }[] }
        )
        .flatMap((result) => result.content)
        .map((result) => ({
          ...result,
          text: result.text.slice(0, MAX_TOOL_RESPONSE_FOR_THROTTLING),
        }));

      const toolResponses = allToolResponses.map<ChatCompletionMessageParam>(
        (result) => ({
          role: "assistant",
          content:
            "Use the following resource, respond to the initial question from user :" +
            result.text,
        })
      );

      const systemMessage: ChatCompletionMessageParam | null = message.content
        ? { role: "system", content: message.content }
        : null;

      return systemMessage ? [systemMessage, ...toolResponses] : toolResponses;
    })
  );

  return messageResults.flat().filter(Boolean);
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  const SERVER_URL = "http://localhost:4321/sse";
  const DEPLOYMENT = "gpt-4o";

  const logger = getDefaultLogger({ silent: true });

  const message = getMessageFromArg();
  logger.log("Message: ", message);

  const { OPENAI_API_KEY, endpoint } = initializeEnvironment();
  const openai = createOpenAIClient({
    endpoint,
    apiKey: OPENAI_API_KEY,
    deployment: DEPLOYMENT,
  });
  logger.log("Connected to OpenAI Agent.");

  const mcpClient = await getMcpClient(SERVER_URL);
  logger.log("Connected to MCP server");

  const tools = await getTools(mcpClient);
  logger.debug("Tools: ", JSON.stringify(tools, null, 2));

  const resources = await mcpClient.listResourceTemplates();
  logger.debug("Resources: ", JSON.stringify(resources, null, 2));

  const greeting = await mcpClient.readResource({
    uri: "greeting://hello",
  });
  logger.debug("Greeting: ", JSON.stringify(greeting, null, 2));

  // const tableSchemas = await mcpClient.readResource({ uri: "table://listing" });
  // logger.debug("Table schemas: ", JSON.stringify(tableSchemas, null, 2));

  const queryDatabasePrompt = await mcpClient.getPrompt({
    name: "query-database",
  });
  logger.debug(
    "Database prompt: ",
    JSON.stringify(queryDatabasePrompt, null, 2)
  );

  const messages: ChatCompletionMessageParam[] = [
    ...queryDatabasePrompt.messages.map<ChatCompletionMessageParam>(
      (message) => ({
        role: message.role,
        content: message.content.text as string,
      })
    ),
    // {
    //   role: "assistant",
    //   content:
    //     "When querying for supportive data, e.g. selecting distinct value from a column, " +
    //     "feel free to retrieve all value from the database if necessary." +
    //     "If needed, impose a limit of 5 rows. " +
    //     "Or select only the column that is relevant to the user. " +
    //     "The reason is to limit the amount of data to process.",
    // },
    {
      role: "user",
      content: message,
    },
  ];
  logger.log("Message: ", JSON.stringify(messages, null, 2));

  let response = await fetchOpenAiResponse(openai, {
    deployment: DEPLOYMENT,
    messages,
    tools,
  });
  logger.log(
    "First Response: ",
    response.choices[0].message.content,
    response.choices[0].message.tool_calls
  );

  let isDone = false;
  for (let idx = 0; !isDone; idx++) {
    const messagesFromResponse = await getMessagesFromChatCompletion(
      response,
      mcpClient
    );

    const printLimit = 1000;
    const printContent = JSON.stringify(messagesFromResponse, null, 2);
    logger.log(
      `${idx} - Messages from response: `,
      printContent.length > printLimit
        ? printContent.slice(0, printLimit) + "..."
        : printContent
    );

    isDone = messagesFromResponse.length === 0;

    if (!isDone) {
      const seconds = 80;
      logger.log(`Starting wait for ${seconds} seconds...`);
      await delay(seconds * 1000);
      logger.log(`Finish waiting, continue to next iteration...`);

      response = await fetchOpenAiResponse(openai, {
        deployment: DEPLOYMENT,
        messages: [...messages, ...messagesFromResponse],
        tools,
      });

      logger.log(
        `${idx} response update: `,
        response.choices[0].message.content,
        response.choices[0].message.tool_calls
      );
    }
  }

  logger.log("Final Response: ", response.choices[0].message.content);

  await mcpClient.close();
  logger.log("Disconnected from MCP server.");
};

main();
