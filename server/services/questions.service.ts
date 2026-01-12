import type { Question, GenderOption } from "../types";

// TEMPORARY in-memory DB
let questions: Question[] = [];
let nextId = 1;

const getNextId = () => nextId++;

// 
// SERVICE FUNCTIONS — these will later become DynamoDB calls
// 

// GET ALL
export const getAllQuestions = (): Question[] => {
  return [...questions].sort((a, b) => a.order - b.order);
};

// CREATE
export const createQuestion = (data: {
  text: string;
  category: string;
  applicableFor: GenderOption[];
}): Question => {
  const maxOrder = questions.length
    ? Math.max(...questions.map((q) => q.order))
    : 0;

  const newQ: Question = {
    id: getNextId(),
    text: data.text,
    category: data.category,
    applicableFor: data.applicableFor ?? [],
    order: maxOrder + 1,
  };

  questions.push(newQ);
  return newQ;
};

// UPDATE
export const updateQuestion = (id: number, data: Partial<Question>): Question | null => {
  const idx = questions.findIndex((q) => q.id === id);
  if (idx === -1) return null;

  questions[idx] = {
    ...questions[idx],
    ...(data.text !== undefined ? { text: data.text } : {}),
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.applicableFor !== undefined
      ? { applicableFor: data.applicableFor }
      : {}),
  };

  return questions[idx];
};

// DELETE
export const deleteQuestion = (id: number): boolean => {
  const idx = questions.findIndex((q) => q.id === id);
  if (idx === -1) return false;

  questions.splice(idx, 1);
  return true;
};

// REORDER
export const reorderQuestions = (orderedIds: number[]): Question[] => {
  // Create map of id → new order
  const orderMap = new Map<number, number>();
  orderedIds.forEach((id, index) => orderMap.set(id, index + 1));

  // Apply new order values
  questions = questions.map((q) => ({
    ...q,
    order: orderMap.get(q.id) ?? q.order,
  }));

  // Sort by updated order
  questions.sort((a, b) => a.order - b.order);

  return questions;
};

