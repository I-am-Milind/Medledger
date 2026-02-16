import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../config/logger';

type LiveEvent = {
  type: 'connected' | 'heartbeat' | 'data_changed';
  timestamp: string;
  method?: string;
  path?: string;
  requestId?: string;
};

class LiveHub {
  private server: WebSocketServer | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  public init(httpServer: HttpServer): void {
    if (this.server) {
      return;
    }

    this.server = new WebSocketServer({
      server: httpServer,
      path: '/ws/live',
    });

    this.server.on('connection', (socket) => {
      this.send(socket, {
        type: 'connected',
        timestamp: new Date().toISOString(),
      });
    });

    this.heartbeatInterval = setInterval(() => {
      this.broadcast({
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
      });
    }, 20_000);

    logger.info('Live WebSocket channel ready at /ws/live');
  }

  public publishDataChange(payload: { method: string; path: string; requestId?: string }): void {
    this.broadcast({
      type: 'data_changed',
      timestamp: new Date().toISOString(),
      method: payload.method,
      path: payload.path,
      requestId: payload.requestId,
    });
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private broadcast(event: LiveEvent): void {
    if (!this.server) {
      return;
    }

    this.server.clients.forEach((client) => {
      this.send(client, event);
    });
  }

  private send(client: WebSocket, event: LiveEvent): void {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }
    client.send(JSON.stringify(event));
  }
}

export const liveHub = new LiveHub();
