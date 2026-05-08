import ConfirmHcaptcha from "@hcaptcha/react-native-hcaptcha";
import {
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import type { WebViewMessageEvent } from "react-native-webview";

export type HCaptchaModalHandle = {
  show: () => void;
};

type Props = {
  siteKey: string;
  onToken: (token: string) => void;
  onCancel: () => void;
  onError: (err: string) => void;
};

export const HCaptchaModal = forwardRef<HCaptchaModalHandle, Props>(
  function HCaptchaModal({ siteKey, onToken, onCancel, onError }, ref) {
    const innerRef = useRef<ConfirmHcaptcha>(null);

    useImperativeHandle(ref, () => ({
      show: () => innerRef.current?.show(),
    }));

    const handleMessage = (event: WebViewMessageEvent) => {
      const data = event.nativeEvent.data;
      if (data === "cancel") {
        onCancel();
      } else if (data === "error" || data.startsWith("error:")) {
        onError(data.replace(/^error:?/, "").trim() || "hCaptcha error");
      } else if (data && data.length > 0) {
        onToken(data);
      }
    };

    return (
      <ConfirmHcaptcha
        ref={innerRef}
        siteKey={siteKey}
        size="normal"
        baseUrl="https://hcaptcha.com"
        onMessage={handleMessage}
      />
    );
  },
);
