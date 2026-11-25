const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB por fatia (passa com folga pelo limite de 100 MB do Cloudflare)

export async function enviarArquivoComSuporteChunk(params: {
  endpoint: string;
  file: File;
  camposExtras?: Record<string, string>;
  onProgress?: (percentual: number) => void;
}): Promise<{ ok: boolean; error?: string; pdfExtraido?: boolean }> {
  const { endpoint, file, camposExtras = {}, onProgress } = params;

  // Arquivos <= 8 MB (fotos e PDFs) sobem em requisição única direta
  if (file.size <= CHUNK_SIZE) {
    onProgress?.(20);
    const fd = new FormData();
    for (const [k, v] of Object.entries(camposExtras)) fd.append(k, v);
    fd.append('arquivos', file);

    const res = await fetch(endpoint, { method: 'POST', body: fd });
    const data = await res.json();
    onProgress?.(100);
    return data;
  }

  // Arquivos grandes (vídeos MP4/MOV de centenas de MB) sobem fatiados
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const slice = file.slice(start, end);

    const fd = new FormData();
    for (const [k, v] of Object.entries(camposExtras)) fd.append(k, v);
    fd.append('modoChunk', '1');
    fd.append('uploadId', uploadId);
    fd.append('chunkIndex', String(i));
    fd.append('totalChunks', String(totalChunks));
    fd.append('fileName', file.name);
    fd.append('chunk', slice, file.name);

    const res = await fetch(endpoint, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Falha na parte ${i + 1}/${totalChunks}` };
    }
    onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
  }

  return { ok: true };
}
