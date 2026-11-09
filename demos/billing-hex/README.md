# billing-hex

Facturation fictive, Java 17, architecture hexagonale. Stand-in du pilote hexagonal de la phase 0. Rien à déployer : le code compile, les tests d'architecture sont rouges à cause d'un import planté.

## Lancer

```bash
mvn -q -DskipTests compile    # doit passer
mvn -q test                   # échoue : domain_does_not_depend_on_frameworks
```

`ArchitectureTest` est le check ArchUnit que le plugin lancera s'il est présent. L'échec attendu est l'import Spring dans le domaine. La règle `application_does_not_depend_on_adapters` reste verte.

## Couches

| Couche | Chemin | Peut importer |
|---|---|---|
| domain | `src/main/java/com/acme/billing/domain/**` | rien |
| application | `src/main/java/com/acme/billing/application/**` | domain |
| adapters | `src/main/java/com/acme/billing/adapters/**` | domain, application |

`support/` est hors couches. Une abstraction qui s'y trouve n'est pas protégée par l'ADR.

Les règles versionnées sont dans `.review/rules.yml`.

## Ce qui est conforme

- `InvoiceRepository` (port) et `JpaInvoiceRepository` (adapter). Jakarta Persistence reste dans l'adapter.
- `IssueInvoice` ne dépend que du domaine.
- `PaymentServiceTransactional` porte `@Transactional` et le suffixe attendu.
- `Money` a un test. `MoneyTest` ne couvre pas `LateFeePolicy`.

## Défauts plantés

| Cas | Axe | Sévérité | Fichier |
|---|---|---|---|
| `hex-import` | architecture | blocking | `domain/notify/InvoiceEventPublisher.java` importe `org.springframework` |
| `naming-transactional` | naming | fix | `application/InvoiceService.java` est `@Transactional` sans le suffixe |
| `missing-test` | tests | fix | `domain/LateFeePolicy.java` n'a aucun test |
| `empty-catch` | errors | fix | `adapters/web/InvoiceController.java` avale `RuntimeException` |
| `unpinned-dep` | deterministic | suggestion | `pom.xml`, Guava en plage `[33.0.0,34.0.0)` |
| `needless-factory` | simplicity | suggestion | `support/DocumentFactory.java`, une seule implémentation, hors ADR |
| `security-sql` | sécurité, hors revue | — | `adapters/persistence/JdbcInvoiceSearch.java`, concaténation SQL d'école, identifiants fictifs |

`security-sql` ne doit pas apparaître dans `REVIEW.md`. Au plus une ligne « des points ont été transmis au rapport sécurité ».

`InvoiceRepository` et son adapter ne sont pas de la sur-ingénierie : l'axe simplicité ne doit pas les signaler (`port-not-bloat`).
