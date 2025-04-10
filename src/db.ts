import pg, { DatabaseError, PoolClient, PoolConfig, QueryResultRow } from "pg";
import { Logger } from "./logger.js";

type IConfig = Pick<
  PoolConfig,
  "user" | "password" | "host" | "port" | "database"
>;

export const getDb = async (inConfig: IConfig, logger: Logger) => {
  const config: PoolConfig = {
    ...inConfig,
    // Add connection timeout and retry settings
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10, // Maximum number of clients in the pool
  };

  // Ensure localhost is using IPv4
  if (config.host === "localhost") {
    config.host = "127.0.0.1";
    logger.log("Changed localhost to 127.0.0.1 to ensure IPv4 connection");
  }

  // Log connection details (without password)
  logger.log("Database configuration:", {
    user: config.user,
    host: config.host,
    port: config.port,
    database: config.database,
  });

  // Create a connection pool
  const pool = new pg.Pool(config);

  // Add event listeners for pool errors
  pool.on("error", (err) => {
    logger.error("Unexpected error on database client", err);
  });

  const database = await pool.connect();

  const result = await database.query("SELECT NOW() AS now");
  logger.debug("Connected to database:", result.rows[0].now);

  return database;
};

export const executeQueryWithRetry = async <T extends QueryResultRow = any>(
  client: PoolClient,
  sql: string,
  logger: Logger,
  maxRetries = 3
) => {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      logger.log(
        `Executing query (attempt ${retries + 1}/${maxRetries}):`,
        sql
      );
      const result = await client.query(sql);
      return result as pg.QueryResult<T>;
    } catch (inErr) {
      const err = inErr as DatabaseError;

      logger.error(
        `Query error (attempt ${retries + 1}/${maxRetries}):`,
        err.message
      );

      // Check if this is a connection-related error that might be resolved by retrying
      const isRetryAllowedError =
        err.code === "ECONNREFUSED" ||
        err.code === "57P01" ||
        err.code === "08006" ||
        err.code === "08001";

      if (isRetryAllowedError && retries < maxRetries - 1) {
        retries++;
        await new Promise((resolve) => setTimeout(resolve, 1000 * retries)); // Exponential backoff
      } else {
        client.release();
        // For other errors, don't retry
        throw err;
      }
    }
  }
};

export const getDbSchema = async (
  client: PoolClient,
  logger: Logger
): Promise<string[]> => {
  const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;

  const result = await executeQueryWithRetry<{ table_name: string }>(
    client,
    sql,
    logger
  );
  const tables = result?.rows.map((row) => row.table_name) ?? [];

  logger.debug("Database schema:", tables);

  return tables;
};
