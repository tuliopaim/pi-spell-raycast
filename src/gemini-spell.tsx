import { useNavigation, getSelectedText, Toast, showToast, LocalStorage } from "@raycast/api";
import { WelcomePage } from "./WelcomePage";
import { ErrorDisplay } from "./ErrorDisplay";
import { TextComparison } from "./TextComparison";
import { useState, useEffect } from "react";
import fetch from "node-fetch";
import { Preferences } from "./Preferences";

const SYSTEM_INSTRUCTION = `You are a helpful assistant that fixes spelling and grammar errors. You are helping a brazilian developer to communicate with his peers in his remote job in the US. Return only the corrected version of the text. Use United States english.`;

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

// Global state management
let globalState = {
  selectedText: null as string | null,
  correctedText: null as string | null,
};

export function clearGlobalState() {
  globalState = {
    selectedText: null,
    correctedText: null,
  };
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWaitingForEnter, setIsWaitingForEnter] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const { push } = useNavigation();

  async function processText() {
    try {
      const apiKey = await LocalStorage.getItem("apiKey");
      if (!apiKey) {
        console.log("API key is not set. Redirecting to preferences.");
        push(<Preferences apiKeySet={setHasApiKeyTrue} />);
        return;
      }

      const currentSelectedText = await getSelectedText();

      if (!currentSelectedText || currentSelectedText.trim() === "") {
        setIsLoading(false);
        setError("No text selected");
        return;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }],
            },
            contents: [
              {
                parts: [{ text: currentSelectedText }],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error?.message || "Unknown API error");
        setIsLoading(false);
        return;
      }

      const data = (await response.json()) as GeminiResponse;

      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        setError("Invalid response format from Gemini API");
        setIsLoading(false);
        return;
      }

      const correctedTextResponse = data.candidates[0].content.parts[0].text;

      // Update global state
      globalState.selectedText = currentSelectedText;
      globalState.correctedText = correctedTextResponse;

      push(
        <TextComparison
          originalText={currentSelectedText}
          correctedText={correctedTextResponse}
          onEditApiKey={() => push(<Preferences apiKeySet={setHasApiKeyTrue} />)}
        />,
      );
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      setError(errorMessage);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to process text",
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      // Clear global state on component mount
      clearGlobalState();

      // Check for API key
      const apiKey = await LocalStorage.getItem("apiKey");
      setHasApiKey(!!apiKey);
      setIsLoading(false);
    }
    init();
  }, []);

  function setHasApiKeyTrue() {
    setHasApiKey(true);
  }

  if (error) {
    return (
      <ErrorDisplay
        isLoading={isLoading}
        errorMessage={error}
        onEditApiKey={() => push(<Preferences apiKeySet={setHasApiKeyTrue} />)}
      />
    );
  }

  if (!hasApiKey) {
    return (
      <ErrorDisplay
        isLoading={isLoading}
        errorMessage="API Key is not set, please set it in preferences"
        onEditApiKey={() => push(<Preferences apiKeySet={setHasApiKeyTrue} />)}
      />
    );
  }

  if (isWaitingForEnter) {
    return (
      <WelcomePage
        isLoading={isLoading}
        onEditApiKey={() => push(<Preferences apiKeySet={setHasApiKeyTrue} />)}
        onEnterPress={() => {
          setIsWaitingForEnter(false);
          setIsLoading(true);
          processText();
        }}
      />
    );
  }

  return <WelcomePage isLoading={isLoading} onEditApiKey={() => push(<Preferences apiKeySet={setHasApiKeyTrue} />)} />;
}
