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
   npm run start:client
   ```

You should see a response like the following:

```text
{
  choices: [
    {
      content_filter_results: [Object],
      finish_reason: 'stop',
      index: 0,
      logprobs: null,
      message: [Object]
    }
  ],
  created: 1744274007,
  id: 'chatcmpl-BKhdf8LcWBezaWxDr2WDPi1uZDfZl',
  model: 'gpt-4o-2024-11-20',
  object: 'chat.completion',
  prompt_filter_results: [ { prompt_index: 0, content_filter_results: [Object] } ],
  system_fingerprint: 'fp_ee1d74bde0',
  usage: {
    completion_tokens: 14,
    completion_tokens_details: {
      accepted_prediction_tokens: 0,
      audio_tokens: 0,
      reasoning_tokens: 0,
      rejected_prediction_tokens: 0
    },
    prompt_tokens: 18,
    prompt_tokens_details: { audio_tokens: 0, cached_tokens: 0 },
    total_tokens: 32
  }
}
Final result:  [Calling tool calculate_sum with args "{\"a\":2,\"b\":3}"]
The sum of 2 and 3 is **5**.
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
