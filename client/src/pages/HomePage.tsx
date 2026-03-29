import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";
import "../style/HomePage.css";

type LogoBubble = {
  id: number;
  text: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  fontSize: number;
  durationMs: number;
};

const bubbleTerms = [
  "Hello World!",
  "boolean awesome = True",
  "console.log(\"Let's go!\")",
  "git commit cool-feature",
  "while(true) { create(); }",
  "const magic = () => code",
  "if (idea) { awesome(); }",
  "404? not on my watch",
  "refactor > rewrite",
  "await coffee();",
  "const focus = 100;",
  "print(\"yeahhh!\")",
  "type AwesomeCode = Success",
  "run tests, then celebrate",
  "sudo make me proud",
  "404 Oh No!",
  "print(\"You rock!\")",
  "print(\"You are awesome!\")",
];

export function HomePage() {
  const maxActiveBubbles = 3;
  const [logoBubbles, setLogoBubbles] = useState<LogoBubble[]>([]);
  const logoWrapRef = useRef<HTMLDivElement | null>(null);
  const lastSpawnRef = useRef(0);
  const bubbleIdRef = useRef(0);
  const bubbleTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      bubbleTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      bubbleTimeoutsRef.current = [];
    };
  }, []);

  const emitBubble = (clientX: number, clientY: number) => {
    const logoRect = logoWrapRef.current?.getBoundingClientRect();
    if (!logoRect) {
      return;
    }

    const localX = clientX - logoRect.left;
    const localY = clientY - logoRect.top;
    const centerX = logoRect.width / 2;
    const centerY = logoRect.height / 2;

    const vectorX = localX - centerX;
    const vectorY = localY - centerY;
    const angle = vectorX === 0 && vectorY === 0
      ? Math.random() * Math.PI * 2
      : Math.atan2(vectorY, vectorX);

    // Emit from the logo edge with a very small outward push.
    const edgeX = centerX + Math.cos(angle) * (logoRect.width * 0.46);
    const edgeY = centerY + Math.sin(angle) * (logoRect.height * 0.46);
    const outsideOffset = 6 + Math.random() * 10;
    const spawnX = edgeX + Math.cos(angle) * outsideOffset;
    const spawnY = edgeY + Math.sin(angle) * outsideOffset;

    const bubbleId = bubbleIdRef.current;
    bubbleIdRef.current += 1;

    const travelAngle = Math.random() * Math.PI * 2;
    const travelDistance = 55 + Math.random() * 90;
    const dx = Math.round(Math.cos(travelAngle) * travelDistance * 0.9);
    const dy = Math.round(Math.sin(travelAngle) * travelDistance - (60 + Math.random() * 90));

    const bubble: LogoBubble = {
      id: bubbleId,
      text: bubbleTerms[Math.floor(Math.random() * bubbleTerms.length)],
      x: spawnX,
      y: spawnY,
      dx,
      dy,
      size: Number((0.82 + Math.random() * 0.58).toFixed(2)),
      fontSize: Math.round(11 + Math.random() * 3),
      durationMs: Math.round(1150 + Math.random() * 550),
    };

    setLogoBubbles((previous) => {
      const next = [...previous, bubble];
      if (next.length > 12) {
        return next.slice(next.length - 12);
      }
      return next;
    });

    const timeoutId = window.setTimeout(() => {
      setLogoBubbles((previous) => previous.filter((item) => item.id !== bubbleId));
      bubbleTimeoutsRef.current = bubbleTimeoutsRef.current.filter((item) => item !== timeoutId);
    }, bubble.durationMs + 160);

    bubbleTimeoutsRef.current.push(timeoutId);
  };

  const handleLogoMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (logoBubbles.length >= maxActiveBubbles) {
      return;
    }

    const now = performance.now();
    if (now - lastSpawnRef.current < 420) {
      return;
    }

    lastSpawnRef.current = now;
    emitBubble(event.clientX, event.clientY);

    if (Math.random() > 0.9) {
      emitBubble(event.clientX + (Math.random() * 18 - 9), event.clientY + (Math.random() * 18 - 9));
    }
  };

  const handleLogoMouseEnter = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (logoBubbles.length >= maxActiveBubbles - 1) {
      return;
    }

    emitBubble(event.clientX, event.clientY);
  };

  return (
    <section className="home-page">
      <div className="home-gradient-overlay" aria-hidden="true" />
      <div className="home-shapes" aria-hidden="true">
        <span className="glass-shape sphere sphere-one" />
        <span className="glass-shape sphere sphere-two" />
        <span className="glass-shape cube cube-one" />
        <span className="glass-shape cube cube-two" />
      </div>

      <div className="home-content">
        <div
          className="home-logo-wrap"
          ref={logoWrapRef}
          onMouseMove={handleLogoMouseMove}
          onMouseEnter={handleLogoMouseEnter}
        >
          <img className="home-logo" src={logo} alt="iTECify logo" />
          <div className="logo-bubble-field" aria-hidden="true">
            {logoBubbles.map((bubble) => (
              <span
                key={bubble.id}
                className="logo-code-bubble"
                style={{
                  left: `${bubble.x}px`,
                  top: `${bubble.y}px`,
                  "--bubble-dx": `${bubble.dx}px`,
                  "--bubble-dy": `${bubble.dy}px`,
                  "--bubble-scale": String(bubble.size),
                  "--bubble-duration": `${bubble.durationMs}ms`,
                  fontSize: `${bubble.fontSize}px`,
                } as CSSProperties}
              >
                {bubble.text}
              </span>
            ))}
          </div>
        </div>
        <p className="home-message">Start your coding journey now!</p>
        <p className="home-submessage">Collab. Code. Create.</p>

        <div className="home-login-wrap">
          <span className="button-bubble bubble-a" aria-hidden="true" />
          <span className="button-bubble bubble-b" aria-hidden="true" />
          <span className="button-bubble bubble-c" aria-hidden="true" />
          <span className="button-bubble bubble-d" aria-hidden="true" />
          <span className="button-bubble bubble-e" aria-hidden="true" />
          <span className="button-bubble bubble-f" aria-hidden="true" />
          <span className="button-bubble bubble-g" aria-hidden="true" />
          <span className="button-bubble bubble-h" aria-hidden="true" />

          <Link to="/login" className="home-login-button">
            Log in
          </Link>
        </div>
      </div>
    </section>
  );
}
