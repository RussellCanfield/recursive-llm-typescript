declare module "isolated-vm" {
  export class Isolate {
    constructor(options?: { memoryLimit?: number });
    createContext(): Promise<Context>;
    compileScript(code: string): Promise<Script>;
    dispose(): void;
  }

  export class Context {
    global: Reference<unknown>;
    eval(code: string, options?: { timeout?: number }): Promise<unknown>;
  }

  export class Script {
    run(context: Context, options?: { timeout?: number }): Promise<unknown>;
  }

  export class Reference<T> {
    constructor(value: T);
    applySync(thisArg: unknown, args: unknown[]): unknown;
    derefInto(): T;
    set(key: string, value: unknown, options?: { copy?: boolean }): Promise<void>;
  }
}
