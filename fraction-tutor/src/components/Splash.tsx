import styles from "../styles/Splash.module.css";

type SplashProps = {
  title: string;
  description: string;
  onStart: () => void;
};

/**
 * Pre-lesson splash. Tapping Start gives the page its first user
 * gesture, which is what unlocks audio playback in modern browsers.
 * Without this gate, the very first tutor message can't speak
 * because nothing has been clicked yet.
 *
 * `title` and `description` come from the lesson manifest so each
 * lesson presents its own framing.
 */
export function Splash({ title, description, onStart }: SplashProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{description}</p>
        <button type="button" className={styles.button} onClick={onStart}>
          Start
        </button>
      </div>
    </div>
  );
}
