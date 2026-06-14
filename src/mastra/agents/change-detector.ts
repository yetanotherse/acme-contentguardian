/**
 * Change Detector Agent — classifies what changed between two source versions
 * into structured, severity-scored change events.
 */
import { Agent } from "@mastra/core/agent";

import { isMockMode, modelId } from "@/lib/providers";

import { generateStructured } from "../llm";
import { mockDetect } from "../mock/scenario";
import { ChangeSetSchema, type ChangeSet } from "../schemas";
import { diffSourceTool } from "../tools";

export const changeDetectorAgent = new Agent({
  id: "change-detector",
  name: "Change Detector",
  instructions: `You are a certification-content change analyst. Compare an OLD and NEW version of an authoritative source (exam guide or cloud docs) and identify every meaningful change.

For each change, classify it as:
- "deprecation": a service/feature/recommendation is being removed or replaced.
- "addition": new material or a new exam domain/topic.
- "emphasis": existing material is significantly expanded or reweighted.
- "wording": terminology or naming changes with little semantic impact.

Assign a severity from 0 (cosmetic) to 1 (breaking). Map each change to the affected knowledge-graph topic slugs. Be precise and avoid inventing changes that are not supported by the text.`,
  model: `google/${modelId("flash")}`,
  tools: { diffSourceTool },
});

export async function detectChanges(input: {
  sourceId: string;
  oldBody: string;
  newBody: string;
  topicSlugs: string[];
}): Promise<ChangeSet> {
  if (isMockMode()) return mockDetect(input.sourceId);

  const prompt = `Available knowledge-graph topic slugs: ${input.topicSlugs.join(", ")}

OLD SOURCE:
"""
${input.oldBody}
"""

NEW SOURCE:
"""
${input.newBody}
"""

Identify the changes and return them in the required structure.`;
  const { object } = await generateStructured(
    changeDetectorAgent,
    prompt,
    ChangeSetSchema,
  );
  return object;
}
