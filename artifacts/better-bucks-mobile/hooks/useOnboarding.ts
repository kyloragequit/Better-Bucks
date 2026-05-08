import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

const ONBOARDING_KEY = "onboarding_complete";

/**
 * Manages the one-time onboarding tutorial state.
 *
 * On first call it reads SecureStore to decide whether the tutorial should
 * show. `visible` stays false until the async check resolves, so the modal
 * never flickers on returning users.
 *
 * `dismiss()` sets `visible` to false *synchronously* (no await, no network)
 * and then writes "true" to SecureStore in the background. This means the
 * modal disappears on the same frame the button is tapped, even offline.
 */
export function useOnboarding() {
  // Start hidden; we reveal only after the SecureStore check confirms the
  // user hasn't already completed/skipped the tutorial.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(ONBOARDING_KEY)
      .then((val) => {
        if (val !== "true") {
          setVisible(true);
        }
      })
      .catch(() => {
        // If SecureStore fails (e.g. simulator without keychain), show the
        // tutorial once but don't crash.
        setVisible(true);
      });
  }, []);

  /**
   * Dismiss the tutorial immediately (synchronous state update) and persist
   * the completion flag in the background. No network call, fully offline.
   */
  const dismiss = () => {
    setVisible(false);
    SecureStore.setItemAsync(ONBOARDING_KEY, "true").catch(() => {});
  };

  return { visible, dismiss };
}
