import {
  $applyNodeReplacement,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import type { ReactNode } from 'react';
import { ReferenceToken } from '@/components/shared/chat-input/ReferenceToken';
import type { Reference } from '@/lib/chat-input';

type SerializedReferenceNode = Spread<
  { reference: Reference },
  SerializedLexicalNode
>;

export class ReferenceNode extends DecoratorNode<ReactNode> {
  __reference: Reference;

  static getType(): string {
    return 'chat-reference';
  }

  static clone(node: ReferenceNode): ReferenceNode {
    return new ReferenceNode(node.__reference, node.__key);
  }

  static importJSON(json: SerializedReferenceNode): ReferenceNode {
    return $createReferenceNode(json.reference);
  }

  constructor(reference: Reference, key?: NodeKey) {
    super(key);
    this.__reference = reference;
  }

  exportJSON(): SerializedReferenceNode {
    return { ...super.exportJSON(), reference: this.__reference };
  }

  createDOM(): HTMLElement {
    return document.createElement('span');
  }

  updateDOM(): false {
    return false;
  }

  isInline(): true {
    return true;
  }

  getReference(): Reference {
    return this.getLatest().__reference;
  }

  decorate(): ReactNode {
    return <ReferenceToken reference={this.__reference} />;
  }
}

export const $createReferenceNode = (reference: Reference): ReferenceNode =>
  $applyNodeReplacement(new ReferenceNode(reference));

export const $isReferenceNode = (
  node: LexicalNode | null | undefined,
): node is ReferenceNode => node instanceof ReferenceNode;
