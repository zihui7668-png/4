
export enum Difficulty {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced'
}

export interface Sentence {
  id: number;
  english: string;
  chinese: string;
  audioStart?: number;
  audioEnd?: number;
}

export interface Article {
  id: string;
  title: string;
  difficulty: Difficulty;
  content: Sentence[];
  description: string;
  audioUrl?: string; // Placeholder or generated
}

export interface WordDefinition {
  word: string;
  phonetic: string;
  translation: string;
  example: string;
}

export enum Step {
  Selection = 0,
  BlindListening = 1,
  Dictation = 2,
  Comprehension = 3,
  Shadowing = 4,
  Completed = 5
}
