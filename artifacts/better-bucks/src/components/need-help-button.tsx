import { useState, useRef, useEffect, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HelpCircle, BookOpen, Mail, Send, ArrowLeft } from "lucide-react";
import { useTutorial } from "@/hooks/use-tutorial";
import { useToast } from "@/hooks/use-toast";

const SUPPORT_EMAIL = "miles.chase@betterbucks.net";

type View = "menu" | "contact";

export function NeedHelpButton() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const { restartTutorial } = useTutorial();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setView("menu");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setView("menu");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleToggle = () => {
    if (!open && containerRef.current) {
      if (window.innerWidth < 640) {
        const rect = containerRef.current.getBoundingClientRect();
        setPopoverStyle({ top: rect.bottom + 8 });
      } else {
        setPopoverStyle({});
      }
    }
    setOpen(!open);
    if (open) setView("menu");
  };

  const handleTutorial = async () => {
    setOpen(false);
    setView("menu");
    try {
      await restartTutorial();
    } catch {
      toast({ title: "Something went wrong", description: "Could not restart the tutorial. Please try again.", variant: "destructive" });
    }
  };

  const handleSend = () => {
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject || "Help Request")}&body=${encodeURIComponent(message)}`;
    window.location.href = mailtoUrl;
    toast({ title: "Opening your email client", description: "A new message draft should appear shortly." });
    setSubject("");
    setMessage("");
    setOpen(false);
    setView("menu");
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="sm"
        className="text-white/70 hover:text-white hover:bg-white/10 gap-1.5 text-sm font-medium"
        onClick={handleToggle}
        data-testid="button-need-help"
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Need Help?</span>
      </Button>

      {open && (
        <div
          className="fixed sm:absolute right-4 sm:right-0 sm:top-full sm:mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-gray-200 z-[1100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          style={popoverStyle}
        >
          {view === "menu" ? (
            <div className="py-1 overflow-y-auto max-h-[calc(100vh-var(--bb-bottom-nav-h)-env(safe-area-inset-bottom)-5rem)]">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">Need Help?</p>
                <p className="text-xs text-gray-500 mt-0.5">Choose an option below</p>
              </div>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors"
                onClick={handleTutorial}
                data-testid="button-help-tutorial"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Restart Tutorial</p>
                  <p className="text-xs text-gray-500">Take the guided tour again</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors"
                onClick={() => setView("contact")}
                data-testid="button-help-contact"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50">
                  <Mail className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Contact Us</p>
                  <p className="text-xs text-gray-500">Send us a message</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-var(--bb-bottom-nav-h)-env(safe-area-inset-bottom)-5rem)]">
              <div className="flex items-center gap-2 mb-3">
                <button
                  className="p-1 rounded hover:bg-gray-100 transition-colors"
                  onClick={() => setView("menu")}
                  data-testid="button-help-back"
                >
                  <ArrowLeft className="h-4 w-4 text-gray-500" />
                </button>
                <p className="text-sm font-semibold text-gray-900">Contact Us</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Subject</label>
                  <Input
                    placeholder="What do you need help with?"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="text-sm h-9"
                    data-testid="input-help-subject"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Message</label>
                  <Textarea
                    placeholder="Describe your question or issue..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="text-sm min-h-[80px] resize-none"
                    data-testid="input-help-message"
                  />
                </div>
                <Button
                  className="w-full gap-2"
                  size="sm"
                  onClick={handleSend}
                  disabled={!message.trim()}
                  data-testid="button-help-send"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send Message
                </Button>
                <p className="text-[11px] text-gray-400 text-center">
                  Opens your email client to send to {SUPPORT_EMAIL}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
