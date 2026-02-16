type CameraPermissionResult = {
  ok: boolean;
  message: string;
};

function mapCameraError(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return 'Unable to access camera. Please try again.';
  }

  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
    return 'Camera access denied. Allow camera permission in your browser settings.';
  }
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return 'No camera device found on this device.';
  }
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return 'Camera is already in use by another app.';
  }
  if (error.name === 'OverconstrainedError') {
    return 'Camera constraints are not supported on this device.';
  }
  return 'Unable to access camera. Please check browser permissions.';
}

export async function ensureCameraPermission(): Promise<CameraPermissionResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      message: 'This browser/device does not support camera capture.',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
    return {
      ok: true,
      message: '',
    };
  } catch (error) {
    return {
      ok: false,
      message: mapCameraError(error),
    };
  }
}
