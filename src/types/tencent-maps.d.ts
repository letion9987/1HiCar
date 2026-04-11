export {};

declare global {
  // Tencent Map JS API uses a global `qq` object.
  // We keep it typed as `any` since this project doesn't include the official d.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qq: any;

  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qq?: any;
  }
}

