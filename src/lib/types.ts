// Формат ответа /api/attempts/[id] и /api/attempts/finish (см. buildResult в lib/attempts.ts).
export interface ReviewItem {
  n: number;
  questionId: string;
  type: string;
  text: string;
  options: string[] | null;
  selectedIndex: number | null;
  correctIndex: number | null;
  userAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean;
  spellingErrors: number;
  grammarErrors: number;
  comment: string | null;
  explanation: string | null;
  rule: string | null;
  unanswered: boolean;
}

export interface AttemptResult {
  attemptId: string;
  userName: string;
  level: string;
  candies: number;
  finished: boolean;
  startedAt: string;
  finishedAt: string | null;
  resultLabel: string;
  resultComment: string;
  certificateEligible: boolean;
  correctCount: number;
  total: number;
  review: ReviewItem[];
}
