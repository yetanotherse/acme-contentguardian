import { describe, expect, it } from "vitest";

import {
  cosineSimilarity,
  hashEmbedding,
  parseEmbedding,
  serializeEmbedding,
} from "./embeddings";
import { MOCK_EMBED_DIM } from "./providers";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns 0 for degenerate / mismatched input", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe("hashEmbedding", () => {
  it("is deterministic and fixed-dimension", () => {
    const a = hashEmbedding("Infrastructure Manager deployment");
    const b = hashEmbedding("Infrastructure Manager deployment");
    expect(a).toEqual(b);
    expect(a).toHaveLength(MOCK_EMBED_DIM);
  });

  it("scores shared-vocabulary text higher than unrelated text", () => {
    const query = hashEmbedding(
      "infrastructure as code deployment manager terraform",
    );
    const related = hashEmbedding(
      "infrastructure manager provisions resources with terraform",
    );
    const unrelated = hashEmbedding(
      "cloud storage archive class for compliance backups",
    );
    expect(cosineSimilarity(query, related)).toBeGreaterThan(
      cosineSimilarity(query, unrelated),
    );
  });

  it("is L2-normalized (self-similarity is 1)", () => {
    const v = hashEmbedding("vertex ai gemini retrieval augmented generation");
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });
});

describe("embedding (de)serialization", () => {
  it("round-trips a vector through JSON", () => {
    const v = [0.1, -0.2, 0.3];
    expect(parseEmbedding(serializeEmbedding(v))).toEqual(v);
  });

  it("returns [] for null or invalid JSON", () => {
    expect(parseEmbedding(null)).toEqual([]);
    expect(parseEmbedding("not json")).toEqual([]);
  });
});
