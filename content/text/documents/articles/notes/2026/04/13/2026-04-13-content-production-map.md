---
description: Maps every function and class in the LLM-prompt-to-published-text pipeline (intake, prompt, parse, gate, edit, project) across its three lineages (content-farm, newsroom, docs) to collapse the parallel copies — pure domain algebra into content-topology, orchestration into the services — and names the next content-math operators to build.
keywords:
  - organizing
  - codec
  - settlement
  - structure
  - closure
  - communicating
  - projection
title: "Map: the producing-content pipeline and where its code should live"
---
A map of every function/class involved in **"an LLM gets a prompt, gives us text, and we edit it into something we publish,"** so we can put each piece in its right home — domain logic in the lib, orchestration in the service — and collapse the parallel copies.

## The pipeline as verbs (the phases)

```
  intake → assign → PROMPT → (LLM) → PARSE → GATE → EDIT → PROJECT/PUBLISH
                    \__________________ domain ________________/   \_ codec _/
           \________________________ orchestration (the cycle) ______________/
```

Three lineages run this same pipeline today:

- **news (mill)** — `content-farm` service, the koios/filum lineage.
- **news (claims)** — `newsroom` service, a claims-first newsroom.
- **docs** — `content-topology/documentation` + the `jsnode-content-computer` app.

## Current homes, by phase × lineage

| phase | news-mill (content-farm) | news-claims (newsroom) | docs (content-topology + app) | shared primitives |
|---|---|---|---|---|
| **PROMPT** | `draftPrompt`, `FORM_EXEMPLAR_DEFAULT`, `ArticleVoice` (`draft.mts`) | `synthesisPrompt`, `assignmentPrompt` (`index.mts`) | `symbolDocPrompt`, `overviewPrompt`, `DocVoice` (`documentation.mts`) | — |
| **PARSE** | `parseDraftReply`, `PostDraft` (`draft.mts`) | `structureBrief`, `StructuredBrief` (`index.mts`) | `parseDocReply`, `parseOverview`, `DocReply` (`documentation.mts`) | — |
| **GATE** | `judgeDraft`, `FarmGate`, `JudgeContext`, `titleFidelityFindings`, `templateMonotonyCount` (`gates.mts`) | `editorialGateCharge`, `isReadyForPublication` (via `news-topology`) | `judgeDoc`, `judgeOverview`, `docFindings`, `hallucinatedApiFindings`, `exampleFindings` (`documentation.mts`) | `prophecyFindings`, `repetitionFindings`, `numberFaithfulnessFindings`, `proseLintErrors`, `wordCount`, `extractNumbers`, `extractLinks` (`content-topology/gates`); rule engine (`language-editing`) |
| **EDIT** | — (was a dead re-prompt loop; now none) | — | revision re-prompt in `symbolDocPrompt`/`overviewPrompt` (`previous`/`findings`) | **`copyedit`** closure — `deprophesy`, `dedupe`, `restoreTitles`, `applyLintSuggestions` (`content-topology/copyedit`); `reviseDraft` abstract trace (`content-topology/production`); `realize`/`plan`/`section` claims→prose (`language-generation`, **unused by either mill**) |
| **PROJECT** | `candidateDocument` (`property.mts`) + frontmatter (`news-codecs`) | `lifecycle`, `publish`, claim writes (`news-topology`) | `formatReferenceEntry`, `formatReference`, `formatReadme` (`documentation.mts`) | `news-codecs/frontmatter` |
| **ORCHESTRATE** | `cultivate`, `compost`, `editorialWorkItem`, `depositEditorialWork`, `ContentFarmService`, `cli` | newsroom `run`, service, `makeAsk` | `jsnode-content-computer` app (cycle, fs, provider) | `syndication-codecs` (intake), provider `makeAsk` |

## The ontological principle (math-aligned)

- **`lib/content-topology`** = the **domain algebra of content production**: pure, I/O-free primitives — prompt-builders, reply-parsers, gates, the edit closure, formatters — for *every content kind*.
  "What content is and how it is produced and edited."
  The parse/gate/edit/format primitives are domain-neutral and live *beside each other*.
  (Its own `documentation.mts` header already says this: *"the parse/gate/format primitives are domain-neutral and live here beside the news ones."* — but the **news ones never came home.**)
- **`lib/news-topology`** = the **news subject algebra**: claims, beats, desks, lifecycle, slugs.
  *What a news item is*, upstream of production.
- **`lib/language-generation` (poiesis) / `language-editing` (koine)** = the **language-level** realize/lint primitives the EDIT phase composes.
- **`services/content-farm`, `services/newsroom`** = **orchestration**: bind the domain primitives to real I/O (provider, fs, syndication, run trace, HTTP) and *manage* the cycle.
  "How and when the process runs."
  A service should *use* the domain, not *contain* it.

## The parallels to collapse (the actual problem)

1. **Three "draft" models.**
  `production. DraftCarrier` (abstract revision trace, Lasswell-projected, **unused by the mill**) · `draft. PostDraft` (concrete news draft, used) · `documentation. DocReply` (concrete doc draft, used).
  Three shapes for "a produced piece + its surfaces."
2. **Four "revise/edit" notions.**
  `production.reviseDraft` (append-a-surface) · the deleted content-farm re-prompt · the live `documentation` re-prompt · `copyedit` (local deterministic closure).
  Plus `language-generation.realize`, which is the *intended* local realizer and is wired to **neither** mill.
3. **News production primitives sit in the service, not the lib.**
  `draftPrompt`, `parseDraftReply`, `judgeDraft`, the news gates, `selectStory` are pure domain logic living inside the `content-farm` *service*, while their doc twins live correctly in `content-topology`.
4. **Two newsroom services.**
  `content-farm` (term/demand-first) and `newsroom` (claim/lifecycle-first) each re-implement prompt/parse/brief + `makeAsk`.

## Proposed target homes

Move the **pure news-production primitives** out of the `content-farm` service and into `content-topology`, beside `documentation.mts`, so every content kind's prompt/parse/gate/edit primitives are findable in one package:

```
lib/content-topology/src/
  article.mts        ← from content-farm/draft.mts + gates.mts (news-specific) + story.mts
                       articlePrompt, parseArticleReply, ArticleDraft, ArticleVoice,
                       judgeArticle, FarmGate→ArticleGate, JudgeContext,
                       titleFidelityFindings, templateMonotonyCount, selectStory
  documentation.mts  ← already here (docs)
  copyedit.mts       ← already here (the EDIT closure)  ✓ correctly placed
  production.mts     ← already here (abstract draft/assignment carriers)
  gates.mts          ← already here (prose primitives)
  demand.mts         ← already here (the demand charge; farm/demand.mts wraps it)
```

`services/content-farm` then keeps **only orchestration**: `cultivate`, the run trace + `compost`, `editorialWorkItem`/`depositEditorialWork`, `property`, `service`, `cli`, demand-pull I/O — importing the article primitives from content-topology exactly as it already imports `copyedit` and `gates`.

Resolution of the prompt-location tension: the prompt's **structure and craft laws are domain** (→ content-topology); the **voice/persona is config** the cycle supplies as a value (`ArticleVoice`/`DocVoice`, already parameters).
So prompts go to the lib; the service passes the property's voice in.

## Open decisions (for us to settle before moving code)

1. **Scope of the first move.**
  Just lift the news primitives (`article.mts`) into content-topology and make content-farm import them?
  Or also reconcile the three draft models / fold `newsroom`?
2. **Naming.**
  `article.mts` vs `news.mts`; `ArticleGate` vs keep `FarmGate`.
3. **`language-generation` disconnect.**
  The claims→prose realizer is the memos' intended EDIT engine but is wired only to swarm/agent-algebra.
  Do we route the mill's EDIT phase through it, or keep `copyedit` as the editing surface and leave realization to the LLM's one call?
4. **`newsroom` vs `content-farm`.**
  Two services, one pipeline.
  Merge, or keep distinct lineages (term-demand vs claim-lifecycle) sharing lib primitives?

## Progress

- **[DONE] Move 1 — news production primitives → content-topology.** `draft.mts`
  + the news halves of `gates.mts` + `story.mts` lifted from the `content-farm` service into `lib/content-topology/src/article.mts` (the news specialization, beside `documentation.mts` and `copyedit.mts`).
    The transport coupling was dropped by the documentation.mts pattern — a local structural `SourceStory` subset replaces `SyndicationItem`, and `selectStory` is generic so the cycle's richer items pass through unchanged; content-topology gained **no** new dependency. content-farm now imports the article surface from the lib and re-exports it for its own consumers.
    The three service files are deleted.
    Verified: content-topology 61 ✓, content-farm 38 ✓ + typecheck, koios.news typecheck ✓.
    Behaviour identical; the LLM is still spent once and copyedit still runs.
    (Names kept stable; `FarmGate` carries "farm" into a pure content lib and is a rename candidate → `ArticleGate`/`ContentGate`.)

- **[DONE] Move 2 — `news-codecs` dissolved into `content-codecs`.**
  Submodule dissolved (no shim, per direction): `ninjs` + `frontmatter` are now content-codecs subpaths; all 5 consumers rewired; `.gitmodules`/lockfile cleaned.
  The entangled frontmatter test (it read koios's live content store) was rewritten hermetically from first principles. content-codecs 34 ✓.
- **[DONE] Move 3 — `news-topology` dissolved.**
  Content-core → `content-topology/src/news/` (claims, lifecycle, gates, beats, sources, story-candidate, slug, cable) as the `./news` subpath, **agency-free**: dropped the `agent-fleet-algebra` coupling — `JsonLike` became a proper local `JsonValue`, `stableId` a local hash, and the office/work agency (`NEWS_DESKS`, `assignmentForStory`, `newsroomProject`) moved to `services/newsroom/src/desks.mts` (the service specializes the content core onto the fleet).
  All ~10 consumers rewired; submodule + lockfile dissolved. content-topology 69 ✓, newsroom 16 ✓, newswire 7 ✓, content-farm 38 ✓, sites typecheck ✓.
  (newscable has a pre-existing WIP typecheck failure unrelated to this move — `discoverNewswires`.)

### Remaining moves (ordered)

4. **Migrate remaining domain tests** (article gate/prompt/story tests still in `content-farm/index.test.mts`) into a `content-topology` test, so tests travel with the code they prove.
5. **Rewire downstream off any remaining indirection** — none left for codecs/ topology (no shims were used); keep this as the audit step.

## Next capabilities — from the 2026-06-14 triage (document math)

The four memos (categorical-algebra / sheaf-topology / claim-systems / info-theory of documents) confirm the layering (`news ⊂ document ⊂ content` is a forgetful functor whose fiber over a document is the claim/editorial layer — already realized as structural subsets like `SourceStory`) and name the next operators to build on the consolidated core.
Ranked by impact × buildability; carrier-discipline throughout (pure TS carriers, operator- returns-new-carrier, a `node:test` law; floats like KL/PageRank enter only as *readings*, never carrier math):

1. **`settlement`** (`content-topology/src/news/settlement.mts`) — the keystone, already named as copyedit's unbuilt successor.
  `settle(bundle, claimId) → ClaimStateBundle`: a contested claim is published **attributed/disputed, not dropped** (status→`contested`, force→`alleges`/`quotes`, opposing claim retained).
  All parts exist (`EditorialStatus="contested"`, `contraryClaimedBy`, `GateReport.contested`).
  Laws: no-drop (claim count non-decreasing), idempotence, modality-preservation.
  *(article_claim_systems memo §6.7: "stores both without explosion.")*
2. **Support/attack links + grounded extension** (`news/argument.mts`) — add `supports? `/`attacks? ` to `AssertedClaim`; `groundedExtension(bundle)` = least fixpoint of Dung "defend" (finite/exact).
  Laws: existence, conflict-freeness, determinism.
  Substrate for #1 and #3.
3. **Transitive correction propagation** — deepen `withCorrection` so a correction recomputes the grounded extension and downgrades claims whose justification it removed (currently only the direct target is superseded).
  Law: no dependent claim left asserted at full force after its premise is removed (Levi identity).
  Gated on #2.
4. **Demand×novelty story selection (MMR)** (`content-topology/src/selection.mts`) — `selectStories` maximizing demand-weighted relevance − λ·redundancy; reuses `demandRanking` + the `dedupe` redundancy key; novelty/redundancy are float readings, the ranked decision deterministic.
5. **Document-tree initial algebra + folds** (`content-topology/src/document-tree.mts`) — `DocNode` union + generic `fold(algebra, node)` (`outline`, `refs` as first algebras).
  The formal spine under `article` and `documentation`; law: fold fusion/initiality.
  Justifies the layering structurally.
6. **Citation/claim sheaf consistency** (`news/consistency.mts`) — `consistency(bundle, interfaces) → Witness | Obstruction` testing global- section equality over claim interfaces (witness/obstruction shape like `demandParity`); exact, no floats.
  *(sheaf memo §3.1: "Failure to have a global section is a precise obstruction to consistency.")*
