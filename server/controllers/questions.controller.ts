import type { Request, Response } from "express";
import {
  getAllQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
} from "../services/questions.service";

export const handleGetQuestions = (_req: Request, res: Response) => {
  res.json(getAllQuestions());
};

export const handleCreateQuestion = (req: Request, res: Response) => {
  const { text, category, applicableFor } = req.body;

  if (!text || !category) {
    return res.status(400).json({ message: "text and category required" });
  }

  const q = createQuestion({
    text,
    category,
    applicableFor: Array.isArray(applicableFor) ? applicableFor : [],
  });

  res.status(201).json(q);
};

export const handleUpdateQuestion = (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const q = updateQuestion(id, req.body);

  if (!q) return res.status(404).json({ message: "Not found" });

  res.json(q);
};

export const handleDeleteQuestion = (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const ok = deleteQuestion(id);
  if (!ok) return res.status(404).json({ message: "Not found" });

  res.status(204).send();
};

export const handleReorderQuestions = (req: Request, res: Response) => {
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ message: "orderedIds must be an array" });
  }

  const updatedList = reorderQuestions(orderedIds);
  res.json(updatedList);
};

