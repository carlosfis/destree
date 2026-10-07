// Codificador MP4 (H.264) dentro de Chrome: WebCodecs VideoEncoder + mp4-muxer (jsdelivr). Lo inyecta promo/render.js en la página renderizada; no necesita ffmpeg.
window.__enc = (() => {
  const CANDIDATES = ['avc1.640028', 'avc1.64002A', 'avc1.4D4028', 'avc1.42E028', 'avc1.42001F'];
  let muxer, encoder, cfg, buffer, frames = 0, lastError = null;
  const loadMuxer = () => new Promise((res, rej) => {
    if (window.Mp4Muxer) return res();
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.min.js';
    s.onload = res; s.onerror = () => rej(new Error('no se pudo cargar mp4-muxer desde jsdelivr')); document.head.appendChild(s);
  });
  async function start({ width, height, fps, bitrate }) {
    if (!('VideoEncoder' in window)) throw new Error('WebCodecs no disponible en este Chrome');
    await loadMuxer();
    for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) {
      for (const codec of CANDIDATES) {
        const c = { codec, width, height, bitrate, framerate: fps, hardwareAcceleration: hw, latencyMode: 'quality', avc: { format: 'avc' } };
        const r = await VideoEncoder.isConfigSupported(c).catch(() => null);
        if (r && r.supported) { cfg = c; break; }
      }
      if (cfg) break;
    }
    if (!cfg) throw new Error('WebCodecs: ningún perfil H.264 soportado');
    muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width, height, frameRate: fps }, fastStart: 'in-memory' });
    encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { lastError = e.message; } });
    encoder.configure(cfg);
    return `${cfg.codec} (${cfg.hardwareAcceleration})`;
  }
  async function push(b64, index, fps) {
    const blob = await (await fetch('data:image/jpeg;base64,' + b64)).blob();
    const bmp = await createImageBitmap(blob);
    const frame = new VideoFrame(bmp, { timestamp: Math.round(index * 1e6 / fps), duration: Math.round(1e6 / fps) });
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 4));
    encoder.encode(frame, { keyFrame: index % (fps * 2) === 0 });
    frame.close(); bmp.close(); frames++;
    if (lastError) throw new Error('VideoEncoder: ' + lastError);
    return frames;
  }
  async function finish() {
    await encoder.flush(); encoder.close(); muxer.finalize();
    buffer = muxer.target.buffer; return buffer.byteLength;
  }
  function chunk(offset, len) {
    const u8 = new Uint8Array(buffer, offset, Math.min(len, buffer.byteLength - offset)); let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  return { start, push, finish, chunk };
})();
