// Basic PCM utilities for resampling and encoding/decoding

// Convert Float32 [-1,1] to Int16 little-endian range
export function float32ToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
}

export function int16ToFloat32(input: Int16Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = input[i] / 0x8000;
  }
  return out;
}

// Linear resample from inputSampleRate to outputSampleRate
export function resampleLinearFloat(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) return input;
  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const rawIndex = i * ratio;
    const index0 = Math.floor(rawIndex);
    const index1 = Math.min(index0 + 1, input.length - 1);
    const frac = rawIndex - index0;
    output[i] = input[index0] * (1 - frac) + input[index1] * frac;
  }
  return output;
}

export function resampleFloatToInt16(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Int16Array {
  const resampled = resampleLinearFloat(input, inputSampleRate, outputSampleRate);
  return float32ToInt16(resampled);
}

// Base64 encode/decode helpers for binary Int16 data
export function base64FromInt16(int16: Int16Array): string {
  const buf = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  // btoa expects binary string
  return btoa(binary);
}

export function int16FromBase64(b64: string): Int16Array {
  const binary = atob(b64);
  const len = binary.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = binary.charCodeAt(i);
  return new Int16Array(buf.buffer);
}
