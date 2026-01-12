import { Question } from "./types";

export let questions: Question[] = [];
export let nextId = 1;

export const getNextId = () => nextId++;
