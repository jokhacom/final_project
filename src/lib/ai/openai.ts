import type { AIProvider, ExtractedTopic, GeneratedQuestion, GradeResult, Level } from "./provider";

// Заготовка второго провайдера. Заполнить аналогично anthropic.ts при необходимости.
export const openaiProvider: AIProvider = {
  async extractKnowledge(_materialText: string): Promise<ExtractedTopic[]> {
    throw new Error("OpenAI provider not implemented yet — fill in src/lib/ai/openai.ts");
  },
  async generateQuestionsForTopic(_topicName: string, _rules: import("./provider").ExtractedRule[], _level: Level, _count: number): Promise<GeneratedQuestion[]> {
    throw new Error("OpenAI provider not implemented yet — fill in src/lib/ai/openai.ts");
  },
  async generateQuestions(_materialText: string, _level: Level, _count: number, _ruleContext?: string): Promise<GeneratedQuestion[]> {
    throw new Error("OpenAI provider not implemented yet — fill in src/lib/ai/openai.ts");
  },
  async gradeOpenAnswer(_question: string, _expectedKeywords: string[], _answer: string, _materialContext: string | null): Promise<GradeResult> {
    throw new Error("OpenAI provider not implemented yet — fill in src/lib/ai/openai.ts");
  },
};
