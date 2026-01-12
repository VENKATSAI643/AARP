import { Request, Response } from "express";
import { questions, getNextId } from "./db";
import { Question, GenderOption } from "./types";

export const getQuestions = (_req: Request, res: Response) => {
    const sorted = [...questions].sort((a, b) => a.order - b.order);
    res.json(sorted);
};

export const createQuestion = (req: Request, res: Response) => {
    const { text, category, applicableFor } = req.body as {
        text: string;
        category: string;
        applicableFor?: GenderOption[];
    };

    if (!text || !category) {
        return res.status(400).json({ message: "text and category are required" });
    }

    const maxOrder = questions.length ? Math.max(...questions.map(q => q.order)) : 0;

    const newQuestion: Question = {
        id: getNextId(),
        text,
        category,
        applicableFor: applicableFor ?? [],
        order: maxOrder + 1
    };

    questions.push(newQuestion);
    res.status(201).json(newQuestion);
};

export const updateQuestion = (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const idx = questions.findIndex(q => q.id === id);

    if (idx === -1) {
        return res.status(404).json({ message: "Question not found" });
    }

    const { text, category, applicableFor } = req.body;

    questions[idx] = {
        ...questions[idx],
        ...(text !== undefined ? { text } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(applicableFor !== undefined ? { applicableFor } : {})
    };

    res.json(questions[idx]);
};

export const deleteQuestion = (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const exists = questions.some(q => q.id === id);

    if (!exists) return res.status(404).json({ message: "Question not found" });

    questions.splice(
        questions.findIndex(q => q.id === id),
        1
    );

    res.status(204).send();
};



