declare module 'ssh2' {
  export interface ConnectConfig {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    readyTimeout?: number;
    keepaliveInterval?: number;
    keepaliveCountMax?: number;
    hostVerifier?: (keyHash: Buffer | string) => boolean;
  }

  export class Client {
    once(event: string, listener: (...args: any[]) => void): this;
    connect(config: ConnectConfig): this;
    exec(command: string, callback: (error: Error | undefined, stream: any) => void): void;
    end(): void;
  }
}
