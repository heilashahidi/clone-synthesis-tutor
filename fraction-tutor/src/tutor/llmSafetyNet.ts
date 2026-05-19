import type { FractionBar } from "../engine/types";
import { barToFraction, fractionToString } from "../engine/conditions";
import { callTutorLLM } from "./tutorApi";

const SYSTEM_PROMPT = `You are a warm, encouraging math tutor for a 9-year-old learning about fraction equivalence. 

Rules:
- Use simple words a 9-year-old would understand
- Keep your response to 1-2 short sentences
- Never use math jargon like "denominator", "numerator", "simplify", or "reduce"
- Refer to "pieces" and "colored pieces" instead
- Be encouraging but redirect the student back to the task
- Never give the answer directly — guide them to discover it`;

const GENERIC_FALLBACK =
  "Hmm, that's not quite what we're looking for. Try looking at the bars again — can you make the colored parts the same size?";

/**
 * Called when the student's manipulative state doesn't match
 * any scripted branch. Generates a contextual redirect.
 */
export async function handleUnrecognizedState(
  bars: FractionBar[],
  taskDescription: string
): Promise<string> {
  const barDescriptions = bars
    .map((bar, i) => {
      const f = barToFraction(bar);
      return `Bar ${i + 1} (${bar.color}): ${fractionToString(f)} (${f.numerator} colored out of ${f.denominator} pieces)`;
    })
    .join("\n");

  const userPrompt = `The student's task: ${taskDescription}

Current bars:
${barDescriptions}

The student's bars don't match what was expected. Gently redirect them back to the task without giving the answer.`;

  const response = await callTutorLLM(SYSTEM_PROMPT, userPrompt);
  return response.ok && response.text ? response.text : GENERIC_FALLBACK;
}

/**
 * Classifies the student's likely misconception based on their actions.
 * Returns a tag the state machine can use for branching.
 */
export type MisconceptionTag =
  | "WHOLE_NUMBER_THINKING"
  | "UNEQUAL_PARTITIONING"
  | "ADDITIVE_REASONING"
  | "OTHER";

export async function classifyMisconception(
  bars: FractionBar[],
  taskDescription: string
): Promise<MisconceptionTag> {
  const barDescriptions = bars
    .map((bar, i) => {
      const f = barToFraction(bar);
      return `Bar ${i + 1}: ${fractionToString(f)}`;
    })
    .join(", ");

  const userPrompt = `Task: ${taskDescription}
Student's bars: ${barDescriptions}

Classify the likely misconception:
- WHOLE_NUMBER_THINKING (believes larger numbers = larger fractions)
- UNEQUAL_PARTITIONING (doesn't realize parts must be equal size)  
- ADDITIVE_REASONING (added same number to top and bottom instead of multiplying)
- OTHER

Respond with ONLY the classification tag, nothing else.`;

  const response = await callTutorLLM(SYSTEM_PROMPT, userPrompt);

  if (response.ok && response.text) {
    const tag = response.text.trim().toUpperCase() as MisconceptionTag;
    const valid: MisconceptionTag[] = [
      "WHOLE_NUMBER_THINKING",
      "UNEQUAL_PARTITIONING",
      "ADDITIVE_REASONING",
      "OTHER",
    ];
    if (valid.includes(tag)) return tag;
  }

  return "OTHER";
}
