const TARGET_SAMPLE_RATE = 16000;

/**
 * Apply gentle linear peak normalization to mono samples so soft-spoken words
 * aren't dropped by Whisper's silence detector without over-amplifying room silence.
 */
export function peakNormalizeMonoSamples(samples: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }

  const gain = peak > 0.005 ? Math.min(4.0, 0.85 / peak) : 1;
  if (gain === 1) {
    return new Float32Array(samples);
  }

  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.max(-1, Math.min(1, samples[i] * gain));
  }
  return out;
}

/**
 * Encode mono Float32Array PCM samples as a 44-byte RIFF 16-bit PCM WAV ArrayBuffer.
 */
export function encodePcm16WavBuffer(
  samples: Float32Array,
  sampleRate: number = TARGET_SAMPLE_RATE
): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataLength = samples.length * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // ByteRate
  view.setUint16(32, numChannels * bytesPerSample, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

/**
 * Decode recorded browser audio, resample to 16kHz mono on the exact 0..T timeline,
 * peak-normalize gentle speech without amplifying room silence, and encode as 16-bit PCM WAV.
 * Falls back to wrapping the original Blob as `recording.webm` if decoding fails.
 */
export async function convertAudioBlobToNormalizedWav(
  blob: Blob,
  filename: string = 'recording.wav'
): Promise<File> {
  const fallbackFile = () =>
    new File([blob], 'recording.webm', { type: blob.type || 'audio/webm' });

  if (typeof window === 'undefined') {
    return fallbackFile();
  }

  const AudioCtxClass =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const OfflineCtxClass =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;

  if (!AudioCtxClass || !OfflineCtxClass) {
    return fallbackFile();
  }

  let audioCtx: AudioContext | null = null;
  try {
    audioCtx = new AudioCtxClass();
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);

    if (!decoded || !Number.isFinite(decoded.duration) || decoded.duration <= 0) {
      return fallbackFile();
    }

    const targetLength = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
    const offlineCtx = new OfflineCtxClass(1, targetLength, TARGET_SAMPLE_RATE);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    const monoSamples = rendered.getChannelData(0);
    const normalizedSamples = peakNormalizeMonoSamples(monoSamples);
    const wavBuffer = encodePcm16WavBuffer(normalizedSamples, TARGET_SAMPLE_RATE);

    return new File([wavBuffer], filename, { type: 'audio/wav' });
  } catch {
    return fallbackFile();
  } finally {
    if (audioCtx && audioCtx.state !== 'closed') {
      await audioCtx.close().catch(() => {});
    }
  }
}
