interface NodeCreationObserverInterface {
  init(id: string): void;
  onCreation<T = HTMLElement>(selector: string, callback: (ele: T) => void, removeOnFirstMatch?: boolean): void;
  remove(selector: string): void;
  stop(): void;
}

export default NodeCreationObserverInterface;
