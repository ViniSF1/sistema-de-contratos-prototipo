/** Estado compartilhado em memória entre as telas (sempre recarregado pelo adapter). */
import { adapter } from './data/adapter.js';
import { sameId } from './utils.js';

export const state = {
  user: null,
  contracts: [],
  files: [],
  /** IDs do último filtro da grade, usados em "exportar apenas filtrados". */
  filteredIds: null,
};

export async function loadAll() {
  const [contracts, files] = await Promise.all([
    adapter.listContracts(),
    adapter.listFiles(),
  ]);
  state.contracts = contracts;
  state.files = files;
}

export async function refreshContracts() {
  state.contracts = await adapter.listContracts();
  return state.contracts;
}

export async function refreshFiles() {
  state.files = await adapter.listFiles();
  return state.files;
}

export function contractById(id) {
  return state.contracts.find((contract) => sameId(contract.id, id)) || null;
}

export function filesForContract(id) {
  return state.files
    .filter((file) => sameId(file.contrato_id, id))
    .sort((a, b) => String(b.enviado_em).localeCompare(String(a.enviado_em)));
}

export function upsertContract(contract) {
  const index = state.contracts.findIndex((item) => sameId(item.id, contract.id));
  if (index >= 0) state.contracts[index] = contract;
  else state.contracts.push(contract);
}

export function removeContractFromState(id) {
  state.contracts = state.contracts.filter((contract) => !sameId(contract.id, id));
  state.files = state.files.filter((file) => !sameId(file.contrato_id, id));
  if (state.filteredIds) {
    state.filteredIds = state.filteredIds.filter((item) => !sameId(item, id));
  }
}
