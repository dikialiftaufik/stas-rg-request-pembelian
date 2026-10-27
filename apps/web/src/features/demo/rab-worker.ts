import { parseRabSource } from './rab-parser';
self.onmessage = (event: MessageEvent<File>) => {
  void parseRabSource(event.data)
    .then((sheets) => self.postMessage({ sheets }))
    .catch((cause: unknown) =>
      self.postMessage({
        error: cause instanceof Error ? cause.message : 'File tidak dapat dibaca.',
      }),
    );
};
