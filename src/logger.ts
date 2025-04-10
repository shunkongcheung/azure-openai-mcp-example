export type Logger = {
  debug: (...args: any[]) => void;
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
};

export const getDefaultLogger = (options?: { silent?: boolean }): Logger => ({
  debug: (...args: any[]) => {
    if (!options?.silent) {
      console.debug(...args);
    }
  },
  log: (...args: any[]) => {
    if (!options?.silent) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    console.error(...args);
  },
});
