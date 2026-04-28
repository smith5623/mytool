declare module 'node-7z' {
  import { EventEmitter } from 'events';

  type SevenOptions = {
    $bin?: string;
    $progress?: boolean;
    recursive?: boolean;
    yes?: boolean;
  };

  type SevenProgress = {
    percent?: number;
  };

  type SevenData = {
    file?: string;
    status?: string;
  };

  interface SevenStream extends EventEmitter {
    on(event: 'progress', listener: (progress: SevenProgress) => void): this;
    on(event: 'data', listener: (data: SevenData) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (error: Error & { stderr?: string }) => void): this;
  }

  export function extractFull(archive: string, output: string, options?: SevenOptions): SevenStream;
}
