/**
 * Difference hash (dHash) — STUB for hypothetical environment.
 *
 * Real production dHash requires image decoding (e.g. Sharp / @napi-rs/image / jimp):
 *   1. Decode image to raw pixels
 *   2. Convert to grayscale
 *   3. Downsample to 9×8 (72 pixels)
 *   4. For each row, compare adjacent pixels → 64 horizontal comparisons → 64 bits
 *   5. Pack into 16 hex chars (MSB-first)
 *
 * This stub is deterministic for testing but is NOT a perceptual hash on visual
 * content — it only hashes raw byte distribution by sampling 65 evenly-spaced
 * byte positions and comparing adjacent samples.
 *
 * TODO(Slice 5 production): Replace with real image-decoding dHash.
 *
 * @module
 */

/**
 * Compute a 64-bit difference hash of raw bytes (stub algorithm).
 *
 * @returns 16-character lowercase hex string representing 64 bits.
 */
export function dhash(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    throw new Error("dhash: input bytes empty");
  }

  const len = bytes.length;

  // Sample 65 evenly-spaced byte positions
  const samples = new Uint8Array(65);
  for (let i = 0; i < 65; i++) {
    const pos = Math.min(Math.floor((i * len) / 65), len - 1);
    samples[i] = bytes[pos];
  }

  // 64 boolean comparisons → 64 bits → 16 hex chars
  let hex = "";
  for (let nibbleIdx = 0; nibbleIdx < 16; nibbleIdx++) {
    let nibble = 0;
    for (let bit = 0; bit < 4; bit++) {
      const i = nibbleIdx * 4 + bit;
      if (samples[i] > samples[i + 1]) {
        nibble |= 1 << (3 - bit); // MSB-first within nibble
      }
    }
    hex += nibble.toString(16);
  }

  return hex;
}

// Popcount lookup for 4-bit nibbles (0x0–0xF)
const NIBBLE_POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4] as const;

const HEX16_RE = /^[0-9a-fA-F]{16}$/;

/**
 * Hamming distance between two 64-bit dHash hex strings.
 *
 * Distance interpretation:
 *   - ≤5  = highly similar
 *   - >20 = unrelated
 *
 * @returns integer 0–64
 */
export function hammingDistance(hashA: string, hashB: string): number {
  if (!HEX16_RE.test(hashA)) {
    throw new Error(`hammingDistance: hashA is not a 16-char hex string: "${hashA}"`);
  }
  if (!HEX16_RE.test(hashB)) {
    throw new Error(`hammingDistance: hashB is not a 16-char hex string: "${hashB}"`);
  }

  let dist = 0;
  for (let i = 0; i < 16; i++) {
    const a = parseInt(hashA[i], 16);
    const b = parseInt(hashB[i], 16);
    dist += NIBBLE_POPCOUNT[a ^ b];
  }
  return dist;
}
