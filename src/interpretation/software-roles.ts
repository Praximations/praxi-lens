import type { SystemModel } from "../system-model/schema.js";
import { indexModel, pathOf, type ModelIndex } from "../system-model/model-index.js";
import { withSemanticGroups } from "../system-model/validate.js";
import { CODE_LANGUAGES } from "../extensions/software/languages.js";

/** Plain-language parts of a software system, ordered from the people who use it toward its foundations. */
export interface RoleDefinition { id: string; name: string; description: string; layer: number; supporting?: boolean }
export const SOFTWARE_ROLES: readonly RoleDefinition[] = [
  { id: "interface", name: "User interface", description: "Screens, pages and visual pieces that people see and use.", layer: 0 },
  { id: "cli", name: "Command line", description: "Commands people type in a terminal to run the project.", layer: 0 },
  { id: "server", name: "Server & API", description: "Receives requests from apps or other systems and sends back answers.", layer: 1 },
  { id: "ai", name: "AI & models", description: "Prompts, AI model calls, agents and machine-learning code.", layer: 2 },
  { id: "core", name: "Core logic", description: "The main rules and processing that make the project work.", layer: 2 },
  { id: "integrations", name: "Integrations", description: "Connections to outside services such as payments, email or cloud platforms.", layer: 3 },
  { id: "data", name: "Data & storage", description: "Describes, saves and loads the project's information.", layer: 3 },
  { id: "shared", name: "Shared helpers", description: "Small reusable tools used across the project.", layer: 3 },
  { id: "packages", name: "Outside packages", description: "Libraries written by others that this project builds on.", layer: 4 },
  { id: "tests", name: "Tests", description: "Automatic checks that confirm the code still works.", layer: 5, supporting: true },
  { id: "docs", name: "Documentation", description: "Guides, notes and explanations written for people.", layer: 5, supporting: true },
  { id: "examples", name: "Examples", description: "Sample code showing how to use the project.", layer: 5, supporting: true },
  { id: "tooling", name: "Build & tooling", description: "Scripts that build, check and release the project.", layer: 6, supporting: true },
  { id: "config", name: "Configuration", description: "Settings that control how the project is built and run.", layer: 6, supporting: true },
  { id: "infrastructure", name: "Deployment", description: "How the project is packaged, deployed and run on servers.", layer: 6, supporting: true },
  { id: "assets", name: "Images & media", description: "Pictures, icons, fonts and other files shown or played as-is.", layer: 6, supporting: true },
  { id: "other", name: "Other files", description: "Files without a clear role.", layer: 7, supporting: true },
];
export const ROLE_BY_ID: ReadonlyMap<string, RoleDefinition> = new Map(SOFTWARE_ROLES.map(r => [r.id, r]));
export const roleGroupId = (roleId: string) => `role:${roleId}`;

const SEGMENTS: [RegExp, string][] = [
  [/^(?:tests?|__tests__|specs?|e2e|testing|__mocks__|mocks?|fixtures?|testdata|test-?utils|cypress|integration-tests)$/, "tests"],
  [/^(?:docs?|documentation|guides?|wiki|manual|handbook|rfcs?|adrs?)$/, "docs"],
  [/^(?:examples?|samples?|demos?|playground|sandbox|tutorials?|starters?|cookbook|recipes)$/, "examples"],
  [/^(?:\.github|\.circleci|\.gitlab|\.buildkite|deploy|deployments?|infra|infrastructure|terraform|k8s|kubernetes|helm|charts|docker|ansible|ops|devops|\.devcontainer|nginx)$/, "infrastructure"],
  [/^(?:scripts?|tools?|tooling|build-tools|\.husky|ci|hack|benchmarks?|bench|codegen|generators?)$/, "tooling"],
  [/^(?:public|static|assets|images?|img|icons?|fonts?|media|sounds?|audio|videos?|brand|illustrations?)$/, "assets"],
  [/^(?:migrations?|db|database|databases|schemas?|prisma|supabase|sql|seeds?|entities|repositories|dao|orm|storage|persistence|datastore)$/, "data"],
  // "models" is ambiguous (database records or AI models); imports decide ties toward AI.
  [/^models?$/, "data"],
  [/^(?:ai|ml|llms?|agents?|prompts?|inference|training|embeddings?|rag|intelligence|neural|nn|copilot|assistants?|chatbot|mcp|evals?|tokenizers?)$/, "ai"],
  [/^(?:cli|cmd|commands?|bin)$/, "cli"],
  [/^(?:api|apis|server|servers|backend|routes?|routers?|controllers?|handlers?|endpoints?|middlewares?|graphql|resolvers?|rpc|grpc|functions|lambdas?|edge-functions|webhooks?|workers?|jobs?|queues?|services?)$/, "server"],
  [/^(?:components?|ui|pages?|views?|screens?|layouts?|widgets?|frontend|client|web|webapp|styles?|css|hooks|themes?|navigation|templates|islands|partials)$/, "interface"],
  [/^(?:integrations?|connectors?|adapters?|providers?|clients|sdks?|external|third-party|gateways?)$/, "integrations"],
  [/^(?:utils?|utilities|helpers?|common|shared|types|typings|constants|primitives)$/, "shared"],
  [/^(?:config|configs|configuration|settings)$/, "config"],
  [/^(?:core|domain|engine|kernel|lib|libs|internal|pkg|src|logic|business|app|apps|packages|crates|modules)$/, "core"],
];
const NAMES: [RegExp, string, number, string][] = [
  [/\.(?:test|spec|e2e)\.[\w]+$|^test_.*\.py$|_test\.(?:go|py|rb|exs)$|^conftest\.py$|_spec\.rb$|Tests?\.(?:java|kt|cs|swift)$/, "tests", 7, "a test file name"],
  [/^(?:license|licence|copying|notice|authors|contributors|changelog|changes|history|contributing|code_of_conduct|security|support|codeowners)(?:\.[\w]+)?$/i, "docs", 6, "a project document"],
  [/\.(?:md|mdx|rst|adoc|txt)$/i, "docs", 4, "written documentation"],
  [/^(?:dockerfile|containerfile)(?:\..+)?$|^docker-compose.*\.ya?ml$|^compose\.ya?ml$|\.tf$|^(?:vercel|netlify|fly|railway|render|app|now)\.(?:json|toml|ya?ml)$|^procfile$|^\.gitlab-ci\.yml$|^jenkinsfile$|^skaffold\.ya?ml$/i, "infrastructure", 6, "a deployment file"],
  [/^(?:package(?:-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|[jt]sconfig.*\.json|\.?eslint.*|\.?prettier.*|\.babelrc.*|babel\.config\.\w+|\.editorconfig|\.git(?:ignore|attributes|modules)|\.nvmrc|\.node-version|\.npmignore|\.dockerignore|go\.(?:mod|sum|work)|cargo\.(?:toml|lock)|pyproject\.toml|setup\.(?:cfg|py)|requirements.*\.txt|pipfile(?:\.lock)?|poetry\.lock|uv\.lock|gemfile(?:\.lock)?|composer\.(?:json|lock)|pubspec\.(?:yaml|lock)|\.env\.example|[\w.-]+\.config\.[cm]?[jt]s|\.mcp\.json|turbo\.json|nx\.json|lerna\.json|deno\.jsonc?|bunfig\.toml|tox\.ini|pytest\.ini|\.flake8|mypy\.ini|ruff\.toml|rustfmt\.toml|clippy\.toml)$/i, "config", 6, "a settings file"],
  [/^(?:makefile|cmakelists\.txt|justfile|taskfile\.ya?ml|gulpfile\.\w+|gruntfile\.\w+|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?|rakefile|build\.rs|meson\.build)$|\.(?:sh|bash|zsh|ps1|bat|cmd)$/i, "tooling", 5, "a build or automation script"],
  [/\.(?:png|jpe?g|gif|svg|webp|ico|avif|bmp|tiff?|woff2?|ttf|otf|eot|mp3|wav|ogg|mp4|webm|mov|pdf|glb|gltf|obj|fbx)$/i, "assets", 7, "an image, font or media file"],
  [/\.(?:css|scss|sass|less|styl)$/i, "interface", 4, "a style sheet"],
  [/\.(?:sql|prisma)$|^(?:models|schema|schemas)\.py$|\.(?:model|entity|repository|schema)\.[jt]s$|_repository\.go$/i, "data", 6, "a data definition"],
  [/^(?:page|layout|loading|error|not-found|template|default)\.[jt]sx?$|\.(?:vue|svelte|astro|html?)$/i, "interface", 5, "a page or visual component file"],
  [/^route\.[jt]s$|^(?:middleware|proxy)\.[jt]s$|\.(?:controller|resolver|handler|gateway|router|routes)\.[jt]s$|^(?:urls|views|wsgi|asgi)\.py$|\.(?:proto|graphql|gql)$|^server\.\w+$/i, "server", 5, "a request-handling file"],
  [/^(?:cli|__main__)\.\w+$/i, "cli", 5, "a command-line entry file"],
  [/prompt|agent|llm|embedding|\.ipynb$/i, "ai", 3, "an AI-related file name"],
  [/^(?:utils?|helpers?|constants|types)\.\w+$/i, "shared", 4, "a helper file name"],
  [/\.(?:jsx|tsx)$/i, "interface", 2, "a component file type"],
];
const PACKAGES: [RegExp, string, string][] = [
  [/^(?:react|react-dom|vue|svelte|@angular\/core|solid-js|preact|react-native|@mui\/.+|@chakra-ui\/.+|styled-components|@emotion\/.+|framer-motion|lucide-react|@radix-ui\/.+|@headlessui\/.+|gradio|streamlit|pyqt[56]|pyside[26]|flutter|@tanstack\/react-.+|three|@react-three\/.+|d3)$/, "interface", "a user-interface library"],
  [/^(?:express|fastify|koa|@hapi\/hapi|hono|@nestjs\/.+|restify|flask|fastapi|django|starlette|aiohttp|tornado|sanic|uvicorn|gunicorn|github\.com\/gin-gonic\/gin|github\.com\/labstack\/echo.*|github\.com\/gofiber\/fiber.*|github\.com\/gorilla\/mux|actix-web|axum|rocket|warp|tonic|@grpc\/grpc-js|grpcio|org\.springframework\.boot|org\.springframework\.web|io\.ktor|rails|sinatra|@trpc\/server|graphql-yoga|@apollo\/server|apollo-server)$/, "server", "a web-server framework"],
  [/^(?:pg|postgres|mysql2?|sqlite3|better-sqlite3|mongoose|mongodb|@prisma\/client|prisma|typeorm|sequelize|knex|drizzle-orm|redis|ioredis|@supabase\/supabase-js|@supabase\/ssr|sqlalchemy|psycopg2?|psycopg|pymongo|peewee|alembic|gorm\.io\/gorm|github\.com\/jackc\/pgx|diesel|sqlx|sea-orm|rusqlite|activerecord|dexie|idb|@neondatabase\/serverless|@vercel\/postgres|@planetscale\/database|kysely)$/, "data", "a database library"],
  [/^(?:openai|@anthropic-ai\/.+|anthropic|langchain|@langchain\/.+|llamaindex|llama-index|ai|@ai-sdk\/.+|cohere-ai|cohere|@google\/generative-ai|@google\/genai|google-generativeai|ollama|transformers|torch|tensorflow|keras|jax|scikit-learn|xgboost|lightgbm|sentence-transformers|huggingface-hub|@huggingface\/.+|tiktoken|chromadb|@pinecone-database\/pinecone|pinecone|weaviate-client|faiss-cpu|mistralai|groq-sdk|groq|replicate|@modelcontextprotocol\/sdk|mcp|litellm|dspy|vllm)$/, "ai", "an AI or machine-learning library"],
  [/^(?:stripe|@stripe\/.+|@sendgrid\/.+|nodemailer|resend|twilio|@aws-sdk\/.+|aws-sdk|boto3|@google-cloud\/.+|googleapis|@octokit\/.+|octokit|@slack\/.+|slack-sdk|discord\.js|firebase|firebase-admin|posthog-js|posthog-node|@sentry\/.+|sentry-sdk|mailgun\.js|plaid|@azure\/.+)$/, "integrations", "a service integration library"],
  [/^(?:commander|yargs|cac|meow|oclif|@oclif\/core|inquirer|@inquirer\/.+|ink|click|typer|fire|github\.com\/spf13\/cobra|github\.com\/urfave\/cli.*|clap|structopt|thor)$/, "cli", "a command-line library"],
  [/^(?:jest|vitest|mocha|chai|@testing-library\/.+|pytest|@playwright\/test|playwright|cypress|supertest|nock|sinon|hypothesis|github\.com\/stretchr\/testify|rspec|minitest)$/, "tests", "a testing library"],
];

export interface RoleAssignment { roleId: string; confidence: number; reasons: string[] }

/** Classifies one leaf of a repository model from its path, file type and outside packages. */
export function classifySoftwareComponent(index: ModelIndex, id: string): RoleAssignment | undefined {
  const entity = index.entity.get(id);
  if (!entity || index.children.get(id)?.length) return undefined;
  if (entity.kind === "package-reference") return { roleId: "packages", confidence: 0.95, reasons: ["an outside package other files refer to"] };
  const path = pathOf(entity);
  if (path === undefined || entity.kind !== "file") return undefined;
  const scores = new Map<string, number>();
  const reasons = new Map<string, string[]>();
  const bump = (role: string, weight: number, reason: string) => {
    if ((reasons.get(role) ?? []).includes(reason)) return;
    scores.set(role, (scores.get(role) ?? 0) + weight);
    (reasons.get(role) ?? reasons.set(role, []).get(role)!).push(reason);
  };
  const parts = path.split("/");
  const name = parts.at(-1)!;
  const folders = parts.slice(0, -1).map(p => p.toLowerCase().replace(/^\((.*)\)$/, "$1"));
  const matched = new Set<string>();
  const language = entity.extensions["praxi.software"]?.data.language;
  const code = typeof language === "string" && CODE_LANGUAGES.has(language);
  const uiFile = /\.(?:[jt]sx|vue|svelte|astro|html?|css|scss|sass|less)$/i.test(name)
    || (index.outgoing.get(id) ?? []).some(r => PACKAGES[0]![0].test(index.entity.get(r.to)?.name ?? "") && index.entity.get(r.to)?.kind === "package-reference");
  for (let distance = 0; distance < folders.length; distance++) {
    const folder = folders[folders.length - 1 - distance]!;
    const role = SEGMENTS.find(([pattern]) => pattern.test(folder))?.[1];
    if (!role || matched.has(role)) continue;
    // Code inside a "media" or "audio" folder is still code, and "tools" deep inside source is usually not build tooling.
    if (role === "assets" && code) continue;
    const depth = folders.length - 1 - distance;
    if (["tooling", "docs", "examples", "infrastructure"].includes(role) && depth > 1 && code) continue;
    matched.add(role);
    // The nearest folder is the most specific; supporting folders such as tests override what they contain.
    const support = ["tests", "docs", "examples", "infrastructure"].includes(role) ? 3 : 0;
    // "views" or "pages" can mean data views; for plain code, an interface folder needs a UI file type or library.
    const weak = role === "core" ? 2.5 : /^models?$/.test(folder) ? 2 : role === "interface" && !uiFile ? 3.5 : 0;
    bump(role, Math.max(1.5, 4.5 - distance * 0.75) + support - weak, `inside a folder named “${parts[folders.length - 1 - distance]}”`);
  }
  for (const [pattern, role, weight, reason] of NAMES) if (pattern.test(name)) bump(role, weight, reason);
  for (const relationship of index.outgoing.get(id) ?? []) {
    const target = index.entity.get(relationship.to);
    if (target?.kind !== "package-reference") continue;
    for (const [pattern, role, reason] of PACKAGES) if (pattern.test(target.name)) bump(role, 2.5, `uses ${target.name} (${reason})`);
  }
  if (!scores.size) {
    if (typeof language === "string" && !["JSON", "YAML", "TOML", "XML", "INI", "Text"].includes(language)) bump("core", 1, `${language} source without a more specific signal`);
    else if (typeof language === "string") bump("config", 1, `a ${language} data file`);
    else return { roleId: "other", confidence: 0.3, reasons: ["no recognizable name, folder or file type"] };
  }
  const ranked = [...scores].sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0]));
  const [top, second] = [ranked[0]!, ranked[1]];
  const confidence = Math.round(Math.min(0.9, Math.max(0.35, 0.35 + 0.55 * (top[1] - (second?.[1] ?? 0)) / top[1] * Math.min(1, top[1] / 4))) * 100) / 100;
  return { roleId: top[0], confidence, reasons: reasons.get(top[0])! };
}
const order = (role: string) => SOFTWARE_ROLES.findIndex(r => r.id === role);

/**
 * Adds an INFERRED role overlay to a repository model: one semantic group per role whose members are
 * leaves (files and outside packages). Observed containment and IDs are untouched; repeated calls
 * replace the previous role overlay.
 */
export function interpretSoftwareRoles(input: SystemModel): SystemModel {
  const index = indexModel(input);
  const { model } = index;
  const members = new Map<string, { ids: string[]; confidence: number; evidence: Set<string> }>();
  for (const component of model.components) {
    const assignment = classifySoftwareComponent(index, component.id);
    if (!assignment) continue;
    const group = members.get(assignment.roleId) ?? members.set(assignment.roleId, { ids: [], confidence: 0, evidence: new Set() }).get(assignment.roleId)!;
    group.ids.push(component.id);
    group.confidence += assignment.confidence;
    if (group.evidence.size < 400) for (const id of component.provenance.evidenceIds) group.evidence.add(id);
    for (const relationship of index.outgoing.get(component.id) ?? []) {
      if (group.evidence.size >= 400) break;
      if (index.entity.get(relationship.to)?.kind === "package-reference") for (const id of relationship.provenance.evidenceIds) group.evidence.add(id);
    }
  }
  const kept = model.semanticGroups.filter(g => !(g.kind === "role" && g.id.startsWith("role:")));
  if (!members.size) return model;
  const groups = SOFTWARE_ROLES.filter(role => members.has(role.id)).map(role => {
    const group = members.get(role.id)!;
    return { id: roleGroupId(role.id), name: role.name, kind: "role", description: role.description, layer: role.layer,
      memberIds: group.ids.sort(),
      provenance: { level: "INFERRED" as const, evidenceIds: [...group.evidence].sort(),
        confidence: Math.round(group.confidence / group.ids.length * 100) / 100 } };
  });
  return withSemanticGroups(model, [...kept, ...groups]);
}
