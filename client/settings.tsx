import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useRpc, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { ExternalLink } from "@getpaseo/plugin/client/ui";
import {
  checkConnectionRpc,
  connectionRpc,
  removeTokenRpc,
  saveTokenRpc,
} from "../shared/contracts";
import { Action, Card, Feedback, Field } from "./controls";

export function PageySettings({ theme }: PluginSurfaceProps) {
  const getConnection = useRpc(connectionRpc);
  const saveToken = useRpc(saveTokenRpc);
  const removeToken = useRpc(removeTokenRpc);
  const checkConnection = useRpc(checkConnectionRpc);
  const [token, setToken] = useState("");
  const [connection, setConnection] = useState<{ configured: boolean; source: string } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const locked = useRef(false);
  const load = useCallback(async () => {
    try {
      setConnection(await getConnection({}));
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Cannot read Pagey connection.");
    }
  }, [getConnection]);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setConnection(await getConnection({}));
      setMessage(success);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Pagey request failed. Try again.");
    } finally {
      locked.current = false;
      setPending(false);
    }
  }

  return (
    <View style={{ gap: 18 }}>
      <Text style={{ color: theme.colors.foreground, fontSize: 22, fontWeight: "700" }}>
        Connect to Pagey
      </Text>
      <Text style={{ color: theme.colors.foregroundMuted, lineHeight: 21 }}>
        Free static hosting. No subscription or credit card. Your account can create 25 new sites
        per day, with no cap on total sites.
      </Text>
      <ExternalLink
        href="https://pagey.site/dashboard/api-tokens"
        onError={() =>
          setError(
            "Cannot open the token page. Visit pagey.site/dashboard/api-tokens in your browser.",
          )
        }
      >
        <Text style={{ color: theme.colors.foreground, textDecorationLine: "underline" }}>
          Create a Pagey API token ↗
        </Text>
      </ExternalLink>
      <Card theme={theme}>
        <Text style={{ color: theme.colors.foreground }}>
          {connection
            ? connection.configured
              ? `Connected token · ${connection.source === "environment" ? "daemon environment" : "saved on this host"}`
              : "No account connected"
            : "Loading connection…"}
        </Text>
        <Field
          label="API token"
          value={token}
          onChangeText={setToken}
          placeholder="Paste your Pagey API token"
          secure
          theme={theme}
          disabled={pending || !connection || connection.source === "environment"}
        />
        <Action
          label={pending ? "Working…" : "Verify and save token"}
          disabled={pending || !connection || !token.trim() || connection.source === "environment"}
          primary
          theme={theme}
          onPress={() =>
            void run(async () => {
              await saveToken({ token: token.trim() });
              setToken("");
            }, "Token verified and saved. You can publish from any connected device.")
          }
        />
        {connection?.configured ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Action
              label="Test connection"
              theme={theme}
              disabled={pending}
              onPress={() => void run(() => checkConnection({}), "Pagey connection verified.")}
            />
            <Action
              label="Forget saved token"
              theme={theme}
              disabled={pending || connection.source === "environment"}
              onPress={() => void run(() => removeToken({}), "Saved token removed from this host.")}
            />
          </View>
        ) : null}
      </Card>
      <Feedback theme={theme} error message={error} />
      <Feedback theme={theme} message={message} />
      {!connection && error ? (
        <Action label="Retry loading connection" theme={theme} onPress={() => void load()} />
      ) : null}
      <Text style={{ color: theme.colors.foregroundMuted, lineHeight: 20, fontSize: 12 }}>
        The token is stored in a private file on the daemon host, or read from PAGEY_API_TOKEN. It
        is sent only to Pagey's API and is never returned to agents or other clients. All authorized
        users of this host share the connected account. The private file is ordinary JSON, not an
        encrypted vault.
      </Text>
    </View>
  );
}
