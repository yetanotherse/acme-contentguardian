/**
 * Mastra instance. Registers the four agents so that — in REAL mode — they share
 * model routing (Gemini), tool wiring, and Mastra's observability. The workflow
 * orchestrators in ./workflows compose these agents into the healing pipelines.
 *
 * Agent `model` fields use Mastra's model-router string form ("google/...") so
 * this module is safe to import in MOCK mode: no API key is touched until an
 * agent is actually generated, which only happens when a key is present.
 */
import { Mastra } from "@mastra/core";

import { changeDetectorAgent } from "./agents/change-detector";
import { contentEvaluatorAgent } from "./agents/evaluator";
import { impactAnalyzerAgent } from "./agents/impact-analyzer";
import { contentRegeneratorAgent } from "./agents/regenerator";

export const mastra = new Mastra({
  agents: {
    changeDetectorAgent,
    impactAnalyzerAgent,
    contentRegeneratorAgent,
    contentEvaluatorAgent,
  },
});

export {
  changeDetectorAgent,
  impactAnalyzerAgent,
  contentRegeneratorAgent,
  contentEvaluatorAgent,
};
