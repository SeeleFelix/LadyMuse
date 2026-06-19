// Strip text chunks from PNG binary without re-encoding pixel data.
// ComfyUI embeds workflow JSON in tEXt chunks — this removes them
// while leaving IDAT (pixel), IHDR, and other structural chunks intact.

const TEXT_CHUNK_TYPES = new Set(["tEXt", "iTXt", "zTXt"]);

export function stripPngMetadata(buf: Buffer): Buffer {
  const sig = buf.subarray(0, 8);
  const out: Buffer[] = [sig];

  let pos = 8;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString("ascii");
    const data = buf.subarray(pos + 8, pos + 8 + len);
    const crc = buf.subarray(pos + 8 + len, pos + 12 + len);

    if (!TEXT_CHUNK_TYPES.has(type)) {
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32BE(len, 0);
      out.push(lenBuf, Buffer.from(type, "ascii"), data, crc);
    }

    pos += 12 + len;
  }

  return Buffer.concat(out);
}
