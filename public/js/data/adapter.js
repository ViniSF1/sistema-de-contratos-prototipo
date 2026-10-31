/**
 * Fachada única de acesso a dados.
 *
 * Todas as telas importam `adapter` deste arquivo — nunca chamam fetch diretamente.
 * O único adaptador disponível é o Supabase.
 */
import { CONFIG } from '../config.js';
import { SupabaseAdapter } from './supabaseAdapter.js';

export { ApiError, AuthError } from './errors.js';

/**
 * Contrato da camada de dados:
 *   login(usuario, senha) -> { usuario, token? }
 *   logout()
 *   getSession() -> usuario
 *   listContracts() -> contrato[]
 *   getContract(id) -> contrato
 *   createContract(dados) -> contrato
 *   updateContract(id, alteracoes) -> contrato
 *   deleteContract(id) -> { ok }
 *   listFiles(filtros?) -> arquivo[]
 *   uploadFile({ contratoId, categoria, file, onProgress }) -> arquivo
 *   downloadFile(id) -> { blob, filename }
 *   viewFileUrl(id) -> Promise<URL> para iframe (PDF/imagem)
 *   deleteFile(id) -> { ok }
 *   exportData({ formato, escopo, ids }) -> { blob, filename }
 */
export const adapter = new SupabaseAdapter(CONFIG.SUPABASE);

export function isSupabaseMode() {
  return true;
}
