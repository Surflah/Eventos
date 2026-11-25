import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assinarPalco, estadoPalcoPadrao } from '@/lib/sse';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const sessao = await prisma.sessao.findUnique({
    where: { id },
    select: { estadoPalcoJson: true },
  });

  const base = estadoPalcoPadrao(id);
  let inicial = base;
  try {
    if (sessao?.estadoPalcoJson) {
      inicial = { ...base, ...JSON.parse(sessao.estadoPalcoJson), sessao: id };
    }
  } catch {
    inicial = base;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const enviar = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          // stream fechado
        }
      };

      enviar(inicial);

      const cancelarAssinatura = assinarPalco(id, (novoEstado) => {
        enviar(novoEstado);
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        cancelarAssinatura();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
