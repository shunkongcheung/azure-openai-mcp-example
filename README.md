# Azure OpenAI MCP Example

This project showcases how to use the MCP protocol with OpenAI. It provides a simple example to interact with OpenAI's API seamlessly via an MCP server and client.

## Getting Started

To get started with this project, follow the steps below:

### Prerequisites

- Node.js (version 22 or higher)
- npm
- An OpenAI compatible endpoint:
  - An OpenAI API key
  - Or, if you are using Azure OpenAI, you need to have an [Azure OpenAI resource](https://learn.microsoft.com/azure/ai-services/openai/chatgpt-quickstart?tabs=keyless%2Ctypescript-keyless%2Cpython-new%2Ccommand-line&pivots=programming-language-javascript) and the corresponding endpoint.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/manekinekko/openai-mcp-example.git
   cd openai-mcp-example
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

### Configuration

#### Azure OpenAI (Keyless Authentication)

In order to use Keyless authentication, you can use the `AZURE_OPENAI_ENDPOINT` environment variable in the `.env` file:

```env
AZURE_OPENAI_ENDPOINT="https://<ai-foundry-openai-project>.openai.azure.com"
```

#### OpenAI API Key

To use the OpenAI API, you need to set your OpenAI API key in the `.env` file:

```env
OPENAI_API_KEY=your_openai_api_key
```

### Usage

1. (Optional) If you are using Azure OpenAI, please log in first using the [Azure CLI](https://learn.microsoft.com/cli/azure/) command:

   ```bash
   az login
   ```

2. Run the MCP server:

   ```bash
   npm run start:server
   ```

3. Run the MCP client:
   ```bash
   npm run start:client "What is the sum of legs in 2 dogs and 1 cat, use tools if possible. Explain the math step by step"
   ```

You should see a response like the following:

```text
Message:  What is the sum of legs in 2 dogs and 1 cat, use tools if possible. Explain the math step by step
Connected to OpenAI Agent.
Connected to MCP server
Tools:  [
  {
    "type": "function",
    "function": {
      "name": "calculate_sum",
      "description": "Calculate the sum of two numbers",
      "parameters": {
        "type": "object",
        "properties": {
          "a": {
            "type": "number"
          },
          "b": {
            "type": "number"
          }
        },
        "required": [
          "a",
          "b"
        ]
      }
    }
  }
]
Message:  [
  {
    "role": "system",
    "content": "This is an agent for teaching kindergarten math."
  },
  {
    "role": "user",
    "content": "What is the sum of legs in 2 dogs and 1 cat, use tools if possible. Explain the math step by step"     
  }
]
Response:  {
  "choices": [
    {
      "content_filter_results": {},
      "finish_reason": "tool_calls",
      "index": 0,
      "logprobs": null,
      "message": {
        "content": null,
        "refusal": null,
        "role": "assistant",
        "tool_calls": [
          {
            "function": {
              "arguments": "{\"a\": 4, \"b\": 4}",
              "name": "calculate_sum"
            },
            "id": "call_jWEdy99mN8wUaTp5cUYMrqvg",
            "type": "function"
          },
          {
            "function": {
              "arguments": "{\"a\": 8, \"b\": 4}",
              "name": "calculate_sum"
            },
            "id": "call_LLqfAy7m7DOGZeLCSxM5njwA",
            "type": "function"
          }
        ]
      }
    }
  ],
  "created": 1744319081,
  "id": "chatcmpl-BKtMfEQnAKzYf2InrL2TeaJudsPhN",
  "model": "gpt-4o-2024-11-20",
  "object": "chat.completion",
  "prompt_filter_results": [
    {
      "prompt_index": 0,
      "content_filter_results": {
        "hate": {
          "filtered": false,
          "severity": "safe"
        },
        "jailbreak": {
          "filtered": false,
          "detected": false
        },
        "self_harm": {
          "filtered": false,
          "severity": "safe"
        },
        "sexual": {
          "filtered": false,
          "severity": "safe"
        },
        "violence": {
          "filtered": false,
          "severity": "safe"
        }
      }
    }
  ],
  "system_fingerprint": "fp_ee1d74bde0",
  "usage": {
    "completion_tokens": 53,
    "completion_tokens_details": {
      "accepted_prediction_tokens": 0,
      "audio_tokens": 0,
      "reasoning_tokens": 0,
      "rejected_prediction_tokens": 0
    },
    "prompt_tokens": 83,
    "prompt_tokens_details": {
      "audio_tokens": 0,
      "cached_tokens": 0
    },
    "total_tokens": 136
  }
}
Messages from response:  [
  "The sum of 4 and 4 is 8.",
  "The sum of 8 and 4 is 12."
]
Disconnected from MCP server.
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
