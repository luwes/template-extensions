export class AssignedTemplateInstance {
  constructor(
    container: HTMLElement | ShadowRoot,
    template: HTMLTemplateElement,
    params: unknown,
    processor?: TemplateTypeInit
  );
  update(params: unknown): void;
}

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
  toString(): string;
}

export class AttrPart implements Part {
  constructor(element: Element, attributeName: string, namespaceURI?: string);
  get element(): Element;
  get attributeName(): string;
  get attributeNamespace(): string | null;
  get value(): string | null;
  set value(value: string | null);
  get booleanValue(): boolean;
  set booleanValue(value: boolean);
  get list(): AttrPartList;
}

export class AttrPartList {
  get length(): number;
  item(index: number): AttrPart;
  append(...items): void;
  toString(): string;
}

export class ChildNodePart implements Part {
  constructor(parentNode: Element, nodes: Node[]);
  get parentNode(): Element;
  get value(): string;
  set value(string: string);
  get previousSibling(): ChildNode | null;
  get nextSibling(): ChildNode | null;
  replace(...nodes: Array<string | ChildNode>): void;
}

export class InnerTemplatePart extends ChildNodePart {
  constructor(parentNode: Element, template: HTMLTemplateElement);
  get directive(): string | null;
  get expression(): Expression | null;
}
