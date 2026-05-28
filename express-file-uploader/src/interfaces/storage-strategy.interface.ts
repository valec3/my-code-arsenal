export interface StorageResult {
  success: boolean;
  storedName: string;
  pathOrUrl: string;
  sizeBytes: number;
  provider: string;
}

export interface StorageStrategy {
  /**
   * Guarda un archivo proveniente de Multer.
   * @param file El archivo procesado por Multer (en memoria).
   */
  save(file: Express.Multer.File): Promise<StorageResult>;

  /**
   * Elimina un archivo del storage utilizando su identificador/nombre único.
   * @param fileKey Nombre almacenado o path/key del archivo.
   */
  delete(fileKey: string): Promise<void>;
}
