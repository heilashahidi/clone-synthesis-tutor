import { useState } from "react";
import { LessonShell } from "./components/LessonShell";
import { Splash } from "./components/Splash";
import { getDefaultLesson } from "./tutor/lessons";
import "./styles/global.css";

function App() {
  // Mounting LessonShell only after Start is tapped ensures the very
  // first tutor message tries to speak AFTER a user gesture, which
  // is what the browser needs in order to allow audio playback.
  const [started, setStarted] = useState(false);
  const manifest = getDefaultLesson();

  if (!started) {
    return (
      <Splash
        title={manifest.title}
        description={manifest.description}
        onStart={() => setStarted(true)}
      />
    );
  }

  return (
    <LessonShell
      lesson={manifest.lesson}
      totalSteps={manifest.totalSteps}
      getStepForNode={manifest.getStepForNode}
    />
  );
}

export default App;
