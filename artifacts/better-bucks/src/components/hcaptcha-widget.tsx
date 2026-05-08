import { useEffect, useRef } from "react";

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

interface HCaptchaWidgetProps {
  onToken: (token: string) => void;
  onExpire: () => void;
}

export function HCaptchaWidget({ onToken, onExpire }: HCaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const siteKey: string =
      import.meta.env.VITE_HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000001";

    function renderWidget() {
      if (!containerRef.current || !window.hcaptcha) return;
      if (widgetIdRef.current !== null) return;
      try {
        widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: onToken,
          "expired-callback": onExpire,
          "error-callback": onExpire,
          theme: "light",
        });
      } catch (e) {
        console.error("hCaptcha render error:", e);
      }
    }

    if (window.hcaptcha) {
      renderWidget();
    } else {
      const existing = document.getElementById("hcaptcha-script");
      if (!existing) {
        const script = document.createElement("script");
        script.id = "hcaptcha-script";
        script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", renderWidget);
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
