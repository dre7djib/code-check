# catalog-node

Catalogue fictif, TypeScript, mêmes couches que `billing-hex`, autres chemins et un autre outil déterministe (`dependency-cruiser`). Stand-in du second pilote : les règles vivent dans ce repo, pas dans le plugin.

## Lancer

```bash
npm install
npm test            # compile, puis Money, vert
npm run typecheck   # vert
npm run check:arch  # rouge : domain-free-of-frameworks
```

`check:arch` doit échouer sur l'import d'Express dans le domaine, et seulement sur celui-là.

## Couches

| Couche | Chemin | Peut importer |
|---|---|---|
| domain | `src/domain/**` | rien |
| application | `src/application/**` | domain |
| adapters | `src/adapters/**` | domain, application |

`src/support/` est hors couches. Les règles sont dans `.review/rules.yml`. Les imports interdits citent `express`, pas Spring.

## Ce qui est conforme

- `ProductRepository` et `MemoryProductRepository`.
- `PublishProduct` ne dépend que du domaine.
- `StockServiceTransactional` porte le décorateur `@Transactional` et le suffixe. Le fichier ne matche pas `**/*Service.ts` (il se termine par `Transactional.ts`) : la règle de nommage ne le sélectionne pas, et le nom est quand même celui attendu.
- `Money` a un test. `DiscountPolicy` n'en a pas.

## Défauts plantés

| Cas | Axe | Sévérité | Fichier |
|---|---|---|---|
| `hex-import` | architecture | blocking | `domain/events/ProductEvents.ts` importe `express` |
| `naming-transactional` | naming | fix | `application/ProductService.ts` a `@Transactional` sans le suffixe |
| `missing-test` | tests | fix | `domain/pricing/DiscountPolicy.ts` n'a aucun test |
| `empty-catch` | errors | fix | `adapters/http/ProductRouter.ts` a un `catch` vide |
| `unpinned-dep` | deterministic | suggestion | `package.json`, `uuid` en `*` |
| `needless-factory` | simplicity | suggestion | `support/LabelFactory.ts`, une seule implémentation, hors ADR |
| `security-sql` | sécurité, hors revue | — | `adapters/persistence/ProductSearch.ts`, concaténation SQL d'école |

Même règle de rapport que sur la démo Java : la requête concaténée sort de la revue de code. Le port `ProductRepository` ne doit pas être qualifié de sur-ingénierie.
