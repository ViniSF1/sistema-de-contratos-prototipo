/**
 * Constantes compartilhadas pelas telas.
 *
 * A fonte única de verdade é public/js/shared/catalog.js, importada também
 * pelo back-end (server/validation.js e server/files.js). Este arquivo apenas
 * re-exporta para manter os imports existentes das telas.
 */
export {
  STATUS_OPTIONS,
  TIPO_OPTIONS,
  FILE_CATEGORIES,
  MAX_FILE_MB,
  MAX_FILE_BYTES,
  ALLOWED_FILE_EXTENSIONS,
  DANGEROUS_FILE_EXTENSIONS,
  CONTRACT_TEXT_LIMITS,
  ISO_DATE_PATTERN,
  isValidISODate,
  parseDecimalBR,
} from './shared/catalog.js';
