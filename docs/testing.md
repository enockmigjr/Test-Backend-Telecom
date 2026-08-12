# Guide des Tests

## Vue d'ensemble

| Type             | Nombre (fichiers)                          | Emplacement          | Commande             |
| ---------------- | ------------------------------------------- | -------------------- | -------------------- |
| Unitaires        | 89 `*.spec.ts` (comptage réel à exécuter ; manifest release : 598 tests / 87 suites) | `src/**/*.spec.ts`   | `pnpm run test:unit` |
| End-to-End (E2E) | 24 fichiers (E2E + intégration)            | `test/*.e2e-spec.ts`, `test/integration/*` | `pnpm run test:e2e` / `pnpm run test:integration` |
| **Total**        | 113 fichiers de tests (nombres de tests à re-valider par exécution) | — | `pnpm run test:all` |

## Commandes

```bash
# Tests unitaires uniquement
pnpm run test:unit

# Tests unitaires en mode watch (développement)
pnpm run test:watch

# Tests unitaires avec couverture
pnpm run test:cov

# Tests E2E (nécessite PostgreSQL + Redis)
pnpm run test:e2e

# TOUS les tests (unitaires + E2E + intégration)
pnpm run test:all
```

## Tests unitaires (Jest)

### Convention de nommage

```
src/modules/<module>/
├── <module>.service.ts          # Code source
├── <module>.service.spec.ts     # Tests unitaires du service
├── <module>.controller.ts       # Code source
└── <module>.controller.spec.ts  # Tests unitaires du controller
```

### Structure d'un test

```typescript
describe('TicketsService', () => {
  let service: TicketsService;
  let mockDrizzle: DeepMockProxy<DrizzleDB>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TicketsService, { provide: DRIZZLE_TOKEN, useValue: mockDeep<DrizzleDB>() }],
    }).compile();

    service = module.get(TicketsService);
    mockDrizzle = module.get(DRIZZLE_TOKEN);
  });

  describe('findAll', () => {
    it('should return paginated tickets', async () => {
      // Arrange
      mockDrizzle.select.mockReturnValue(/* ... */);

      // Act
      const result = await service.findAll({ page: 1, limit: 10 });

      // Assert
      expect(result.data).toHaveLength(10);
      expect(result.meta.page).toBe(1);
    });
  });
});
```

### Mocking

- **Drizzle ORM** : `jest-mock-extended` (`mockDeep<DrizzleDB>()`)
- **Services** : injection de mocks via `useValue` dans le module de test
- **Redis** : mock en mémoire
- **EventEmitter** : mock avec `jest.fn()`

## Tests E2E (Supertest)

### Prérequis

Les tests E2E nécessitent une base de données PostgreSQL et Redis démarrés :

```bash
docker compose up -d postgres redis
pnpm run db:push
```

### Configuration

Fichier : `test/jest-e2e.json`

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" }
}
```

### Structure d'un test E2E

```typescript
describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('should return tokens on valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@telecom.local', password: 'Admin@1234' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.accessToken).toBeDefined();
        });
    });
  });
});
```

## Couverture de tests par module

| Module         | Unitaires               | E2E                       |
| -------------- | ----------------------- | ------------------------- |
| Auth           | ✅ Service + Controller | ✅ Login, refresh, logout |
| Users          | ✅ Service + Controller | ✅ CRUD + activation      |
| Tickets        | ✅ Service + Controller | ✅ CRUD + state machine   |
| Comments       | ✅ Service + Controller | ✅ CRUD                   |
| Internal Notes | ✅ Service + Controller | ✅ CRUD                   |
| Departments    | ✅ Service + Controller | ✅ CRUD                   |
| Categories     | ✅ Service + Controller | ✅ CRUD                   |
| SLA            | ✅ Service + Controller | ✅ CRUD + engine          |
| Dashboard      | ✅ Service + Controller | ✅ 7 endpoints            |
| Audit Logs     | ✅ Service + Controller | ✅ Liste + filtres        |
| Notifications  | ✅ Service + Controller | ✅ CRUD + mark-read       |
| Settings       | ✅ Service + Controller | ✅ GET + PATCH            |
| Email          | ✅ Service              | —                         |
| Reports        | ✅ Service + Controller | ✅ Génération             |
| Attachments    | ✅ Service + Controller | ✅ Upload/download        |

## Bonnes pratiques

- Tester le **comportement** (résultat), pas l'**implémentation** (comment)
- Un `describe` par méthode publique
- Nommer les tests en français (style BDD) : `'devrait retourner 403 si non autorisé'`
- Pas de dépendance entre les tests (chaque test est indépendant)
- Nettoyer les données de test dans `afterEach` / `afterAll`
