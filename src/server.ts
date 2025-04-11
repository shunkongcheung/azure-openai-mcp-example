import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";
import { getDefaultLogger } from "./logger.js";
import { PoolClient } from "pg";
import { executeQueryWithRetry, getDb, getTableSchema } from "./db.js";

dotenv.config();

const app = express();

const config = process.env;
const DB_USERNAME = config.DB_USERNAME ?? "username";
const DB_PASSWORD = config.DB_PASSWORD ?? "password";
const DB_NAME = config.DB_NAME ?? "postgres";
const DB_HOST = config.DB_HOST ?? "database";
const DB_PORT = config.DB_PORT ?? 5432;

app.listen(4321, async () => {
  const logger = getDefaultLogger({ silent: true });
  let transport: SSEServerTransport | null = null;
  let database: PoolClient | null = null;

  logger.debug("Configuration: ", {
    DB_USERNAME,
    DB_PASSWORD,
    DB_NAME,
    DB_HOST,
  });
  logger.log("Server started and listening for requests...");
  logger.log("You can connect to it using the SSEClientTransport.");
  logger.log(
    "For example: new SSEClientTransport(new URL('http://localhost:4321/sse'))"
  );

  const server = new McpServer({
    name: "mcp-server",
    version: "1.0.0",
  });
  logger.log("MCP server initialized.");

  database = await getDb(
    {
      user: DB_USERNAME,
      password: DB_PASSWORD,
      database: DB_NAME,
      host: DB_HOST,
      port: Number(DB_PORT),
    },
    logger
  );
  logger.log("Database connection established.");

  app.get("/sse", async (_req, res) => {
    transport = new SSEServerTransport("/messages", res);
    server.connect(transport);
    logger.log("SSE connection established.");
  });

  app.post("/messages", (req, res) => {
    logger.log("Message received.");
    if (transport) {
      transport.handlePostMessage(req, res);
    } else {
      logger.error("Transport is not initialized.");
    }
  });

  server.resource(
    "greeting",
    new ResourceTemplate("greeting://{name}", { list: undefined }),
    async (uri, { name }) => {
      logger.log(`Greeting to ${name} requested.`);
      return {
        contents: [
          {
            uri: uri.href,
            text: `Hello, ${name}!`,
          },
        ],
      };
    }
  );

  const listingTableSchema = await getTableSchema(database, "listing", logger);
  server.prompt("query-database", "About querying the database", async () => {
    logger.log(`Querying the database prompt requested.`);
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text:
              "The purpose of this chat is to respond to client based on a data from postgres database. " +
              "This database contains information about airbnb listing in Toronto. " +
              "Help the user search for a listing based on their needs. " +
              "This postgres database contains a table named 'listing' Please use this table only. ",
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text:
              "The table 'listing' has the following columns: " +
              JSON.stringify(listingTableSchema) +
              ". " +
              "You can use these columns to filter the data. " +
              "Postgres database has a syntax where column name has to be double quoted when used as filter." +
              "While the filter value has to be single quoted." +
              "Please use the column name as the key and the value you want to filter as the value. " +
              'e.g. SELECT * FROM "listing" where "listing_id" = \'Some value\';',
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text:
              "If you would like to form a SQL query based on number field, please provide the column name and the value you want to filter. " +
              'e.g. SELECT * FROM "listing" where "price" = 100;',
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text:
              "If you would like to form a SQL query based on non-number text field, check what are the available options first" +
              'For example, if you want to query by "buildType", you can use the following query to check what are the available options: ' +
              'SELECT DISTINCT "buildType" FROM "listing";' +
              "Then you can use the value from the result to form your query. ",
          },
        },
      ],
      description: "Provide the instruction when querying the database",
    };
  });

  server.tool(
    "query",
    `Issue query to database`,
    {
      sql: z.string().describe("PostgreSQL query to execute"),
    },
    async (args) => {
      logger.log("Received request to issue query on table:", args);
      const result = await executeQueryWithRetry(database, args.sql, logger);
      return await Promise.resolve({
        content: [
          {
            type: "text",
            text: JSON.stringify(result?.rows),
          },
        ],
      });
    }
  );
});
