PROJECT: PRAXIMATIONS
SYSTEM: PRAXI LENS
WORKING NAME: SYSTEM LENS

MISSION

Build a universal system-understanding and visualization platform.

The goal is not to generate diagrams.

The goal is to let a person understand almost any complex system as quickly,
accurately, and deeply as possible.

A system may be:

- a software repository
- an application
- an API
- an AI model
- an agent
- a workflow
- an automation
- a database
- a cloud architecture
- a business
- a financial system
- a network
- a robot
- hardware
- a scientific system
- a factory
- a physical process
- a future technology that does not exist today

Praxi Lens should analyze the system, construct a structured model of it,
and generate interactive ways of understanding:

- what exists
- how the parts relate
- how information moves
- how behavior unfolds over time
- what depends on what
- what is happening right now
- why a component exists
- where a conclusion came from
- what level of abstraction the user currently needs

The system should eventually become a public platform that developers,
researchers, students, engineers, companies, and other users can use to
understand their own systems or publicly shared systems.


======================================================================
1. FUNDAMENTAL PRINCIPLE
======================================================================

Do NOT build Praxi Lens as:

"AI creates a pretty node graph."

Instead build:

SOURCE SYSTEM
      ↓
FACT EXTRACTION
      ↓
SYSTEM MODEL
      ↓
SEMANTIC UNDERSTANDING
      ↓
EXPLANATION PLANNING
      ↓
VIEW GENERATION
      ↓
INTERACTIVE LEARNING


The visualizer must never become the source of truth.

The System Model is the source from which visualizations are generated.


======================================================================
2. CORE ARCHITECTURE
======================================================================

Conceptually:

PRAXI LENS
│
├── Ingestion
│
├── Analysis
│
├── System Model
│
├── Interpretation
│
├── Explanation
│
├── Visualization
│
├── Interaction
│
├── Runtime Observation
│
├── Evidence
│
├── Learning
│
└── Public Platform


Do not create every folder immediately.

These are architectural responsibilities.


======================================================================
3. UNIVERSAL SYSTEM MODEL
======================================================================

Create an extensible intermediate representation called SystemModel.

Everything Praxi Lens understands should eventually be representable
through this model.

The small universal core should include concepts such as:

SYSTEM

COMPONENT

RELATIONSHIP

FLOW

INTERFACE

CAPABILITY

STATE

EVENT

DATA

DEPENDENCY

RUNTIME INSTANCE

METRIC

EVIDENCE

VIEW


Conceptually:

SystemModel
│
├── system
│
├── components[]
│
├── relationships[]
│
├── flows[]
│
├── interfaces[]
│
├── capabilities[]
│
├── states[]
│
├── events[]
│
├── data[]
│
├── metrics[]
│
├── evidence[]
│
└── views[]


Do not force every system into one rigid schema.

The core model should be small.

Different system types may add extensions.

Examples:

AI model extensions:
- layers
- tensor shapes
- modalities
- inference graph
- training information
- model evaluations

Database extensions:
- schemas
- tables
- indexes
- constraints
- queries

Robot extensions:
- sensors
- actuators
- control loops
- physical state

Business extensions:
- departments
- processes
- roles
- information flows

Software extensions:
- repositories
- services
- packages
- APIs
- functions
- deployments


======================================================================
4. IDENTITY AND HIERARCHY
======================================================================

Every meaningful object should have a stable identity.

Do not identify components merely by their display name.

Support nested abstraction.

Example:

Praximations
    ↓
Praxi
    ↓
Coordination
    ↓
Routing
    ↓
Provider selection
    ↓
router.ts
    ↓
selectProvider()
    ↓
specific execution


A component may therefore have:

id
kind
parent
children
relationships
evidence
abstraction_level


The hierarchy must not be purely folder-based.

Semantic grouping may differ from physical source-code layout.


======================================================================
5. SEMANTIC ZOOM
======================================================================

Semantic zoom is a foundational interaction.

Zooming should change WHAT the user sees, not simply make boxes larger.

Example:

LEVEL 0

Praximations


LEVEL 1

Praxi
Praxium
Praxos
Praximation


LEVEL 2

Inside Praxi:

Intelligence
Coordination
Adaptation
Connections


LEVEL 3

Inside Coordination:

Understanding
Planning
Routing
Context
Orchestration
Verification


LEVEL 4

Inside Routing:

Candidate discovery
Constraint filtering
Performance lookup
Provider selection


LEVEL 5

Source modules


LEVEL 6

Functions


LEVEL 7

Runtime calls / actual data


Different systems may have different useful depth.

The system should dynamically determine meaningful abstraction boundaries.


======================================================================
6. SEPARATE STRUCTURE FROM BEHAVIOR
======================================================================

A major architectural rule:

STRUCTURE
and
BEHAVIOR

are different things.

A structural view answers:

"What is this made of?"

Example:

Application
├── Frontend
├── API
├── Database
└── Praxi


A behavioral view answers:

"What happens when something occurs?"

Example:

User sends message
      ↓
Chat UI
      ↓
API
      ↓
Praxi
      ↓
Context
      ↓
Model
      ↓
Response


Do not try to explain both with one enormous graph.


Praxi Lens should support different view classes such as:

- overview
- hierarchy
- dependency
- flow
- state
- timeline
- sequence
- runtime
- data flow
- capability
- interface
- comparison
- architecture


The user should be able to move between these views without losing
their place in the underlying system.


======================================================================
7. FACTS BEFORE AI INTERPRETATION
======================================================================

Praxi Lens must distinguish mechanically observed facts from AI inference.

For software, deterministic analysis may discover:

- files
- directories
- imports
- package dependencies
- classes
- functions
- API routes
- database definitions
- schemas
- environment references
- build configuration
- public interfaces
- dependency graphs
- framework metadata


Praxi can then infer higher-level concepts such as:

"These modules collectively form authentication."

"This service appears responsible for model routing."

"This subsystem likely handles billing."


Every item should retain an evidence level such as:

VERIFIED
directly observed from source/runtime

DERIVED
computed deterministically from verified information

INFERRED
interpreted by intelligence

USER_DEFINED
declared by a user

EXTERNAL
provided by another integration


Never present inferred architecture as certain fact.


======================================================================
8. EVIDENCE AND EXPLAINABILITY
======================================================================

Every meaningful visual claim should be traceable.

Example:

INTELLIGENCE ROUTER

Why is this shown?

Evidence:
- src/routing/router.ts
- src/providers/registry.ts
- call relationships
- API usage
- documentation


The user should be able to ask:

"Why do you think this?"

"Show me the source."

"How certain are you?"

"Is this observed or inferred?"


Maintain source references and provenance.


======================================================================
9. SYSTEM INGESTION
======================================================================

Create an extensible ingestion architecture.

Initial priority:

Git/local software repositories.

Future sources may include:

- GitHub
- Git repositories
- uploaded repositories
- APIs
- OpenAPI
- databases
- cloud environments
- running applications
- AI models
- Docker
- Kubernetes
- MCP
- logs
- telemetry
- hardware
- external architecture descriptions
- user-defined system manifests


Use adapters.

Conceptually:

SOURCE
   ↓
SOURCE ADAPTER
   ↓
OBSERVATIONS
   ↓
SYSTEM MODEL


Adding a new source type should not require rewriting the System Model.


======================================================================
10. REPOSITORY ANALYSIS V1
======================================================================

The first real supported system type should be software repositories.

Analyze:

- directory structure
- languages
- frameworks
- packages
- imports
- exports
- APIs
- routes
- functions
- classes
- database schemas
- migrations
- configuration
- environment dependencies
- tests
- external APIs
- build scripts
- deployment configuration
- documentation


Build deterministic dependency information first.

Then allow Praxi to semantically group components.


Example:

Observed:

auth/login.ts
auth/session.ts
middleware/auth.ts
users/permissions.ts

Praxi interpretation:

Authentication & Authorization


Store BOTH representations.


======================================================================
11. EXPLANATION ENGINE
======================================================================

Do not generate one explanation for everyone.

Create an Explanation Planner.

Inputs:

USER
SYSTEM
QUESTION
CURRENT VIEW
CURRENT DEPTH
KNOWN USER UNDERSTANDING
AVAILABLE EVIDENCE
TIME / DETAIL PREFERENCE


Output:

EXPLANATION PLAN


The planner decides:

- what to show
- what to hide
- which abstraction level to use
- which components to highlight
- whether motion helps
- whether a static diagram is better
- what order to reveal information
- what terminology to use
- what example to provide
- whether a question should be asked
- when to let the user explore freely


The system should support modes such as:

Explore

Explain

Teach

Trace

Compare

Debug

Inspect


======================================================================
12. HUMAN UNDERSTANDING PRINCIPLES
======================================================================

Design the experience around reducing unnecessary cognitive load.

Prefer:

OVERVIEW FIRST

Then:

ZOOM
FILTER
DETAIL ON DEMAND


Use progressive disclosure.

Do not show every available detail immediately.


Use visual signaling:

- highlight the active component
- dim irrelevant components
- emphasize the current path
- keep relationships visually clear
- reveal information progressively


Keep explanatory text physically near the visual object it describes
when practical.


Use movement when movement communicates something meaningful.

Examples where animation helps:

- data movement
- request execution
- state transitions
- dependency activation
- temporal behavior


Do not animate everything merely because animation looks impressive.


Prefer static visuals when the concept itself is static.


Allow the learner to control pacing.


======================================================================
13. SCENE ENGINE — VIDEO WITHOUT VIDEO
======================================================================

Do not generate full videos for normal explanations.

Instead create a declarative Scene / Story format.

Example:

Story
│
├── Scene 1
│   focus: User
│   text: "A request begins here."
│
├── Scene 2
│   reveal: Praxi
│   connect: User → Praxi
│
├── Scene 3
│   expand: Praxi
│   reveal:
│       Coordination
│       Intelligence
│
├── Scene 4
│   animate:
│       Coordination → Router → Model
│
└── Scene 5
    show result


The browser is responsible for:

- zooming
- panning
- highlighting
- transitions
- path animation
- labels
- captions
- optional narration
- pacing


Praxi only generates the semantic scene instructions.

This dramatically reduces generation cost compared with image/video generation.


The user must be able to:

pause
resume
go backward
jump ahead
click anything
interrupt the explanation
ask a question
explore a component
return to the explanation


This should feel like:

an interactive YouTube explanation

rather than:

a passive video.


======================================================================
14. QUESTION-DRIVEN VISUALIZATION
======================================================================

A major feature should be:

"Show me..."

Examples:

"Show me how authentication works."

"Show me how a message reaches the model."

"Show me what happens when this service fails."

"Show only the database dependencies."

"Where does user data leave the system?"

"Why does this component exist?"

"Show me what depends on Supabase."

"Show me the path from UI to storage."


Praxi should translate the question into a View Query.

Example:

QUESTION
      ↓
SEMANTIC QUERY
      ↓
RELEVANT SUBGRAPH
      ↓
BEST VIEW TYPE
      ↓
VISUALIZATION


Do not create an entirely new system model for every question.

Query the existing model.


======================================================================
15. FOCUS MODE
======================================================================

Users should be able to isolate a component.

Example:

Entire architecture
      ↓
select Praxi
      ↓
Everything irrelevant fades
      ↓
Praxi becomes the temporary root


Then:

"Show dependencies"

"Show callers"

"Show data"

"Show runtime activity"

"Show code"

"Explain this"


This prevents complex systems from becoming overwhelming.


======================================================================
16. RUNTIME VISUALIZATION
======================================================================

Static architecture is not enough.

Eventually allow live/runtime information.

Examples:

actual API request

database query

Praxi model call

agent execution

workflow

deployment

robot event


Runtime telemetry should attach to the same System Model.

Example:

SYSTEM MODEL

API Service
   ↓
Database


RUNTIME INSTANCE

Request #912
API Service
   ↓ 37 ms
Database
   ↓ 19 ms
Response


Do not create an unrelated runtime visualization architecture.

Static structure and runtime behavior should share stable component IDs.


======================================================================
17. STATE AND TIME
======================================================================

Support systems that change.

Represent:

state

state transitions

events

time

runtime instances


Example:

Agent

IDLE
 ↓ task_received
PLANNING
 ↓ plan_created
EXECUTING
 ↓ waiting_for_tool
WAITING
 ↓ tool_complete
EXECUTING
 ↓
COMPLETE


Users should be able to:

watch the transition

scrub backward

inspect the state

understand why the transition occurred


======================================================================
18. AI MODEL VISUALIZATION
======================================================================

Praxi Lens should eventually support AI models.

Allow visualization of factual/measurable properties such as:

- architecture
- layers
- modules
- tensor shapes
- token flow
- inference stages
- model routing
- latency
- memory
- activation statistics where instrumentation exists
- attention information where available and meaningful
- training/evaluation metadata
- model composition


Do NOT claim that architecture visualizations expose an AI's hidden
internal reasoning or private chain of thought.

Clearly distinguish:

architecture

runtime measurements

interpretability techniques

inferred explanations

from:

unobservable internal reasoning.


======================================================================
19. ADAPTIVE TEACHING
======================================================================

Praxi Lens should gradually understand how much the user understands.

This does not need to be complicated initially.

Maintain a lightweight concept such as:

Knowledge State

- concepts already explained
- concepts user appears comfortable with
- concepts that caused confusion
- current depth
- preferred explanation style


Example:

Beginner:
"Praxi chooses which intelligence should solve the task."

Advanced:
"The router filters providers by capability contract, context constraints,
evaluation history, latency requirements, and availability."


Same underlying system.

Different explanation.


======================================================================
20. UNDERSTANDING CHECKS
======================================================================

Optional lightweight interactions may test understanding.

Examples:

"Where do you think the request goes next?"

"Which component owns persistent information?"

"What would happen if this service were unavailable?"


These should help adapt instruction.

Do not turn every explanation into a quiz.

Exploration should remain natural.


======================================================================
21. MULTIPLE VISUAL REPRESENTATIONS
======================================================================

Do not make node-edge graphs the universal visualization.

Different information deserves different representations.

Examples:

Hierarchy
→ nested tree / semantic zoom

Behavior
→ sequence / animated flow

State
→ state machine

Time
→ timeline

Data
→ data-flow view

Dependencies
→ graph

Architecture
→ system map

Model layers
→ layered architecture

Metrics
→ chart

Comparison
→ synchronized side-by-side views


The Explanation Planner should select the representation that communicates
the concept most clearly.


======================================================================
22. UNIVERSAL VIEW SPECIFICATION
======================================================================

Create a structured ViewSpec separate from SystemModel.

SystemModel:
"What is true about the system?"

ViewSpec:
"How should some portion of that truth currently be presented?"


Conceptually:

ViewSpec
│
├── type
├── root
├── included_components
├── included_relationships
├── abstraction_level
├── layout
├── highlights
├── hidden
├── annotations
├── focus
└── interaction_rules


A single SystemModel may generate unlimited ViewSpecs.


======================================================================
23. PUBLIC SYSTEM REPRESENTATION FORMAT
======================================================================

The SystemModel format should eventually become documented and extensible.

Third parties should be able to create adapters.

Examples:

TensorFlow → SystemModel

PostgreSQL → SystemModel

Kubernetes → SystemModel

AWS → SystemModel

Blender → SystemModel

MyRobot → SystemModel

MyCustomAI → SystemModel


The public ecosystem should not depend on Praximations personally writing
every adapter.


======================================================================
24. PROVIDERS AND THIRD-PARTY SYSTEMS
======================================================================

Praxi Lens must visualize first-party and third-party systems equally.

A user may connect:

Praximations software

open-source software

commercial software

private company software

custom hardware

external AI systems


The model should preserve who provides each system/capability.

Do not absorb an external system into Praximations architecture just because
it is visualized by Praxi Lens.


======================================================================
25. CONNECTION TO PRAXI
======================================================================

Praxi provides intelligence for:

- semantic interpretation
- subsystem grouping
- explanation planning
- question understanding
- comparison
- guided tours
- abstraction selection
- ambiguity detection


Praxi does NOT replace deterministic parsers, graph algorithms, compilers,
or runtime telemetry.

Use AI where meaning is required.

Use deterministic systems where facts can be computed.


======================================================================
26. CONNECTION TO PRAXIUM
======================================================================

Praxium should eventually store/share:

- SystemModels
- component identities
- relationships
- evidence references
- system history
- documentation
- saved views
- user understanding context
- runtime references


Do not make Praxi Lens build a second universal knowledge system.

Use Praxium where shared persistent information belongs.


======================================================================
27. CONNECTION TO PRAXOS
======================================================================

Praxos can eventually support:

- continuous repository re-analysis
- watching changing systems
- runtime observation
- scheduled model refresh
- telemetry ingestion
- architecture drift detection
- keeping public visualizations current


Praxi Lens itself should not become a scheduler/workflow engine.


======================================================================
28. CONNECTION TO PRAXIMATION
======================================================================

Praximation provides the product environment.

Praxi Lens may be surfaced in:

Praxi Dev

public system pages

company architecture views

AI model pages

business process views

finance system views


Web, Desktop, and future clients should be able to render the same
SystemModel/ViewSpec concepts.


======================================================================
29. PUBLIC PLATFORM
======================================================================

Eventually support shareable system pages.

Example:

praximations.com/lens/<system>


Possible visibility:

private

organization

unlisted

public


A public system page could allow people to:

explore

zoom

follow flows

play guided explanations

ask questions

inspect evidence

view source references

switch abstraction levels


Never expose private source code, infrastructure details, secrets,
credentials, internal URLs, or hidden data simply because a visualization
is public.


======================================================================
30. USER-CREATED EXPLANATIONS
======================================================================

Users should eventually be able to create and publish their own views
and tours.

Example:

"How React rendering works"

"How Bitcoin transactions work"

"How this neural network works"

"How our company's fulfillment system works"


They should be able to start from a SystemModel and create:

saved view

annotation

guided tour

lesson

public explanation


Praxi may assist with authoring.


======================================================================
31. TRUST AND UNCERTAINTY
======================================================================

The viewer must communicate uncertainty.

Do not hide uncertainty because a diagram looks authoritative.

A component or relationship may visibly indicate:

verified

derived

inferred

incomplete

outdated


If analysis cannot determine something:

say so.


Never invent missing architecture to make a graph prettier.


======================================================================
32. LARGE SYSTEMS
======================================================================

Praxi Lens must eventually handle systems with:

thousands

millions

or potentially more components.


Never render everything simultaneously.

Use:

hierarchical aggregation

semantic grouping

progressive loading

graph partitioning

search

filters

levels of detail

server-side analysis

precomputed summaries


The UI should usually show only a small relevant subset.


======================================================================
33. TOKEN AND AI COST EFFICIENCY
======================================================================

Do not send entire repositories to AI models repeatedly.

The analysis pipeline should be:

repository
   ↓
deterministic extraction
   ↓
structured summaries
   ↓
relevant slices
   ↓
Praxi


Cache semantic interpretations where possible.

Use stable component IDs.

When the repository changes, analyze only affected areas when practical.

Reuse SystemModel information for multiple questions.


An explanation should mostly reference structured IDs.

Example:

focus component_193
reveal component_211
animate relation_55


rather than regenerate giant textual descriptions.


======================================================================
34. PERFORMANCE
======================================================================

The visual experience should feel immediate.

Important interactions such as:

zoom

pan

select

focus

expand

collapse

switch view

should generally be local frontend operations once the required model
data is loaded.

Do not call an AI model simply because someone zooms the graph.

Use Praxi only when intelligence is genuinely needed.


======================================================================
35. INITIAL TECHNOLOGY
======================================================================

Use the existing Praximations infrastructure where practical.

Current infrastructure:

Vercel
Supabase


Do not introduce unnecessary custom cloud infrastructure.


Likely implementation stack:

TypeScript

Next.js / existing Praximations frontend

graph/visualization library appropriate to the requirements

automatic layout engine

Supabase for persistent project/system metadata where appropriate

Praxi API for semantic interpretation


Do not hardcode architecture around one visualization library.

SystemModel and ViewSpec should remain library-independent.


======================================================================
36. VISUALIZATION ENGINE
======================================================================

Implement visualization as a renderer over ViewSpec.

Conceptually:

SystemModel
    ↓
View Generator
    ↓
ViewSpec
    ↓
Renderer


Renderer may support primitives such as:

node

group

edge

path

layer

annotation

metric

state

timeline item


The visual style should remain:

clean
minimal
professional
low-noise
modern

Do not make the canvas look like a developer graph-debugging tool full
of tiny boxes and crossing arrows.


======================================================================
37. LAYOUT
======================================================================

Automatic layout should consider semantics.

Examples:

data flow
→ left-to-right may be appropriate

hierarchy
→ top-down

model architecture
→ layered

network
→ graph layout

sequence
→ timeline/columns


The system should not apply one layout algorithm to every view.


Preserve mental map when expanding and collapsing components where possible.

Objects should not randomly jump across the screen every time a user
reveals one detail.


======================================================================
38. NAVIGATION
======================================================================

Maintain navigation history.

Example:

Praximations
→ Praxi
→ Coordination
→ Routing
→ Provider Selection


The user should always understand:

where they are

how they got there

how to go back


Provide breadcrumbs or an equivalent visual navigation model.


======================================================================
39. SEARCH
======================================================================

Users should be able to search by meaning.

Examples:

"authentication"

"where user data is stored"

"anything that calls OpenAI"

"systems connected to billing"

"components that depend on Supabase"


Praxi can interpret semantic searches.

The System Model should perform the actual filtering/traversal.


======================================================================
40. COMPARE MODE
======================================================================

Eventually support comparing:

two system versions

two architectures

two AI models

before/after refactor

development vs production

two competing implementations


Example:

VERSION A
     │
     ├── Router
     └── OpenAI

VERSION B
     │
     ├── Capability Router
     ├── OpenAI
     └── Logera


Highlight:

added

removed

changed

performance differences

relationship changes


======================================================================
41. SYSTEM CHANGE OVER TIME
======================================================================

SystemModels should support versioning.

This enables:

"What changed?"

"When was this introduced?"

"What depended on this before?"

"How did the architecture evolve?"


Do not overwrite all architecture history when a new analysis runs.


======================================================================
42. DEBUGGING MODE
======================================================================

For developers, Praxi Lens could eventually become a debugging tool.

Example:

Production request failed.

Praxi Lens:

highlights the runtime path

marks the failure

shows timings

shows relevant logs

shows involved components

shows recent changes

allows the developer to ask Praxi:

"Why might this have failed?"


Again:

facts first

AI interpretation second.


======================================================================
43. SECURITY VIEW
======================================================================

Eventually allow specialized views such as:

Trust boundaries

Data exposure

Credential usage

External communication

Permission boundaries

Organization boundaries


This should be generated from verified system information where possible.

Do not claim security guarantees based only on visual inference.


======================================================================
44. SYSTEM QUALITY
======================================================================

Connect eventually to the universal Evaluation System.

Praxi Lens should be able to display:

performance

reliability

cost

complexity

test coverage

benchmark results

known weaknesses


without becoming the owner of those evaluation systems.


Example:

click Router

see:

latency
failure rate
benchmark results
recent regressions


======================================================================
45. ADAPTER ECOSYSTEM
======================================================================

Design adapters as first-class packages.

An adapter should be able to provide:

source ingestion

system-model extension

runtime integration

view suggestions


Examples:

github-adapter

nextjs-adapter

postgres-adapter

pytorch-adapter

kubernetes-adapter

custom-robot-adapter


Third parties should eventually be able to build and distribute adapters.


======================================================================
46. FIRST VERSION
======================================================================

Do NOT attempt to support everything above immediately.

The first useful vertical slice should be:

INPUT:
Git repository

ANALYSIS:
deterministically understand repository structure and dependencies

INTERPRETATION:
Praxi identifies meaningful major subsystems

SYSTEM MODEL:
generate structured SystemModel with evidence

VISUALIZATION:
interactive overview

INTERACTION:
click to focus

SEMANTIC ZOOM:
expand subsystem into deeper components

QUESTION:
"Show me how X works"

VIEW:
generate relevant subgraph/flow

GUIDED EXPLANATION:
play a scene-based explanation


This alone should be genuinely useful.


======================================================================
47. MVP DEVELOPMENT ORDER
======================================================================

PHASE 0

Create a hand-authored SystemModel.

Build the viewer first against known structured data.

Prove:

zoom

selection

focus

expand/collapse

multiple views


PHASE 1

Build repository fact extraction.

No AI architecture inference required yet.


PHASE 2

Use Praxi to semantically group the repository.

Keep evidence.


PHASE 3

Natural language:

"Show me how authentication works."


PHASE 4

Scene-based guided explanations.


PHASE 5

Semantic zoom refinement.


PHASE 6

Runtime tracing.


PHASE 7

Public adapter SDK.


Do not skip directly to Phase 7.


======================================================================
48. FIRST SYSTEMMODEL EXAMPLE
======================================================================

The model might resemble conceptually:

{
  "system": {
    "id": "praxi-api",
    "name": "Praxi API",
    "kind": "software-system"
  },

  "components": [
    {
      "id": "coordination",
      "name": "Coordination",
      "kind": "subsystem",
      "parent": "praxi-api",
      "confidence": "inferred",
      "evidence": ["..."]
    },

    {
      "id": "routing",
      "name": "Routing",
      "kind": "subsystem",
      "parent": "coordination",
      "confidence": "verified",
      "evidence": ["src/routing/..."]
    }
  ],

  "relationships": [
    {
      "id": "rel-1",
      "from": "coordination",
      "to": "routing",
      "kind": "uses"
    }
  ]
}


Do not finalize the exact schema until the first several system types
have been tested against it.


======================================================================
49. IMPORTANT ANTI-PATTERNS
======================================================================

Do not:

generate giant graphs

put every source file on the first screen

use AI output as unquestionable truth

make everything an animation

make every interaction require an AI call

create a video generation pipeline for basic explanation

tie SystemModel directly to React Flow

tie SystemModel directly to Next.js

assume software is the only kind of system

assume graphs are always the best visualization

hide source evidence

store user source code publicly by default

invent missing dependencies

create dozens of empty abstractions before the MVP works


======================================================================
50. PRODUCT EXPERIENCE
======================================================================

The ideal experience should eventually feel like:

User opens a system.

First they see:

THE WHOLE THING
in a few understandable components.

Then they click one.

The system smoothly becomes more detailed.

They ask:

"How does this work?"

The irrelevant components fade.

The important path appears.

Praxi guides their attention step by step.

They interrupt:

"Wait — why is that here?"

The explanation pauses.

Praxi zooms into that component.

Evidence appears.

They understand it.

They return to the original explanation.

They can continue until they reach:

architecture

service

module

function

runtime execution

real source code


The user should feel like they are moving THROUGH the system,
not reading documentation about it.


======================================================================
51. CONNECTION TO THE LARGER PRAXIMATIONS VISION
======================================================================

Praxi Lens should eventually become a universal interface for understanding
the systems in Praximations.

Praxi:
understands and explains

Praxium:
preserves the model, relationships, evidence, and knowledge

Praxos:
keeps live models and observations updated

Praximation:
hosts and operates the systems being visualized


But Praxi Lens must also work for systems that are completely outside
Praximations.


======================================================================
52. ULTIMATE OBJECTIVE
======================================================================

Create a universal visual language for understanding systems.

The goal is not:

"turn code into diagrams."

The goal is:

SYSTEM
    ↓
UNDERSTANDING
    ↓
STRUCTURED REPRESENTATION
    ↓
THE RIGHT EXPLANATION
    ↓
THE RIGHT VISUALIZATION
    ↓
HUMAN UNDERSTANDING


Someone should eventually be able to point Praxi Lens at something they
do not understand and say:

"Teach me this."

Praxi Lens should determine:

what the system is

what level of abstraction matters

what the user needs to see first

what should remain hidden

how the parts relate

how behavior unfolds

which visualization communicates it best

and how to progressively reveal deeper levels until the person genuinely
understands the system.


FINAL DESIGN PRINCIPLE:

Do not force the human to understand the structure the computer uses.

Build a representation that allows the computer to continuously choose
the structure the HUMAN needs.