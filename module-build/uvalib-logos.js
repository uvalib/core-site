/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * True if the custom elements polyfill is in use.
 */
const isCEPolyfill = typeof window !== 'undefined' &&
    window.customElements != null &&
    window.customElements.polyfillWrapFlushCallback !==
        undefined;
/**
 * Removes nodes, starting from `start` (inclusive) to `end` (exclusive), from
 * `container`.
 */
const removeNodes = (container, start, end = null) => {
    while (start !== end) {
        const n = start.nextSibling;
        container.removeChild(start);
        start = n;
    }
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An expression marker with embedded unique key to avoid collision with
 * possible text in templates.
 */
const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
/**
 * An expression marker used text-positions, multi-binding attributes, and
 * attributes with markup-like text values.
 */
const nodeMarker = `<!--${marker}-->`;
const markerRegex = new RegExp(`${marker}|${nodeMarker}`);
/**
 * Suffix appended to all bound attribute names.
 */
const boundAttributeSuffix = '$lit$';
/**
 * An updatable Template that tracks the location of dynamic parts.
 */
class Template {
    constructor(result, element) {
        this.parts = [];
        this.element = element;
        const nodesToRemove = [];
        const stack = [];
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(element.content, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        // Keeps track of the last index associated with a part. We try to delete
        // unnecessary nodes, but we never want to associate two different parts
        // to the same index. They must have a constant node between.
        let lastPartIndex = 0;
        let index = -1;
        let partIndex = 0;
        const { strings, values: { length } } = result;
        while (partIndex < length) {
            const node = walker.nextNode();
            if (node === null) {
                // We've exhausted the content inside a nested template element.
                // Because we still have parts (the outer for-loop), we know:
                // - There is a template in the stack
                // - The walker will find a nextNode outside the template
                walker.currentNode = stack.pop();
                continue;
            }
            index++;
            if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
                if (node.hasAttributes()) {
                    const attributes = node.attributes;
                    const { length } = attributes;
                    // Per
                    // https://developer.mozilla.org/en-US/docs/Web/API/NamedNodeMap,
                    // attributes are not guaranteed to be returned in document order.
                    // In particular, Edge/IE can return them out of order, so we cannot
                    // assume a correspondence between part index and attribute index.
                    let count = 0;
                    for (let i = 0; i < length; i++) {
                        if (endsWith(attributes[i].name, boundAttributeSuffix)) {
                            count++;
                        }
                    }
                    while (count-- > 0) {
                        // Get the template literal section leading up to the first
                        // expression in this attribute
                        const stringForPart = strings[partIndex];
                        // Find the attribute name
                        const name = lastAttributeNameRegex.exec(stringForPart)[2];
                        // Find the corresponding attribute
                        // All bound attributes have had a suffix added in
                        // TemplateResult#getHTML to opt out of special attribute
                        // handling. To look up the attribute value we also need to add
                        // the suffix.
                        const attributeLookupName = name.toLowerCase() + boundAttributeSuffix;
                        const attributeValue = node.getAttribute(attributeLookupName);
                        node.removeAttribute(attributeLookupName);
                        const statics = attributeValue.split(markerRegex);
                        this.parts.push({ type: 'attribute', index, name, strings: statics });
                        partIndex += statics.length - 1;
                    }
                }
                if (node.tagName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
            }
            else if (node.nodeType === 3 /* Node.TEXT_NODE */) {
                const data = node.data;
                if (data.indexOf(marker) >= 0) {
                    const parent = node.parentNode;
                    const strings = data.split(markerRegex);
                    const lastIndex = strings.length - 1;
                    // Generate a new text node for each literal section
                    // These nodes are also used as the markers for node parts
                    for (let i = 0; i < lastIndex; i++) {
                        let insert;
                        let s = strings[i];
                        if (s === '') {
                            insert = createMarker();
                        }
                        else {
                            const match = lastAttributeNameRegex.exec(s);
                            if (match !== null && endsWith(match[2], boundAttributeSuffix)) {
                                s = s.slice(0, match.index) + match[1] +
                                    match[2].slice(0, -boundAttributeSuffix.length) + match[3];
                            }
                            insert = document.createTextNode(s);
                        }
                        parent.insertBefore(insert, node);
                        this.parts.push({ type: 'node', index: ++index });
                    }
                    // If there's no text, we must insert a comment to mark our place.
                    // Else, we can trust it will stick around after cloning.
                    if (strings[lastIndex] === '') {
                        parent.insertBefore(createMarker(), node);
                        nodesToRemove.push(node);
                    }
                    else {
                        node.data = strings[lastIndex];
                    }
                    // We have a part for each match found
                    partIndex += lastIndex;
                }
            }
            else if (node.nodeType === 8 /* Node.COMMENT_NODE */) {
                if (node.data === marker) {
                    const parent = node.parentNode;
                    // Add a new marker node to be the startNode of the Part if any of
                    // the following are true:
                    //  * We don't have a previousSibling
                    //  * The previousSibling is already the start of a previous part
                    if (node.previousSibling === null || index === lastPartIndex) {
                        index++;
                        parent.insertBefore(createMarker(), node);
                    }
                    lastPartIndex = index;
                    this.parts.push({ type: 'node', index });
                    // If we don't have a nextSibling, keep this node so we have an end.
                    // Else, we can remove it to save future costs.
                    if (node.nextSibling === null) {
                        node.data = '';
                    }
                    else {
                        nodesToRemove.push(node);
                        index--;
                    }
                    partIndex++;
                }
                else {
                    let i = -1;
                    while ((i = node.data.indexOf(marker, i + 1)) !== -1) {
                        // Comment node has a binding marker inside, make an inactive part
                        // The binding won't work, but subsequent bindings will
                        // TODO (justinfagnani): consider whether it's even worth it to
                        // make bindings in comments work
                        this.parts.push({ type: 'node', index: -1 });
                        partIndex++;
                    }
                }
            }
        }
        // Remove text binding nodes after the walk to not disturb the TreeWalker
        for (const n of nodesToRemove) {
            n.parentNode.removeChild(n);
        }
    }
}
const endsWith = (str, suffix) => {
    const index = str.length - suffix.length;
    return index >= 0 && str.slice(index) === suffix;
};
const isTemplatePartActive = (part) => part.index !== -1;
// Allows `document.createComment('')` to be renamed for a
// small manual size-savings.
const createMarker = () => document.createComment('');
/**
 * This regex extracts the attribute name preceding an attribute-position
 * expression. It does this by matching the syntax allowed for attributes
 * against the string literal directly preceding the expression, assuming that
 * the expression is in an attribute-value position.
 *
 * See attributes in the HTML spec:
 * https://www.w3.org/TR/html5/syntax.html#elements-attributes
 *
 * " \x09\x0a\x0c\x0d" are HTML space characters:
 * https://www.w3.org/TR/html5/infrastructure.html#space-characters
 *
 * "\0-\x1F\x7F-\x9F" are Unicode control characters, which includes every
 * space character except " ".
 *
 * So an attribute is:
 *  * The name: any character except a control character, space character, ('),
 *    ("), ">", "=", or "/"
 *  * Followed by zero or more space characters
 *  * Followed by "="
 *  * Followed by zero or more space characters
 *  * Followed by:
 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
 *    * (") then any non-("), or
 *    * (') then any non-(')
 */
const lastAttributeNameRegex = 
// eslint-disable-next-line no-control-regex
/([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const walkerNodeFilter = 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */;
/**
 * Removes the list of nodes from a Template safely. In addition to removing
 * nodes from the Template, the Template part indices are updated to match
 * the mutated Template DOM.
 *
 * As the template is walked the removal state is tracked and
 * part indices are adjusted as needed.
 *
 * div
 *   div#1 (remove) <-- start removing (removing node is div#1)
 *     div
 *       div#2 (remove)  <-- continue removing (removing node is still div#1)
 *         div
 * div <-- stop removing since previous sibling is the removing node (div#1,
 * removed 4 nodes)
 */
function removeNodesFromTemplate(template, nodesToRemove) {
    const { element: { content }, parts } = template;
    const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
    let partIndex = nextActiveIndexInTemplateParts(parts);
    let part = parts[partIndex];
    let nodeIndex = -1;
    let removeCount = 0;
    const nodesToRemoveInTemplate = [];
    let currentRemovingNode = null;
    while (walker.nextNode()) {
        nodeIndex++;
        const node = walker.currentNode;
        // End removal if stepped past the removing node
        if (node.previousSibling === currentRemovingNode) {
            currentRemovingNode = null;
        }
        // A node to remove was found in the template
        if (nodesToRemove.has(node)) {
            nodesToRemoveInTemplate.push(node);
            // Track node we're removing
            if (currentRemovingNode === null) {
                currentRemovingNode = node;
            }
        }
        // When removing, increment count by which to adjust subsequent part indices
        if (currentRemovingNode !== null) {
            removeCount++;
        }
        while (part !== undefined && part.index === nodeIndex) {
            // If part is in a removed node deactivate it by setting index to -1 or
            // adjust the index as needed.
            part.index = currentRemovingNode !== null ? -1 : part.index - removeCount;
            // go to the next active part.
            partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
            part = parts[partIndex];
        }
    }
    nodesToRemoveInTemplate.forEach((n) => n.parentNode.removeChild(n));
}
const countNodes = (node) => {
    let count = (node.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */) ? 0 : 1;
    const walker = document.createTreeWalker(node, walkerNodeFilter, null, false);
    while (walker.nextNode()) {
        count++;
    }
    return count;
};
const nextActiveIndexInTemplateParts = (parts, startIndex = -1) => {
    for (let i = startIndex + 1; i < parts.length; i++) {
        const part = parts[i];
        if (isTemplatePartActive(part)) {
            return i;
        }
    }
    return -1;
};
/**
 * Inserts the given node into the Template, optionally before the given
 * refNode. In addition to inserting the node into the Template, the Template
 * part indices are updated to match the mutated Template DOM.
 */
function insertNodeIntoTemplate(template, node, refNode = null) {
    const { element: { content }, parts } = template;
    // If there's no refNode, then put node at end of template.
    // No part indices need to be shifted in this case.
    if (refNode === null || refNode === undefined) {
        content.appendChild(node);
        return;
    }
    const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
    let partIndex = nextActiveIndexInTemplateParts(parts);
    let insertCount = 0;
    let walkerIndex = -1;
    while (walker.nextNode()) {
        walkerIndex++;
        const walkerNode = walker.currentNode;
        if (walkerNode === refNode) {
            insertCount = countNodes(node);
            refNode.parentNode.insertBefore(node, refNode);
        }
        while (partIndex !== -1 && parts[partIndex].index === walkerIndex) {
            // If we've inserted the node, simply adjust all subsequent parts
            if (insertCount > 0) {
                while (partIndex !== -1) {
                    parts[partIndex].index += insertCount;
                    partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
                }
                return;
            }
            partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
        }
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const directives = new WeakMap();
const isDirective = (o) => {
    return typeof o === 'function' && directives.has(o);
};

/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * A sentinel value that signals that a value was handled by a directive and
 * should not be written to the DOM.
 */
const noChange = {};
/**
 * A sentinel value that signals a NodePart to fully clear its content.
 */
const nothing = {};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An instance of a `Template` that can be attached to the DOM and updated
 * with new values.
 */
class TemplateInstance {
    constructor(template, processor, options) {
        this.__parts = [];
        this.template = template;
        this.processor = processor;
        this.options = options;
    }
    update(values) {
        let i = 0;
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.setValue(values[i]);
            }
            i++;
        }
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.commit();
            }
        }
    }
    _clone() {
        // There are a number of steps in the lifecycle of a template instance's
        // DOM fragment:
        //  1. Clone - create the instance fragment
        //  2. Adopt - adopt into the main document
        //  3. Process - find part markers and create parts
        //  4. Upgrade - upgrade custom elements
        //  5. Update - set node, attribute, property, etc., values
        //  6. Connect - connect to the document. Optional and outside of this
        //     method.
        //
        // We have a few constraints on the ordering of these steps:
        //  * We need to upgrade before updating, so that property values will pass
        //    through any property setters.
        //  * We would like to process before upgrading so that we're sure that the
        //    cloned fragment is inert and not disturbed by self-modifying DOM.
        //  * We want custom elements to upgrade even in disconnected fragments.
        //
        // Given these constraints, with full custom elements support we would
        // prefer the order: Clone, Process, Adopt, Upgrade, Update, Connect
        //
        // But Safari does not implement CustomElementRegistry#upgrade, so we
        // can not implement that order and still have upgrade-before-update and
        // upgrade disconnected fragments. So we instead sacrifice the
        // process-before-upgrade constraint, since in Custom Elements v1 elements
        // must not modify their light DOM in the constructor. We still have issues
        // when co-existing with CEv0 elements like Polymer 1, and with polyfills
        // that don't strictly adhere to the no-modification rule because shadow
        // DOM, which may be created in the constructor, is emulated by being placed
        // in the light DOM.
        //
        // The resulting order is on native is: Clone, Adopt, Upgrade, Process,
        // Update, Connect. document.importNode() performs Clone, Adopt, and Upgrade
        // in one step.
        //
        // The Custom Elements v1 polyfill supports upgrade(), so the order when
        // polyfilled is the more ideal: Clone, Process, Adopt, Upgrade, Update,
        // Connect.
        const fragment = isCEPolyfill ?
            this.template.element.content.cloneNode(true) :
            document.importNode(this.template.element.content, true);
        const stack = [];
        const parts = this.template.parts;
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(fragment, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        let partIndex = 0;
        let nodeIndex = 0;
        let part;
        let node = walker.nextNode();
        // Loop through all the nodes and parts of a template
        while (partIndex < parts.length) {
            part = parts[partIndex];
            if (!isTemplatePartActive(part)) {
                this.__parts.push(undefined);
                partIndex++;
                continue;
            }
            // Progress the tree walker until we find our next part's node.
            // Note that multiple parts may share the same node (attribute parts
            // on a single element), so this loop may not run at all.
            while (nodeIndex < part.index) {
                nodeIndex++;
                if (node.nodeName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
                if ((node = walker.nextNode()) === null) {
                    // We've exhausted the content inside a nested template element.
                    // Because we still have parts (the outer for-loop), we know:
                    // - There is a template in the stack
                    // - The walker will find a nextNode outside the template
                    walker.currentNode = stack.pop();
                    node = walker.nextNode();
                }
            }
            // We've arrived at our part's node.
            if (part.type === 'node') {
                const part = this.processor.handleTextExpression(this.options);
                part.insertAfterNode(node.previousSibling);
                this.__parts.push(part);
            }
            else {
                this.__parts.push(...this.processor.handleAttributeExpressions(node, part.name, part.strings, this.options));
            }
            partIndex++;
        }
        if (isCEPolyfill) {
            document.adoptNode(fragment);
            customElements.upgrade(fragment);
        }
        return fragment;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Our TrustedTypePolicy for HTML which is declared using the html template
 * tag function.
 *
 * That HTML is a developer-authored constant, and is parsed with innerHTML
 * before any untrusted expressions have been mixed in. Therefor it is
 * considered safe by construction.
 */
const policy = window.trustedTypes &&
    trustedTypes.createPolicy('lit-html', { createHTML: (s) => s });
const commentMarker = ` ${marker} `;
/**
 * The return type of `html`, which holds a Template and the values from
 * interpolated expressions.
 */
class TemplateResult {
    constructor(strings, values, type, processor) {
        this.strings = strings;
        this.values = values;
        this.type = type;
        this.processor = processor;
    }
    /**
     * Returns a string of HTML used to create a `<template>` element.
     */
    getHTML() {
        const l = this.strings.length - 1;
        let html = '';
        let isCommentBinding = false;
        for (let i = 0; i < l; i++) {
            const s = this.strings[i];
            // For each binding we want to determine the kind of marker to insert
            // into the template source before it's parsed by the browser's HTML
            // parser. The marker type is based on whether the expression is in an
            // attribute, text, or comment position.
            //   * For node-position bindings we insert a comment with the marker
            //     sentinel as its text content, like <!--{{lit-guid}}-->.
            //   * For attribute bindings we insert just the marker sentinel for the
            //     first binding, so that we support unquoted attribute bindings.
            //     Subsequent bindings can use a comment marker because multi-binding
            //     attributes must be quoted.
            //   * For comment bindings we insert just the marker sentinel so we don't
            //     close the comment.
            //
            // The following code scans the template source, but is *not* an HTML
            // parser. We don't need to track the tree structure of the HTML, only
            // whether a binding is inside a comment, and if not, if it appears to be
            // the first binding in an attribute.
            const commentOpen = s.lastIndexOf('<!--');
            // We're in comment position if we have a comment open with no following
            // comment close. Because <-- can appear in an attribute value there can
            // be false positives.
            isCommentBinding = (commentOpen > -1 || isCommentBinding) &&
                s.indexOf('-->', commentOpen + 1) === -1;
            // Check to see if we have an attribute-like sequence preceding the
            // expression. This can match "name=value" like structures in text,
            // comments, and attribute values, so there can be false-positives.
            const attributeMatch = lastAttributeNameRegex.exec(s);
            if (attributeMatch === null) {
                // We're only in this branch if we don't have a attribute-like
                // preceding sequence. For comments, this guards against unusual
                // attribute values like <div foo="<!--${'bar'}">. Cases like
                // <!-- foo=${'bar'}--> are handled correctly in the attribute branch
                // below.
                html += s + (isCommentBinding ? commentMarker : nodeMarker);
            }
            else {
                // For attributes we use just a marker sentinel, and also append a
                // $lit$ suffix to the name to opt-out of attribute-specific parsing
                // that IE and Edge do for style and certain SVG attributes.
                html += s.substr(0, attributeMatch.index) + attributeMatch[1] +
                    attributeMatch[2] + boundAttributeSuffix + attributeMatch[3] +
                    marker;
            }
        }
        html += this.strings[l];
        return html;
    }
    getTemplateElement() {
        const template = document.createElement('template');
        let value = this.getHTML();
        if (policy !== undefined) {
            // this is secure because `this.strings` is a TemplateStringsArray.
            // TODO: validate this when
            // https://github.com/tc39/proposal-array-is-template-object is
            // implemented.
            value = policy.createHTML(value);
        }
        template.innerHTML = value;
        return template;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const isPrimitive = (value) => {
    return (value === null ||
        !(typeof value === 'object' || typeof value === 'function'));
};
const isIterable = (value) => {
    return Array.isArray(value) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        !!(value && value[Symbol.iterator]);
};
/**
 * Writes attribute values to the DOM for a group of AttributeParts bound to a
 * single attribute. The value is only set once even if there are multiple parts
 * for an attribute.
 */
class AttributeCommitter {
    constructor(element, name, strings) {
        this.dirty = true;
        this.element = element;
        this.name = name;
        this.strings = strings;
        this.parts = [];
        for (let i = 0; i < strings.length - 1; i++) {
            this.parts[i] = this._createPart();
        }
    }
    /**
     * Creates a single part. Override this to create a differnt type of part.
     */
    _createPart() {
        return new AttributePart(this);
    }
    _getValue() {
        const strings = this.strings;
        const l = strings.length - 1;
        const parts = this.parts;
        // If we're assigning an attribute via syntax like:
        //    attr="${foo}"  or  attr=${foo}
        // but not
        //    attr="${foo} ${bar}" or attr="${foo} baz"
        // then we don't want to coerce the attribute value into one long
        // string. Instead we want to just return the value itself directly,
        // so that sanitizeDOMValue can get the actual value rather than
        // String(value)
        // The exception is if v is an array, in which case we do want to smash
        // it together into a string without calling String() on the array.
        //
        // This also allows trusted values (when using TrustedTypes) being
        // assigned to DOM sinks without being stringified in the process.
        if (l === 1 && strings[0] === '' && strings[1] === '') {
            const v = parts[0].value;
            if (typeof v === 'symbol') {
                return String(v);
            }
            if (typeof v === 'string' || !isIterable(v)) {
                return v;
            }
        }
        let text = '';
        for (let i = 0; i < l; i++) {
            text += strings[i];
            const part = parts[i];
            if (part !== undefined) {
                const v = part.value;
                if (isPrimitive(v) || !isIterable(v)) {
                    text += typeof v === 'string' ? v : String(v);
                }
                else {
                    for (const t of v) {
                        text += typeof t === 'string' ? t : String(t);
                    }
                }
            }
        }
        text += strings[l];
        return text;
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element.setAttribute(this.name, this._getValue());
        }
    }
}
/**
 * A Part that controls all or part of an attribute value.
 */
class AttributePart {
    constructor(committer) {
        this.value = undefined;
        this.committer = committer;
    }
    setValue(value) {
        if (value !== noChange && (!isPrimitive(value) || value !== this.value)) {
            this.value = value;
            // If the value is a not a directive, dirty the committer so that it'll
            // call setAttribute. If the value is a directive, it'll dirty the
            // committer if it calls setValue().
            if (!isDirective(value)) {
                this.committer.dirty = true;
            }
        }
    }
    commit() {
        while (isDirective(this.value)) {
            const directive = this.value;
            this.value = noChange;
            directive(this);
        }
        if (this.value === noChange) {
            return;
        }
        this.committer.commit();
    }
}
/**
 * A Part that controls a location within a Node tree. Like a Range, NodePart
 * has start and end locations and can set and update the Nodes between those
 * locations.
 *
 * NodeParts support several value types: primitives, Nodes, TemplateResults,
 * as well as arrays and iterables of those types.
 */
class NodePart {
    constructor(options) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.options = options;
    }
    /**
     * Appends this part into a container.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendInto(container) {
        this.startNode = container.appendChild(createMarker());
        this.endNode = container.appendChild(createMarker());
    }
    /**
     * Inserts this part after the `ref` node (between `ref` and `ref`'s next
     * sibling). Both `ref` and its next sibling must be static, unchanging nodes
     * such as those that appear in a literal section of a template.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterNode(ref) {
        this.startNode = ref;
        this.endNode = ref.nextSibling;
    }
    /**
     * Appends this part into a parent part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendIntoPart(part) {
        part.__insert(this.startNode = createMarker());
        part.__insert(this.endNode = createMarker());
    }
    /**
     * Inserts this part after the `ref` part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterPart(ref) {
        ref.__insert(this.startNode = createMarker());
        this.endNode = ref.endNode;
        ref.endNode = this.startNode;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        if (this.startNode.parentNode === null) {
            return;
        }
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        const value = this.__pendingValue;
        if (value === noChange) {
            return;
        }
        if (isPrimitive(value)) {
            if (value !== this.value) {
                this.__commitText(value);
            }
        }
        else if (value instanceof TemplateResult) {
            this.__commitTemplateResult(value);
        }
        else if (value instanceof Node) {
            this.__commitNode(value);
        }
        else if (isIterable(value)) {
            this.__commitIterable(value);
        }
        else if (value === nothing) {
            this.value = nothing;
            this.clear();
        }
        else {
            // Fallback, will render the string representation
            this.__commitText(value);
        }
    }
    __insert(node) {
        this.endNode.parentNode.insertBefore(node, this.endNode);
    }
    __commitNode(value) {
        if (this.value === value) {
            return;
        }
        this.clear();
        this.__insert(value);
        this.value = value;
    }
    __commitText(value) {
        const node = this.startNode.nextSibling;
        value = value == null ? '' : value;
        // If `value` isn't already a string, we explicitly convert it here in case
        // it can't be implicitly converted - i.e. it's a symbol.
        const valueAsString = typeof value === 'string' ? value : String(value);
        if (node === this.endNode.previousSibling &&
            node.nodeType === 3 /* Node.TEXT_NODE */) {
            // If we only have a single text node between the markers, we can just
            // set its value, rather than replacing it.
            // TODO(justinfagnani): Can we just check if this.value is primitive?
            node.data = valueAsString;
        }
        else {
            this.__commitNode(document.createTextNode(valueAsString));
        }
        this.value = value;
    }
    __commitTemplateResult(value) {
        const template = this.options.templateFactory(value);
        if (this.value instanceof TemplateInstance &&
            this.value.template === template) {
            this.value.update(value.values);
        }
        else {
            // Make sure we propagate the template processor from the TemplateResult
            // so that we use its syntax extension, etc. The template factory comes
            // from the render function options so that it can control template
            // caching and preprocessing.
            const instance = new TemplateInstance(template, value.processor, this.options);
            const fragment = instance._clone();
            instance.update(value.values);
            this.__commitNode(fragment);
            this.value = instance;
        }
    }
    __commitIterable(value) {
        // For an Iterable, we create a new InstancePart per item, then set its
        // value to the item. This is a little bit of overhead for every item in
        // an Iterable, but it lets us recurse easily and efficiently update Arrays
        // of TemplateResults that will be commonly returned from expressions like:
        // array.map((i) => html`${i}`), by reusing existing TemplateInstances.
        // If _value is an array, then the previous render was of an
        // iterable and _value will contain the NodeParts from the previous
        // render. If _value is not an array, clear this part and make a new
        // array for NodeParts.
        if (!Array.isArray(this.value)) {
            this.value = [];
            this.clear();
        }
        // Lets us keep track of how many items we stamped so we can clear leftover
        // items from a previous render
        const itemParts = this.value;
        let partIndex = 0;
        let itemPart;
        for (const item of value) {
            // Try to reuse an existing part
            itemPart = itemParts[partIndex];
            // If no existing part, create a new one
            if (itemPart === undefined) {
                itemPart = new NodePart(this.options);
                itemParts.push(itemPart);
                if (partIndex === 0) {
                    itemPart.appendIntoPart(this);
                }
                else {
                    itemPart.insertAfterPart(itemParts[partIndex - 1]);
                }
            }
            itemPart.setValue(item);
            itemPart.commit();
            partIndex++;
        }
        if (partIndex < itemParts.length) {
            // Truncate the parts array so _value reflects the current state
            itemParts.length = partIndex;
            this.clear(itemPart && itemPart.endNode);
        }
    }
    clear(startNode = this.startNode) {
        removeNodes(this.startNode.parentNode, startNode.nextSibling, this.endNode);
    }
}
/**
 * Implements a boolean attribute, roughly as defined in the HTML
 * specification.
 *
 * If the value is truthy, then the attribute is present with a value of
 * ''. If the value is falsey, the attribute is removed.
 */
class BooleanAttributePart {
    constructor(element, name, strings) {
        this.value = undefined;
        this.__pendingValue = undefined;
        if (strings.length !== 2 || strings[0] !== '' || strings[1] !== '') {
            throw new Error('Boolean attributes can only contain a single expression');
        }
        this.element = element;
        this.name = name;
        this.strings = strings;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const value = !!this.__pendingValue;
        if (this.value !== value) {
            if (value) {
                this.element.setAttribute(this.name, '');
            }
            else {
                this.element.removeAttribute(this.name);
            }
            this.value = value;
        }
        this.__pendingValue = noChange;
    }
}
/**
 * Sets attribute values for PropertyParts, so that the value is only set once
 * even if there are multiple parts for a property.
 *
 * If an expression controls the whole property value, then the value is simply
 * assigned to the property under control. If there are string literals or
 * multiple expressions, then the strings are expressions are interpolated into
 * a string first.
 */
class PropertyCommitter extends AttributeCommitter {
    constructor(element, name, strings) {
        super(element, name, strings);
        this.single =
            (strings.length === 2 && strings[0] === '' && strings[1] === '');
    }
    _createPart() {
        return new PropertyPart(this);
    }
    _getValue() {
        if (this.single) {
            return this.parts[0].value;
        }
        return super._getValue();
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.element[this.name] = this._getValue();
        }
    }
}
class PropertyPart extends AttributePart {
}
// Detect event listener options support. If the `capture` property is read
// from the options object, then options are supported. If not, then the third
// argument to add/removeEventListener is interpreted as the boolean capture
// value so we should only pass the `capture` property.
let eventOptionsSupported = false;
// Wrap into an IIFE because MS Edge <= v41 does not support having try/catch
// blocks right into the body of a module
(() => {
    try {
        const options = {
            get capture() {
                eventOptionsSupported = true;
                return false;
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.addEventListener('test', options, options);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.removeEventListener('test', options, options);
    }
    catch (_e) {
        // event options not supported
    }
})();
class EventPart {
    constructor(element, eventName, eventContext) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.element = element;
        this.eventName = eventName;
        this.eventContext = eventContext;
        this.__boundHandleEvent = (e) => this.handleEvent(e);
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const newListener = this.__pendingValue;
        const oldListener = this.value;
        const shouldRemoveListener = newListener == null ||
            oldListener != null &&
                (newListener.capture !== oldListener.capture ||
                    newListener.once !== oldListener.once ||
                    newListener.passive !== oldListener.passive);
        const shouldAddListener = newListener != null && (oldListener == null || shouldRemoveListener);
        if (shouldRemoveListener) {
            this.element.removeEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        if (shouldAddListener) {
            this.__options = getOptions(newListener);
            this.element.addEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        this.value = newListener;
        this.__pendingValue = noChange;
    }
    handleEvent(event) {
        if (typeof this.value === 'function') {
            this.value.call(this.eventContext || this.element, event);
        }
        else {
            this.value.handleEvent(event);
        }
    }
}
// We copy options because of the inconsistent behavior of browsers when reading
// the third argument of add/removeEventListener. IE11 doesn't support options
// at all. Chrome 41 only reads `capture` if the argument is an object.
const getOptions = (o) => o &&
    (eventOptionsSupported ?
        { capture: o.capture, passive: o.passive, once: o.once } :
        o.capture);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * The default TemplateFactory which caches Templates keyed on
 * result.type and result.strings.
 */
function templateFactory(result) {
    let templateCache = templateCaches.get(result.type);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(result.type, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    // If the TemplateStringsArray is new, generate a key from the strings
    // This key is shared between all templates with identical content
    const key = result.strings.join(marker);
    // Check if we already have a Template for this key
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        // If we have not seen this key before, create a new Template
        template = new Template(result, result.getTemplateElement());
        // Cache the Template for this key
        templateCache.keyString.set(key, template);
    }
    // Cache all future queries for this TemplateStringsArray
    templateCache.stringsArray.set(result.strings, template);
    return template;
}
const templateCaches = new Map();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const parts = new WeakMap();
/**
 * Renders a template result or other value to a container.
 *
 * To update a container with new values, reevaluate the template literal and
 * call `render` with the new result.
 *
 * @param result Any value renderable by NodePart - typically a TemplateResult
 *     created by evaluating a template tag like `html` or `svg`.
 * @param container A DOM parent to render to. The entire contents are either
 *     replaced, or efficiently updated if the same result type was previous
 *     rendered there.
 * @param options RenderOptions for the entire render tree rendered to this
 *     container. Render options must *not* change between renders to the same
 *     container, as those changes will not effect previously rendered DOM.
 */
const render$1 = (result, container, options) => {
    let part = parts.get(container);
    if (part === undefined) {
        removeNodes(container, container.firstChild);
        parts.set(container, part = new NodePart(Object.assign({ templateFactory }, options)));
        part.appendInto(container);
    }
    part.setValue(result);
    part.commit();
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Creates Parts when a template is instantiated.
 */
class DefaultTemplateProcessor {
    /**
     * Create parts for an attribute-position binding, given the event, attribute
     * name, and string literals.
     *
     * @param element The element containing the binding
     * @param name  The attribute name
     * @param strings The string literals. There are always at least two strings,
     *   event for fully-controlled bindings with a single expression.
     */
    handleAttributeExpressions(element, name, strings, options) {
        const prefix = name[0];
        if (prefix === '.') {
            const committer = new PropertyCommitter(element, name.slice(1), strings);
            return committer.parts;
        }
        if (prefix === '@') {
            return [new EventPart(element, name.slice(1), options.eventContext)];
        }
        if (prefix === '?') {
            return [new BooleanAttributePart(element, name.slice(1), strings)];
        }
        const committer = new AttributeCommitter(element, name, strings);
        return committer.parts;
    }
    /**
     * Create parts for a text-position binding.
     * @param templateFactory
     */
    handleTextExpression(options) {
        return new NodePart(options);
    }
}
const defaultTemplateProcessor = new DefaultTemplateProcessor();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for lit-html usage.
// TODO(justinfagnani): inject version number at build time
if (typeof window !== 'undefined') {
    (window['litHtmlVersions'] || (window['litHtmlVersions'] = [])).push('1.4.1');
}
/**
 * Interprets a template literal as an HTML template that can efficiently
 * render to and update a container.
 */
const html = (strings, ...values) => new TemplateResult(strings, values, 'html', defaultTemplateProcessor);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// Get a key to lookup in `templateCaches`.
const getTemplateCacheKey = (type, scopeName) => `${type}--${scopeName}`;
let compatibleShadyCSSVersion = true;
if (typeof window.ShadyCSS === 'undefined') {
    compatibleShadyCSSVersion = false;
}
else if (typeof window.ShadyCSS.prepareTemplateDom === 'undefined') {
    console.warn(`Incompatible ShadyCSS version detected. ` +
        `Please update to at least @webcomponents/webcomponentsjs@2.0.2 and ` +
        `@webcomponents/shadycss@1.3.1.`);
    compatibleShadyCSSVersion = false;
}
/**
 * Template factory which scopes template DOM using ShadyCSS.
 * @param scopeName {string}
 */
const shadyTemplateFactory = (scopeName) => (result) => {
    const cacheKey = getTemplateCacheKey(result.type, scopeName);
    let templateCache = templateCaches.get(cacheKey);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(cacheKey, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    const key = result.strings.join(marker);
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        const element = result.getTemplateElement();
        if (compatibleShadyCSSVersion) {
            window.ShadyCSS.prepareTemplateDom(element, scopeName);
        }
        template = new Template(result, element);
        templateCache.keyString.set(key, template);
    }
    templateCache.stringsArray.set(result.strings, template);
    return template;
};
const TEMPLATE_TYPES = ['html', 'svg'];
/**
 * Removes all style elements from Templates for the given scopeName.
 */
const removeStylesFromLitTemplates = (scopeName) => {
    TEMPLATE_TYPES.forEach((type) => {
        const templates = templateCaches.get(getTemplateCacheKey(type, scopeName));
        if (templates !== undefined) {
            templates.keyString.forEach((template) => {
                const { element: { content } } = template;
                // IE 11 doesn't support the iterable param Set constructor
                const styles = new Set();
                Array.from(content.querySelectorAll('style')).forEach((s) => {
                    styles.add(s);
                });
                removeNodesFromTemplate(template, styles);
            });
        }
    });
};
const shadyRenderSet = new Set();
/**
 * For the given scope name, ensures that ShadyCSS style scoping is performed.
 * This is done just once per scope name so the fragment and template cannot
 * be modified.
 * (1) extracts styles from the rendered fragment and hands them to ShadyCSS
 * to be scoped and appended to the document
 * (2) removes style elements from all lit-html Templates for this scope name.
 *
 * Note, <style> elements can only be placed into templates for the
 * initial rendering of the scope. If <style> elements are included in templates
 * dynamically rendered to the scope (after the first scope render), they will
 * not be scoped and the <style> will be left in the template and rendered
 * output.
 */
const prepareTemplateStyles = (scopeName, renderedDOM, template) => {
    shadyRenderSet.add(scopeName);
    // If `renderedDOM` is stamped from a Template, then we need to edit that
    // Template's underlying template element. Otherwise, we create one here
    // to give to ShadyCSS, which still requires one while scoping.
    const templateElement = !!template ? template.element : document.createElement('template');
    // Move styles out of rendered DOM and store.
    const styles = renderedDOM.querySelectorAll('style');
    const { length } = styles;
    // If there are no styles, skip unnecessary work
    if (length === 0) {
        // Ensure prepareTemplateStyles is called to support adding
        // styles via `prepareAdoptedCssText` since that requires that
        // `prepareTemplateStyles` is called.
        //
        // ShadyCSS will only update styles containing @apply in the template
        // given to `prepareTemplateStyles`. If no lit Template was given,
        // ShadyCSS will not be able to update uses of @apply in any relevant
        // template. However, this is not a problem because we only create the
        // template for the purpose of supporting `prepareAdoptedCssText`,
        // which doesn't support @apply at all.
        window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
        return;
    }
    const condensedStyle = document.createElement('style');
    // Collect styles into a single style. This helps us make sure ShadyCSS
    // manipulations will not prevent us from being able to fix up template
    // part indices.
    // NOTE: collecting styles is inefficient for browsers but ShadyCSS
    // currently does this anyway. When it does not, this should be changed.
    for (let i = 0; i < length; i++) {
        const style = styles[i];
        style.parentNode.removeChild(style);
        condensedStyle.textContent += style.textContent;
    }
    // Remove styles from nested templates in this scope.
    removeStylesFromLitTemplates(scopeName);
    // And then put the condensed style into the "root" template passed in as
    // `template`.
    const content = templateElement.content;
    if (!!template) {
        insertNodeIntoTemplate(template, condensedStyle, content.firstChild);
    }
    else {
        content.insertBefore(condensedStyle, content.firstChild);
    }
    // Note, it's important that ShadyCSS gets the template that `lit-html`
    // will actually render so that it can update the style inside when
    // needed (e.g. @apply native Shadow DOM case).
    window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
    const style = content.querySelector('style');
    if (window.ShadyCSS.nativeShadow && style !== null) {
        // When in native Shadow DOM, ensure the style created by ShadyCSS is
        // included in initially rendered output (`renderedDOM`).
        renderedDOM.insertBefore(style.cloneNode(true), renderedDOM.firstChild);
    }
    else if (!!template) {
        // When no style is left in the template, parts will be broken as a
        // result. To fix this, we put back the style node ShadyCSS removed
        // and then tell lit to remove that node from the template.
        // There can be no style in the template in 2 cases (1) when Shady DOM
        // is in use, ShadyCSS removes all styles, (2) when native Shadow DOM
        // is in use ShadyCSS removes the style if it contains no content.
        // NOTE, ShadyCSS creates its own style so we can safely add/remove
        // `condensedStyle` here.
        content.insertBefore(condensedStyle, content.firstChild);
        const removes = new Set();
        removes.add(condensedStyle);
        removeNodesFromTemplate(template, removes);
    }
};
/**
 * Extension to the standard `render` method which supports rendering
 * to ShadowRoots when the ShadyDOM (https://github.com/webcomponents/shadydom)
 * and ShadyCSS (https://github.com/webcomponents/shadycss) polyfills are used
 * or when the webcomponentsjs
 * (https://github.com/webcomponents/webcomponentsjs) polyfill is used.
 *
 * Adds a `scopeName` option which is used to scope element DOM and stylesheets
 * when native ShadowDOM is unavailable. The `scopeName` will be added to
 * the class attribute of all rendered DOM. In addition, any style elements will
 * be automatically re-written with this `scopeName` selector and moved out
 * of the rendered DOM and into the document `<head>`.
 *
 * It is common to use this render method in conjunction with a custom element
 * which renders a shadowRoot. When this is done, typically the element's
 * `localName` should be used as the `scopeName`.
 *
 * In addition to DOM scoping, ShadyCSS also supports a basic shim for css
 * custom properties (needed only on older browsers like IE11) and a shim for
 * a deprecated feature called `@apply` that supports applying a set of css
 * custom properties to a given location.
 *
 * Usage considerations:
 *
 * * Part values in `<style>` elements are only applied the first time a given
 * `scopeName` renders. Subsequent changes to parts in style elements will have
 * no effect. Because of this, parts in style elements should only be used for
 * values that will never change, for example parts that set scope-wide theme
 * values or parts which render shared style elements.
 *
 * * Note, due to a limitation of the ShadyDOM polyfill, rendering in a
 * custom element's `constructor` is not supported. Instead rendering should
 * either done asynchronously, for example at microtask timing (for example
 * `Promise.resolve()`), or be deferred until the first time the element's
 * `connectedCallback` runs.
 *
 * Usage considerations when using shimmed custom properties or `@apply`:
 *
 * * Whenever any dynamic changes are made which affect
 * css custom properties, `ShadyCSS.styleElement(element)` must be called
 * to update the element. There are two cases when this is needed:
 * (1) the element is connected to a new parent, (2) a class is added to the
 * element that causes it to match different custom properties.
 * To address the first case when rendering a custom element, `styleElement`
 * should be called in the element's `connectedCallback`.
 *
 * * Shimmed custom properties may only be defined either for an entire
 * shadowRoot (for example, in a `:host` rule) or via a rule that directly
 * matches an element with a shadowRoot. In other words, instead of flowing from
 * parent to child as do native css custom properties, shimmed custom properties
 * flow only from shadowRoots to nested shadowRoots.
 *
 * * When using `@apply` mixing css shorthand property names with
 * non-shorthand names (for example `border` and `border-width`) is not
 * supported.
 */
const render = (result, container, options) => {
    if (!options || typeof options !== 'object' || !options.scopeName) {
        throw new Error('The `scopeName` option is required.');
    }
    const scopeName = options.scopeName;
    const hasRendered = parts.has(container);
    const needsScoping = compatibleShadyCSSVersion &&
        container.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ &&
        !!container.host;
    // Handle first render to a scope specially...
    const firstScopeRender = needsScoping && !shadyRenderSet.has(scopeName);
    // On first scope render, render into a fragment; this cannot be a single
    // fragment that is reused since nested renders can occur synchronously.
    const renderContainer = firstScopeRender ? document.createDocumentFragment() : container;
    render$1(result, renderContainer, Object.assign({ templateFactory: shadyTemplateFactory(scopeName) }, options));
    // When performing first scope render,
    // (1) We've rendered into a fragment so that there's a chance to
    // `prepareTemplateStyles` before sub-elements hit the DOM
    // (which might cause them to render based on a common pattern of
    // rendering in a custom element's `connectedCallback`);
    // (2) Scope the template with ShadyCSS one time only for this scope.
    // (3) Render the fragment into the container and make sure the
    // container knows its `part` is the one we just rendered. This ensures
    // DOM will be re-used on subsequent renders.
    if (firstScopeRender) {
        const part = parts.get(renderContainer);
        parts.delete(renderContainer);
        // ShadyCSS might have style sheets (e.g. from `prepareAdoptedCssText`)
        // that should apply to `renderContainer` even if the rendered value is
        // not a TemplateInstance. However, it will only insert scoped styles
        // into the document if `prepareTemplateStyles` has already been called
        // for the given scope name.
        const template = part.value instanceof TemplateInstance ?
            part.value.template :
            undefined;
        prepareTemplateStyles(scopeName, renderContainer, template);
        removeNodes(container, container.firstChild);
        container.appendChild(renderContainer);
        parts.set(container, part);
    }
    // After elements have hit the DOM, update styling if this is the
    // initial render to this container.
    // This is needed whenever dynamic changes are made so it would be
    // safest to do every render; however, this would regress performance
    // so we leave it up to the user to call `ShadyCSS.styleElement`
    // for dynamic changes.
    if (!hasRendered && needsScoping) {
        window.ShadyCSS.styleElement(container.host);
    }
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
var _a;
/**
 * Use this module if you want to create your own base class extending
 * [[UpdatingElement]].
 * @packageDocumentation
 */
/*
 * When using Closure Compiler, JSCompiler_renameProperty(property, object) is
 * replaced at compile time by the munged name for object[property]. We cannot
 * alias this function, so we have to use a small shim that has the same
 * behavior when not compiling.
 */
window.JSCompiler_renameProperty =
    (prop, _obj) => prop;
const defaultConverter = {
    toAttribute(value, type) {
        switch (type) {
            case Boolean:
                return value ? '' : null;
            case Object:
            case Array:
                // if the value is `null` or `undefined` pass this through
                // to allow removing/no change behavior.
                return value == null ? value : JSON.stringify(value);
        }
        return value;
    },
    fromAttribute(value, type) {
        switch (type) {
            case Boolean:
                return value !== null;
            case Number:
                return value === null ? null : Number(value);
            case Object:
            case Array:
                // Type assert to adhere to Bazel's "must type assert JSON parse" rule.
                return JSON.parse(value);
        }
        return value;
    }
};
/**
 * Change function that returns true if `value` is different from `oldValue`.
 * This method is used as the default for a property's `hasChanged` function.
 */
const notEqual = (value, old) => {
    // This ensures (old==NaN, value==NaN) always returns false
    return old !== value && (old === old || value === value);
};
const defaultPropertyDeclaration = {
    attribute: true,
    type: String,
    converter: defaultConverter,
    reflect: false,
    hasChanged: notEqual
};
const STATE_HAS_UPDATED = 1;
const STATE_UPDATE_REQUESTED = 1 << 2;
const STATE_IS_REFLECTING_TO_ATTRIBUTE = 1 << 3;
const STATE_IS_REFLECTING_TO_PROPERTY = 1 << 4;
/**
 * The Closure JS Compiler doesn't currently have good support for static
 * property semantics where "this" is dynamic (e.g.
 * https://github.com/google/closure-compiler/issues/3177 and others) so we use
 * this hack to bypass any rewriting by the compiler.
 */
const finalized = 'finalized';
/**
 * Base element class which manages element properties and attributes. When
 * properties change, the `update` method is asynchronously called. This method
 * should be supplied by subclassers to render updates as desired.
 * @noInheritDoc
 */
class UpdatingElement extends HTMLElement {
    constructor() {
        super();
        this.initialize();
    }
    /**
     * Returns a list of attributes corresponding to the registered properties.
     * @nocollapse
     */
    static get observedAttributes() {
        // note: piggy backing on this to ensure we're finalized.
        this.finalize();
        const attributes = [];
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        this._classProperties.forEach((v, p) => {
            const attr = this._attributeNameForProperty(p, v);
            if (attr !== undefined) {
                this._attributeToPropertyMap.set(attr, p);
                attributes.push(attr);
            }
        });
        return attributes;
    }
    /**
     * Ensures the private `_classProperties` property metadata is created.
     * In addition to `finalize` this is also called in `createProperty` to
     * ensure the `@property` decorator can add property metadata.
     */
    /** @nocollapse */
    static _ensureClassProperties() {
        // ensure private storage for property declarations.
        if (!this.hasOwnProperty(JSCompiler_renameProperty('_classProperties', this))) {
            this._classProperties = new Map();
            // NOTE: Workaround IE11 not supporting Map constructor argument.
            const superProperties = Object.getPrototypeOf(this)._classProperties;
            if (superProperties !== undefined) {
                superProperties.forEach((v, k) => this._classProperties.set(k, v));
            }
        }
    }
    /**
     * Creates a property accessor on the element prototype if one does not exist
     * and stores a PropertyDeclaration for the property with the given options.
     * The property setter calls the property's `hasChanged` property option
     * or uses a strict identity check to determine whether or not to request
     * an update.
     *
     * This method may be overridden to customize properties; however,
     * when doing so, it's important to call `super.createProperty` to ensure
     * the property is setup correctly. This method calls
     * `getPropertyDescriptor` internally to get a descriptor to install.
     * To customize what properties do when they are get or set, override
     * `getPropertyDescriptor`. To customize the options for a property,
     * implement `createProperty` like this:
     *
     * static createProperty(name, options) {
     *   options = Object.assign(options, {myOption: true});
     *   super.createProperty(name, options);
     * }
     *
     * @nocollapse
     */
    static createProperty(name, options = defaultPropertyDeclaration) {
        // Note, since this can be called by the `@property` decorator which
        // is called before `finalize`, we ensure storage exists for property
        // metadata.
        this._ensureClassProperties();
        this._classProperties.set(name, options);
        // Do not generate an accessor if the prototype already has one, since
        // it would be lost otherwise and that would never be the user's intention;
        // Instead, we expect users to call `requestUpdate` themselves from
        // user-defined accessors. Note that if the super has an accessor we will
        // still overwrite it
        if (options.noAccessor || this.prototype.hasOwnProperty(name)) {
            return;
        }
        const key = typeof name === 'symbol' ? Symbol() : `__${name}`;
        const descriptor = this.getPropertyDescriptor(name, key, options);
        if (descriptor !== undefined) {
            Object.defineProperty(this.prototype, name, descriptor);
        }
    }
    /**
     * Returns a property descriptor to be defined on the given named property.
     * If no descriptor is returned, the property will not become an accessor.
     * For example,
     *
     *   class MyElement extends LitElement {
     *     static getPropertyDescriptor(name, key, options) {
     *       const defaultDescriptor =
     *           super.getPropertyDescriptor(name, key, options);
     *       const setter = defaultDescriptor.set;
     *       return {
     *         get: defaultDescriptor.get,
     *         set(value) {
     *           setter.call(this, value);
     *           // custom action.
     *         },
     *         configurable: true,
     *         enumerable: true
     *       }
     *     }
     *   }
     *
     * @nocollapse
     */
    static getPropertyDescriptor(name, key, options) {
        return {
            // tslint:disable-next-line:no-any no symbol in index
            get() {
                return this[key];
            },
            set(value) {
                const oldValue = this[name];
                this[key] = value;
                this
                    .requestUpdateInternal(name, oldValue, options);
            },
            configurable: true,
            enumerable: true
        };
    }
    /**
     * Returns the property options associated with the given property.
     * These options are defined with a PropertyDeclaration via the `properties`
     * object or the `@property` decorator and are registered in
     * `createProperty(...)`.
     *
     * Note, this method should be considered "final" and not overridden. To
     * customize the options for a given property, override `createProperty`.
     *
     * @nocollapse
     * @final
     */
    static getPropertyOptions(name) {
        return this._classProperties && this._classProperties.get(name) ||
            defaultPropertyDeclaration;
    }
    /**
     * Creates property accessors for registered properties and ensures
     * any superclasses are also finalized.
     * @nocollapse
     */
    static finalize() {
        // finalize any superclasses
        const superCtor = Object.getPrototypeOf(this);
        if (!superCtor.hasOwnProperty(finalized)) {
            superCtor.finalize();
        }
        this[finalized] = true;
        this._ensureClassProperties();
        // initialize Map populated in observedAttributes
        this._attributeToPropertyMap = new Map();
        // make any properties
        // Note, only process "own" properties since this element will inherit
        // any properties defined on the superClass, and finalization ensures
        // the entire prototype chain is finalized.
        if (this.hasOwnProperty(JSCompiler_renameProperty('properties', this))) {
            const props = this.properties;
            // support symbols in properties (IE11 does not support this)
            const propKeys = [
                ...Object.getOwnPropertyNames(props),
                ...(typeof Object.getOwnPropertySymbols === 'function') ?
                    Object.getOwnPropertySymbols(props) :
                    []
            ];
            // This for/of is ok because propKeys is an array
            for (const p of propKeys) {
                // note, use of `any` is due to TypeSript lack of support for symbol in
                // index types
                // tslint:disable-next-line:no-any no symbol in index
                this.createProperty(p, props[p]);
            }
        }
    }
    /**
     * Returns the property name for the given attribute `name`.
     * @nocollapse
     */
    static _attributeNameForProperty(name, options) {
        const attribute = options.attribute;
        return attribute === false ?
            undefined :
            (typeof attribute === 'string' ?
                attribute :
                (typeof name === 'string' ? name.toLowerCase() : undefined));
    }
    /**
     * Returns true if a property should request an update.
     * Called when a property value is set and uses the `hasChanged`
     * option for the property if present or a strict identity check.
     * @nocollapse
     */
    static _valueHasChanged(value, old, hasChanged = notEqual) {
        return hasChanged(value, old);
    }
    /**
     * Returns the property value for the given attribute value.
     * Called via the `attributeChangedCallback` and uses the property's
     * `converter` or `converter.fromAttribute` property option.
     * @nocollapse
     */
    static _propertyValueFromAttribute(value, options) {
        const type = options.type;
        const converter = options.converter || defaultConverter;
        const fromAttribute = (typeof converter === 'function' ? converter : converter.fromAttribute);
        return fromAttribute ? fromAttribute(value, type) : value;
    }
    /**
     * Returns the attribute value for the given property value. If this
     * returns undefined, the property will *not* be reflected to an attribute.
     * If this returns null, the attribute will be removed, otherwise the
     * attribute will be set to the value.
     * This uses the property's `reflect` and `type.toAttribute` property options.
     * @nocollapse
     */
    static _propertyValueToAttribute(value, options) {
        if (options.reflect === undefined) {
            return;
        }
        const type = options.type;
        const converter = options.converter;
        const toAttribute = converter && converter.toAttribute ||
            defaultConverter.toAttribute;
        return toAttribute(value, type);
    }
    /**
     * Performs element initialization. By default captures any pre-set values for
     * registered properties.
     */
    initialize() {
        this._updateState = 0;
        this._updatePromise =
            new Promise((res) => this._enableUpdatingResolver = res);
        this._changedProperties = new Map();
        this._saveInstanceProperties();
        // ensures first update will be caught by an early access of
        // `updateComplete`
        this.requestUpdateInternal();
    }
    /**
     * Fixes any properties set on the instance before upgrade time.
     * Otherwise these would shadow the accessor and break these properties.
     * The properties are stored in a Map which is played back after the
     * constructor runs. Note, on very old versions of Safari (<=9) or Chrome
     * (<=41), properties created for native platform properties like (`id` or
     * `name`) may not have default values set in the element constructor. On
     * these browsers native properties appear on instances and therefore their
     * default value will overwrite any element default (e.g. if the element sets
     * this.id = 'id' in the constructor, the 'id' will become '' since this is
     * the native platform default).
     */
    _saveInstanceProperties() {
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        this.constructor
            ._classProperties.forEach((_v, p) => {
            if (this.hasOwnProperty(p)) {
                const value = this[p];
                delete this[p];
                if (!this._instanceProperties) {
                    this._instanceProperties = new Map();
                }
                this._instanceProperties.set(p, value);
            }
        });
    }
    /**
     * Applies previously saved instance properties.
     */
    _applyInstanceProperties() {
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        // tslint:disable-next-line:no-any
        this._instanceProperties.forEach((v, p) => this[p] = v);
        this._instanceProperties = undefined;
    }
    connectedCallback() {
        // Ensure first connection completes an update. Updates cannot complete
        // before connection.
        this.enableUpdating();
    }
    enableUpdating() {
        if (this._enableUpdatingResolver !== undefined) {
            this._enableUpdatingResolver();
            this._enableUpdatingResolver = undefined;
        }
    }
    /**
     * Allows for `super.disconnectedCallback()` in extensions while
     * reserving the possibility of making non-breaking feature additions
     * when disconnecting at some point in the future.
     */
    disconnectedCallback() {
    }
    /**
     * Synchronizes property values when attributes change.
     */
    attributeChangedCallback(name, old, value) {
        if (old !== value) {
            this._attributeToProperty(name, value);
        }
    }
    _propertyToAttribute(name, value, options = defaultPropertyDeclaration) {
        const ctor = this.constructor;
        const attr = ctor._attributeNameForProperty(name, options);
        if (attr !== undefined) {
            const attrValue = ctor._propertyValueToAttribute(value, options);
            // an undefined value does not change the attribute.
            if (attrValue === undefined) {
                return;
            }
            // Track if the property is being reflected to avoid
            // setting the property again via `attributeChangedCallback`. Note:
            // 1. this takes advantage of the fact that the callback is synchronous.
            // 2. will behave incorrectly if multiple attributes are in the reaction
            // stack at time of calling. However, since we process attributes
            // in `update` this should not be possible (or an extreme corner case
            // that we'd like to discover).
            // mark state reflecting
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_ATTRIBUTE;
            if (attrValue == null) {
                this.removeAttribute(attr);
            }
            else {
                this.setAttribute(attr, attrValue);
            }
            // mark state not reflecting
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_ATTRIBUTE;
        }
    }
    _attributeToProperty(name, value) {
        // Use tracking info to avoid deserializing attribute value if it was
        // just set from a property setter.
        if (this._updateState & STATE_IS_REFLECTING_TO_ATTRIBUTE) {
            return;
        }
        const ctor = this.constructor;
        // Note, hint this as an `AttributeMap` so closure clearly understands
        // the type; it has issues with tracking types through statics
        // tslint:disable-next-line:no-unnecessary-type-assertion
        const propName = ctor._attributeToPropertyMap.get(name);
        if (propName !== undefined) {
            const options = ctor.getPropertyOptions(propName);
            // mark state reflecting
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_PROPERTY;
            this[propName] =
                // tslint:disable-next-line:no-any
                ctor._propertyValueFromAttribute(value, options);
            // mark state not reflecting
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_PROPERTY;
        }
    }
    /**
     * This protected version of `requestUpdate` does not access or return the
     * `updateComplete` promise. This promise can be overridden and is therefore
     * not free to access.
     */
    requestUpdateInternal(name, oldValue, options) {
        let shouldRequestUpdate = true;
        // If we have a property key, perform property update steps.
        if (name !== undefined) {
            const ctor = this.constructor;
            options = options || ctor.getPropertyOptions(name);
            if (ctor._valueHasChanged(this[name], oldValue, options.hasChanged)) {
                if (!this._changedProperties.has(name)) {
                    this._changedProperties.set(name, oldValue);
                }
                // Add to reflecting properties set.
                // Note, it's important that every change has a chance to add the
                // property to `_reflectingProperties`. This ensures setting
                // attribute + property reflects correctly.
                if (options.reflect === true &&
                    !(this._updateState & STATE_IS_REFLECTING_TO_PROPERTY)) {
                    if (this._reflectingProperties === undefined) {
                        this._reflectingProperties = new Map();
                    }
                    this._reflectingProperties.set(name, options);
                }
            }
            else {
                // Abort the request if the property should not be considered changed.
                shouldRequestUpdate = false;
            }
        }
        if (!this._hasRequestedUpdate && shouldRequestUpdate) {
            this._updatePromise = this._enqueueUpdate();
        }
    }
    /**
     * Requests an update which is processed asynchronously. This should
     * be called when an element should update based on some state not triggered
     * by setting a property. In this case, pass no arguments. It should also be
     * called when manually implementing a property setter. In this case, pass the
     * property `name` and `oldValue` to ensure that any configured property
     * options are honored. Returns the `updateComplete` Promise which is resolved
     * when the update completes.
     *
     * @param name {PropertyKey} (optional) name of requesting property
     * @param oldValue {any} (optional) old value of requesting property
     * @returns {Promise} A Promise that is resolved when the update completes.
     */
    requestUpdate(name, oldValue) {
        this.requestUpdateInternal(name, oldValue);
        return this.updateComplete;
    }
    /**
     * Sets up the element to asynchronously update.
     */
    async _enqueueUpdate() {
        this._updateState = this._updateState | STATE_UPDATE_REQUESTED;
        try {
            // Ensure any previous update has resolved before updating.
            // This `await` also ensures that property changes are batched.
            await this._updatePromise;
        }
        catch (e) {
            // Ignore any previous errors. We only care that the previous cycle is
            // done. Any error should have been handled in the previous update.
        }
        const result = this.performUpdate();
        // If `performUpdate` returns a Promise, we await it. This is done to
        // enable coordinating updates with a scheduler. Note, the result is
        // checked to avoid delaying an additional microtask unless we need to.
        if (result != null) {
            await result;
        }
        return !this._hasRequestedUpdate;
    }
    get _hasRequestedUpdate() {
        return (this._updateState & STATE_UPDATE_REQUESTED);
    }
    get hasUpdated() {
        return (this._updateState & STATE_HAS_UPDATED);
    }
    /**
     * Performs an element update. Note, if an exception is thrown during the
     * update, `firstUpdated` and `updated` will not be called.
     *
     * You can override this method to change the timing of updates. If this
     * method is overridden, `super.performUpdate()` must be called.
     *
     * For instance, to schedule updates to occur just before the next frame:
     *
     * ```
     * protected async performUpdate(): Promise<unknown> {
     *   await new Promise((resolve) => requestAnimationFrame(() => resolve()));
     *   super.performUpdate();
     * }
     * ```
     */
    performUpdate() {
        // Abort any update if one is not pending when this is called.
        // This can happen if `performUpdate` is called early to "flush"
        // the update.
        if (!this._hasRequestedUpdate) {
            return;
        }
        // Mixin instance properties once, if they exist.
        if (this._instanceProperties) {
            this._applyInstanceProperties();
        }
        let shouldUpdate = false;
        const changedProperties = this._changedProperties;
        try {
            shouldUpdate = this.shouldUpdate(changedProperties);
            if (shouldUpdate) {
                this.update(changedProperties);
            }
            else {
                this._markUpdated();
            }
        }
        catch (e) {
            // Prevent `firstUpdated` and `updated` from running when there's an
            // update exception.
            shouldUpdate = false;
            // Ensure element can accept additional updates after an exception.
            this._markUpdated();
            throw e;
        }
        if (shouldUpdate) {
            if (!(this._updateState & STATE_HAS_UPDATED)) {
                this._updateState = this._updateState | STATE_HAS_UPDATED;
                this.firstUpdated(changedProperties);
            }
            this.updated(changedProperties);
        }
    }
    _markUpdated() {
        this._changedProperties = new Map();
        this._updateState = this._updateState & ~STATE_UPDATE_REQUESTED;
    }
    /**
     * Returns a Promise that resolves when the element has completed updating.
     * The Promise value is a boolean that is `true` if the element completed the
     * update without triggering another update. The Promise result is `false` if
     * a property was set inside `updated()`. If the Promise is rejected, an
     * exception was thrown during the update.
     *
     * To await additional asynchronous work, override the `_getUpdateComplete`
     * method. For example, it is sometimes useful to await a rendered element
     * before fulfilling this Promise. To do this, first await
     * `super._getUpdateComplete()`, then any subsequent state.
     *
     * @returns {Promise} The Promise returns a boolean that indicates if the
     * update resolved without triggering another update.
     */
    get updateComplete() {
        return this._getUpdateComplete();
    }
    /**
     * Override point for the `updateComplete` promise.
     *
     * It is not safe to override the `updateComplete` getter directly due to a
     * limitation in TypeScript which means it is not possible to call a
     * superclass getter (e.g. `super.updateComplete.then(...)`) when the target
     * language is ES5 (https://github.com/microsoft/TypeScript/issues/338).
     * This method should be overridden instead. For example:
     *
     *   class MyElement extends LitElement {
     *     async _getUpdateComplete() {
     *       await super._getUpdateComplete();
     *       await this._myChild.updateComplete;
     *     }
     *   }
     * @deprecated Override `getUpdateComplete()` instead for forward
     *     compatibility with `lit-element` 3.0 / `@lit/reactive-element`.
     */
    _getUpdateComplete() {
        return this.getUpdateComplete();
    }
    /**
     * Override point for the `updateComplete` promise.
     *
     * It is not safe to override the `updateComplete` getter directly due to a
     * limitation in TypeScript which means it is not possible to call a
     * superclass getter (e.g. `super.updateComplete.then(...)`) when the target
     * language is ES5 (https://github.com/microsoft/TypeScript/issues/338).
     * This method should be overridden instead. For example:
     *
     *   class MyElement extends LitElement {
     *     async getUpdateComplete() {
     *       await super.getUpdateComplete();
     *       await this._myChild.updateComplete;
     *     }
     *   }
     */
    getUpdateComplete() {
        return this._updatePromise;
    }
    /**
     * Controls whether or not `update` should be called when the element requests
     * an update. By default, this method always returns `true`, but this can be
     * customized to control when to update.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    shouldUpdate(_changedProperties) {
        return true;
    }
    /**
     * Updates the element. This method reflects property values to attributes.
     * It can be overridden to render and keep updated element DOM.
     * Setting properties inside this method will *not* trigger
     * another update.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    update(_changedProperties) {
        if (this._reflectingProperties !== undefined &&
            this._reflectingProperties.size > 0) {
            // Use forEach so this works even if for/of loops are compiled to for
            // loops expecting arrays
            this._reflectingProperties.forEach((v, k) => this._propertyToAttribute(k, this[k], v));
            this._reflectingProperties = undefined;
        }
        this._markUpdated();
    }
    /**
     * Invoked whenever the element is updated. Implement to perform
     * post-updating tasks via DOM APIs, for example, focusing an element.
     *
     * Setting properties inside this method will trigger the element to update
     * again after this update cycle completes.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    updated(_changedProperties) {
    }
    /**
     * Invoked when the element is first updated. Implement to perform one time
     * work on the element after update.
     *
     * Setting properties inside this method will trigger the element to update
     * again after this update cycle completes.
     *
     * @param _changedProperties Map of changed properties with old values
     */
    firstUpdated(_changedProperties) {
    }
}
_a = finalized;
/**
 * Marks class as having finished creating properties.
 */
UpdatingElement[_a] = true;

/**
@license
Copyright (c) 2019 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at
http://polymer.github.io/LICENSE.txt The complete set of authors may be found at
http://polymer.github.io/AUTHORS.txt The complete set of contributors may be
found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by Google as
part of the polymer project is also subject to an additional IP rights grant
found at http://polymer.github.io/PATENTS.txt
*/
/**
 * Whether the current browser supports `adoptedStyleSheets`.
 */
const supportsAdoptingStyleSheets = (window.ShadowRoot) &&
    (window.ShadyCSS === undefined || window.ShadyCSS.nativeShadow) &&
    ('adoptedStyleSheets' in Document.prototype) &&
    ('replace' in CSSStyleSheet.prototype);
const constructionToken = Symbol();
class CSSResult {
    constructor(cssText, safeToken) {
        if (safeToken !== constructionToken) {
            throw new Error('CSSResult is not constructable. Use `unsafeCSS` or `css` instead.');
        }
        this.cssText = cssText;
    }
    // Note, this is a getter so that it's lazy. In practice, this means
    // stylesheets are not created until the first element instance is made.
    get styleSheet() {
        if (this._styleSheet === undefined) {
            // Note, if `supportsAdoptingStyleSheets` is true then we assume
            // CSSStyleSheet is constructable.
            if (supportsAdoptingStyleSheets) {
                this._styleSheet = new CSSStyleSheet();
                this._styleSheet.replaceSync(this.cssText);
            }
            else {
                this._styleSheet = null;
            }
        }
        return this._styleSheet;
    }
    toString() {
        return this.cssText;
    }
}
/**
 * Wrap a value for interpolation in a [[`css`]] tagged template literal.
 *
 * This is unsafe because untrusted CSS text can be used to phone home
 * or exfiltrate data to an attacker controlled site. Take care to only use
 * this with trusted input.
 */
const unsafeCSS = (value) => {
    return new CSSResult(String(value), constructionToken);
};
const textFromCSSResult = (value) => {
    if (value instanceof CSSResult) {
        return value.cssText;
    }
    else if (typeof value === 'number') {
        return value;
    }
    else {
        throw new Error(`Value passed to 'css' function must be a 'css' function result: ${value}. Use 'unsafeCSS' to pass non-literal values, but
            take care to ensure page security.`);
    }
};
/**
 * Template tag which which can be used with LitElement's [[LitElement.styles |
 * `styles`]] property to set element styles. For security reasons, only literal
 * string values may be used. To incorporate non-literal values [[`unsafeCSS`]]
 * may be used inside a template string part.
 */
const css = (strings, ...values) => {
    const cssText = values.reduce((acc, v, idx) => acc + textFromCSSResult(v) + strings[idx + 1], strings[0]);
    return new CSSResult(cssText, constructionToken);
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for LitElement usage.
// TODO(justinfagnani): inject version number at build time
(window['litElementVersions'] || (window['litElementVersions'] = []))
    .push('2.5.1');
/**
 * Sentinal value used to avoid calling lit-html's render function when
 * subclasses do not implement `render`
 */
const renderNotImplemented = {};
/**
 * Base element class that manages element properties and attributes, and
 * renders a lit-html template.
 *
 * To define a component, subclass `LitElement` and implement a
 * `render` method to provide the component's template. Define properties
 * using the [[`properties`]] property or the [[`property`]] decorator.
 */
class LitElement extends UpdatingElement {
    /**
     * Return the array of styles to apply to the element.
     * Override this method to integrate into a style management system.
     *
     * @nocollapse
     */
    static getStyles() {
        return this.styles;
    }
    /** @nocollapse */
    static _getUniqueStyles() {
        // Only gather styles once per class
        if (this.hasOwnProperty(JSCompiler_renameProperty('_styles', this))) {
            return;
        }
        // Take care not to call `this.getStyles()` multiple times since this
        // generates new CSSResults each time.
        // TODO(sorvell): Since we do not cache CSSResults by input, any
        // shared styles will generate new stylesheet objects, which is wasteful.
        // This should be addressed when a browser ships constructable
        // stylesheets.
        const userStyles = this.getStyles();
        if (Array.isArray(userStyles)) {
            // De-duplicate styles preserving the _last_ instance in the set.
            // This is a performance optimization to avoid duplicated styles that can
            // occur especially when composing via subclassing.
            // The last item is kept to try to preserve the cascade order with the
            // assumption that it's most important that last added styles override
            // previous styles.
            const addStyles = (styles, set) => styles.reduceRight((set, s) => 
            // Note: On IE set.add() does not return the set
            Array.isArray(s) ? addStyles(s, set) : (set.add(s), set), set);
            // Array.from does not work on Set in IE, otherwise return
            // Array.from(addStyles(userStyles, new Set<CSSResult>())).reverse()
            const set = addStyles(userStyles, new Set());
            const styles = [];
            set.forEach((v) => styles.unshift(v));
            this._styles = styles;
        }
        else {
            this._styles = userStyles === undefined ? [] : [userStyles];
        }
        // Ensure that there are no invalid CSSStyleSheet instances here. They are
        // invalid in two conditions.
        // (1) the sheet is non-constructible (`sheet` of a HTMLStyleElement), but
        //     this is impossible to check except via .replaceSync or use
        // (2) the ShadyCSS polyfill is enabled (:. supportsAdoptingStyleSheets is
        //     false)
        this._styles = this._styles.map((s) => {
            if (s instanceof CSSStyleSheet && !supportsAdoptingStyleSheets) {
                // Flatten the cssText from the passed constructible stylesheet (or
                // undetectable non-constructible stylesheet). The user might have
                // expected to update their stylesheets over time, but the alternative
                // is a crash.
                const cssText = Array.prototype.slice.call(s.cssRules)
                    .reduce((css, rule) => css + rule.cssText, '');
                return unsafeCSS(cssText);
            }
            return s;
        });
    }
    /**
     * Performs element initialization. By default this calls
     * [[`createRenderRoot`]] to create the element [[`renderRoot`]] node and
     * captures any pre-set values for registered properties.
     */
    initialize() {
        super.initialize();
        this.constructor._getUniqueStyles();
        this.renderRoot = this.createRenderRoot();
        // Note, if renderRoot is not a shadowRoot, styles would/could apply to the
        // element's getRootNode(). While this could be done, we're choosing not to
        // support this now since it would require different logic around de-duping.
        if (window.ShadowRoot && this.renderRoot instanceof window.ShadowRoot) {
            this.adoptStyles();
        }
    }
    /**
     * Returns the node into which the element should render and by default
     * creates and returns an open shadowRoot. Implement to customize where the
     * element's DOM is rendered. For example, to render into the element's
     * childNodes, return `this`.
     * @returns {Element|DocumentFragment} Returns a node into which to render.
     */
    createRenderRoot() {
        return this.attachShadow(this.constructor.shadowRootOptions);
    }
    /**
     * Applies styling to the element shadowRoot using the [[`styles`]]
     * property. Styling will apply using `shadowRoot.adoptedStyleSheets` where
     * available and will fallback otherwise. When Shadow DOM is polyfilled,
     * ShadyCSS scopes styles and adds them to the document. When Shadow DOM
     * is available but `adoptedStyleSheets` is not, styles are appended to the
     * end of the `shadowRoot` to [mimic spec
     * behavior](https://wicg.github.io/construct-stylesheets/#using-constructed-stylesheets).
     */
    adoptStyles() {
        const styles = this.constructor._styles;
        if (styles.length === 0) {
            return;
        }
        // There are three separate cases here based on Shadow DOM support.
        // (1) shadowRoot polyfilled: use ShadyCSS
        // (2) shadowRoot.adoptedStyleSheets available: use it
        // (3) shadowRoot.adoptedStyleSheets polyfilled: append styles after
        // rendering
        if (window.ShadyCSS !== undefined && !window.ShadyCSS.nativeShadow) {
            window.ShadyCSS.ScopingShim.prepareAdoptedCssText(styles.map((s) => s.cssText), this.localName);
        }
        else if (supportsAdoptingStyleSheets) {
            this.renderRoot.adoptedStyleSheets =
                styles.map((s) => s instanceof CSSStyleSheet ? s : s.styleSheet);
        }
        else {
            // This must be done after rendering so the actual style insertion is done
            // in `update`.
            this._needsShimAdoptedStyleSheets = true;
        }
    }
    connectedCallback() {
        super.connectedCallback();
        // Note, first update/render handles styleElement so we only call this if
        // connected after first update.
        if (this.hasUpdated && window.ShadyCSS !== undefined) {
            window.ShadyCSS.styleElement(this);
        }
    }
    /**
     * Updates the element. This method reflects property values to attributes
     * and calls `render` to render DOM via lit-html. Setting properties inside
     * this method will *not* trigger another update.
     * @param _changedProperties Map of changed properties with old values
     */
    update(changedProperties) {
        // Setting properties in `render` should not trigger an update. Since
        // updates are allowed after super.update, it's important to call `render`
        // before that.
        const templateResult = this.render();
        super.update(changedProperties);
        // If render is not implemented by the component, don't call lit-html render
        if (templateResult !== renderNotImplemented) {
            this.constructor
                .render(templateResult, this.renderRoot, { scopeName: this.localName, eventContext: this });
        }
        // When native Shadow DOM is used but adoptedStyles are not supported,
        // insert styling after rendering to ensure adoptedStyles have highest
        // priority.
        if (this._needsShimAdoptedStyleSheets) {
            this._needsShimAdoptedStyleSheets = false;
            this.constructor._styles.forEach((s) => {
                const style = document.createElement('style');
                style.textContent = s.cssText;
                this.renderRoot.appendChild(style);
            });
        }
    }
    /**
     * Invoked on each update to perform rendering tasks. This method may return
     * any value renderable by lit-html's `NodePart` - typically a
     * `TemplateResult`. Setting properties inside this method will *not* trigger
     * the element to update.
     */
    render() {
        return renderNotImplemented;
    }
}
/**
 * Ensure this class is marked as `finalized` as an optimization ensuring
 * it will not needlessly try to `finalize`.
 *
 * Note this property name is a string to prevent breaking Closure JS Compiler
 * optimizations. See updating-element.ts for more information.
 */
LitElement['finalized'] = true;
/**
 * Reference to the underlying library method used to render the element's
 * DOM. By default, points to the `render` method from lit-html's shady-render
 * module.
 *
 * **Most users will never need to touch this property.**
 *
 * This  property should not be confused with the `render` instance method,
 * which should be overridden to define a template for the element.
 *
 * Advanced users creating a new base class based on LitElement can override
 * this property to point to a custom render method with a signature that
 * matches [shady-render's `render`
 * method](https://lit-html.polymer-project.org/api/modules/shady_render.html#render).
 *
 * @nocollapse
 */
LitElement.render = render;
/** @nocollapse */
LitElement.shadowRootOptions = { mode: 'open' };

var style = css`
:host{--uvalib-brand-blue-lightest:#87b9d9;--uvalib-brand-blue-lighter:#3395d4;--uvalib-brand-blue-light:#0370b7;--uvalib-brand-blue:#232d4b;--uvalib-brand-orange-lightest:#ffead6;--uvalib-brand-orange:#e57200;--uvalib-brand-orange-dark:#b35900;--uvalib-blue-alt-light:#bfe7f7;--uvalib-blue-alt:#007bac;--uvalib-blue-alt-dark:#005679;--uvalib-blue-alt-darkest:#141e3c;--uvalib-teal-lightest:#c8f2f4;--uvalib-teal-light:#5bd7de;--uvalib-teal:#25cad3;--uvalib-teal-dark:#1da1a8;--uvalib-teal-darker:#16777c;--uvalib-green-lightest:#89cc74;--uvalib-green:#62bb46;--uvalib-green-dark:#4e9737;--uvalib-red-lightest:#fbcfda;--uvalib-red:#ef3f6b;--uvalib-red-emergency:#df1e43;--uvalib-red-darker:#b30000;--uvalib-red-dark:#df1e43;--uvalib-yellow-light:#fef6c8;--uvalib-yellow:#ecc602;--uvalib-yellow-dark:#b99c02;--uvalib-beige:#f7efe1;--uvalib-beige-dark:#c0b298;--uvalib-grey-lightest:#f1f1f1;--uvalib-grey-light:#dadada;--uvalib-grey:grey;--uvalib-grey-dark:#565656;--uvalib-grey-darkest:#2b2b2b;--uvalib-text-light:#fff;--uvalib-text:#565656;--uvalib-text-dark:#2b2b2b;--uvalib-primary-orange:#e57200;--uvalib-accessibility-highlight:#0370b7;--uvalib-color-link:#005679;--uvalib-color-link-darker:#005679;--uvalib-color-primary-text:#565656;--uvalib-color-error:#df1e43}
/*# sourceMappingURL=css/wc-styles.css.map */
`;

class UvalibLogos extends LitElement {
  static get styles() {
    return [
            style,
            css`
            :host {
              display: inline-block; 
              padding: 10px 10px 10px 10px;
              color: var(--uvalib-logos-text-color, #000);
            }
            svg { 
              max-height: 100%;
              width: 100%;
              min-height: 20px;
            }
            g#rotunda  rect, g#rotunda polygon, g#rotunda path {
              fill: var(--uvalib-brand-orange);
            }
            #sepline {
              fill: var(--uvalib-text-light);
            }
            #uvaletters, #libletters {
              fill: var(--uvalib-text-light);
            }
            `
            ];
  }

  render() {
    return html`
    <svg role="img" id="library_logo_primary" data-name="library_logo_primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 327.42 73.89">
      <title>University of Virginia Library</title>
      <desc id="desc">"Horizontal version of the logo"</desc>
      <g>
        <rect id="sepline" x="168.33" width="0.63" height="73.89" />
        <g id="rotunda">
          <rect x="21.82" y="34.73" width="2.72" height="12.96" />
          <rect x="7.12" y="34.73" width="2.64" height="12.96" />
          <rect x="10.67" y="34.73" width="2.81" height="12.96" />
          <rect x="14.38" y="34.73" width="2.81" height="12.96" />
          <rect x="18.1" y="34.73" width="2.81" height="12.96" />
          <polygon points="23.37 33.82 8.23 33.82 16 29.04 23.37 33.82" />
          <polygon points="0 28.99 0 33.82 6.49 33.82 14.34 28.99 0 28.99" />
          <polygon points="17.61 28.99 31.57 28.99 31.57 33.82 25.05 33.82 17.61 28.99" />
          <path d="M29.58,28.07H2a15.73,15.73,0,0,1,27.58,0" />
          <path d="M2.13,44l-.24.73.62-.45.62.45L2.89,44l.62-.45H2.74l-.23-.72-.24.72H1.51ZM0,39.88l.62.45-.24.72L1,40.6l.62.45-.24-.72L2,39.88H1.24L1,39.15l-.24.73ZM6.22,47.7H5.38L5.15,47l.61-.44H5l-.24-.73-.23.73H3.77l.61.44-.23.73H0V37.06l.58-.42.62.45L1,36.36l.62-.45H.82l-.24-.72-.1.33-.15.39H0V34.73H6.22Zm-.84,0H4.15l.61-.45ZM0,37v-.75l.19.13-.14.4Z"
            style="fill-rule: evenodd" />
          <rect y="48.61" width="6.21" height="3.44" />
          <rect x="25.45" y="48.61" width="6.13" height="3.44" />
          <path d="M20.05,51l.62-.45H19.9l-.23-.72-.24.72h-.76l.62.45-.24.73.62-.45.61.45Zm-4.62.48-.17.53H7.12V48.61h1L8,49.15H7.19l.62.45-.24.72.62-.45.61.45-.23-.72.62-.45H8.42l-.17-.54H23.37l-.17.54h-.77l.62.45-.23.72.61-.45.62.45-.24-.72.62-.45h-.76l-.18-.54h1.05v3.44H16.37l-.17-.53.61-.45h-.76l-.24-.72-.23.72h-.76Zm-4-.48-.24.73.62-.45.62.45L12.22,51l.62-.45h-.76l-.24-.72-.23.72h-.77Zm4.71,1h-.7l.34-.25Z"
            style="fill-rule: evenodd" />
          <path d="M29.49,44l.62-.45h-.76l-.24-.72-.23.72h-.77l.62.45-.24.73.62-.45.62.45Zm-2,3.69L27.24,47l.61-.44h-.76l-.23-.73-.24.73h-.76l.61.44-.23.72.62-.44.61.44Zm4.1,0H25.45v-13h6.12v1.18h-.3L31,35.19l-.24.72H30l.62.45-.24.73.62-.45.53.39v2.85h-.71l-.24-.73-.24.73h-.76l.62.45-.24.72.62-.44.62.44L31,40.33l.57-.42Zm0-11.44v.59l-.15-.48Z"
            style="fill-rule: evenodd" />
        </g>
        <g id="uvaletters">
          <path d="M44.09,37.49A6.85,6.85,0,0,0,48.89,36,6.64,6.64,0,0,0,51,31c.08-1,.13-5.47.13-5.82s0-4,0-4.25a1,1,0,0,1,1.1-1h1c.12,0,.15-.1.15-.26v-.56c0-.07,0-.18-.26-.18s-1,.08-2.81.08-2.89-.08-3.14-.08-.18.05-.18.18v.62c0,.12,0,.2.18.2h1.12a1.13,1.13,0,0,1,1.15,1.12c.08.64.13,2.13.13,4.07v5.47a6.35,6.35,0,0,1-1.33,4.5,5.44,5.44,0,0,1-3.83,1.41,4.78,4.78,0,0,1-4.07-1.85,6.12,6.12,0,0,1-.82-3.24c0-.82-.12-4.07-.12-5.42V24.3c0-1.3,0-3.09.05-3.32a1.15,1.15,0,0,1,1.22-1.05h1.28c.18,0,.21-.05.21-.18v-.66c0-.11,0-.16-.23-.16s-1.51.08-3.51.08-3.24-.08-3.5-.08-.23.05-.23.21v.56c0,.18,0,.23.18.23h1.2c.8,0,1,.41,1,1.3v6.09a27.16,27.16,0,0,0,.41,6.21,4.67,4.67,0,0,0,3,3.43,9.66,9.66,0,0,0,3.45.53"
            style="fill-rule: evenodd" />
          <path d="M65.08,28.68c0-1.14-.06-2.89.08-4.17,0-.39.19-.58.89-.58h.28c.11,0,.16-.09.16-.2v-.58c0-.17,0-.22-.19-.22s-1.17.08-1.75.08c-.89,0-2.09-.08-2.28-.08s-.19.05-.19.14v.66c0,.14.05.2.19.2h.47a1.07,1.07,0,0,1,1,.5A13.52,13.52,0,0,1,64,27c.06.89.09,1.75.09,3.33v1.84H64c-.33-.37-2.91-3.62-3.41-4.2s-3.78-4.72-3.86-4.83S56.41,23,56,23s-.92.05-1.36.05-.75,0-1.11-.05-.67,0-.72,0a.16.16,0,0,0-.17.17v.66a.15.15,0,0,0,.17.17h.25a1.38,1.38,0,0,1,1.47,1.47v2.92c0,3.14-.06,5.11-.08,5.44a.85.85,0,0,1-.81.83H53c-.08,0-.11,0-.11.09v.72c0,.14,0,.19.08.19.23,0,1.48-.08,1.86-.08.81,0,1.92.08,2.12.08s.13-.05.13-.16v-.67c0-.11,0-.17-.13-.17h-.59c-.28,0-.58-.3-.66-.94-.06-.25-.17-3-.17-4.69V25.15h.05c.45.5,2.7,3.5,3.37,4.28l2.77,3.3c1.14,1.36,2.09,2.5,2.28,2.7a1.27,1.27,0,0,0,.64.27c.33,0,.42-.27.42-.52Z"
            style="fill-rule: evenodd" />
          <path d="M71.67,28.4c0-.19,0-3.5,0-3.78,0-.58.28-.69,1-.69h.47c.14,0,.17-.09.17-.2v-.66c0-.09-.06-.14-.17-.14s-1.64.08-2.45.08c-1.3,0-3-.08-3.19-.08s-.17.05-.17.16v.64c0,.11,0,.2.17.2h.5c1.17,0,1.42.28,1.42.58s0,3.17,0,3.61v1.22c0,.95,0,4.48,0,4.73-.06.5-.5.52-1.2.52h-.61a.17.17,0,0,0-.17.17v.61c0,.14.06.22.17.22s1.78-.08,2.72-.08c1.25,0,2.7.08,2.92.08s.17-.08.17-.19v-.67c0-.08,0-.14-.17-.14h-.42c-.8,0-1.14-.39-1.19-1,0-.42,0-3.61,0-3.78Z"
            style="fill-rule: evenodd" />
          <path d="M99.83,29.18c0,1.69,0,3.33,0,4.69,0,.61-.33.72-1,.72h-.33c-.11,0-.17.06-.17.14v.64c0,.14.06.22.17.22s1.61-.08,2.3-.08c.92,0,2.42.08,2.61.08s.23-.05.23-.19v-.67c0-.08-.06-.14-.17-.14h-.72a.69.69,0,0,1-.78-.69V30.23a3.08,3.08,0,0,1,.72-.05c1.17,0,1.59.61,2.59,2.33a17.72,17.72,0,0,0,2,3.06c.48,0,1.14-.06,1.78-.06l.86,0,.56.05a.17.17,0,0,0,.17-.19v-.56c0-.16,0-.25-.14-.25a1.9,1.9,0,0,1-1.25-.3,8.63,8.63,0,0,1-1.56-1.78C106.52,30.9,106,30,105.33,29.9v-.06c2.19-.77,3.28-1.88,3.28-3.8a3.06,3.06,0,0,0-1-2A5.51,5.51,0,0,0,104,22.93l-3.11.08c-.5,0-2.22-.08-2.36-.08s-.17.05-.17.14v.66c0,.12,0,.2.12.2h.27c.78,0,1,.3,1.06.86v4.39Zm2.11-4.75c0-.5.42-.61.83-.61a4.64,4.64,0,0,1,2.64.72,2.36,2.36,0,0,1,.92,1.92c0,.72-.47,2.88-3.56,2.88a5.61,5.61,0,0,1-.83-.05Z"
            style="fill-rule: evenodd" />
          <path d="M115.31,35.84A3.65,3.65,0,0,0,119.17,32a3.4,3.4,0,0,0-.89-2.66,7.58,7.58,0,0,0-3-1.5,5,5,0,0,1-1.94-1.14,2.26,2.26,0,0,1-.45-1.36,1.84,1.84,0,0,1,2-1.7,2.36,2.36,0,0,1,1.84.75,7.22,7.22,0,0,1,1,2c0,.09.08.14.17.12l.5-.12a.14.14,0,0,0,.11-.16c0-.39-.28-2.2-.28-3.11,0-.14,0-.25-.25-.25s-.31,0-.36.08l-.11.19c-.06.14-.2.12-.48-.05a4.25,4.25,0,0,0-2-.36,4,4,0,0,0-2.61.83,3.26,3.26,0,0,0-1.19,2.33,3.72,3.72,0,0,0,1,2.87,8.61,8.61,0,0,0,2.72,1.44c1.47.56,2.56,1.25,2.56,2.83,0,1.2-1.33,1.89-2.22,1.89a2.63,2.63,0,0,1-2.37-1.39,3.5,3.5,0,0,1-.5-1.89c0-.11-.11-.16-.22-.19l-.5-.06c-.11,0-.16.09-.19.2,0,.44-.22,2.66-.31,3.44,0,.14.06.25.23.31s.36,0,.41-.14l.08-.22c.06-.22.23-.2.42-.06a4.77,4.77,0,0,0,3,1"
            style="fill-rule: evenodd" />
          <path d="M123.87,28.4c0-.19,0-3.5,0-3.78,0-.58.28-.69,1-.69h.47c.14,0,.17-.09.17-.2v-.66c0-.09-.06-.14-.17-.14S123.76,23,123,23c-1.31,0-3-.08-3.2-.08a.14.14,0,0,0-.16.16v.64c0,.11,0,.2.16.2h.5c1.17,0,1.42.28,1.42.58s.06,3.17.06,3.61v1.22c0,.95,0,4.48-.06,4.73-.05.5-.5.52-1.19.52h-.61a.16.16,0,0,0-.17.17v.61c0,.14.05.22.17.22s1.77-.08,2.72-.08c1.25,0,2.69.08,2.91.08s.17-.08.17-.19v-.67c0-.08,0-.14-.17-.14h-.41a1,1,0,0,1-1.2-1c0-.42,0-3.61,0-3.78Z"
            style="fill-rule: evenodd" />
          <path d="M49.41,44.41c2.54,0,4.07-3.5,4.07-5.43a1.85,1.85,0,0,0-1.88-2c-2.34,0-4,3-4,5.22a2,2,0,0,0,1.81,2.26m-.27-.84a.84.84,0,0,1-.81-.9,6,6,0,0,1,1-2.84c.88-1.43,1.81-2.1,2.55-2.1a.87.87,0,0,1,.88,1c0,1.16-1.81,4.85-3.64,4.85" style="fill-rule: evenodd" />
          <path d="M78.36,44.86c0-.2,0-3.5,0-3.78,0-.58.28-.69,1-.69h.47c.14,0,.16-.09.16-.2v-.66c0-.09,0-.14-.16-.14s-1.64.08-2.45.08c-1.3,0-3-.08-3.19-.08s-.17,0-.17.16v.64c0,.11,0,.2.17.2h.5c1.17,0,1.42.27,1.42.58s0,3.17,0,3.61V45.8c0,1,0,4.47,0,4.72-.06.5-.5.53-1.2.53h-.61a.17.17,0,0,0-.17.17v.61c0,.14.06.22.17.22S76.14,52,77.08,52c1.25,0,2.7.08,2.92.08s.17-.08.17-.19v-.67c0-.08,0-.14-.17-.14h-.42a1,1,0,0,1-1.19-1c0-.41,0-3.61,0-3.77Z"
            style="fill-rule: evenodd" />
          <path d="M82.4,45.64c0,1.69,0,3.33,0,4.69,0,.61-.33.72-1,.72H81c-.11,0-.17.06-.17.14v.64c0,.14.06.22.17.22s1.61-.08,2.3-.08c.92,0,2.42.08,2.61.08s.23,0,.23-.19v-.67c0-.08-.06-.14-.17-.14h-.72a.69.69,0,0,1-.78-.69V46.69a3.08,3.08,0,0,1,.72,0c1.17,0,1.58.61,2.58,2.33a18,18,0,0,0,2,3.05C90.29,52,91,52,91.59,52l.86,0,.56,0a.17.17,0,0,0,.17-.19V51.3c0-.16,0-.25-.14-.25a2,2,0,0,1-1.25-.3A8.63,8.63,0,0,1,90.23,49c-1.14-1.61-1.69-2.47-2.33-2.61V46.3c2.19-.77,3.28-1.89,3.28-3.8a3,3,0,0,0-1-2,5.51,5.51,0,0,0-3.61-1.08l-3.11.08c-.5,0-2.22-.08-2.36-.08s-.16,0-.16.14v.66c0,.11,0,.2.11.2h.27c.78,0,1,.3,1.06.86v4.39Zm2.27-4.75c0-.5.42-.61.83-.61a4.64,4.64,0,0,1,2.64.72,2.36,2.36,0,0,1,.92,1.91c0,.73-.47,2.89-3.56,2.89a5.61,5.61,0,0,1-.83,0Z"
            style="fill-rule: evenodd" />
          <path d="M103.58,48.19c0-.47.52-.58.8-.58h.47a.16.16,0,0,0,.14-.17v-.67c0-.08,0-.13-.16-.13s-1.37,0-2.39,0c-1.5,0-2.86,0-3,0s-.14,0-.14.13v.67c0,.08,0,.14.14.14h.67c.72,0,1.36.19,1.36.83v1a1.32,1.32,0,0,1-.42,1.2,3.93,3.93,0,0,1-2.3.61A4,4,0,0,1,96.05,50a6.77,6.77,0,0,1-1.69-4.86A5.86,5.86,0,0,1,95.8,41.5a4,4,0,0,1,3-1.42,3.66,3.66,0,0,1,2.81,1.33,7,7,0,0,1,1.33,2c.08.22.14.25.22.22l.53-.17c.08,0,.11-.08.11-.22,0-.5-.42-3.08-.42-3.22s0-.31-.3-.31a.34.34,0,0,0-.36.2l-.14.25c-.06.08-.17.08-.39-.11A6.05,6.05,0,0,0,99,39.14a7.5,7.5,0,0,0-5,1.69,6.09,6.09,0,0,0-2,4.56,6.76,6.76,0,0,0,1.66,4.88,7.14,7.14,0,0,0,5,2,10.42,10.42,0,0,0,4.75-1.11c.2-.08.31-.17.31-.3s-.08-.31-.08-.56Z"
            style="fill-rule: evenodd" />
          <path d="M108.67,44.86c0-.2,0-3.5,0-3.78,0-.58.27-.69,1-.69h.48c.13,0,.16-.09.16-.2v-.66c0-.09,0-.14-.16-.14s-1.64.08-2.45.08c-1.3,0-3-.08-3.19-.08s-.17,0-.17.16v.64c0,.11,0,.2.17.2h.5c1.16,0,1.42.27,1.42.58s0,3.17,0,3.61V45.8c0,1,0,4.47,0,4.72-.06.5-.5.53-1.2.53h-.61a.17.17,0,0,0-.17.17v.61c0,.14.06.22.17.22s1.78-.08,2.72-.08c1.25,0,2.7.08,2.92.08s.16-.08.16-.19v-.67c0-.08,0-.14-.16-.14h-.42a1,1,0,0,1-1.19-1c0-.41,0-3.61,0-3.77Z"
            style="fill-rule: evenodd" />
          <path d="M123.68,45.14c0-1.14-.06-2.89.08-4.17.06-.39.2-.58.89-.58h.28a.18.18,0,0,0,.17-.2v-.58c0-.17-.06-.22-.2-.22s-1.16.08-1.75.08c-.89,0-2.08-.08-2.27-.08s-.2,0-.2.14v.66c0,.14.06.2.2.2h.47a1,1,0,0,1,1,.5,13.43,13.43,0,0,1,.23,2.61c.05.89.08,1.75.08,3.33v1.83h-.11c-.33-.36-2.92-3.61-3.42-4.19s-3.77-4.72-3.86-4.83-.28-.23-.66-.23-.92.06-1.37.06-.75,0-1.11-.06l-.72,0a.16.16,0,0,0-.17.16v.67a.15.15,0,0,0,.17.17h.25a1.38,1.38,0,0,1,1.47,1.47v2.92c0,3.13-.05,5.11-.08,5.44a.85.85,0,0,1-.8.83h-.64c-.09,0-.12,0-.12.09v.72c0,.14,0,.19.09.19.22,0,1.47-.08,1.86-.08.8,0,1.92.08,2.11.08s.14,0,.14-.16v-.67c0-.11,0-.17-.14-.17H115c-.28,0-.59-.3-.67-.94-.06-.25-.17-3-.17-4.7v-3.8h.06c.44.5,2.69,3.5,3.36,4.28.31.36,1.5,1.77,2.78,3.3,1.14,1.36,2.08,2.5,2.28,2.7a1.23,1.23,0,0,0,.63.27c.34,0,.42-.27.42-.52Z"
            style="fill-rule: evenodd" />
          <path d="M55.44,37.87H53.88c-.09,0-.13-.08-.1-.21l.07-.29c0-.13.16-.41.3-.41h1.53a10.68,10.68,0,0,1,2-3.78A3.61,3.61,0,0,1,60.25,32c1,0,1.59.61,1.59,1a.73.73,0,0,1-.71.81.69.69,0,0,1-.77-.7c0-.18-.19-.51-.72-.51-1.64,0-2,2.32-2.57,4.29,0,0,2.44.07,4.44.07S64.8,36.9,65,36.9s.26.08.26.18v.59c0,.12,0,.23-.2.23H63.86c-.72,0-1.07.23-1.07.66a4,4,0,0,0,.1.87c.15.92,1.1,4,1.56,5.39.3,1,1.79,5.37,2.37,6.93.59-1.2,2.59-6.47,2.79-7s1.23-3.63,1.61-4.76a5.39,5.39,0,0,0,.36-1.46c0-.3-.18-.58-.82-.58H70.1c-.11,0-.13-.08-.13-.23v-.59c0-.13,0-.18.15-.18s1.41.08,3,.08c1.86,0,2.5-.08,2.73-.08s.18.05.18.18v.64c0,.1,0,.18-.18.18h-.69a2.21,2.21,0,0,0-1.81,1c-.67.82-2.71,6.06-3.15,7.14-.3.84-3.6,9-3.73,9.22s-.23.34-.36.34-.3-.26-.43-.59c-.82-2.35-2.89-8.18-3.22-9.1L62.22,45c-.61-1.82-1.81-5.52-2.14-6.29-.26-.59-.52-.84-1-.84l-2.38,0c-.46,1.43-1.27,4.44-2.14,6.69-1.08,2.74-2.32,4.69-4.21,4.69a1.17,1.17,0,0,1-1.26-1,.74.74,0,0,1,.75-.75.91.91,0,0,1,.83.79.34.34,0,0,0,.3.29c.84,0,1.79-1.47,2.74-4.72Z" />
          <path d="M126.94,22.89s0,0,.11,0a47.1,47.1,0,0,0,5,.2h1.12c.9,0,1.88,0,2.94-.08.53,0,3.8,0,4.46,0s2.5-.08,2.7-.08a.17.17,0,0,1,.19.19v.61c0,.11,0,.2-.19.2h-.42c-.5,0-.53.3-.42.47S145,28.34,145.4,29c.42-.69,2.72-4.05,2.83-4.28.22-.44.25-.8-.36-.8h-.44a.18.18,0,0,1-.2-.2v-.61a.18.18,0,0,1,.2-.19c.16,0,1.55.08,2.39.08.5,0,1.47-.08,1.63-.08s.2.05.2.22v.58c0,.14-.06.2-.17.2h-.28a2,2,0,0,0-1,.22,62,62,0,0,0-4.27,5.72v2.34c0,.69,0,1.44,0,1.77.06.59.5.61,1,.61h.36c.14,0,.2.06.2.14v.67c0,.11-.06.19-.23.19s-1.72-.08-2.63-.08c-.61,0-2.23.08-2.39.08s-.2-.05-.2-.22v-.61a.17.17,0,0,1,.17-.17h.42c.89,0,1-.16,1.08-.55s0-1.25,0-2.89v-1c-.25-.5-3.64-5.47-4.09-5.89a1.45,1.45,0,0,0-.87-.33c.16.76.38,1.74.47,2.22,0,.11,0,.17-.14.22l-.47.14c-.16.06-.25,0-.3-.11A7.58,7.58,0,0,0,137,24.26a15.12,15.12,0,0,0-3.23-.28v4.67c0,2.92,0,5,0,5.22,0,.45.19.72.64.72h1.05c.14,0,.2.09.2.25v.59c0,.08-.06.16-.2.16s-1.91-.08-2.83-.08-2.58.08-2.8.08-.23-.08-.23-.25v-.55c0-.14.06-.2.17-.2h1.11c.42,0,.61-.22.64-.44.08-1.06.08-2.53.08-4.19V24a14,14,0,0,0-3.11.25,6.36,6.36,0,0,0-1.64,2.14c-.06.11-.14.2-.25.14l-.5-.19c-.14-.06-.14-.17-.11-.28.16-.51.64-2.22.87-3.06,0,0,0-.07,0-.09" />
          <path d="M136,46.28h3.78c-.11-.39-1.42-4.56-1.47-4.78s-.09-.28-.17-.28-.14.08-.22.31S136.18,46,136,46.28m-5.76-1.42v1.39c0,.16,0,3.36,0,3.77a1,1,0,0,0,1.2,1h.32a1.52,1.52,0,0,0,1.14-.58c.19-.22,1.61-3.56,2.27-4.94.2-.39,1.84-4.17,2-4.64.06-.17.23-.48,0-.56,0,0-.14-.19-.11-.28s0-.14.28-.19a3.91,3.91,0,0,0,1.55-.81.36.36,0,0,1,.34-.19c.16,0,.22.11.27.3.39,1.12,1.81,5.09,2.17,6.2a51.33,51.33,0,0,0,1.81,4.94,1.62,1.62,0,0,0,1.3.75h.53c.11,0,.14.09.14.17v.58c0,.09,0,.25-.2.25-.33,0-1.8-.08-2.44-.08s-2.17.08-2.53.08c-.19,0-.22-.14-.22-.25v-.58c0-.08,0-.17.14-.17h.44a.43.43,0,0,0,.45-.47c-.11-.56-.86-2.78-1.08-3.42h-4.48c-.11.34-1,2.64-1.11,3-.16.55-.08.91.5.91h.7c.16,0,.19.09.19.2v.61c0,.11,0,.19-.17.19S134,52,133.6,52H129c-.95,0-2.56.08-2.72.08s-.17-.08-.17-.22v-.61a.17.17,0,0,1,.17-.17h.61c.69,0,1.13,0,1.19-.53,0-.25.06-3.77.06-4.72V44.58c0-.44-.06-3.22-.06-3.61s-.25-.58-1.42-.58h-.49c-.14,0-.17-.09-.17-.2v-.64c0-.11,0-.16.17-.16s1.88.11,3.19.08c.8,0,2.22-.08,2.44-.08s.17,0,.17.14v.66c0,.11,0,.2-.17.2h-.47c-.75,0-1,.11-1,.69,0,.28,0,3.58,0,3.78" />
          <path d="M79.57,23.12v.64a.17.17,0,0,1-.19.17h-.64c-.36,0-.78.05-.78.42a23.43,23.43,0,0,0,1.22,4c.22.69,1.25,3.92,1.42,4.36h.08c.17-.58,1.53-4,1.67-4.44,1.05-3.09,1.42-3.84,1.42-4.11s-.12-.28-.59-.28h-.3c-.11,0-.17-.06-.17-.2V23.1a.16.16,0,0,1,.17-.17c.16,0,1.61.08,2.25.08h4.24l6.22,0c.28,0,.64-.05.75-.05s.11.05.17.39.83,2.64.89,2.83,0,.17,0,.19l-.44.2c-.06,0-.17,0-.25-.11s-1.39-1.64-1.86-2.08a1.66,1.66,0,0,0-1.06-.42l-2.94-.06v4.72c.16,0,1.8-.08,2-.13.73-.2,1-.59,1-1.45,0-.11,0-.14.14-.14l.61,0c.11,0,.2.06.17.17s-.06,1.72-.06,2c0,.61.09,1.47.12,1.83,0,.11-.06.14-.14.14l-.59.06c-.08,0-.14,0-.16-.11-.14-.7-.31-1.14-1-1.31a10.1,10.1,0,0,0-2.08-.19v.94c0,1,.05,2.58.05,2.94,0,1.31.81,1.39,2,1.39A4.05,4.05,0,0,0,95.82,34a14.91,14.91,0,0,0,1.47-1.87c.14-.19.28-.22.36-.16l.44.25a.17.17,0,0,1,.09.19l-1,3c-.06.14-.2.27-.31.27s-1.66-.08-7.5-.08c-.5,0-2,.08-2.36.08-.14,0-.17-.08-.17-.19v-.64c0-.11.06-.17.2-.17h.25c1.3,0,1.39-.11,1.39-.5V28.18c0-1.47,0-3.28-.06-3.56-.08-.58-.25-.69-1.36-.69H86.6a1.61,1.61,0,0,0-1.17.42,30.33,30.33,0,0,0-2.3,4.88c-.25.59-2.53,6-2.75,6.39a.49.49,0,0,1-.45.22c-.22,0-.36-.19-.44-.41-.61-1.64-2.09-5.67-2.31-6.28L77,28.54c-.47-1.28-1.31-3.81-1.5-4.08a1,1,0,0,0-.81-.53h-.27c-.12,0-.14-.09-.14-.17v-.69c0-.09,0-.14.16-.14s1.67.08,2.39.08,2.36-.08,2.53-.08.22.05.22.19" />
        </g>
        <g id="libletters">
          <path d="M206.91,42.63c.06.06.06.12.06.31s-1.38,5.39-1.56,6.23c-.82,0-9.84-.09-13-.09-2.82,0-3.95.09-4.32.09s-.25-.06-.25-.28v-.72c0-.19,0-.25.19-.25h1.25c1.13,0,1.31-.44,1.31-.85,0-.56.13-8.39.13-10.27V35.05c0-2-.06-5.32-.13-5.86-.06-.81-.18-1.12-1-1.12h-1.31a.27.27,0,0,1-.25-.29v-.72c0-.18.06-.25.25-.25s1.44.1,4.32.1c3.38,0,4.7-.1,5-.1s.31.13.31.29v.72c0,.12-.06.25-.31.25h-1.7c-.93,0-1.06.31-1.06,1.15,0,.44-.13,5.14-.13,7.33v2.69c0,.57,0,7.33.13,8.68h1.75a52.38,52.38,0,0,0,5.26-.16c1.76-.25,3.76-4,4.2-5.2.13-.12.19-.18.38-.12Z" />
          <path d="M214.91,38.93c0,.31.06,7.52.06,7.86,0,1,.5,1.13,1.26,1.13h1.31c.13,0,.25.06.25.22v.78c0,.19-.12.25-.31.25-.38,0-1.63-.09-4.57-.09-3.13,0-4.51.09-4.83.09s-.25-.06-.25-.22v-.84c0-.13.07-.19.25-.19h1.26c.62,0,1.31-.06,1.44-.91.06-.44.12-7.2.12-8.89V35.93c0-.76-.06-6.39-.09-6.8-.1-.75-.41-1.06-1.28-1.06H207.9c-.19,0-.25-.07-.25-.22V27c0-.15.06-.22.18-.22.38,0,2,.1,5.08.1s4-.1,4.44-.1c.19,0,.25.13.25.29v.72a.23.23,0,0,1-.25.25h-1.19c-.69,0-1.19.25-1.19.84,0,.31-.06,7.2-.06,7.58Z" />
          <path d="M223.33,35.42c0-1.12-.06-4.94-.1-5.47-.09-1.82-.59-1.88-1.78-1.88h-1c-.19,0-.25-.07-.25-.25V27.1c0-.19.06-.29.25-.29.44,0,1.94.13,4.57.1,1,0,2.88-.1,4.57-.1,2.38,0,4.39.22,5.51.85a4.35,4.35,0,0,1,2.38,4.26c0,2.5-1.31,4-4.26,5.1v.16c3.57.94,5.64,2.82,5.64,6.14,0,1.69-.94,3.94-2.44,4.76-1.32.75-3.32,1.09-6.83,1.09-1.25,0-3.32-.09-4.57-.09-2.44,0-3.76.09-4.42.09-.12,0-.21-.09-.21-.25v-.78a.19.19,0,0,1,.21-.22H222c.94,0,1.16-.38,1.25-1.35.07-.75.13-4.88.13-7.45Zm3.82,1.32c.5,0,.94,0,1.44,0a5.47,5.47,0,0,0,3.32-.91,4.52,4.52,0,0,0,1.63-3.69,3.92,3.92,0,0,0-1.38-3.2,6.55,6.55,0,0,0-3.57-1.09,4.65,4.65,0,0,0-.94.06.62.62,0,0,0-.41.5c0,.6-.09,3.29-.09,5.92Zm2.69,11.43c2.44,0,4.7-1.16,4.7-5a4.84,4.84,0,0,0-3-4.88,9.06,9.06,0,0,0-3.57-.57h-.81V44C227.15,47,227.84,48.17,229.84,48.17Z" />
          <path d="M285,47.92h-1a2.37,2.37,0,0,1-2-1.44c-.44-.85-2.44-6.67-3.2-9.11-.56-2-3-9-3.56-11-.07-.19-.19-.57-.38-.57s-.28.13-.47.32a10.36,10.36,0,0,1-3.1,1.56c-.25.06-.31.19-.31.31a.7.7,0,0,0,.18.38c.19.19,0,.75-.06,1.07L268,37.68c-.94,2.63-3.19,8.27-3.5,8.83a2.77,2.77,0,0,1-2.46,1.41,3.27,3.27,0,0,1-1.85-.53,36.32,36.32,0,0,1-2.66-3.57c-.25-.38-2.19-3.32-2.56-3.82a4.07,4.07,0,0,0-1.88-1.44v-.13c3.44-.56,5.82-2.19,5.82-6.14a4.77,4.77,0,0,0-1.69-3.5,8.39,8.39,0,0,0-5.7-2c-.94,0-3.82.1-5.57.1-3.07,0-4.07-.1-4.29-.1s-.22.07-.22.22v.85c0,.12.06.19.22.19h1.22c.56,0,1,.5,1,1.56v8.24c0,2.94,0,5.88-.06,9,0,.84-.5,1-1.19,1h-1.07c-.12,0-.18.09-.18.25v.72c0,.19.06.28.25.28s1.06-.09,4.13-.09c3.26,0,3.88.09,4.29.09.25,0,.34-.06.34-.28v-.75c0-.13-.06-.22-.25-.22h-1.56c-.5,0-.72-.57-.82-1.19-.06-.47-.12-4-.12-5.86V39.18l1-.06c1.31,0,2,.85,2.82,1.94.5.69,1.38,2.13,1.69,2.69s1.5,2.76,2.07,3.64a8.28,8.28,0,0,0,1.37,1.78c.69,0,1.88-.09,2.76-.09H265c2.19,0,3.5.09,3.94.09.19,0,.25-.12.25-.31v-.78c0-.1-.06-.16-.31-.16h-1.31c-.63,0-1.13-.35-1.13-.75a2.81,2.81,0,0,1,.06-.66c.16-.85,1.69-5.32,1.94-6h7.27c.37,1.15,1.62,5.16,1.88,6.29.18.85-.07,1.16-.94,1.16h-.82c-.19,0-.25.06-.25.25v.63c0,.18.06.37.31.37.69,0,1.76-.09,4.39-.09,3.44,0,4.07.09,4.63.09.25,0,.32-.19.32-.37v-.66C285.24,48,285.17,47.92,285,47.92ZM248.9,38.18a8.88,8.88,0,0,1-1.19-.12l.06-9a1.08,1.08,0,0,1,.38-.91,2.17,2.17,0,0,1,1.13-.19,6,6,0,0,1,4.13,1.35,4.93,4.93,0,0,1,1.38,3.5A5.48,5.48,0,0,1,248.9,38.18Zm20,1c.22-.72,3-8.42,3.16-8.83s.22-.4.41-.4.19.18.31.56c.19.63,2.32,7.77,2.63,8.67Z" />
          <path d="M292.58,40.87c0,1.88.06,5.39.12,5.86.1.62.32,1.19.82,1.19h1.56c.19,0,.25.09.25.22v.75c0,.22-.09.28-.34.28-.41,0-1-.09-4.29-.09-3.07,0-3.82.09-4.13.09s-.25-.09-.25-.28v-.72c0-.16.06-.25.18-.25h1.07c.69,0,1.19-.19,1.19-1,.06-3.14.06-6.08.06-9V29.63c0-1.06-.44-1.56-1-1.56H286.6c-.16,0-.22-.07-.22-.19V27c0-.15.06-.22.22-.22s1.22.1,4.29.1c1.75,0,4.63-.1,5.57-.1a8.39,8.39,0,0,1,5.7,2,4.77,4.77,0,0,1,1.69,3.5c0,4-2.38,5.58-5.82,6.14v.13A4.07,4.07,0,0,1,299.91,40c.37.5,2.31,3.44,2.56,3.82s2.2,3.13,2.67,3.57a3.28,3.28,0,0,0,2.22.59c.19,0,.25.1.25.22v.66c0,.22-.06.31-.25.31s-1.07-.09-3.07-.09c-.88,0-2.07.06-2.76.09a8.28,8.28,0,0,1-1.37-1.78c-.57-.88-1.79-3.14-2.07-3.64s-1.19-2-1.69-2.69c-.78-1.09-1.5-1.94-2.82-1.94l-1,.06Zm.06-2.81a9,9,0,0,0,1.19.12,5.48,5.48,0,0,0,5.89-5.39,4.93,4.93,0,0,0-1.38-3.5,6,6,0,0,0-4.13-1.35,2.19,2.19,0,0,0-1.13.19,1.08,1.08,0,0,0-.38.91Z" />
          <path d="M317.91,43.25c0,1.19.06,3.26.09,3.6.09,1,.59,1.07,1.22,1.07h1a.2.2,0,0,1,.22.22v.72c0,.22-.06.31-.22.31-.34,0-1.59-.09-4.41-.09-3.07,0-4.07.09-4.35.09s-.22-.12-.22-.28v-.72c0-.13.06-.25.22-.25h1.28c.81,0,1.06-.31,1.1-.78s.09-2.89.09-5.83v-1.5c-.5-.94-5.57-10-6.45-11a2.26,2.26,0,0,0-1.57-.69h-.56c-.19,0-.25-.07-.25-.22V27c0-.12.06-.19.25-.19s1.75.1,4.13.1c3.2,0,4.32-.1,4.64-.1s.25.07.25.22v.72c0,.19-.06.32-.25.32h-.82c-.69,0-.94.25-.87.9s3.82,7.52,4.66,9.27c1.07-1.75,5.11-8.26,5.17-9,.06-.56-.13-1.12-1.07-1.12h-.81a.22.22,0,0,1-.25-.25V27c0-.15.06-.22.19-.22.31,0,1.63.1,3.82.1,2,0,2.69-.1,3-.1s.25.07.25.22v.72c0,.19-.06.32-.25.32h-.69a2.46,2.46,0,0,0-1.69.72c-.5.56-5.7,8.58-6.88,10.64Z" />
        </g>
      </g>
    </svg>
    `;
  }
}

window.customElements.define('uvalib-logos', UvalibLogos);
