import { useState, useEffect } from "react";

const EVENT = "funthemechange";

export function setFunMode(on: boolean) {
  if (on) {
    document.documentElement.classList.add("fun-theme");
  } else {
    document.documentElement.classList.remove("fun-theme");
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { on } }));
}

export function useFunMode() {
  const [funMode, setLocal] = useState(() =>
    document.documentElement.classList.contains("fun-theme")
  );

  useEffect(() => {
    const handler = (e: Event) => setLocal((e as CustomEvent<{ on: boolean }>).detail.on);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  return funMode;
}
