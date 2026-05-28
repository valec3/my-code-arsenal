import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config();

/**
 * Interfaz que define la estructura de nuestra configuración fuertemente tipada.
 */
interface EnvConfig {
  PORT: number;
  MAX_FILE_SIZE: number;
  ALLOWED_MIMETYPES: string[];
  STORAGE_PROVIDER: 'local' | 'r2' | 's3' | 'supabase' | 'gcp';
  
  // Local
  UPLOAD_DIR?: string;

  // S3 / R2
  S3_BUCKET_NAME?: string;
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_REGION?: string;
  S3_PUBLIC_URL?: string;

  // Supabase (Template)
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;

  // GCP (Template)
  GCP_PROJECT_ID?: string;
  GCP_BUCKET_NAME?: string;
}

/**
 * Función auxiliar para obtener y validar una variable de entorno requerida de forma general.
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`❌ ERROR DE CONFIGURACIÓN: La variable de entorno obligatoria [${key}] no está definida en el archivo .env`);
  }
  return value.trim();
}

// ==============================================================================
// 1. Validaciones de Variables Globales (Siempre Obligatorias)
// ==============================================================================

const rawPort = getRequiredEnv('PORT');
const PORT = parseInt(rawPort, 10);
if (isNaN(PORT)) {
  throw new Error(`❌ ERROR DE CONFIGURACIÓN: La variable PORT [${rawPort}] debe ser un número válido.`);
}

const rawMaxSize = getRequiredEnv('MAX_FILE_SIZE');
const MAX_FILE_SIZE = parseInt(rawMaxSize, 10);
if (isNaN(MAX_FILE_SIZE)) {
  throw new Error(`❌ ERROR DE CONFIGURACIÓN: La variable MAX_FILE_SIZE [${rawMaxSize}] debe ser un número válido de bytes.`);
}

const rawMimetypes = getRequiredEnv('ALLOWED_MIMETYPES');
const ALLOWED_MIMETYPES = rawMimetypes.split(',').map(type => type.trim());
if (ALLOWED_MIMETYPES.length === 0 || ALLOWED_MIMETYPES[0] === '') {
  throw new Error(`❌ ERROR DE CONFIGURACIÓN: ALLOWED_MIMETYPES debe contener al menos un tipo MIME válido.`);
}

const rawProvider = getRequiredEnv('STORAGE_PROVIDER').toLowerCase();
const validProviders = ['local', 'r2', 's3', 'supabase', 'gcp'];
if (!validProviders.includes(rawProvider)) {
  throw new Error(`❌ ERROR DE CONFIGURACIÓN: STORAGE_PROVIDER [${rawProvider}] no es válido. Debe ser uno de: ${validProviders.join(', ')}`);
}
const STORAGE_PROVIDER = rawProvider as EnvConfig['STORAGE_PROVIDER'];

// Inicializar el objeto de configuración base
const config: EnvConfig = {
  PORT,
  MAX_FILE_SIZE,
  ALLOWED_MIMETYPES,
  STORAGE_PROVIDER
};

// ==============================================================================
// 2. Validaciones Condicionales según el Proveedor Activo (Fail-Fast)
// ==============================================================================

if (STORAGE_PROVIDER === 'local') {
  config.UPLOAD_DIR = getRequiredEnv('UPLOAD_DIR');
}

if (STORAGE_PROVIDER === 'r2' || STORAGE_PROVIDER === 's3') {
  config.S3_BUCKET_NAME = getRequiredEnv('S3_BUCKET_NAME');
  config.S3_ACCESS_KEY_ID = getRequiredEnv('S3_ACCESS_KEY_ID');
  config.S3_SECRET_ACCESS_KEY = getRequiredEnv('S3_SECRET_ACCESS_KEY');
  config.S3_REGION = getRequiredEnv('S3_REGION');
  
  // El endpoint es obligatorio para Cloudflare R2, opcional para AWS S3 estándar
  if (STORAGE_PROVIDER === 'r2') {
    config.S3_ENDPOINT = getRequiredEnv('S3_ENDPOINT');
  } else {
    config.S3_ENDPOINT = process.env.S3_ENDPOINT;
  }
  
  config.S3_PUBLIC_URL = process.env.S3_PUBLIC_URL;
}

if (STORAGE_PROVIDER === 'supabase') {
  config.SUPABASE_URL = getRequiredEnv('SUPABASE_URL');
  config.SUPABASE_ANON_KEY = getRequiredEnv('SUPABASE_ANON_KEY');
}

if (STORAGE_PROVIDER === 'gcp') {
  config.GCP_PROJECT_ID = getRequiredEnv('GCP_PROJECT_ID');
  config.GCP_BUCKET_NAME = getRequiredEnv('GCP_BUCKET_NAME');
}

// Congelar el objeto para evitar mutaciones accidentales en el ciclo de vida de la app
export const env = Object.freeze(config);
