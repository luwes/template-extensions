
export class TemplateInstance extends DocumentFragment {
  constructor(
    template: HTMLTemplateElement,
    params: unknown,
    processor?: TemplateTypeInit
  );
  update(params: unknown): void;
}

type Expression = string;

type TemplateProcessCallback = (
  instance: TemplateInstance,
  parts: Iterable<[Expression, Part]>,
  params: unknown
) => void;

export type TemplateTypeInit = {
  processCallback: TemplateProcessCallback;
  createCallback?: TemplateProcessCallback;
};

export interface Part {
  value: string | null;
}

export class AttrPart implements Part {
  constructor(element: Element, attributeName: string, namespaceURI?: string);
  get attributeName(): string;
  get attributeNamespace(): string | null;
  get value(): string | null;
  set value(value: string | null);
  get element(): Element;
  get booleanValue(): boolean;
  set booleanValue(value: boolean);
}

export class ChildNodePart implements Part {
  constructor(parentNode: Element, nodes: Node[]);
  get value(): string;
  set value(string: string);
  get previousSibling(): ChildNode | null;
  get nextSibling(): ChildNode | null;
  replace(...nodes: Array<string | ChildNode>): void;
}


 // Slice off the expr name and the text info.
  const details = selectors.map((s) => {
    const info = s.split(' ');
    return [info.slice(0, -2), ...info.slice(-2)];
  });
  let paths = details.map(([path]) => path);
  // Sort based on path length, aka the tree depth.
  const shortToLong = [...paths].sort((a, b) => a.length - b.length);
  for (let i = 0; i < shortToLong.length - 1; i++) {
    const currentPath = shortToLong[i];
    const nextPath = shortToLong[i + 1];
    const currentDepth = currentPath.length - 1;
    const nextDepth = nextPath.length - 1;
    if (currentDepth === nextDepth) {
      const [currentNodeId, offsetLength = 1] = currentPath.join('|').split('+');
      const [nextNodeId] = nextPath.join('|').split('+');
      if (currentNodeId === nextNodeId) {
        let offset = 0;
        for (let path of paths) {
          const [index, len] = path[currentDepth]?.split('+') ?? [];
          if (offset > 0 && index) {
            path[currentDepth] = `${(+index + offset)}${len ? '+' + len : ''}`;
          }
          if (path === currentPath) {
            offset += (+offsetLength);
          }
          // bump the equal node path to the next node
          if (path === nextPath) offset += 1;
        }
      }
    }
  }

  for (let [path, textInfo, expr] of details) {
    console.log(path, textInfo, expr);
  }
