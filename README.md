# OpenAI MCP Example

This project showcases how to use the MCP protocol with OpenAI. It provides a simple example to interact with OpenAI's API seamlessly via an MCP server and client.

## Getting Started

To get started with this project, follow the steps below:

### Prerequisites

- Node.js (version 22 or higher)
- npm
- OpenAI API key

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

1. Create a `.env` file in the root directory and add your OpenAI API key:
    ```env
    OPENAI_API_KEY=your_openai_api_key
    ```

### Usage

1. Run the MCP server:
    ```bash
    npm run start:server
    ```

2. Run the MCP client:
    ```bash
    npm run start:client
    ```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
