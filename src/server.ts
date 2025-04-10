import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";
import { getDefaultLogger } from "./logger.js";
import { PoolClient } from "pg";
import { executeQueryWithRetry, getDb, getDbSchema } from "./db.js";

dotenv.config();

const app = express();

const config = process.env;
const DB_USERNAME = config.DB_USERNAME ?? "username";
const DB_PASSWORD = config.DB_PASSWORD ?? "password";
const DB_NAME = config.DB_NAME ?? "postgres";
const DB_HOST = config.DB_HOST ?? "database";
const DB_PORT = config.DB_PORT ?? 5432;

app.listen(4321, async () => {
  const logger = getDefaultLogger();
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
  const tables = await getDbSchema(database, logger);
  logger.log("Database connection established.");

  app.get("/sse", async (_req, res) => {
    transport = new SSEServerTransport("/messages", res);
    server.connect(transport);
    logger.log("SSE connection established.");
  });

  app.post("/messages", (req, res) => {
    if (transport) {
      transport.handlePostMessage(req, res);
    }
  });

  server.tool(
    "calculate_sum",
    "Calculate the sum of two numbers",
    {
      a: z.number(),
      b: z.number(),
    },
    async (args) => {
      logger.log("Received request to calculate sum:", { args });
      return await Promise.resolve({
        content: [
          {
            type: "text",
            text: `The sum of ${args.a} and ${args.b} is ${args.a + args.b}.`,
          },
        ],
      });
    }
  );

  server.tool(
    "database_schema",
    "return the schema of the database",
    {},
    async () => {
      logger.log("Received request to check database schema");
      return await Promise.resolve({
        content: [
          {
            type: "text",
            text: tables.join("\n"),
          },
        ],
      });
    }
  );

  tables.map((table) => {
    server.tool(
      `table_${table}`,
      `Issue query on table ${table}`,
      {
        sql: z.string().describe("SQL query to execute"),
      },
      async (args) => {
        logger.log("Received request to issue query on table:", { args });
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
});
