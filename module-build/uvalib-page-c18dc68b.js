import { r as render, h as html } from './shady-render-85df7350.js';
import './uvalib-logos-aac41ac8.js';

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

var style$2 = css`
@import url("https://use.typekit.net/tgy5tlj.css");:host{display:block;margin:0;padding:0;width:100%}header{align-items:center;background-color:#232d4b;display:flex;flex-direction:column;height:60px;margin:0;padding:0}#container{max-width:1200px;width:100%}
/*# sourceMappingURL=src/UvalibHeader.css.map */
`;

class UvalibHeader extends LitElement {
  static get styles() {
    return [style$2];
  }

  static get properties() {
    return {
      homelink: { type: String },
      simple: { type: Boolean }
    };
  }

  constructor() {
    super();
    this.homelink = "https://library.virginia.edu";
  }

  render() {
    return html`  
<header>
  <div id="container">
    <a href="${this.homelink}"><uvalib-logos>University of Virginia Library</uvalib-logos></a>
  </div>
</header>
    `;
  }
}

window.customElements.define('uvalib-header', UvalibHeader);

var style$1 = css`
@import url("https://use.typekit.net/tgy5tlj.css");:host{align-items:center;background-color:#232d4b;box-sizing:border-box;color:#87b9d9;display:block;display:flex;flex-direction:column;text-align:left;width:100%}#top{flex:1;flex-basis:0.000000001px;flex-basis:auto;max-width:1200px;width:95%}.copyright{background-color:#fff;border-radius:3px;color:#4f4f4f;font-size:14px;padding-top:20px;padding:10px!important;text-align:center}a{color:#87b9d9;margin-bottom:5px}ul{list-style:none;margin:0;padding:0}ul li{color:#87b9d9;padding:0 0 8px}ul li a:hover{text-decoration:underline}h3{color:#fff;font-family:franklin-gothic-urw,arial,sans-serif;font-size:18px;font-style:normal;font-weight:400;margin-bottom:25px;margin-top:0;text-transform:none}#give-button{border:none;font-size:18px;font-weight:700;margin-bottom:1em;margin-left:0;margin-top:.5em}.social-links{display:flex;flex-direction:row}address{color:#fff;font-style:normal;line-height:1.4}.bottom-bar{align-items:center;background-color:#141e3c;color:#fff;display:flex;flex-direction:column;height:80px;width:100%}.bottom-bar>div{max-width:1200px;width:100%}.bottom-bar a{text-decoration:none}.bottom-bar ::slotted{display:flex;flex-direction:row}.bottom-bar ::slotted(.footer-extended){background-color:initial!important;height:100%!important}.bottom-bar a{color:#fff;font-size:1.1em;padding:0 10px}.bottom-bar div.links{float:left;padding:30px 0 0 28px}.bottom-bar div.fdl{float:left;height:80px}.columns{position:relative;top:-23px}div.fdl svg{height:50%;padding-top:20px}#top .section paper-icon-button:focus{outline:3px dotted #0370b7;padding:.15em}@media screen and (max-width:768px){:host{padding:30px 0 0}.social-links{justify-content:center}.column{padding-bottom:10px}.section>div{align-items:center;flex:1;flex-basis:0.000000001px;padding-bottom:20px;text-align:center}#top{display:flex;flex-direction:column;padding-bottom:10px}#top>.section{display:flex;flex:2;flex-direction:column}}@media screen and (max-width:925px) and (min-width:768px){:host{padding:20px 0 0}.column{padding-bottom:10px}.section>div{padding-bottom:20px}#top{display:flex;flex-direction:row;padding-bottom:10px;padding-left:90px}#top>.section{display:flex;flex:2;flex-direction:column}}@media screen and (min-width:925px){:host{padding:50px 0 0}#top{display:flex;flex-direction:row;padding-bottom:10px;padding-left:90px}#top>.section{display:flex;flex:2;flex-direction:row}.section>div{flex:1;flex-basis:0.000000001px}}
/*# sourceMappingURL=src/UvalibFooterStyle.css.map */
`;

class UvalibFooter extends LitElement {
  static get styles() {
    return [
      style$1
    ]
  }

  static get properties() {
    return {
    };
  }

  constructor() {
    super();
  }

  render() {
    return html`
    <div role="contentinfo" id="top">
    <div class="section">
      <div class="column-1 column">
        <h3>Contact Us</h3>
        <ul>
          <li>(434) 924-3021</li>
          <li><a href="mailto:library@virginia.edu">library@virginia.edu</a></li>
          <li><a href="https://library.virginia.edu/askalibrarian/">Ask a Librarian</a></li>
        </ul>
        <div class="social-links">
<!--
          <uvalib-instagram-link style="color:white; height:40px; width:40px" alt="Library Instagram Account"></uvalib-instagram-link>
          <uvalib-facebook-link style="color:white; height:40px; width:40px" alt="Library Facebook Account"></uvalib-facebook-link>
          <uvalib-twitter-link style="color:white; height:40px; width:40px" alt="Library Twitter Account"></uvalib-twitter-link>
-->
        </div>
        <address>
          UVA Library<br />
          P.O. Box - 400109<br />
          2450 Old Ivy Rd.<br />
          Charlottesville, VA 22903
        </address>
      </div>
      <div class="column-2 column">
        <h3>About the Library</h3>
        <ul>
          <li><a href="https://library.virginia.edu/hours/">Hours</a></li>
          <li><a href="https://library.virginia.edu/staff/">Staff Directory</a></li>
          <li><a href="https://library.virginia.edu/jobs/">Jobs</a></li>
          <li><a href="https://library.virginia.edu/press/">Press</a></li>
          <li><a href="https://library.virginia.edu/renovation/">Renovation</a></li>
          <li><a href="https://library.virginia.edu/jobs/fellowships/">Fellowship Opportunities</a></li>
          <li><a href="https://library.virginia.edu/support-library/"><paper-button id="give-button">Give to the Library</paper-button></a></li>
        </ul>
      </div>
    </div>
    <div class="section">
      <div class="column-3 column">
        <h3>Help &amp; Assistance</h3>
        <ul>
          <li><a href="https://answers.lib.virginia.edu/" aria-label="F A Qs">FAQs</a></li>
          <li><a href="https://library.virginia.edu/services/off-grounds-access/">Off-Grounds Access</a></li>
          <li><a href="https://virginia.service-now.com/its?id=kb_article&sys_id=1cbb89a4db471b045bce5478dc9619ad" aria-label="I T S Computing Accounts">ITS Computing Accounts</a></li>
          <li><a href="https://library.virginia.edu/services/accessibility-services/">Accessibility</a></li>
          <li><a href="https://library.virginia.edu/emergency/">Emergency Information</a></li>
          <li><a href="https://library.virginia.edu/policies/">Library Policies</a></li>
        </ul>
      </div>
      <div class="column-4 column">
        <h3>Related Resources</h3>
        <ul>
          <li><a href="http://www.virginia.edu" aria-label="U V A Home">UVA Home</a></li>
          <li><a href="https://virginia.service-now.com/its?id=home" aria-label="I T S">ITS</a></li>
          <li><a href="https://sisuva.admin.virginia.edu/ihprd/signon.html">SIS</a></li>
          <li><a href="https://collab.itc.virginia.edu/portal" aria-label="U V A Collab">UVaCollab</a></li>
          <li><a href="https://www.virginia.edu/cavalieradvantage/">Cavalier Advantage</a></li>
          <li><a href="https://confluence.lib.virginia.edu/pages/viewpage.action?spaceKey=sw&title=StaffWeb">Library Staff Site</a></li>
          <li><a href="https://analytics.lib.virginia.edu/index.php?module=CoreAdminHome&action=optOut&language=en">Tracking Opt-out</a></li>
        </ul>
      </div>
    </div>
  </div>

  <div class="bottom-bar lib3">
    <div>
    <slot name="bottom-bar">

      <div class="links">
        <a href="mailto:site-feedback@virginia.edu">Feedback</a> |
<!--
        <iron-dropdown id="copydrop"
          auto-fit-on-attach no-overlap
          vertical-align="bottom"
          horizontal-align="left">
            <div slot="dropdown-content">
              <div id="copyright-info" class="copyright">Copyright {{_currentYear}} by the Rector and Visitors of the University of Virginia</div>
            </div>
        </iron-dropdown> -->
        <a href="" on-tap="_copyrightDropup" aria-labelledby="copyright-info">Copyright</a>
      </div>
      <div class="fdl">
<!--            <iron-dropdown id="fdlpdrop"
          auto-fit-on-attach no-overlap always-on-top
          vertical-align="bottom"
          horizontal-align="left">
            <div slot="dropdown-content">
              <div class="copyright">This library is a congressionally designated depository for U.S. Government documents. Public access to the government documents collection is guaranteed by public law. (Title 44 United States Code)</div>
            </div>
        </iron-dropdown>
-->
        <a href="https://guides.lib.virginia.edu/findinggovinfo" id="fdl" >
          <svg alt="Federal Depository Library Program logo" on-mouseover="_fdlpDropup" on-mouseout="_fdlpDropdown" width="50px" viewBox="0 0 76 69" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
              <title>Federal Depository Library Program</title>
              <desc>Created with Sketch.</desc>
              <defs></defs>
              <g id="Welcome" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                  <g id="First-Release" transform="translate(-1164.000000, -2888.000000)">
                      <g id="footer" transform="translate(-1.000000, 2650.000000)">
                          <g id="fdlp-emblem-logo-text-cmyk" transform="translate(1164.778054, 238.000000)">
                              <path d="M13.4360945,28.2205532 L2.35993899,28.2205532 C2.35993899,28.2205532 0.577055368,28.0392271 0.575613488,27.3131932 C0.565880804,19.4366373 0.594718388,19.7671834 0.594718388,19.7671834 C0.594718388,19.7671834 1.50598604,20.7522545 2.71824597,20.806251 C3.74774771,20.852221 14.3304201,20.806251 14.3304201,20.806251 C14.3304201,20.806251 17.2444579,21.0645585 16.6543688,23.3356948 C16.1432227,25.2930677 15.6944378,26.5462971 15.601797,29.8915257 L15.5808898,29.870365 C15.0560458,28.2511999 13.4360945,28.2205532 13.4360945,28.2205532" id="Fill-2" fill="#FFFFFF"></path>
                              <path d="M1.62277825,39.3398174 C2.12094751,40.9224984 3.90130785,40.1742092 3.90130785,40.1742092 C3.90130785,40.1742092 11.6283384,38.3894062 13.4169896,38.0493742 C15.2002337,37.7104368 16.4759363,38.5907985 16.4759363,38.5907985 C16.4759363,38.5907985 15.6695654,34.9529673 15.4013758,32.8952631 C15.1353491,30.8415721 12.2973704,30.5923856 12.2973704,30.5923856 C12.2973704,30.5923856 3.62230422,30.6022363 2.29649631,30.5923856 C0.89462926,30.579981 0.575613488,29.5058886 0.575613488,29.5058886 C0.575613488,29.5058886 0.610218589,36.0956498 1.62277825,39.3398174" id="Fill-3" fill="#FFFFFF"></path>
                              <path d="M18.1340974,26.4142246 C17.2916794,29.9969648 17.5137288,33.4023923 18.5035789,36.8924629 C21.4493381,47.2524927 32.2774904,53.7878925 42.599543,51.7210673 C42.3299116,52.3256091 41.8209283,52.7958894 41.5931114,53.3745275 C39.8444724,57.8595199 38.9851124,61.8942984 37.3824637,66.4445974 C37.1232859,67.1815766 36.5533831,67.7992527 36.0101551,68.372783 C35.8958862,68.4928157 36.0386322,68.6832628 36.166599,68.6894651 C41.1508149,68.9962966 46.0993443,68.2421699 50.8027542,66.5128227 C51.713301,66.181547 52.5816727,65.8626758 53.443556,65.4314335 C66.739845,58.8000805 75.3929225,45.3604264 75.5760411,31.4727474 C75.7259966,20.4629355 71.0557499,10.1277149 63.027727,2.29931795 C62.7069089,1.98117645 63.2814977,1.39816027 63.1081117,0.928609688 C63.027727,0.710799511 62.7872936,0.433520224 62.6009307,0.433520224 C57.3337461,0.421115624 52.153795,0.512325916 46.8916569,0.495908063 C46.5769668,0.495908063 46.2071248,0.933717464 46.0337388,1.30074768 C45.9461447,1.48937056 45.8617947,1.92316671 46.1764849,1.94907043 C47.4514665,2.05998215 47.9752291,3.2825649 49.0443826,3.57115426 C50.161118,3.86777013 51.0370596,3.0592821 52.0827825,2.78820512 C52.834362,2.59119089 53.6749776,2.54777479 54.3537422,2.96770697 C55.078647,3.41938034 54.9149937,4.68428466 54.1785539,5.00643941 C51.8037789,6.03930476 49.2321873,5.20454817 47.1652535,3.54889895 C46.8628193,3.31065767 46.3268008,2.8571601 45.8340385,3.1256832 C43.7883724,4.23334098 40.4972832,3.97722248 39.8307745,6.34431197 C39.3571172,8.02659459 40.4388871,9.90881018 41.1688384,11.5841608 C42.0548732,10.3079464 43.554788,10.1040002 44.9126777,10.5217433 C47.3476512,11.2663842 49.337805,12.5889334 51.0900487,14.381398 C53.2845888,16.6288196 54.3587888,19.5789253 54.6049897,22.6246194 C55.2826729,30.9032303 52.9735034,43.1640826 43.6823943,44.6551884 C28.0538657,47.1689441 24.0681512,37.5520957 24.0681512,32.7489618 C24.0681512,30.8696649 24.0184064,29.1041985 24.4819705,27.343475 C25.4361341,23.716589 27.4194389,20.6249249 30.6925047,18.7511007 C32.025522,17.9893123 33.5950075,17.6262954 34.4947401,16.2435474 C35.1781908,15.1949938 35.0603172,13.9800728 34.6821844,12.8720501 C34.3328892,11.8483058 33.3632254,10.9113937 32.413027,10.9113937 C21.7449233,10.9113937 9.9078161,10.9095695 0.621393153,10.9095695 C0.621393153,13.6221636 0.594718388,14.9177146 0.621393153,17.1443402 C0.632207247,18.1943531 1.28501805,18.7521952 2.40860241,18.7521952 L21.6551664,18.7521952 C20.4173131,21.3301629 18.8207923,23.4929414 18.1340974,26.4142246 Z" id="Fill-4" fill="#FFFFFF"></path>
                              <path d="M11.3828585,54.9313047 C12.5742112,54.515021 21.0726472,49.1828673 21.7878192,48.9209113 C22.4258508,48.6888724 22.9550204,48.6111612 23.8875558,49.2802799 C26.3931814,51.080771 29.0235295,52.8995043 30.3186975,52.8995043 C30.3186975,52.8995043 29.9146108,53.2154567 29.1107632,53.9827177 C28.3512533,54.7098461 20.9396338,62.70607 20.9396338,62.70607 C20.9396338,62.70607 19.600849,64.1081546 18.1705048,63.1599324 C18.1705048,63.1599324 13.3016392,59.7238583 9.37323939,55.293592 C9.37323939,55.293592 10.0894929,55.3848023 11.3828585,54.9313047" id="Fill-5" fill="#FFFFFF"></path>
                              <path d="M21.3422786,64.9199262 C21.3422786,64.9199262 22.5033518,64.8765101 23.1298483,64.2905752 C23.7545425,63.7020864 31.5673649,54.432202 31.5673649,54.432202 C31.5673649,54.432202 31.8672757,53.4431176 33.3996329,53.7988377 C35.3198555,54.2541595 38.4029537,54.390975 39.0265664,54.3431808 C39.0265664,54.3431808 38.6232007,54.7098461 38.1769391,55.9258617 C37.9166799,56.6376669 35.1421439,66.5026072 34.6057648,67.2705978 C34.0697462,68.0415072 33.9810706,68.7186524 32.1913381,68.4016055 C28.8014801,67.8010769 26.0694795,66.9685093 21.3422786,64.9199262" id="Fill-6" fill="#FFFFFF"></path>
                              <path d="M2.46159147,42.2184143 C2.46159147,42.2184143 3.39989436,42.4891264 4.33891818,42.3081652 C6.18308167,41.9528099 13.275325,40.0829989 14.6097841,39.9593177 C16.5307277,39.7765323 16.1738626,40.048339 17.1983178,41.0447202 C18.0803874,41.8940705 19.8340729,45.6968099 20.2817764,45.9693463 C20.7258752,46.2385991 20.9933438,46.7369721 21.754656,46.8756118 C21.754656,46.8756118 11.0227492,52.9334345 10.1868197,53.0220909 C9.29645932,53.1129363 8.42340147,53.9973113 7.50888959,52.661263 C4.33891818,48.0055248 4.25168449,47.3247312 2.86387577,43.4384431 L2.46159147,42.2184143" id="Fill-7" fill="#FFFFFF"></path>
                              <polygon id="Fill-8" fill="#C11E42" points="30.9895318 38.5240326 46.0903326 38.5240326 46.0903326 24.2594726 30.9895318 24.2594726"></polygon>
                              <path d="M38.5792234,23.2010684 C38.5792234,23.2010684 36.2116577,19.9455907 32.2828974,20.1283761 L32.2828974,22.7964596 L29.7372597,22.7964596 L29.7372597,39.8356366 L36.5238246,39.8356366 C36.5238246,39.8356366 36.8395961,38.750599 37.4181502,38.5240326 L31.0774864,38.5240326 L31.0774864,24.329887 L32.1913381,24.329887 L32.1913381,35.5418209 C32.1913381,35.5418209 35.7390818,35.4586371 37.7501428,38.5316943 L38.8928321,38.5316943" id="Fill-9" fill="#FFFFFF"></path>
                              <path d="M38.5792234,23.2010684 C38.5792234,23.2010684 40.9568822,19.9455907 44.8842006,20.1283761 L44.8842006,22.7964596 L47.4276755,22.7964596 L47.4276755,39.8356366 L40.6414711,39.8356366 C40.6414711,39.8356366 40.3303857,38.750599 39.7482269,38.5240326 L46.0903326,38.5240326 L46.0903326,24.329887 L44.9710738,24.329887 L44.9710738,35.5418209 C44.9710738,35.5418209 41.4290976,35.4586371 39.4201994,38.5316943 L38.7609002,38.5316943" id="Fill-10" fill="#FFFFFF"></path>
                              <path d="M37.8903656,24.329887 C37.8903656,24.329887 36.4823706,21.619482 33.5326462,21.619482 L33.5326462,34.5001994 C33.5326462,34.5001994 35.9016537,34.7716412 37.5500821,36.0832452 L37.9094705,36.3991976 L37.8903656,24.329887" id="Fill-11" fill="#C11E42"></path>
                              <path d="M39.30557,24.329887 C39.30557,24.329887 40.6854484,21.619482 43.6326495,21.619482 L43.6326495,34.5001994 C43.6326495,34.5001994 40.7535772,34.92378 39.735971,35.879299 C39.5377126,36.0660977 39.30557,36.4232772 39.30557,36.4232772 L39.30557,24.329887" id="Fill-12" fill="#C11E42"></path>
                          </g>
                      </g>
                  </g>
              </g>
          </svg>
        </a>

      </div>
    </slot>
    </div>
  </div>
    `;
  }
}

window.customElements.define('uvalib-footer', UvalibFooter);

var style = css`
@import url("https://use.typekit.net/tgy5tlj.css");:host{display:block;margin:0;min-height:100vh;padding:0}#container{align-items:center;display:flex;flex-direction:column;min-height:100vh}#center{display:flex;flex:1;flex-wrap:wrap;margin-bottom:4em;max-width:1200px;width:100vw}#sidebar{flex:0 0 12em}#sidebar,main{padding-left:1em;padding-right:1em;padding-top:1em}main{flex:1 1 40%}
/*# sourceMappingURL=src/UvalibPage.css.map */
`;

class UvalibPage extends LitElement {
  static get styles() {
    return style;
  }

  static get properties() {
    return {
      hassidebar: { type: Boolean }
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this.hassidebar = false;
    // ensure that we don't have any padding/margins set in ancestors nodes
    let nodes = [];
    let element = this;
    while(element.parentNode) {
      nodes.unshift(element.parentNode);
      element = element.parentNode;
    }
    nodes.forEach((e)=>{
      if (e.style) {
        e.style.margin="0";
        e.style.padding="0";
      }
    });
  }

  firstUpdated() {
    this._checkForSideSlotted();
  }

  // See if the sidebar has been slotted so that we can display or not
  _checkForSideSlotted() {
    let sideslots = [
      this.shadowRoot.querySelector("#side-nav"),
      this.shadowRoot.querySelector("#side-aside")
    ];
//    this.hassidebar = 
//      sideslots[0].assignedNodes()?.length ||
//      aside[1].assignedNodes()?.length;
    let slotsfilled = false;
    sideslots.forEach(function(s){
      slotsfilled = slotsfilled? slotsfilled:s.assignedNodes()?.length;
      s.addEventListener('slotchange', function(e){
        this._checkForSideSlotted();
      }.bind(this));
    }.bind(this));
    this.hassidebar = slotsfilled;
  }

  render() {
    return html`
    <div id="container">
      <uvalib-header><slot name="header"></slot></uvalib-header>
      <div id="center">
        <main><slot></slot></main>
        <div id="sidebar" ?hidden="${!this.hassidebar}">
          <nav><slot id="side-nav" name="side-nav"></slot></nav>
          <aside><slot id="side-aside" name="side-aside"></slot></aside>
        </div>
      </div>
      <uvalib-footer><slot name="footer"></slot></uvalib-footer>
    </div>
    `;
  }
}

window.customElements.define('uvalib-page', UvalibPage);
