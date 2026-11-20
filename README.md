# kargo

App Android de treino de academia: mostra a ficha do dia, anota as cargas e conta os descansos, com uma tela feita para usar entre séries.

**a carga certa, na hora certa. o resto é treino.** · kargo · por kairos

- Especificação da v1: documento "kargo v1: especificação" (no projeto do Claude)
- Telas desenhadas: artefato "Telas do kargo"

## Estado

Esta etapa monta a base: projeto Expo, banco local, regras do treino (com testes), catálogo de 108 exercícios, as 4 abas e a importação de backup. A tela de treino (série/descanso, timer, anotação de cargas) vem na próxima etapa.

## Rodar

```bash
npm install
npx expo start          # abre no Expo Go ou num development build
npm test                # regras do treino (node:test)
npm run typecheck
```

## Gerar o APK

```bash
npx eas-cli@latest build --platform android --profile preview      # APK para instalar direto
npx eas-cli@latest build --platform android --profile production   # AAB para a Play Store
```

## Sua ficha pronta

`npm run backup:heitor -- kargo-backup-heitor.json` gera um backup com o catálogo e a pasta "Hipertrofia ABC" (A1 → B → A2, com as cargas atuais). No app: engrenagem › Importar backup.

## Estrutura

| Pasta | O que tem |
| --- | --- |
| `src/app/` | Telas (Expo Router). `(tabs)/` são as 4 abas. |
| `src/domain/` | Regras puras e testadas: progressão dupla, estagnação, próxima ficha, descanso, datas. |
| `src/db/` | Esquema SQLite com migrações, consultas e backup. |
| `src/data/` | Catálogo de exercícios e a ficha do Heitor. |
| `src/ui/` | Cores, fontes, ícones e componentes. |

Os dados ficam só no aparelho. Toda tabela tem id UUID, `updated_at` e `deleted_at`, para a sincronização com login entrar depois sem migrar dados.
