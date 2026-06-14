/**
 * LLM provider abstraction.
 *
 * ContentGuardian runs in one of two modes, chosen automatically at runtime:
 *
 *   - REAL  : GOOGLE_GENERATIVE_AI_API_KEY is set → agents call live Gemini
 *             (via the Vercel AI SDK inside Mastra) and embeddings use
 *             text-embedding-004.
 *   - MOCK  : no key set → a deterministic, scripted provider drives the exact
 *             same workflow/persistence/trace code paths so `npm run dev` and the
 *             2-minute demo work end-to-end with zero external services.
 *
 * This mock fallback is a DEMO CONVENIENCE, not a production pattern — see the
 * README "Architecture Decisions" section.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export type ModelTier = "flash" | "pro";

const MODEL_IDS: Record<ModelTier, string> = {
  // Cheap/fast tier for detect/impact/judge; capable tier for regeneration.
  // (gemini-2.0-flash was retired on the Gemini API — use the 2.5 GA line.)
  flash: "gemini-2.5-flash",
  pro: "gemini-2.5-pro",
};

/**
 * Single embedding dimensionality used by BOTH the deterministic mock
 * (feature-hashing buckets) and live Gemini (`outputDimensionality`). Keeping
 * one fixed dimension lets the Postgres `vector(EMBEDDING_DIM)` column be
 * well-defined and makes mock/real embeddings interchangeable.
 */
export const EMBEDDING_DIM = 1536;

/** @deprecated use EMBEDDING_DIM — kept as an alias for back-compat. */
export const MOCK_EMBED_DIM = EMBEDDING_DIM;
// Gemini API (v1beta) GA embedding model. The older `text-embedding-004` is no
// longer served on this endpoint and returns a "model not found" error.
export const EMBED_MODEL_ID = "gemini-embedding-001";

export function geminiApiKey(): string | undefined {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

/** True when no Gemini key is configured → deterministic mock provider is active. */
export function isMockMode(): boolean {
  return geminiApiKey() === undefined;
}

/** Human-readable provider label used in provenance / UI badges. */
export function providerLabel(tier: ModelTier): string {
  return isMockMode() ? "mock:deterministic" : `google/${MODEL_IDS[tier]}`;
}

let cachedProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function googleProvider() {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini provider requested but GOOGLE_GENERATIVE_AI_API_KEY is not set.",
    );
  }
  if (!cachedProvider) {
    cachedProvider = createGoogleGenerativeAI({ apiKey });
  }
  return cachedProvider;
}

/** AI SDK language model for the given tier (REAL mode only). */
export function getLanguageModel(tier: ModelTier) {
  return googleProvider()(MODEL_IDS[tier]);
}

/** AI SDK embedding model (REAL mode only). Dimensionality is pinned via
 * provider options at the embed() call site (see src/lib/embeddings.ts). */
export function getEmbeddingModel() {
  return googleProvider().textEmbeddingModel(EMBED_MODEL_ID);
}

/** Provider options pinning Gemini embedding output to EMBEDDING_DIM. */
export const embeddingProviderOptions = {
  google: { outputDimensionality: EMBEDDING_DIM },
} as const;

export function modelId(tier: ModelTier): string {
  return MODEL_IDS[tier];
}
