/** Shape of `content_versions.body_json`, discriminated by content item type. */
import type { ContentType } from "@/db/schema";

export interface QuestionBody {
  stem: string;
  options: string[];
  answerIndex: number;
  rationale: string;
}

export interface LessonBody {
  markdown: string;
}

export type ContentBody = QuestionBody | LessonBody;

export function isQuestionBody(
  type: ContentType,
  body: ContentBody,
): body is QuestionBody {
  return type === "question" && "stem" in body;
}

export function parseBody(json: string): ContentBody {
  return JSON.parse(json) as ContentBody;
}

/** Flatten a content body into a single string for embedding / diffing. */
export function bodyToText(type: ContentType, body: ContentBody): string {
  if (type === "question" && "stem" in body) {
    return [
      body.stem,
      ...body.options,
      `Answer: ${body.options[body.answerIndex] ?? ""}`,
      body.rationale,
    ].join("\n");
  }
  if ("markdown" in body) return body.markdown;
  return JSON.stringify(body);
}
