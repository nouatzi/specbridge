# SpecBridge : Architecture Decision Runtime

## Une approche pragmatique de "l'outil du milieu"

**Version 1.0 — Janvier 2026**

---

## Résumé exécutif

Ce document propose **SpecBridge**, un système qui transforme les décisions architecturales en contraintes exécutables, vérifiables et évolutives. L'objectif n'est pas de remplacer les agents de code ou les outils de spécification existants, mais de créer une **couche d'intégration vivante** entre intention et implémentation.

Principes fondateurs :
- **Adoption progressive** : chaque composant apporte de la valeur isolément
- **Inférence d'abord** : le système apprend du code existant avant d'imposer
- **Friction calibrée** : les contraintes s'intensifient avec la criticité

---

## Partie 1 : Le problème reformulé

### 1.1 Ce qui manque vraiment

Le document original identifie correctement le gap entre décisions et implémentations. Mais je propose une reformulation plus opérationnelle :

**Le problème n'est pas l'absence d'artefacts, c'est l'absence de liaison dynamique.**

La plupart des équipes *ont* des specs, des schémas, des conventions. Ce qui manque :

1. **Un lien bidirectionnel** entre ces artefacts et le code
2. **Une détection temps réel** des divergences
3. **Un chemin de résolution** quand divergence il y a

### 1.2 Les trois modes de défaillance

| Mode | Symptôme | Cause racine |
|------|----------|--------------|
| **Dérive silencieuse** | Le code s'éloigne de la spec sans que personne ne s'en aperçoive | Pas de vérification automatique |
| **Improvisation locale** | Chaque dev (ou agent) réinvente les patterns | Pas de source de vérité accessible au moment du code |
| **Fossilisation** | Les specs deviennent obsolètes et sont ignorées | Coût de maintenance trop élevé |

SpecBridge attaque ces trois modes simultanément.

---

## Partie 2 : Architecture de SpecBridge

### 2.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                        SPECBRIDGE RUNTIME                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   INFÉRENCE  │───▶│   REGISTRY   │◀───│  VÉRIFICATION│       │
│  │   ENGINE     │    │  (Sources de │    │   ENGINE     │       │
│  │              │    │   vérité)    │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         ▲                   │                   │               │
│         │                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   CODEBASE   │    │  PROPAGATION │    │   REPORTING  │       │
│  │   SCANNER    │    │   ENGINE     │    │   & ALERTS   │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                             │                                   │
│                             ▼                                   │
│                      ┌──────────────┐                           │
│                      │    AGENT     │                           │
│                      │  INTERFACE   │                           │
│                      └──────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Les six composants

#### A) Inference Engine — "Apprendre avant d'imposer"

**Fonction** : Analyser le code existant pour extraire les patterns implicites.

**Mécanisme** :
- Scan statique du codebase (AST, dépendances, structures)
- Détection de patterns récurrents (naming, architecture, error handling)
- Génération de "draft constraints" soumises à validation humaine

**Exemple concret** :
```
[INFÉRÉ] 87% des endpoints suivent le pattern :
  - Route: /api/v1/{resource}
  - Auth: middleware 'requireAuth' appliqué
  - Response: { data: T, error?: ErrorPayload }

[EXCEPTION DÉTECTÉE] 4 endpoints ne suivent pas ce pattern :
  - POST /webhooks/stripe (intentionnel? webhook externe)
  - GET /health (intentionnel? health check)
  - POST /api/v1/admin/reset (ALERTE: route admin sans auth standard)
  - GET /api/internal/metrics (ALERTE: route non documentée)

[ACTION REQUISE] Valider ou ajuster ces observations
```

**Valeur** : Pas besoin de tout spécifier from scratch. Le système propose, l'humain dispose.

---

#### B) Registry — "Sources de vérité vivantes"

**Fonction** : Stocker les décisions validées sous forme structurée et versionée.

**Structure proposée** :

```yaml
# .specbridge/decisions/auth-strategy.decision.yaml
kind: Decision
metadata:
  id: auth-001
  title: "Stratégie d'authentification"
  status: active
  created: 2026-01-15
  owners: [security-team]

decision:
  summary: "JWT avec refresh token, RBAC basé sur claims"
  rationale: "Scalabilité horizontale, pas de session serveur"
  
constraints:
  - id: auth-001-c1
    type: invariant
    rule: "Tout endpoint sous /api/** (sauf /api/public/**) requiert un JWT valide"
    severity: critical
    
  - id: auth-001-c2  
    type: convention
    rule: "Les rôles sont stockés dans le claim 'roles' du JWT"
    severity: high

  - id: auth-001-c3
    type: guideline
    rule: "Préférer les permissions granulaires aux rôles larges"
    severity: medium

verification:
  automated:
    - check: route-auth-coverage
      target: "src/routes/**/*.ts"
    - check: jwt-claim-structure
      target: "src/auth/token.ts"
  manual:
    - review: security-audit
      frequency: quarterly
```

**Types de contraintes** :
- **Invariant** : Ne doit jamais être violé (bloque le merge)
- **Convention** : Doit être respecté sauf justification (warning + demande de justification)
- **Guideline** : Recommandé (info seulement)

---

#### C) Verification Engine — "Prouver, pas espérer"

**Fonction** : Vérifier en continu que le code respecte les décisions.

**Niveaux de vérification** :

| Niveau | Quand | Quoi | Action si échec |
|--------|-------|------|-----------------|
| **Lint-time** | À chaque save (IDE) | Patterns syntaxiques simples | Warning inline |
| **Commit-time** | Pre-commit hook | Vérifications rapides (<5s) | Bloque le commit |
| **PR-time** | CI/CD | Vérifications complètes | Bloque le merge |
| **Runtime** | Monitoring | Comportement en production | Alerte + logs |

**Exemple de vérificateur** :

```typescript
// .specbridge/verifiers/auth-coverage.verifier.ts
import { Verifier, Decision, Violation } from '@specbridge/core';

export const authCoverageVerifier: Verifier = {
  id: 'route-auth-coverage',
  appliesTo: ['auth-001-c1'],
  
  async verify(codebase, decision): Promise<Violation[]> {
    const routes = await codebase.findAll('src/routes/**/*.ts');
    const violations: Violation[] = [];
    
    for (const route of routes) {
      const endpoint = parseRouteFile(route);
      
      if (endpoint.path.startsWith('/api/') && 
          !endpoint.path.startsWith('/api/public/') &&
          !hasAuthMiddleware(endpoint)) {
        
        violations.push({
          constraint: 'auth-001-c1',
          severity: 'critical',
          location: route.path,
          message: `Endpoint ${endpoint.method} ${endpoint.path} n'a pas de middleware d'auth`,
          suggestion: `Ajouter requireAuth() avant le handler`,
          autoFixAvailable: true
        });
      }
    }
    
    return violations;
  }
};
```

---

#### D) Propagation Engine — "Voir les conséquences"

**Fonction** : Quand une source de vérité change, identifier tous les impacts.

**Mécanisme** :

1. **Graphe de dépendances** : Chaque artefact connaît ses dépendants
2. **Analyse d'impact** : Calcul des changements nécessaires
3. **Plan de migration** : Séquence d'actions avec estimations

**Exemple** :

```
[CHANGEMENT DÉTECTÉ]
  Decision: data-model-007
  Modification: Ajout du champ 'deletedAt' sur l'entité Reservation
  
[ANALYSE D'IMPACT]
  
  ├── Database
  │   └── Migration requise: AddDeletedAtToReservation
  │       Effort estimé: trivial
  │       Risque: faible (nouveau champ nullable)
  
  ├── API
  │   ├── GET /reservations : Doit filtrer deletedAt IS NULL
  │   │   Effort: faible | Fichier: src/routes/reservations/list.ts
  │   ├── GET /reservations/:id : Doit vérifier deletedAt IS NULL
  │   │   Effort: faible | Fichier: src/routes/reservations/get.ts
  │   └── DELETE /reservations/:id : Doit soft-delete (pas hard delete)
  │       Effort: moyen | Fichier: src/routes/reservations/delete.ts
  
  ├── Tests
  │   ├── 3 tests existants à modifier (filtrage)
  │   └── 5 nouveaux tests suggérés (soft delete behavior)
  
  └── Documentation
      └── API docs à mettre à jour (comportement DELETE)

[ACTIONS PROPOSÉES]
  1. Générer la migration SQL
  2. Créer les patches pour les 3 routes
  3. Générer les stubs de tests
  4. Mettre à jour l'OpenAPI spec
  
  [Appliquer tout] [Réviser un par un] [Ignorer]
```

---

#### E) Reporting & Alerts — "Santé du système"

**Fonction** : Dashboard de conformité et alertes proactives.

**Métriques clés** :

```
╔══════════════════════════════════════════════════════════════╗
║                    SPECBRIDGE HEALTH REPORT                  ║
║                         2026-01-25                           ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  CONFORMITÉ GLOBALE                          ████████░░ 82%  ║
║                                                              ║
║  Par domaine:                                                ║
║    Authentication & Authorization            ██████████ 100% ║
║    API Contracts                             █████████░  94% ║
║    Data Model                                ████████░░  85% ║
║    Error Handling                            ██████░░░░  62% ║
║    Observability                             ████░░░░░░  45% ║
║                                                              ║
║  VIOLATIONS ACTIVES                                          ║
║    🔴 Critiques:     2  (bloquent le déploiement)            ║
║    🟠 Importantes:   7  (deadline: 7 jours)                  ║
║    🟡 Mineures:     23  (backlog)                            ║
║                                                              ║
║  DÉRIVE RÉCENTE (7 derniers jours)                           ║
║    +3 nouvelles violations                                   ║
║    -8 violations résolues                                    ║
║    Tendance: ↗ amélioration                                  ║
║                                                              ║
║  DÉCISIONS SANS VÉRIFICATION AUTOMATIQUE                     ║
║    5 décisions n'ont pas de verifier actif                   ║
║    → Risque de dérive non détectée                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

#### F) Agent Interface — "Contraindre sans brider"

**Fonction** : Exposer les décisions aux agents de code (Copilot, Claude, etc.).

**Deux modes d'interaction** :

**Mode 1 : Contexte enrichi (prompt injection)**

Quand un agent travaille sur un fichier, il reçoit automatiquement :

```markdown
## SPECBRIDGE CONTEXT FOR: src/routes/reservations/cancel.ts

### Applicable Decisions:
- [auth-001] Requires JWT auth middleware
- [reservation-003] Cancellation only allowed if startAt > now + 24h
- [audit-002] All mutations must emit audit event

### Existing Patterns in Codebase:
- Error format: { code: string, message: string, details?: object }
- Validation: use zod schemas in /src/schemas/
- Audit: call auditService.log() after mutation

### Recent Violations in This Area:
- PR #234: Missing audit log on update (fixed)
- PR #201: Auth middleware bypassed (rejected)

### DO:
- Apply requireAuth() middleware
- Validate cancellation business rules
- Emit ReservationCancelled event

### DON'T:
- Hard-delete reservations (use soft delete)
- Return raw database errors to client
```

**Mode 2 : Validation post-génération**

L'agent génère, SpecBridge valide immédiatement :

```
[AGENT OUTPUT REVIEW]

Generated code for: POST /api/v1/reservations/:id/cancel

✅ Auth middleware: present
✅ Input validation: uses zod schema
✅ Soft delete: correct pattern
⚠️ Audit event: MISSING
   → Decision audit-002 requires ReservationCancelled event
   → Suggested fix: Add auditService.log('ReservationCancelled', {...})
❌ Business rule: INCOMPLETE
   → Decision reservation-003 requires 24h advance check
   → Current code only checks if reservation exists
   
[Auto-fix available for 2/2 issues]
```

---

## Partie 3 : Implémentation progressive

### 3.1 Les cinq niveaux de maturité

L'adoption se fait par paliers. Chaque niveau apporte de la valeur sans exiger le suivant.

```
Niveau 5: Correction automatique
    ▲     L'agent corrige les violations mineures sans intervention
    │
Niveau 4: Génération contrainte  
    │     L'agent reçoit le contexte et génère du code conforme
    │
Niveau 3: Détection de dérive
    │     CI détecte les violations et bloque si critique
    │
Niveau 2: Documentation active
    │     Les décisions sont documentées et versionnées
    │
Niveau 1: Observation
    ▼     Le système infère les patterns existants
```

### 3.2 Plan d'implémentation réaliste

**Phase 1 (Semaines 1-2) : Observer**

Objectif : Comprendre le codebase sans rien imposer

Actions :
- Déployer le scanner sur le repo
- Générer le rapport d'inférence
- Identifier les 10 patterns les plus stables
- Identifier les 5 incohérences les plus flagrantes

Livrable : Rapport de santé initiale

---

**Phase 2 (Semaines 3-4) : Formaliser**

Objectif : Transformer les patterns validés en décisions

Actions :
- Workshop avec l'équipe sur les patterns inférés
- Rédiger 5-10 décisions critiques (auth, data model, errors)
- Créer les fichiers .decision.yaml
- Documenter les exceptions connues

Livrable : Registry initial avec décisions fondamentales

---

**Phase 3 (Semaines 5-8) : Vérifier**

Objectif : Automatiser la détection de violations

Actions :
- Écrire les verifiers pour les décisions critiques
- Intégrer au CI (mode warning d'abord)
- Résoudre les violations existantes
- Passer en mode bloquant pour les invariants

Livrable : CI qui bloque les violations critiques

---

**Phase 4 (Semaines 9-12) : Propager**

Objectif : Gérer le changement de façon contrôlée

Actions :
- Construire le graphe de dépendances
- Implémenter l'analyse d'impact
- Tester sur 2-3 changements réels
- Affiner les estimations

Livrable : Propagation engine fonctionnel

---

**Phase 5 (Mois 4+) : Intégrer**

Objectif : Boucler avec les agents de code

Actions :
- Créer l'interface de contexte pour agents
- Tester avec l'agent principal de l'équipe
- Mesurer l'amélioration du taux de conformité
- Itérer sur le format de contexte

Livrable : Agents contraints par SpecBridge

---

## Partie 4 : Formats et standards

### 4.1 Structure de fichiers

```
.specbridge/
├── config.yaml                    # Configuration globale
├── decisions/
│   ├── auth-strategy.decision.yaml
│   ├── api-conventions.decision.yaml
│   ├── data-model.decision.yaml
│   └── ...
├── verifiers/
│   ├── auth-coverage.verifier.ts
│   ├── api-contract.verifier.ts
│   └── ...
├── inferred/
│   ├── patterns.json              # Patterns détectés (auto-généré)
│   └── exceptions.json            # Exceptions connues
└── reports/
    ├── health-latest.json
    └── history/
        └── ...
```

### 4.2 Schéma de décision (complet)

```yaml
kind: Decision
version: "1.0"

metadata:
  id: string                       # Identifiant unique (ex: auth-001)
  title: string                    # Titre lisible
  status: draft | active | deprecated | superseded
  created: date
  updated: date
  owners: string[]                 # Équipes/personnes responsables
  tags: string[]                   # Pour filtrage/recherche
  supersedes: string[]             # IDs des décisions remplacées
  supersededBy: string             # ID de la décision qui remplace

decision:
  summary: string                  # Résumé en une phrase
  rationale: string                # Pourquoi cette décision
  alternatives:                    # Options considérées et rejetées
    - option: string
      reason: string
  references: string[]             # Liens vers docs externes

constraints:
  - id: string
    type: invariant | convention | guideline
    rule: string                   # Description de la règle
    severity: critical | high | medium | low
    scope: string                  # Glob pattern des fichiers concernés
    exceptions:                    # Cas où la règle ne s'applique pas
      - pattern: string
        reason: string
    examples:
      valid: string[]
      invalid: string[]

verification:
  automated:
    - check: string                # ID du verifier
      target: string               # Scope du check
      frequency: commit | pr | daily | weekly
  manual:
    - review: string
      frequency: string
      checklist: string[]

migration:
  from: string                     # État avant
  to: string                       # État après
  steps: string[]                  # Étapes de migration
  rollback: string[]               # Procédure de rollback
```

### 4.3 Format de violation

```json
{
  "id": "v-2026-01-25-001",
  "timestamp": "2026-01-25T14:30:00Z",
  "decision": "auth-001",
  "constraint": "auth-001-c1",
  "severity": "critical",
  "status": "open",
  "location": {
    "file": "src/routes/admin/reset.ts",
    "line": 15,
    "column": 1
  },
  "message": "Endpoint POST /api/admin/reset n'a pas de middleware d'auth",
  "context": {
    "code": "router.post('/reset', async (req, res) => { ... })",
    "expectedPattern": "router.post('/reset', requireAuth(), async (req, res) => { ... })"
  },
  "suggestion": {
    "description": "Ajouter requireAuth() comme premier middleware",
    "autoFixAvailable": true,
    "patch": "..."
  },
  "history": [
    {"date": "2026-01-25T14:30:00Z", "action": "detected", "by": "ci"},
    {"date": "2026-01-25T15:00:00Z", "action": "assigned", "to": "alice"}
  ]
}
```

---

## Partie 5 : Exemples concrets

### 5.1 Scénario : Ajout d'un rôle "moderator"

**Situation** : L'équipe veut ajouter un rôle moderator qui peut éditer les réservations des autres mais pas les supprimer.

**Sans SpecBridge** :
1. Dev ajoute le rôle dans la DB
2. Dev modifie 2-3 endpoints qu'il connaît
3. 3 semaines plus tard : bug découvert, un endpoint admin oublié
4. Hotfix en prod

**Avec SpecBridge** :

```
$ specbridge decision modify auth-001

[MODIFICATION DÉTECTÉE]
  Ajout du rôle 'moderator' avec permissions:
    - reservation:read (all)
    - reservation:update (all)
    - reservation:delete (own only)

[ANALYSE D'IMPACT AUTOMATIQUE]

  Fichiers à modifier (12 détectés):

  1. Database (1 fichier)
     └── migrations/add-moderator-role.sql
         Action: Créer la migration
         Status: À générer

  2. Auth middleware (2 fichiers)  
     ├── src/auth/roles.ts
     │   Action: Ajouter 'moderator' à l'enum Role
     │   Status: À générer
     └── src/auth/permissions.ts
         Action: Définir les permissions du moderator
         Status: À générer

  3. Routes impactées (6 fichiers)
     ├── src/routes/reservations/update.ts
     │   Action: Autoriser moderator
     │   Status: À générer
     ├── src/routes/reservations/delete.ts
     │   Action: Restreindre moderator à ses propres réservations
     │   Status: ⚠️ Logique complexe - review manuel suggéré
     └── ... (4 autres)

  4. Tests (3 fichiers)
     └── tests/auth/moderator.test.ts
         Action: Créer la suite de tests
         Status: À générer

  5. Documentation (1 fichier)
     └── docs/api/authorization.md
         Action: Documenter le nouveau rôle
         Status: À générer

[RISQUES IDENTIFIÉS]
  ⚠️ La route DELETE a une logique de permission complexe
     → L'auto-fix pourrait être incorrect
     → Review manuel recommandé

[ACTIONS]
  [1] Générer tous les patches (review avant apply)
  [2] Générer seulement DB + Auth (core)
  [3] Voir le détail d'un fichier
  [4] Annuler

$ 1

[PATCHES GÉNÉRÉS]
  12 fichiers dans .specbridge/pending/moderator-role/
  
  Pour appliquer:
    $ specbridge apply moderator-role --interactive
  
  Pour review:
    $ specbridge diff moderator-role
```

### 5.2 Scénario : Détection de dérive post-deploy

**Situation** : Un dev a mergé du code qui bypass les conventions d'erreur.

**Timeline avec SpecBridge** :

```
[T+0] PR #456 mergée
      SpecBridge CI: ✅ Toutes vérifications passées

[T+2h] Monitoring runtime détecte anomalie
       
       [ALERTE SPECBRIDGE]
       Type: Runtime pattern deviation
       Decision: errors-001 (Error taxonomy)
       
       Observation:
         Endpoint POST /api/v1/payments/capture retourne:
         { "error": "Payment failed" }
         
       Attendu (selon errors-001):
         { "code": "PAYMENT_CAPTURE_FAILED", "message": "...", "details": {...} }
       
       Impact:
         - Clients ne peuvent pas parser l'erreur programmatiquement
         - Monitoring/alerting dégradé
         - 47 occurrences en 2h
       
       Cause probable:
         PR #456, fichier src/routes/payments/capture.ts, ligne 89
         → Le catch block retourne une erreur string au lieu de ErrorPayload
       
       Actions suggérées:
         [1] Créer un ticket automatique (P2)
         [2] Générer le patch correctif
         [3] Notifier l'auteur de la PR
         [4] Rollback automatique (si critique)

[T+2h30] Dev corrige

[T+3h] Nouveau verifier ajouté
       → Ce pattern d'erreur sera désormais détecté au commit-time
```

---

## Partie 6 : Considérations avancées

### 6.1 Gestion des exceptions

Les règles absolues sont rares. SpecBridge gère les exceptions de façon explicite :

```yaml
constraints:
  - id: auth-001-c1
    rule: "Tout endpoint sous /api/** requiert auth"
    exceptions:
      - pattern: "/api/public/**"
        reason: "Endpoints publics par design"
        approved_by: security-team
        date: 2026-01-01
        
      - pattern: "/api/webhooks/**"  
        reason: "Authentification par signature dans le body"
        approved_by: security-team
        date: 2026-01-10
        compensating_control: "Vérification HMAC obligatoire"
```

### 6.2 Évolution des décisions

Les décisions ne sont pas immuables. SpecBridge gère le cycle de vie :

```
┌─────────┐    ┌─────────┐    ┌────────────┐    ┌────────────┐
│  DRAFT  │───▶│ ACTIVE  │───▶│ DEPRECATED │───▶│ SUPERSEDED │
└─────────┘    └─────────┘    └────────────┘    └────────────┘
     │              │               │
     │              │               └── Nouvelle décision active
     │              │                   Ancien code encore toléré (warning)
     │              │
     │              └── Migration en cours
     │                  Violations bloquantes après deadline
     │
     └── En discussion
         Pas de vérification
```

### 6.3 Métriques de succès

Comment savoir si SpecBridge fonctionne ?

| Métrique | Avant | Objectif 6 mois |
|----------|-------|-----------------|
| Temps moyen de détection de dérive | ~3 semaines | < 1 jour |
| Bugs liés à des incohérences | ~15/mois | < 3/mois |
| Temps de onboarding (comprendre les patterns) | ~2 semaines | < 3 jours |
| Couverture des décisions critiques par verifiers | 0% | > 90% |
| Taux de conformité du code généré par agents | ~60% | > 95% |

---

## Partie 7 : Ce que SpecBridge n'est pas

Pour éviter les malentendus :

**❌ Ce n'est pas un framework d'architecture**
SpecBridge est agnostique. Il ne prescrit pas DDD, hexagonal, ou autre. Il formalise *vos* décisions.

**❌ Ce n'est pas un générateur de code**
SpecBridge ne génère pas l'application. Il guide et contraint les agents qui le font.

**❌ Ce n'est pas un outil de documentation**
Les décisions sont exécutables. Si une décision n'a pas de verifier, elle perd de sa valeur.

**❌ Ce n'est pas un remplacement de tests**
Les verifiers complètent les tests, ils ne les remplacent pas. Ils vérifient la *structure*, pas le *comportement*.

**❌ Ce n'est pas un outil top-down**
L'inférence permet de partir du code existant. Pas besoin de tout spécifier avant de coder.

---

## Conclusion

### Le pari de SpecBridge

L'hypothèse centrale : **la friction bien placée crée de la valeur**.

Les agents de code sont puissants mais improvisent trop. Les specs traditionnelles sont ignorées car déconnectées. SpecBridge crée un pont vivant : assez léger pour être adopté, assez rigoureux pour être utile.

### Les trois insights clés

1. **Inférer d'abord, imposer ensuite** — Le système apprend vos patterns avant de les enforcer. Adoption naturelle.

2. **Graduation de la contrainte** — Tout n'est pas un invariant. Les guidelines informent, les conventions avertissent, les invariants bloquent.

3. **Le milieu est un runtime, pas un document** — Les décisions ne vivent pas dans un wiki. Elles vivent dans le CI, l'IDE, les prompts des agents.

### Prochaine étape

La valeur de ce concept se prouve par l'usage. La prochaine étape serait un prototype minimal :

- 1 scanner qui infère 3 patterns
- 1 format de décision simple
- 1 verifier CI basique
- 1 intégration agent (contexte dans prompt)

Quelques centaines de lignes de code pour valider l'hypothèse avant d'investir plus.

---

*Document créé par Claude — Janvier 2026*
*Basé sur l'analyse du concept "l'outil du milieu"*
