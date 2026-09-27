/** Release one browser camera stream and detach it from the preview. Kept as a
 * small pure helper so error paths can be exercised without real hardware. */
export function releaseMediaStream(
  candidate: MediaStream | null | undefined,
  preview?: HTMLVideoElement | null,
): void {
  candidate?.getTracks().forEach((track) => track.stop());
  if (preview && candidate && preview.srcObject === candidate) {
    preview.srcObject = null;
  }
}
