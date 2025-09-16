import { Action, ActionPanel, Form, useNavigation, LocalStorage, showToast, Toast } from "@raycast/api";

interface PreferencesProps {
  apiKeySet: () => void;
}

export function Preferences({ apiKeySet }: PreferencesProps) {
  const { pop } = useNavigation();

  async function handleSubmitApiKey(values: { apiKey: string }) {
    try {
      await LocalStorage.setItem("apiKey", values.apiKey);
      await showToast({
        style: Toast.Style.Success,
        title: "API Key saved successfully",
        message: "You can now use the plugin",
      });

      apiKeySet();

      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save API Key",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Api Key" onSubmit={handleSubmitApiKey} />
          <Action.OpenInBrowser title="Get Gemini Api Key" url="https://makersuite.google.com/app/apikey" />
        </ActionPanel>
      }
    >
      <Form.Description text="Enter your Gemini API Key to use the plugin. You can get one from Google's MakerSuite." />
      <Form.PasswordField id="apiKey" title="Gemini API Key" placeholder="Enter your Gemini API Key" />
    </Form>
  );
}
