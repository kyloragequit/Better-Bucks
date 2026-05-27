import { useEffect, useRef } from "react";

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
    hcaptchaApiReady?: () => void;
    __hcaptchaRenderQueue?: Array<() => void>;
  }
}

interface HCaptchaWidgetProps {
  onToken: (token: string) => void;
  onExpire: () => void;
}

export function HCaptchaWidget({ onToken, onExpire }: HCaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const siteKey: string =
      import.meta.env.VITE_HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000001";

    function renderWidget() {
      if (!containerRef.current || !window.hcaptcha) return;
      if (widgetIdRef.current !== null) return;
      try {
        widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onExpireRef.current(),
          "error-callback": () => onExpireRef.current(),
          theme: "light",
        });
      } catch (e) {
        console.error("hCaptcha render error:", e);
      }
    }

    if (window.hcaptcha) {
      renderWidget();
    } else {
      window.__hcaptchaRenderQueue = window.__hcaptchaRenderQueue || [];
      window.__hcaptchaRenderQueue.push(renderWidget);

      if (!window.hcaptchaApiReady) {
        window.hcaptchaApiReady = () => {
          const queue = window.__hcaptchaRenderQueue || [];
          window.__hcaptchaRenderQueue = [];
          for (const fn of queue) fn();
        };
      }

      if (!document.getElementById("hcaptcha-script")) {
        const script = document.createElement("script");
        script.id = "hcaptcha-script";
        script.src = "https://js.hcaptcha.com/1/api.js?render=explicit&onload=hcaptchaApiReady";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (widgetIdRef.current !== null && window.hcaptcha) {
        try {
          window.hcaptcha.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex justify-center"
      data-testid="widget-hcaptcha"
    />
  );
}
