import { useState, useEffect } from "react";
import { Smartphone, X, Share, MoreVertical, Plus, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type DeviceInfo = {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isIOSSafari: boolean;
  isIOSChrome: boolean;
  isAndroidChrome: boolean;
  isSamsungBrowser: boolean;
  isFirefoxAndroid: boolean;
  isStandalone: boolean;
};

function detectDevice(): DeviceInfo {
  if (typeof window === "undefined") {
    return {
      isMobile: false, isIOS: false, isAndroid: false,
      isIOSSafari: false, isIOSChrome: false, isAndroidChrome: false,
      isSamsungBrowser: false, isFirefoxAndroid: false, isStandalone: false,
    };
  }
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobi/i.test(ua);
  const isIOSChrome = isIOS && /CriOS/i.test(ua);
  const isIOSSafari = isIOS && !isIOSChrome && /Safari/i.test(ua) && !/Chrome/i.test(ua);
  const isSamsungBrowser = /SamsungBrowser/i.test(ua);
  const isFirefoxAndroid = isAndroid && /Firefox/i.test(ua);
  const isAndroidChrome = isAndroid && /Chrome/i.test(ua) && !isSamsungBrowser && !isFirefoxAndroid;
  const isStandalone =
    ("standalone" in navigator && (navigator as any).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches;
  return {
    isMobile, isIOS, isAndroid,
    isIOSSafari, isIOSChrome, isAndroidChrome,
    isSamsungBrowser, isFirefoxAndroid, isStandalone,
  };
}

type Step = { icon: React.ReactNode; text: string };

function getSteps(device: DeviceInfo): { title: string; steps: Step[] } {
  if (device.isIOSSafari) {
    return {
      title: "Add to Home Screen on iPhone / iPad",
      steps: [
        {
          icon: <Share className="h-5 w-5 text-blue-500 shrink-0" />,
          text: 'Tap the Share button at the bottom of your screen (the square with an arrow pointing up).',
        },
        {
          icon: <Plus className="h-5 w-5 text-blue-500 shrink-0" />,
          text: 'Scroll down and tap "Add to Home Screen".',
        },
        {
          icon: <Smartphone className="h-5 w-5 text-green-500 shrink-0" />,
          text: 'Tap "Add" in the top-right corner. Better Bucks will appear on your home screen like an app!',
        },
      ],
    };
  }
  if (device.isIOSChrome) {
    return {
      title: "Add to Home Screen on iPhone (Chrome)",
      steps: [
        {
          icon: <MoreVertical className="h-5 w-5 text-blue-500 shrink-0" />,
          text: 'Tap the three-dot menu ( ⋮ ) in the bottom-right corner of Chrome.',
        },
        {
          icon: <Plus className="h-5 w-5 text-blue-500 shrink-0" />,
          text: 'Tap "Add to Home Screen".',
        },
        {
          icon: <Smartphone className="h-5 w-5 text-green-500 shrink-0" />,
          text: 'Tap "Add". Better Bucks will appear on your home screen!',
        },
      ],
    };
  }
  if (device.isSamsungBrowser) {
    return {
      title: "Add to Home Screen on Samsung Browser",
      steps: [
        {
          icon: <MoreVertical className="h-5 w-5 text-blue-500 shrink-0" />,
          text: 'Tap the three-line menu ( ☰ ) at the bottom of Samsung Browser.',
        },
        {
          icon: <Plus className="h-5 w-5 text-blue-500 shrink-0" />,
          text: 'Tap "Add page to" and then choose "Home screen".',
        },
        {
          icon: <Smartphone className="h-5 w-5 text-green-500 shrink-0" />,
          text: 'Tap "Add". The app icon will appear on your home screen.',
        },
      ],
    };
  }
  if (device.isFirefoxAndroid) {
    return {
      title: "Add to Home Screen on Firefox (Android)",
      steps: [
        {
          icon: <MoreVertical className="h-5 w-5 text-blue-500 shrink-0" />,
          text: 'Tap the three-dot menu ( ⋮ ) at the top-right corner.',
        },
        {
          icon: <Plus className="h-5 w-5 text-blue-500 shrink-0" />,
          text: 'Tap "Install" or "Add to Home Screen".',
        },
        {
          icon: <Smartphone className="h-5 w-5 text-green-500 shrink-0" />,
          text: 'Tap "Add". Better Bucks will be pinned to your home screen.',
        },
      ],
    };
  }
  return {
    title: "Add to Home Screen on Android",
    steps: [
      {
        icon: <MoreVertical className="h-5 w-5 text-blue-500 shrink-0" />,
        text: 'Tap the three-dot menu ( ⋮ ) in the top-right corner of your browser.',
      },
      {
        icon: <Plus className="h-5 w-5 text-blue-500 shrink-0" />,
        text: 'Tap "Add to Home screen" or "Install app".',
      },
      {
        icon: <Smartphone className="h-5 w-5 text-green-500 shrink-0" />,
        text: 'Tap "Add". Better Bucks will appear on your home screen like an app!',
      },
    ],
  };
}

export function AddToHomescreenButton() {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDevice(detectDevice());
  }, []);

  if (!device || !device.isMobile || device.isStandalone) return null;

  const { title, steps } = getSteps(device);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Add to home screen"
        className="text-white/70 hover:text-white hover:bg-white/10"
        onClick={() => setOpen(true)}
        data-testid="button-add-to-homescreen"
      >
        <Smartphone className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl" data-testid="dialog-add-to-homescreen">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-5 w-5 text-primary" />
              {title}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground -mt-1">
            Add <span className="font-semibold text-foreground">betterbucks.net</span> to your home screen for quick,
            app-like access — no download required.
          </p>

          <ol className="space-y-4 mt-1">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex items-start gap-2">
                  {step.icon}
                  <p className="text-sm text-foreground leading-snug">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          {device.isIOSSafari && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 mt-1">
              <ArrowDown className="h-4 w-4 shrink-0" />
              The Share button is at the <strong className="ml-1">bottom center</strong> of Safari.
            </div>
          )}

          <Button
            className="w-full mt-1"
            onClick={() => setOpen(false)}
            data-testid="button-homescreen-done"
          >
            Got it!
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
