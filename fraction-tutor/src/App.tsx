import { LessonShell } from "./components/LessonShell";
import equivalenceLesson from "./tutor/lessons/equivalence.json";
import type { Lesson } from "./engine/types";
import "./styles/global.css";

function App() {
  return <LessonShell lesson={equivalenceLesson as Lesson} />;
}

export default App;
