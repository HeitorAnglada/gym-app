/**
 * Carregado pelo `npm test` (node --import). Troca módulos nativos do Expo por
 * versões para o Node, para os testes rodarem o código de src/db com SQLite de verdade.
 */
import { registerHooks } from 'node:module';

const stubs = {
  'expo-crypto': `data:text/javascript,import { randomUUID } from 'node:crypto'; export { randomUUID };`,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier in stubs) return { url: stubs[specifier], shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
