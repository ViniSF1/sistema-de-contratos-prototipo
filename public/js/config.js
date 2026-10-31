/**
 * Configuração central do front-end.
 *
 * O adaptador de dados é exclusivamente o Supabase.
 * O restante da aplicação conversa somente com a interface exposta por data/adapter.js.
 */
export const CONFIG = {
  SUPABASE: {
    URL: 'https://vbzwrzdywhlkaeapabps.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiendyemR5d2hsa2FlYXBhYnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyODczNTYsImV4cCI6MjEwODg2MzM1Nn0.GHCDr8ER2ZawAeB23pt975wJXTg26frlYaJ9yrG6_RY',
    BUCKET: 'contract-files',
  },
};
