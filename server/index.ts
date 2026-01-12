import express from "express";
import cors from "cors";
import {
  handleGetQuestions,
  handleCreateQuestion,
  handleUpdateQuestion,
  handleDeleteQuestion,
  handleReorderQuestions,
} from "./controllers/questions.controller";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

app.get("/api/questions", handleGetQuestions);
app.post("/api/questions", handleCreateQuestion);
app.put("/api/questions/:id", handleUpdateQuestion);
app.delete("/api/questions/:id", handleDeleteQuestion);
app.put("/api/questions/reorder", handleReorderQuestions);

app.listen(PORT, () => console.log(`API running on ${PORT}`));
