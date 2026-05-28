export interface StorageResult {
  success: boolean;
  storedName: string;
  pathOrUrl: string;
  sizeBytes: number;
  provider: string;
}

export interface StorageStrategy {
  save(file: Express.Multer.File): Promise<StorageResult>;
  delete(fileKey: string): Promise<void>;
}
