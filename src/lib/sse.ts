export interface EstadoPalco {
  sessao: string;
  hid: string;
  etapa: 'abertura' | 'titulo' | 'fotos' | 'video' | 'placa' | 'encerramento';
  indice: number;
  pausado: boolean;
  intervalo: number;
  gcVisivel: boolean;
  gcPosicao: 'inferior' | 'superior';
  videoAcao?: 'play' | 'pause' | 'restart' | null;
  videoSeq?: number;
  videoVolume: number;
  trilhaUrl: string;
  trilhaTocando: boolean;
  trilhaVolume: number;
  telaPreta: boolean;
  deixa: string;
  ts: number;
}

export function estadoPalcoPadrao(sessaoId: string): EstadoPalco {
  return {
    sessao: sessaoId,
    hid: '',
    etapa: 'abertura',
    indice: 0,
    pausado: false,
    intervalo: 6,
    gcVisivel: true,
    gcPosicao: 'inferior',
    videoAcao: null,
    videoSeq: 0,
    videoVolume: 100,
    trilhaUrl: '',
    trilhaTocando: false,
    trilhaVolume: 25,
    telaPreta: false,
    deixa: 'Abertura da Sessão Solene',
    ts: Date.now(),
  };
}

type Listener = (estado: EstadoPalco) => void;

const globalForSse = globalThis as unknown as {
  palcoListeners?: Map<string, Set<Listener>>;
};

const listenersMap = globalForSse.palcoListeners ?? new Map<string, Set<Listener>>();
globalForSse.palcoListeners = listenersMap;

export function assinarPalco(sessaoId: string, fn: Listener): () => void {
  let set = listenersMap.get(sessaoId);
  if (!set) {
    set = new Set();
    listenersMap.set(sessaoId, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
    if (set && set.size === 0) listenersMap.delete(sessaoId);
  };
}

export function publicarPalco(sessaoId: string, estado: EstadoPalco) {
  const set = listenersMap.get(sessaoId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(estado);
    } catch {
      // ignore closed stream
    }
  }
}
