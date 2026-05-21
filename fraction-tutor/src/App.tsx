import { useState } from "react";
import { LessonShell } from "./components/LessonShell";
import { Splash } from "./components/Splash";
import { getDefaultLesson } from "./tutor/lessons";
import "./styles/global.css";

const STARTED_KEY = "fraction-tutor:started";

function App() {
  // Mounting LessonShell only after Start is tapped ensures the very
  // first tutor message tries to speak AFTER a user gesture, which
  // is what the browser needs in order to allow audio playback.
  // We persist `started` to sessionStorage so a Vite dev reload (or
  // any accidental refresh) doesn't bounce the user back to splash.
  const [started, setStarted] = useState(
    () => sessionStorage.getItem(STARTED_KEY) === "1"
  );
  const manifest = getDefaultLesson();

  if (!started) {
    return (
      <Splash
        title={manifest.title}
        description={manifest.description}
        onStart={() => {
          sessionStorage.setItem(STARTED_KEY, "1");
          setStarted(true);
        }}
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
