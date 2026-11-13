import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import React, { useRef, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "../lib/api";
import { checkPhoto, stripDataUrl, uploadDoorPhoto } from "../lib/doorPhoto";
import { colors, radius, space, typography } from "../theme";
import { BigButton } from "./BigButton";
import { Card } from "./Card";

type Shot = { uri: string; base64: string };
type Phase =
  | { kind: "idle" }
  | { kind: "camera" }
  | { kind: "preview"; shot: Shot }
  | { kind: "uploading"; shot: Shot; progress: number }
  | { kind: "done"; shot: Shot | null };

/** On the web preview there may be no camera: let the rider pick a photo instead. */
function pickOnWeb(): Promise<Shot | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg";
    input.setAttribute("capture", "environment");
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result);
        resolve({ uri: url, base64: stripDataUrl(url) });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

/**
 * The optional door photo. The customer's code is still what completes a delivery; the photo
 * is extra proof that settles "it never arrived" disputes.
 */
export function DoorPhoto({
  deliveryId,
  uploaded,
  compact,
}: {
  deliveryId: string;
  uploaded: boolean;
  /** Smaller card for the delivered screen */
  compact?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(
    uploaded ? { kind: "done", shot: null } : { kind: "idle" },
  );
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const open = async () => {
    setError(null);
    if (Platform.OS === "web") {
      const shot = await pickOnWeb();
      if (!shot) return;
      const problem = checkPhoto(shot.base64);
      if (problem) return setError(problem);
      return setPhase({ kind: "preview", shot });
    }
    const granted = permission?.granted || (await requestPermission()).granted;
    if (!granted) {
      setError("Camera access is off. Allow it in Settings to add a photo.");
      return;
    }
    setPhase({ kind: "camera" });
  };

  const upload = async (shot: Shot) => {
    setError(null);
    setPhase({ kind: "uploading", shot, progress: 0 });
    try {
      await uploadDoorPhoto(deliveryId, shot.base64, (progress) =>
        setPhase({ kind: "uploading", shot, progress }),
      );
      setPhase({ kind: "done", shot });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed. Try again.");
      setPhase({ kind: "preview", shot });
    }
  };

  if (phase.kind === "done") {
    return (
      <View style={styles.doneRow} accessibilityRole="summary">
        <Ionicons name="checkmark-circle" size={22} color={colors.brand[700]} />
        <Text style={styles.doneText}>Door photo added</Text>
        {phase.shot ? <Image source={{ uri: phase.shot.uri }} style={styles.thumb} /> : null}
      </View>
    );
  }

  const shot = phase.kind === "preview" || phase.kind === "uploading" ? phase.shot : null;

  return (
    <Card title={compact ? undefined : "Photo at the door"}>
      {!shot ? (
        <Text style={styles.help}>
          Optional, but it protects you: take a photo of the order handed over or left at the door.
        </Text>
      ) : (
        <Image source={{ uri: shot.uri }} style={styles.preview} contentFit="cover" />
      )}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {phase.kind === "uploading" ? (
        <View style={styles.progressWrap} accessibilityLabel="Uploading photo">
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(phase.progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>Uploading {Math.round(phase.progress * 100)}%</Text>
        </View>
      ) : shot ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <BigButton label="Retake" variant="secondary" icon="camera-reverse" onPress={open} />
          </View>
          <View style={styles.flex}>
            <BigButton label="Use photo" icon="cloud-upload" onPress={() => void upload(shot)} />
          </View>
        </View>
      ) : (
        <BigButton label="Take a photo" variant="secondary" icon="camera" onPress={open} />
      )}

      {phase.kind === "camera" ? (
        <CameraSheet
          onCancel={() => setPhase({ kind: "idle" })}
          onShot={(taken) => {
            const problem = checkPhoto(taken.base64);
            if (problem) {
              setError(problem);
              setPhase({ kind: "idle" });
            } else {
              setPhase({ kind: "preview", shot: taken });
            }
          }}
        />
      ) : null}
    </Card>
  );
}

function CameraSheet({ onShot, onCancel }: { onShot: (shot: Shot) => void; onCancel: () => void }) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  const take = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      // Low quality keeps the photo well under the upload limit and quick on mobile data
      const picture = await camera.current.takePictureAsync({ quality: 0.35, base64: true });
      if (picture?.base64) onShot({ uri: picture.uri, base64: stripDataUrl(picture.base64) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.camRoot}>
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
        <View style={[styles.camTop, { paddingTop: insets.top + space[2] }]}>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Close the camera"
            hitSlop={12}
            style={styles.camClose}
          >
            <Ionicons name="close" size={26} color={colors.surface[0]} />
          </Pressable>
          <Text style={styles.camHint}>Show the order and the door</Text>
        </View>
        <View style={[styles.camBottom, { paddingBottom: insets.bottom + space[6] }]}>
          <Pressable
            onPress={() => void take()}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={({ pressed }) => [styles.shutter, (pressed || busy) && styles.shutterPressed]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  help: { ...typography.body, color: colors.ink[700] },
  error: { ...typography.bodyStrong, color: colors.danger },
  preview: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface[100],
  },
  row: { flexDirection: "row", gap: space[3] },
  flex: { flex: 1 },
  progressWrap: { gap: space[2] },
  track: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface[100],
    overflow: "hidden",
  },
  fill: { height: 8, backgroundColor: colors.brand[600] },
  progressText: { ...typography.caption, color: colors.ink[700] },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    backgroundColor: colors.brand[50],
    borderRadius: radius.md,
    padding: space[3],
  },
  doneText: { ...typography.bodyStrong, color: colors.brand[800], flex: 1 },
  thumb: { width: 44, height: 44, borderRadius: radius.sm },
  camRoot: { flex: 1, backgroundColor: "#000" },
  camTop: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", gap: space[2] },
  camClose: {
    position: "absolute",
    left: space[4],
    top: 0,
    padding: space[2],
    marginTop: space[8],
  },
  camHint: {
    ...typography.bodyStrong,
    color: colors.surface[0],
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
  },
  camBottom: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center" },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.surface[0],
    alignItems: "center",
    justifyContent: "center",
  },
  shutterPressed: { opacity: 0.6 },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.surface[0] },
});
