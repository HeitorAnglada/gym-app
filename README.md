# kargo

App Android de treino de academia: mostra a ficha do dia, anota as cargas e conta os descansos, com uma tela feita para usar entre séries.

**a carga certa, na hora certa. o resto é treino.** · kargo · por kairos

- Especificação da v1: documento "kargo v1: especificação" (no projeto do Claude)
- Telas desenhadas: artefato "Telas do kargo"

## Estado

A v1 tem: tela de treino (série/descanso, timer que conta pra cima com aviso no alvo, cargas com −/+, troca por substituto, extras, ordem livre, só prioridades), resumo do fim do treino, histórico com calendário e detalhe editável por 7 dias, página de cada exercício (gráfico, recordes, descanso médio), montagem de pastas e fichas pelo app, catálogo de 108 exercícios e backup em JSON.

## Rodar

```bash
npm install
npx expo start          # abre no Expo Go ou num development build
npm test                # regras do treino (node:test)
npm run typecheck
```

## Baixar o APK

Cada push gera o APK automaticamente (GitHub Actions) e publica em **Releases**: as da `main` são as versões normais; as de outras branches saem como pré-release para teste. Baixe o `.apk` no celular e abra para instalar.

## Gerar o APK pelo EAS

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
| `src/domain/` | Regras puras e testadas: progressão dupla, estagnação, próxima ficha, descanso, séries do treino, edição de fichas, datas. |
| `src/db/` | Esquema SQLite com migrações, consultas e backup. |
| `src/data/` | Catálogo de exercícios e a ficha do Heitor. |
| `src/ui/` | Cores, fontes, ícones e componentes. |

Os dados ficam só no aparelho. Toda tabela tem id UUID, `updated_at` e `deleted_at`, para a sincronização com login entrar depois sem migrar dados.
