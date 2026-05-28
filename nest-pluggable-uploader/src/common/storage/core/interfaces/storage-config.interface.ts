export interface StorageModuleConfig {
  maxFileSize: number;
  allowedMimetypes: string[];
  logger?: {
    info: (msg: string, ...args: any[]) => void;
    error: (err: any, msg: string) => void;
    warn: (msg: string, ...args: any[]) => void;
  };
}
