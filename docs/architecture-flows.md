# Flux Architecturaux — Diagrammes Mermaid

## 1. Cycle de Vie d'un Ticket

```mermaid
stateDiagram-v2
    [*] --> NEW : Création
    NEW --> ASSIGNED : Assignation
    NEW --> CANCELLED : Annulation
    ASSIGNED --> IN_PROGRESS : Prise en charge
    ASSIGNED --> CANCELLED : Annulation
    IN_PROGRESS --> PENDING_CUSTOMER : En attente client
    IN_PROGRESS --> PENDING_THIRD_PARTY : En attente tiers
    IN_PROGRESS --> RESOLVED : Résolution
    PENDING_CUSTOMER --> IN_PROGRESS : Retour
    PENDING_CUSTOMER --> RESOLVED : Résolution
    PENDING_THIRD_PARTY --> IN_PROGRESS : Retour
    PENDING_THIRD_PARTY --> RESOLVED : Résolution
    RESOLVED --> CLOSED : Clôture
    RESOLVED --> REOPENED : Réouverture
    CLOSED --> REOPENED : Réouverture
    REOPENED --> IN_PROGRESS : Reprise
    REOPENED --> CANCELLED : Annulation
    CANCELLED --> [*]
```

## 2. Flux d'Authentification JWT avec Rotation

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant PostgreSQL
    participant Redis

    Client->>API: POST /auth/login {email, password}
    API->>PostgreSQL: SELECT user WHERE email
    PostgreSQL-->>API: user (+ password_hash)
    API->>API: Argon2.verify(password, hash)
    alt Identifiants valides
        API->>API: Générer accessToken (JWT, 15min)
        API->>API: Générer refreshToken (random 48 bytes)
        API->>PostgreSQL: INSERT refresh_tokens (hashé SHA-256)
        API-->>Client: {accessToken, refreshToken, user}
    else Identifiants invalides
        API-->>Client: 401 Unauthorized
    end

    Note over Client,Redis: Rafraîchissement (rotation)

    Client->>API: POST /auth/refresh {refreshToken}
    API->>PostgreSQL: SELECT refresh_token WHERE hash
    API->>PostgreSQL: UPDATE revoked_at (ancien token)
    API->>PostgreSQL: INSERT nouveau refresh_token
    API->>Redis: SADD jwt_blacklist (jti de l'ancien access token)
    API-->>Client: {accessToken, refreshToken}

    Note over Client,Redis: Déconnexion

    Client->>API: POST /auth/logout {refreshToken}
    API->>PostgreSQL: UPDATE revoked_at
    API->>Redis: SADD jwt_blacklist (jti access token courant)
    API-->>Client: 204 No Content
```

## 3. Pipeline Requête HTTP (Request Lifecycle)

```mermaid
sequenceDiagram
    participant Client
    participant Nginx
    participant Middleware
    participant Guard
    participant Pipe
    participant Controller
    participant Service
    participant PostgreSQL
    participant Redis
    participant BullMQ

    Client->>Nginx: POST /api/v1/tickets
    Nginx->>Nginx: TLS termination, rate limiting
    Nginx->>Middleware: Proxy

    Middleware->>Middleware: CorrelationId (génère/propage)
    Middleware->>Middleware: RequestLogger (Pino)

    Middleware->>Guard: Suivant

    Guard->>Guard: JwtAuthGuard (vérifie JWT + Redis blacklist)
    Guard->>Redis: SISMEMBER jwt_blacklist {jti}
    Guard->>PostgreSQL: SELECT user (vérifie existe + actif)
    Guard->>Guard: RolesGuard (vérifie @Roles)

    Guard->>Pipe: Suivant
    Pipe->>Pipe: ValidationPipe (class-validator)
    Pipe-->>Client: 400 si validation échoue

    Pipe->>Controller: DTO validé
    Controller->>Service: ticketsService.create(dto, user)

    Service->>Service: TicketNumberService.generate()
    Service->>PostgreSQL: SELECT nextval('ticket_number_seq')
    Service->>Service: State machine validation
    Service->>PostgreSQL: INSERT ticket + history
    Service->>Service: EventEmitter.emit('ticket.created')
    Service-->>Controller: {ticket}

    Controller-->>Client: 201 Created (via TransformInterceptor)

    Note over BullMQ: Traitement asynchrone (après réponse)
    Service->>BullMQ: Job notification + email + SLA
    BullMQ->>BullMQ: Workers process jobs
```

## 4. Traitement Asynchrone — Domain Events → BullMQ

```mermaid
flowchart LR
    subgraph "Requête HTTP (synchrone)"
        Controller --> Service
        Service --> PostgreSQL[(PostgreSQL)]
        Service --> EventEmitter
    end

    subgraph "Traitement Asynchrone"
        EventEmitter -->|ticket.created| HistoryListener
        EventEmitter -->|ticket.assigned| NotificationListener
        EventEmitter -->|ticket.status_changed| AuditListener
        EventEmitter -->|ticket.resolved| SlaListener

        HistoryListener --> PostgreSQL
        NotificationListener --> BullMQ[BullMQ Queue]
        AuditListener --> PostgreSQL
        SlaListener --> BullMQ

        BullMQ --> EmailWorker[Email Worker]
        BullMQ --> NotificationWorker[Notification Worker]
        BullMQ --> SlaWorker[SLA Worker]

        EmailWorker --> SMTP[SMTP/Mailpit]
        NotificationWorker --> PostgreSQL
        NotificationWorker --> WebSocket
        SlaWorker --> PostgreSQL
    end
```

## 5. Architecture des Files BullMQ

```mermaid
flowchart TB
    subgraph "Producers (Services NestJS)"
        TicketService[TicketService]
        AuthService[AuthService]
        SlaEngine[SlaEngineService]
    end

    subgraph "Redis (Message Broker)"
        Redis[(Redis)]
    end

    subgraph "Queues"
        Q1[email-queue<br/>Emails transactionnels]
        Q2[notification-queue<br/>Notifications in-app]
        Q3[sla-queue<br/>Vérifications SLA]
        Q4[audit-queue<br/>Logs d'audit asynchrones]
    end

    subgraph "Workers (Processus séparés)"
        W1[EmailWorker<br/>Nodemailer + Handlebars]
        W2[NotificationWorker<br/>Insert DB + WebSocket emit]
        W3[SlaWorker<br/>Breach detection + escalation]
        W4[AuditWorker<br/>Écriture audit_logs]
    end

    TicketService -->|job| Q1
    TicketService -->|job| Q2
    SlaEngine -->|job| Q3
    TicketService -->|job| Q4

    Q1 --> Redis
    Q2 --> Redis
    Q3 --> Redis
    Q4 --> Redis

    Redis --> W1
    Redis --> W2
    Redis --> W3
    Redis --> W4

    W1 --> SMTP[SMTP Server]
    W2 --> PostgreSQL[(PostgreSQL)]
    W3 --> PostgreSQL
    W4 --> PostgreSQL
```

## 6. Stack d'Observabilité

```mermaid
flowchart LR
    subgraph "Application NestJS"
        API[NestJS API]
        Pino[Logger Pino]
        OTel[OpenTelemetry SDK]
        PromClient[prom-client]
    end

    subgraph "Collecte & Stockage"
        Loki[(Loki)]
        Tempo[(Tempo)]
        Prometheus[(Prometheus)]
    end

    subgraph "Visualisation & Alertes"
        Grafana[Grafana Dashboards]
        Alerts[Alertes PagerDuty/Slack]
    end

    API --> Pino
    API --> OTel
    API --> PromClient

    Pino -->|Logs JSON| Loki
    OTel -->|Traces distribuées| Tempo
    PromClient -->|Métriques /metrics| Prometheus

    Loki --> Grafana
    Tempo --> Grafana
    Prometheus --> Grafana
    Prometheus --> Alerts
```

## 7. Déploiement Docker Compose (Vue C4 — Niveau Conteneurs)

```mermaid
flowchart TB
    subgraph "Internet"
        User[Employé Télécom]
    end

    subgraph "Docker Host"
        Nginx[Nginx Reverse Proxy<br/>:80, :443]
        API[NestJS API<br/>:3000]
        Worker[BullMQ Workers<br/>Processus séparé]
        PG[(PostgreSQL 16<br/>:5432)]
        RD[(Redis 7<br/>:6379)]
        Mailpit[Mailpit<br/>SMTP :1025, Web :8025]

        subgraph "Observabilité (optionnel)"
            Prom[Prometheus]
            LokiS[Loki]
            TempoS[Tempo]
            Graf[Grafana :3001]
        end
    end

    User -->|HTTPS| Nginx
    Nginx -->|Proxy| API
    API --> PG
    API --> RD
    Worker --> RD
    Worker --> PG
    API --> Mailpit
    Worker --> Mailpit
    API --> Prom
    API --> LokiS
    API --> TempoS
    Prom --> Graf
    LokiS --> Graf
    TempoS --> Graf
```

## 8. RBAC — Flux de Décision d'Autorisation

```mermaid
flowchart TD
    Request[Requête HTTP] --> JWTGuard{JwtAuthGuard}
    JWTGuard -->|Token absent/invalide| Reject1[401 Unauthorized]
    JWTGuard -->|Token valide| RedisCheck{JTI dans<br/>blacklist Redis?}
    RedisCheck -->|Oui| Reject2[401 Token révoqué]
    RedisCheck -->|Non| UserCheck{Utilisateur<br/>existe + actif?}
    UserCheck -->|Non| Reject3[401 Désactivé]
    UserCheck -->|Oui| RolesGuard{RolesGuard}

    RolesGuard -->|Pas de @Roles| Pass[Accès autorisé]
    RolesGuard -->|@Roles requis| RoleCheck{Rôle dans<br/>la liste?}
    RoleCheck -->|Oui| Pass
    RoleCheck -->|Non| Reject4[403 Forbidden]

    Pass --> Controller[Controller]
```

## 9. Cache Redis — Stratégie Cache-Aside

```mermaid
sequenceDiagram
    participant Service
    participant Redis
    participant PostgreSQL

    Service->>Redis: GET dashboard:overview:2026-06
    alt Cache HIT
        Redis-->>Service: Données (JSON)
        Service-->>Client: Réponse (< 5ms)
    else Cache MISS
        Redis-->>Service: null
        Service->>PostgreSQL: SELECT agrégations
        PostgreSQL-->>Service: Données brutes
        Service->>Redis: SETEX dashboard:overview:2026-06 60 {json}
        Service-->>Client: Réponse (~50ms)
    end

    Note over Service,Redis: Invalidation au changement
    Service->>Redis: DEL dashboard:overview:*
    Service->>Redis: DEL dashboard:departments:*
```
