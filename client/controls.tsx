import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon, TextInput } from "@getpaseo/plugin/client/ui";
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";

export type Theme = PluginSurfaceProps["theme"];
export function Action({
  label,
  onPress,
  theme,
  disabled = false,
  primary = false,
  icon,
}: {
  label: string;
  onPress(): void;
  theme: Theme;
  disabled?: boolean;
  primary?: boolean;
  icon?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        minHeight: 42,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: primary ? theme.colors.foreground : theme.colors.surface1,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      })}
    >
      {icon ? (
        <Icon
          name={icon}
          size={16}
          color={primary ? theme.colors.surface0 : theme.colors.foreground}
        />
      ) : null}
      <Text
        style={{
          color: primary ? theme.colors.surface0 : theme.colors.foreground,
          fontWeight: "600",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  theme,
  secure = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChangeText(value: string): void;
  placeholder?: string;
  theme: Theme;
  secure?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.foregroundMuted}
        secureTextEntry={secure}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 11,
          color: theme.colors.foreground,
          backgroundColor: theme.colors.surface0,
          fontSize: 14,
        }}
      />
    </View>
  );
}

export function Card({ children, theme }: { children: ReactNode; theme: Theme }) {
  return (
    <View
      style={{
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 18,
        gap: 14,
        backgroundColor: theme.colors.surface1,
      }}
    >
      {children}
    </View>
  );
}

export function Feedback({
  message,
  theme,
  error = false,
}: {
  message: string | null;
  theme: Theme;
  error?: boolean;
}) {
  return message ? (
    <Text
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      selectable
      style={{
        color: error ? theme.colors.statusDanger : theme.colors.foregroundMuted,
        fontSize: 13,
        lineHeight: 20,
      }}
    >
      {message}
    </Text>
  ) : null;
}

export function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MiB`
    : bytes >= 1024
      ? `${(bytes / 1024).toFixed(1)} KiB`
      : `${bytes} B`;
}
