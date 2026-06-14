/**
 * Thin helper around Mastra agent structured generation, with one retry on
 * schema-validation failure (Gemini structured outputs are usually reliable but
 * occasionally need a repair pass).
 *
 * A structuring `model` is passed to `structuredOutput` so the main agent call
 * can use tools (function calling) and a separate pass produces the JSON. Gemini
 * rejects function calling + a JSON response schema in the same request, so this
 * two-step is required for any tool-bearing agent.
 */
import type { Agent } from "@mastra/core/agent";
import type { ZodType } from "zod";

import { modelId } from "@/lib/providers";

export interface StructuredResult<T> {
  object: T;
  reasoning: string;
}

const STRUCTURING_MODEL = `google/${modelId("flash")}`;

export async function generateStructured<T>(
  agent: Agent,
  prompt: string,
  schema: ZodType<T>,
): Promise<StructuredResult<T>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await agent.generate(prompt, {
        structuredOutput: { schema, model: STRUCTURING_MODEL },
      });
      const out = res as unknown as { object?: T; text?: string };
      const object = out.object;
      if (object === undefined) {
        throw new Error("Agent returned no structured object.");
      }
      return { object, reasoning: out.text ?? "" };
    } catch (error: unknown) {
      lastError = error;
    }
  }
  throw new Error(
    `Structured generation failed: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
