(function () {

  if ('adoptedStyleSheets' in document) { return; }

  var hasShadyCss = 'ShadyCSS' in window && !window.ShadyCSS.nativeShadow;
  var deferredStyleSheets = [];
  var deferredDocumentStyleElements = [];
  var adoptedSheetsRegistry = new WeakMap();
  var sheetMetadataRegistry = new WeakMap();
  var locationRegistry = new WeakMap();
  var observerRegistry = new WeakMap();
  var appliedActionsCursorRegistry = new WeakMap();
  var state = {
    loaded: false
  };
  var frame = {
    body: null,
    CSSStyleSheet: null
  };
  var OldCSSStyleSheet = CSSStyleSheet;

  var importPattern = /@import\surl(.*?);/gi;
  function instanceOfStyleSheet(instance) {
    return instance instanceof OldCSSStyleSheet || instance instanceof frame.CSSStyleSheet;
  }
  function checkAndPrepare(sheets, container) {
    var locationType = container === document ? 'Document' : 'ShadowRoot';
    if (!Array.isArray(sheets)) {
      throw new TypeError("Failed to set the 'adoptedStyleSheets' property on " + locationType + ": Iterator getter is not callable.");
    }
    if (!sheets.every(instanceOfStyleSheet)) {
      throw new TypeError("Failed to set the 'adoptedStyleSheets' property on " + locationType + ": Failed to convert value to 'CSSStyleSheet'");
    }
    var uniqueSheets = sheets.filter(function (value, index) {
      return sheets.indexOf(value) === index;
    });
    adoptedSheetsRegistry.set(container, uniqueSheets);
    return uniqueSheets;
  }
  function isDocumentLoading() {
    return document.readyState === 'loading';
  }
  function getAdoptedStyleSheet(location) {
    return adoptedSheetsRegistry.get(location.parentNode === document.documentElement ? document : location);
  }
  function rejectImports(contents) {
    var imports = contents.match(importPattern, '') || [];
    var sheetContent = contents;
    if (imports.length) {
      console.warn('@import rules are not allowed here. See https://github.com/WICG/construct-stylesheets/issues/119#issuecomment-588352418');
      imports.forEach(function (_import) {
        sheetContent = sheetContent.replace(_import, '');
      });
    }
    return sheetContent;
  }

  var cssStyleSheetMethods = ['addImport', 'addPageRule', 'addRule', 'deleteRule', 'insertRule', 'removeImport', 'removeRule'];
  var cssStyleSheetNewMethods = ['replace', 'replaceSync'];
  function updatePrototype(proto) {
    cssStyleSheetNewMethods.forEach(function (methodKey) {
      proto[methodKey] = function () {
        return ConstructStyleSheet.prototype[methodKey].apply(this, arguments);
      };
    });
    cssStyleSheetMethods.forEach(function (methodKey) {
      var oldMethod = proto[methodKey];
      proto[methodKey] = function () {
        var args = arguments;
        var result = oldMethod.apply(this, args);
        if (sheetMetadataRegistry.has(this)) {
          var _sheetMetadataRegistr = sheetMetadataRegistry.get(this),
              adopters = _sheetMetadataRegistr.adopters,
              actions = _sheetMetadataRegistr.actions;
          adopters.forEach(function (styleElement) {
            if (styleElement.sheet) {
              styleElement.sheet[methodKey].apply(styleElement.sheet, args);
            }
          });
          actions.push([methodKey, args]);
        }
        return result;
      };
    });
  }
  function updateAdopters(sheet) {
    var _sheetMetadataRegistr2 = sheetMetadataRegistry.get(sheet),
        adopters = _sheetMetadataRegistr2.adopters,
        basicStyleElement = _sheetMetadataRegistr2.basicStyleElement;
    adopters.forEach(function (styleElement) {
      styleElement.innerHTML = basicStyleElement.innerHTML;
    });
  }
  var ConstructStyleSheet =
  function () {
    function ConstructStyleSheet() {
      var basicStyleElement = document.createElement('style');
      if (state.loaded) {
        frame.body.appendChild(basicStyleElement);
      } else {
        document.head.appendChild(basicStyleElement);
        basicStyleElement.disabled = true;
        deferredStyleSheets.push(basicStyleElement);
      }
      var nativeStyleSheet = basicStyleElement.sheet;
      sheetMetadataRegistry.set(nativeStyleSheet, {
        adopters: new Map(),
        actions: [],
        basicStyleElement: basicStyleElement
      });
      return nativeStyleSheet;
    }
    var _proto = ConstructStyleSheet.prototype;
    _proto.replace = function replace(contents) {
      var _this = this;
      var sanitized = rejectImports(contents);
      return new Promise(function (resolve, reject) {
        if (sheetMetadataRegistry.has(_this)) {
          var _sheetMetadataRegistr3 = sheetMetadataRegistry.get(_this),
              basicStyleElement = _sheetMetadataRegistr3.basicStyleElement;
          basicStyleElement.innerHTML = sanitized;
          resolve(basicStyleElement.sheet);
          updateAdopters(_this);
        } else {
          reject(new Error("Can't call replace on non-constructed CSSStyleSheets."));
        }
      });
    };
    _proto.replaceSync = function replaceSync(contents) {
      var sanitized = rejectImports(contents);
      if (sheetMetadataRegistry.has(this)) {
        var _sheetMetadataRegistr4 = sheetMetadataRegistry.get(this),
            basicStyleElement = _sheetMetadataRegistr4.basicStyleElement;
        basicStyleElement.innerHTML = sanitized;
        updateAdopters(this);
        return basicStyleElement.sheet;
      } else {
        throw new Error("Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.");
      }
    };
    return ConstructStyleSheet;
  }();
  Object.defineProperty(ConstructStyleSheet, Symbol.hasInstance, {
    configurable: true,
    value: instanceOfStyleSheet
  });

  function adoptStyleSheets(location) {
    var newStyles = document.createDocumentFragment();
    var sheets = getAdoptedStyleSheet(location);
    var observer = observerRegistry.get(location);
    for (var i = 0, len = sheets.length; i < len; i++) {
      var _sheetMetadataRegistr = sheetMetadataRegistry.get(sheets[i]),
          adopters = _sheetMetadataRegistr.adopters,
          basicStyleElement = _sheetMetadataRegistr.basicStyleElement;
      var elementToAdopt = adopters.get(location);
      if (elementToAdopt) {
        observer.disconnect();
        newStyles.appendChild(elementToAdopt);
        if (!elementToAdopt.innerHTML || elementToAdopt.sheet && !elementToAdopt.sheet.cssText) {
          elementToAdopt.innerHTML = basicStyleElement.innerHTML;
        }
        observer.observe();
      } else {
        elementToAdopt = document.createElement('style');
        elementToAdopt.innerHTML = basicStyleElement.innerHTML;
        locationRegistry.set(elementToAdopt, location);
        appliedActionsCursorRegistry.set(elementToAdopt, 0);
        adopters.set(location, elementToAdopt);
        newStyles.appendChild(elementToAdopt);
      }
      if (location === document.head) {
        deferredDocumentStyleElements.push(elementToAdopt);
      }
    }
    location.insertBefore(newStyles, location.firstChild);
    for (var _i = 0, _len = sheets.length; _i < _len; _i++) {
      var _sheetMetadataRegistr2 = sheetMetadataRegistry.get(sheets[_i]),
          _adopters = _sheetMetadataRegistr2.adopters,
          actions = _sheetMetadataRegistr2.actions;
      var adoptedStyleElement = _adopters.get(location);
      var cursor = appliedActionsCursorRegistry.get(adoptedStyleElement);
      if (actions.length > 0) {
        for (var _i2 = cursor, _len2 = actions.length; _i2 < _len2; _i2++) {
          var _actions$_i = actions[_i2],
              key = _actions$_i[0],
              args = _actions$_i[1];
          adoptedStyleElement.sheet[key].apply(adoptedStyleElement.sheet, args);
        }
        appliedActionsCursorRegistry.set(adoptedStyleElement, actions.length - 1);
      }
    }
  }
  function removeExcludedStyleSheets(location, oldSheets) {
    var sheets = getAdoptedStyleSheet(location);
    for (var i = 0, len = oldSheets.length; i < len; i++) {
      if (sheets.indexOf(oldSheets[i]) > -1) {
        continue;
      }
      var _sheetMetadataRegistr3 = sheetMetadataRegistry.get(oldSheets[i]),
          adopters = _sheetMetadataRegistr3.adopters;
      var observer = observerRegistry.get(location);
      var styleElement = adopters.get(location);
      if (!styleElement) {
        styleElement = adopters.get(document.head);
      }
      observer.disconnect();
      styleElement.parentNode.removeChild(styleElement);
      observer.observe();
    }
  }

  function adoptAndRestoreStylesOnMutationCallback(mutations) {
    for (var i = 0, len = mutations.length; i < len; i++) {
      var _mutations$i = mutations[i],
          addedNodes = _mutations$i.addedNodes,
          removedNodes = _mutations$i.removedNodes;
      for (var _i = 0, _len = removedNodes.length; _i < _len; _i++) {
        var location = locationRegistry.get(removedNodes[_i]);
        if (location) {
          adoptStyleSheets(location);
        }
      }
      if (!hasShadyCss) {
        for (var _i2 = 0, _len2 = addedNodes.length; _i2 < _len2; _i2++) {
          var iter = document.createNodeIterator(addedNodes[_i2], NodeFilter.SHOW_ELEMENT, function (node) {
            return node.shadowRoot && node.shadowRoot.adoptedStyleSheets.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          },
          null, false);
          var node = void 0;
          while (node = iter.nextNode()) {
            adoptStyleSheets(node.shadowRoot);
          }
        }
      }
    }
  }
  function createObserver(location) {
    var observer = new MutationObserver(adoptAndRestoreStylesOnMutationCallback);
    var observerTool = {
      observe: function observe() {
        observer.observe(location, {
          childList: true,
          subtree: true
        });
      },
      disconnect: function disconnect() {
        observer.disconnect();
      }
    };
    observerRegistry.set(location, observerTool);
    observerTool.observe();
  }

  function initPolyfill() {
    var iframe = document.createElement('iframe');
    iframe.hidden = true;
    document.body.appendChild(iframe);
    frame.body = iframe.contentWindow.document.body;
    frame.CSSStyleSheet = iframe.contentWindow.CSSStyleSheet;
    updatePrototype(iframe.contentWindow.CSSStyleSheet.prototype);
    createObserver(document.body);
    state.loaded = true;
    var fragment = document.createDocumentFragment();
    for (var i = 0, len = deferredStyleSheets.length; i < len; i++) {
      deferredStyleSheets[i].disabled = false;
      fragment.appendChild(deferredStyleSheets[i]);
    }
    frame.body.appendChild(fragment);
    for (var _i = 0, _len = deferredDocumentStyleElements.length; _i < _len; _i++) {
      fragment.appendChild(deferredDocumentStyleElements[_i]);
    }
    document.body.insertBefore(fragment, document.body.firstChild);
    deferredStyleSheets.length = 0;
    deferredDocumentStyleElements.length = 0;
  }
  function initAdoptedStyleSheets() {
    var adoptedStyleSheetAccessors = {
      configurable: true,
      get: function get() {
        return adoptedSheetsRegistry.get(this) || [];
      },
      set: function set(sheets) {
        var oldSheets = adoptedSheetsRegistry.get(this) || [];
        checkAndPrepare(sheets, this);
        var location = this === document ?
        isDocumentLoading() ? this.head : this.body : this;
        var isConnected = 'isConnected' in location ? location.isConnected : document.body.contains(location);
        window.requestAnimationFrame(function () {
          if (isConnected) {
            adoptStyleSheets(location);
            removeExcludedStyleSheets(location, oldSheets);
          }
        });
      }
    };
    Object.defineProperty(Document.prototype, 'adoptedStyleSheets', adoptedStyleSheetAccessors);
    if (typeof ShadowRoot !== 'undefined') {
      var attachShadow = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function () {
        var location = hasShadyCss ? this : attachShadow.apply(this, arguments);
        createObserver(location);
        return location;
      };
      Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', adoptedStyleSheetAccessors);
    }
  }

  updatePrototype(OldCSSStyleSheet.prototype);
  window.CSSStyleSheet = ConstructStyleSheet;
  initAdoptedStyleSheets();
  if (isDocumentLoading()) {
    document.addEventListener('DOMContentLoaded', initPolyfill);
  } else {
    initPolyfill();
  }

}());

var css_248z = "/** @color Black */\n/** @color White */\n/** @color Danger */\n/** @color Success */\n/* OFFICIAL 2019-2020 BRAND COLORS */\n/**\n * @color Blue (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Blue (lighter)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Blue (light)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Blue\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Orange (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Orange (lighter)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Orange (light)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Orange\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Orange (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Orange (darker)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Alternative Blue (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Alternative Blue (lighter)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Alternative Blue (light)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Alternative Blue\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Alternative Blue (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Alternative Blue (darkest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Teal (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Teal (light)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Teal\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Teal (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Teal (darker)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Green (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Green (lighter)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Green\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Green (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Red (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Red\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Red (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Red (darker)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Yellow (light)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Yellow (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Yellow\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Yellow (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Beige\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Beige (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Grey (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Grey (light)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Grey\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Grey Dark\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Grey Darkest\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Text Light\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Red Emergency\n * @section 2019-2020 Brand Colors\n */\n/*Secondary Brand Colors*/\n/**\n * @color Secondary Web Orange\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Web Blue\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Cyan\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Yellow\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Teal\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Magenta\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Green (ADA compliant)\n * @section Secondary Brand Colors\n */\n/*ADA compliant*/\n/**\n * @color Secondary Light Gray\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Medium Gray\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Text Grey (ADA compliant)\n * @section Secondary Brand Colors\n */\n/*ADA compliant*/\n/**\n * @color Secondary Dark Grey (ADA compliant for hover over shaded table rows)\n * @section Secondary Brand Colors\n */\n/*ADA compliant for hover over shaded table rows*/\n/**\n * @color Secondary Text Almost Black (ADA compliant)\n * @section Secondary Brand Colors\n */\n/*ADA compliant*/\n/**\n * @color Secondary Emergency Red (ADA compliant)\n * @section Secondary Brand Colors\n */\n/*ADA compliant*/\n/* PHASE OUT THE CODE BELOW */\n/* Brand Color Palate*/\n/* link colors for body links */\n/* Other color palette */\n/* color variables */\n/*var(--uvalib-blue-700);*/\n/* paper components reference this */\n/* testing out colors for focus states */\n/* Color Remapping */\n/** @color Black */\n/** @color White */\n/** @color Danger */\n/** @color Success */\n/* OFFICIAL 2019-2020 BRAND COLORS */\n/**\n * @color Blue (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Blue (lighter)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Blue (light)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Blue\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Orange (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Orange (lighter)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Orange (light)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Orange\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Orange (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Orange (darker)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Alternative Blue (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Alternative Blue (lighter)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Alternative Blue (light)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Alternative Blue\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Alternative Blue (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Alternative Blue (darkest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Teal (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Teal (light)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Teal\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Teal (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Teal (darker)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Green (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Green (lighter)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Green\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Green (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Red (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Red\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Red (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Red (darker)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Yellow (light)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Yellow (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Yellow\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Yellow (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Beige\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Beige (dark)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Grey (lightest)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Grey (light)\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Grey\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Grey Dark\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Grey Darkest\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Text Light\n * @section 2019-2020 Brand Colors\n */\n/**\n * @color Red Emergency\n * @section 2019-2020 Brand Colors\n */\n/*Secondary Brand Colors*/\n/**\n * @color Secondary Web Orange\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Web Blue\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Cyan\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Yellow\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Teal\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Magenta\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Green (ADA compliant)\n * @section Secondary Brand Colors\n */\n/*ADA compliant*/\n/**\n * @color Secondary Light Gray\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Medium Gray\n * @section Secondary Brand Colors\n */\n/**\n * @color Secondary Text Grey (ADA compliant)\n * @section Secondary Brand Colors\n */\n/*ADA compliant*/\n/**\n * @color Secondary Dark Grey (ADA compliant for hover over shaded table rows)\n * @section Secondary Brand Colors\n */\n/*ADA compliant for hover over shaded table rows*/\n/**\n * @color Secondary Text Almost Black (ADA compliant)\n * @section Secondary Brand Colors\n */\n/*ADA compliant*/\n/**\n * @color Secondary Emergency Red (ADA compliant)\n * @section Secondary Brand Colors\n */\n/*ADA compliant*/\n/* PHASE OUT THE CODE BELOW */\n/* Brand Color Palate*/\n/* link colors for body links */\n/* Other color palette */\n/* color variables */\n/*var(--uvalib-blue-700);*/\n/* paper components reference this */\n/* testing out colors for focus states */\n/* Color Remapping */\n/* common scsss variables for V4 client */\n/* small media width */\n/* spacing unit of measure */\n/* font variables */\n/* be sure to load fonts.js */\n/*Pulling in fonts via Typekit, weights will pull in font variants*/\n/*try to refrain from using this one, difficult to read on small screens*/\n/*not used?*/\n/* Main sizing unit - changing this will update most of the font size/spacing variables on the site */\n/* typography variables */\n/* used for headers in card body */\n/* main body font */\n.fa, .fas, .far, .icon-window-close-regular, .fal, .icon-exclamation-circle, .icon-exclamation-triangle, .icon-info-circle, .icon-ban, .icon-check-circle, .icon-clock, .icon-comment-dots, .icon-user-circle, .icon-bell, .icon-chevron-circle-up, .icon-search, .icon-check, .icon-external-link-alt, .icon-search-plus, .icon-university, .icon-plus, .icon-minus, .icon-caret-up, .icon-caret-down, .icon-quote-right, .icon-print, .icon-copy, .icon-edit, .icon-trash-alt, .icon-download, .icon-calendar-alt, .icon-file-pdf, .icon-envelope, .icon-bookmark, .icon-times-circle, .icon-plus-circle, .icon-redo-alt, .icon-chevron-double-left, .icon-chevron-double-right, .icon-arrow-right, .icon-arrow-left, .icon-star, .fad, .fab, .icon-facebook-square, .icon-instagram, .icon-twitter-square, .icon-vimeo, .icon-youtube {\n  -moz-osx-font-smoothing: grayscale;\n  -webkit-font-smoothing: antialiased;\n  display: inline-block;\n  font-style: normal;\n  font-variant: normal;\n  text-rendering: auto;\n  line-height: 1; }\n\n.fa.fa-pull-left, .fas.fa-pull-left, .far.fa-pull-left, .fa-pull-left.icon-window-close-regular, .fal.fa-pull-left, .fa-pull-left.icon-exclamation-circle, .fa-pull-left.icon-exclamation-triangle, .fa-pull-left.icon-info-circle, .fa-pull-left.icon-ban, .fa-pull-left.icon-check-circle, .fa-pull-left.icon-clock, .fa-pull-left.icon-comment-dots, .fa-pull-left.icon-user-circle, .fa-pull-left.icon-bell, .fa-pull-left.icon-chevron-circle-up, .fa-pull-left.icon-search, .fa-pull-left.icon-check, .fa-pull-left.icon-external-link-alt, .fa-pull-left.icon-search-plus, .fa-pull-left.icon-university, .fa-pull-left.icon-plus, .fa-pull-left.icon-minus, .fa-pull-left.icon-caret-up, .fa-pull-left.icon-caret-down, .fa-pull-left.icon-quote-right, .fa-pull-left.icon-print, .fa-pull-left.icon-copy, .fa-pull-left.icon-edit, .fa-pull-left.icon-trash-alt, .fa-pull-left.icon-download, .fa-pull-left.icon-calendar-alt, .fa-pull-left.icon-file-pdf, .fa-pull-left.icon-envelope, .fa-pull-left.icon-bookmark, .fa-pull-left.icon-times-circle, .fa-pull-left.icon-plus-circle, .fa-pull-left.icon-redo-alt, .fa-pull-left.icon-chevron-double-left, .fa-pull-left.icon-chevron-double-right, .fa-pull-left.icon-arrow-right, .fa-pull-left.icon-arrow-left, .fa-pull-left.icon-star, .fab.fa-pull-left, .fa-pull-left.icon-facebook-square, .fa-pull-left.icon-instagram, .fa-pull-left.icon-twitter-square, .fa-pull-left.icon-vimeo, .fa-pull-left.icon-youtube {\n  margin-right: .3em; }\n\n.fa.fa-pull-right, .fas.fa-pull-right, .far.fa-pull-right, .fa-pull-right.icon-window-close-regular, .fal.fa-pull-right, .fa-pull-right.icon-exclamation-circle, .fa-pull-right.icon-exclamation-triangle, .fa-pull-right.icon-info-circle, .fa-pull-right.icon-ban, .fa-pull-right.icon-check-circle, .fa-pull-right.icon-clock, .fa-pull-right.icon-comment-dots, .fa-pull-right.icon-user-circle, .fa-pull-right.icon-bell, .fa-pull-right.icon-chevron-circle-up, .fa-pull-right.icon-search, .fa-pull-right.icon-check, .fa-pull-right.icon-external-link-alt, .fa-pull-right.icon-search-plus, .fa-pull-right.icon-university, .fa-pull-right.icon-plus, .fa-pull-right.icon-minus, .fa-pull-right.icon-caret-up, .fa-pull-right.icon-caret-down, .fa-pull-right.icon-quote-right, .fa-pull-right.icon-print, .fa-pull-right.icon-copy, .fa-pull-right.icon-edit, .fa-pull-right.icon-trash-alt, .fa-pull-right.icon-download, .fa-pull-right.icon-calendar-alt, .fa-pull-right.icon-file-pdf, .fa-pull-right.icon-envelope, .fa-pull-right.icon-bookmark, .fa-pull-right.icon-times-circle, .fa-pull-right.icon-plus-circle, .fa-pull-right.icon-redo-alt, .fa-pull-right.icon-chevron-double-left, .fa-pull-right.icon-chevron-double-right, .fa-pull-right.icon-arrow-right, .fa-pull-right.icon-arrow-left, .fa-pull-right.icon-star, .fab.fa-pull-right, .fa-pull-right.icon-facebook-square, .fa-pull-right.icon-instagram, .fa-pull-right.icon-twitter-square, .fa-pull-right.icon-vimeo, .fa-pull-right.icon-youtube {\n  margin-left: .3em; }\n\n.fal, .icon-exclamation-circle, .icon-exclamation-triangle, .icon-info-circle, .icon-ban, .icon-check-circle, .icon-clock, .icon-comment-dots, .icon-user-circle, .icon-bell, .icon-chevron-circle-up, .icon-search, .icon-check, .icon-external-link-alt, .icon-search-plus, .icon-university, .icon-plus, .icon-minus, .icon-caret-up, .icon-caret-down, .icon-quote-right, .icon-print, .icon-copy, .icon-edit, .icon-trash-alt, .icon-download, .icon-calendar-alt, .icon-file-pdf, .icon-envelope, .icon-bookmark, .icon-times-circle, .icon-plus-circle, .icon-redo-alt, .icon-chevron-double-left, .icon-chevron-double-right, .icon-arrow-right, .icon-arrow-left, .icon-star {\n  font-family: 'Font Awesome 5 Pro';\n  font-weight: 300; }\n\n.fab, .icon-facebook-square, .icon-instagram, .icon-twitter-square, .icon-vimeo, .icon-youtube {\n  font-family: 'Font Awesome 5 Brands';\n  font-weight: 400; }\n\n.far, .icon-window-close-regular {\n  font-family: 'Font Awesome 5 Pro';\n  font-weight: 400; }\n\n/**\n * Critical, Emergency Alerts / Attention Status\n *\n * @atom .icon-exclamation-circle\n * @section Icons\n * @markup\n *  <i class=\"icon-exclamation-circle\"></i>\n */\n.icon-exclamation-circle:before {\n  content: \"\\f06a\"; }\n\n/**\n * Warning Alerts / Modified Status\n *\n * @atom .icon-exclamation-triangle\n * @section Icons\n * @markup\n *  <i class=\"icon-exclamation-triangle\"></i>\n */\n.icon-exclamation-triangle:before {\n  content: \"\\f071\"; }\n\n/**\n * Info / FYI / Informational Alerts\n *\n * @atom .icon-info-circle\n * @section Icons\n * @markup\n *  <i class=\"icon-info-circle\"></i>\n */\n.icon-info-circle:before {\n  content: \"\\f05a\"; }\n\n/**\n * Error, Problem Alerts / Not Available\n *\n * @atom .icon-ban\n * @section Icons\n * @markup\n *  <i class=\"icon-ban\"></i>\n */\n.icon-ban:before {\n  content: \"\\f05e\"; }\n\n/**\n * Success / Conformation Alerts\n *\n * @atom .icon-check-circle\n * @section Icons\n * @markup\n *  <i class=\"icon-check-circle\"></i>\n */\n.icon-check-circle:before {\n  content: \"\\f058\"; }\n\n/**\n * Hours\n *\n * @atom .icon-clock\n * @section Icons\n * @markup\n *  <i class=\"icon-clock\"></i>\n */\n.icon-clock:before {\n  content: \"\\f017\"; }\n\n/**\n * Ask a Librarian\n *\n * @atom .icon-comment-dots\n * @section Icons\n * @markup\n *  <i class=\"icon-comment-dots\"></i>\n */\n.icon-comment-dots:before {\n  content: \"\\f4ad\"; }\n\n/**\n * Account / MyAccount\n *\n * @atom .icon-user-circle\n * @section Icons\n * @markup\n *  <i class=\"icon-user-circle\"></i>\n */\n.icon-user-circle:before {\n  content: \"\\f2bd\"; }\n\n/**\n * Alert (appears in navbar)\n *\n * @atom .icon-bell\n * @section Icons\n * @markup\n *  <i class=\"icon-bell\"></i>\n */\n.icon-bell:before {\n  content: \"\\f0f3\"; }\n\n/**\n * Return to top\n *\n * @atom .icon-chevron-circle-up\n * @section Icons\n * @markup\n *  <i class=\"icon-chevron-circle-up\"></i>\n */\n.icon-chevron-circle-up:before {\n  content: \"\\f139\"; }\n\n/**\n * Search\n *\n * @atom .icon-search\n * @section Icons\n * @markup\n *  <i class=\"icon-search\"></i>\n */\n.icon-search:before {\n  content: \"\\f002\"; }\n\n/**\n * Status Available / Conformation\n *\n * @atom .icon-check\n * @section Icons\n * @markup\n *  <i class=\"icon-check\"></i>\n */\n.icon-check:before {\n  content: \"\\f00c\"; }\n\n/**\n * External Link\n *\n * @atom .icon-external-link-alt\n * @section Icons\n * @markup\n *  <i class=\"icon-external-link-alt\"></i>\n */\n.icon-external-link-alt:before {\n  content: \"\\f35d\"; }\n\n/**\n * Image Expand\n *\n * @atom .icon-search-plus\n * @section Icons\n * @markup\n *  <i class=\"icon-search-plus\"></i>\n */\n.icon-search-plus:before {\n  content: \"\\f00e\"; }\n\n/**\n * Course Reserves\n *\n * @atom .icon-university\n * @section Icons\n * @markup\n *  <i class=\"icon-university\"></i>\n */\n.icon-university:before {\n  content: \"\\f19c\"; }\n\n/**\n * Accordion Expand\n *\n * @atom .icon-plus\n * @section Icons\n * @markup\n *  <i class=\"icon-plus\"></i>\n */\n.icon-plus:before {\n  content: \"\\f067\"; }\n\n/**\n * Accordion Collapse\n *\n * @atom .icon-minus\n * @section Icons\n * @markup\n *  <i class=\"icon-minus\"></i>\n */\n.icon-minus:before {\n  content: \"\\f068\"; }\n\n/**\n * Drop Down Menu up\n *\n * @atom .icon-caret-up\n * @section Icons\n * @markup\n *  <i class=\"icon-caret-up\"></i>\n */\n.icon-caret-up:before {\n  content: \"\\f0d8\"; }\n\n/**\n * Drop Down Menu down \n *\n * @atom .icon-caret-down\n * @section Icons\n * @markup\n *  <i class=\"icon-caret-down\"></i>\n */\n.icon-caret-down:before {\n  content: \"\\f0d7\"; }\n\n/**\n * Cite\n *\n * @atom .icon-quote-right\n * @section Icons\n * @markup\n *  <i class=\"icon-quote-right\"></i>\n */\n.icon-quote-right:before {\n  content: \"\\f10e\"; }\n\n/**\n * Print\n *\n * @atom .icon-print\n * @section Icons\n * @markup\n *  <i class=\"icon-print\"></i>\n */\n.icon-print:before {\n  content: \"\\f02f\"; }\n\n/**\n * Copy\n *\n * @atom .icon-copy\n * @section Icons\n * @markup\n *  <i class=\"icon-copy\"></i>\n */\n.icon-copy:before {\n  content: \"\\f0c5\"; }\n\n/**\n * Edit\n *\n * @atom .icon-edit\n * @section Icons\n * @markup\n *  <i class=\"icon-edit\"></i>\n */\n.icon-edit:before {\n  content: \"\\f044\"; }\n\n/**\n * Delete\n *\n * @atom .icon-trash-alt\n * @section Icons\n * @markup\n *  <i class=\"icon-trash-alt\"></i>\n */\n.icon-trash-alt:before {\n  content: \"\\f2ed\"; }\n\n/**\n * Download\n *\n * @atom .icon-download\n * @section Icons\n * @markup\n *  <i class=\"icon-download\"></i>\n */\n.icon-download:before {\n  content: \"\\f019\"; }\n\n/**\n * Calendar \n *\n * @atom .icon-calendar-alt\n * @section Icons\n * @markup\n *  <i class=\"icon-calendar-alt\"></i>\n */\n.icon-calendar-alt:before {\n  content: \"\\f073\"; }\n\n/**\n * PDF \n *\n * @atom .icon-file-pdf\n * @section Icons\n * @markup\n *  <i class=\"icon-file-pdf\"></i>\n */\n.icon-file-pdf:before {\n  content: \"\\f1c1\"; }\n\n/**\n * Facebook\n *\n * @atom .icon-facebook-square\n * @section Icons\n * @markup\n *  <i class=\"icon-facebook-square\"></i>\n */\n.icon-facebook-square:before {\n  content: \"\\f082\"; }\n\n/**\n * Instagram\n *\n * @atom .icon-instagram\n * @section Icons\n * @markup\n *  <i class=\"icon-instagram\"></i>\n */\n.icon-instagram:before {\n  content: \"\\f16d\"; }\n\n/**\n * Twitter\n *\n * @atom .icon-twitter-square\n * @section Icons\n * @markup\n *  <i class=\"icon-twitter-square\"></i>\n */\n.icon-twitter-square:before {\n  content: \"\\f081\"; }\n\n/**\n * Vimeo\n *\n * @atom .icon-vimeo\n * @section Icons\n * @markup\n *  <i class=\"icon-vimeo\"></i>\n */\n.icon-vimeo:before {\n  content: \"\\f40a\"; }\n\n/**\n * Youtube\n *\n * @atom .icon-youtube\n * @section Icons\n * @markup\n *  <i class=\"icon-youtube\"></i>\n */\n.icon-youtube:before {\n  content: \"\\f167\"; }\n\n/**\n * Email\n *\n * @atom .icon-envelope\n * @section Icons\n * @markup\n *  <i class=\"icon-envelope\"></i>\n */\n.icon-envelope:before {\n  content: \"\\f0e0\"; }\n\n/**\n * Bookmark\n *\n * @atom .icon-bookmark\n * @section Icons\n * @markup\n *  <i class=\"icon-bookmark\"></i>\n */\n.icon-bookmark:before {\n  content: \"\\f02e\"; }\n\n/**\n * Close Window / Close Dialog\n *\n * @atom .icon-window-close\n * @section Icons\n * @markup\n *  <i class=\"icon-window-close\"></i>\n */\n.icon-window-close-regular:before {\n  content: \"\\f2d3\"; }\n\n/**\n * Remove Search Criteria\n *\n * @atom .icon-x-circle\n * @section Icons\n * @markup\n *  <i class=\"icon-x-circle\"></i>\n */\n.icon-times-circle:before {\n  content: \"\\f057\"; }\n\n/**\n * Add Criteria\n * \n * @atom .icon-plus-circle\n * @section Icons\n * @markup\n *  <i class=\"icon-plus-circle\"></i>\n */\n.icon-plus-circle:before {\n  content: \"\\f055\"; }\n\n/**\n * Refresh Page / Reload / Reset\n * @atom .icon-redo-alt\n * @section Icons\n * @markup\n *  <i class=\"icon-redo-alt\"></i>\n */\n.icon-redo-alt:before {\n  content: \"\\f2f9\"; }\n\n/**\n * Slide Left (on page)\n *\n * @atom .icon-chevron-double-left\n * @section Icons\n * @markup\n *  <i class=\"icon-chevron-double-left\"></i>\n */\n.icon-chevron-double-left:before {\n  content: \"\\f323\"; }\n\n/**\n * Slide Right (on page)\n *\n * @atom .icon-chevron-double-right\n * @section Icons\n * @markup\n *  <i class=\"icon-chevron-double-right\"></i>\n */\n.icon-chevron-double-right:before {\n  content: \"\\f324\"; }\n\n/**\n * Page Forward\n *\n * @atom .icon-arrow-right\n * @section Icons\n * @markup\n *  <i class=\"icon-arrow-right\"></i>\n */\n.icon-arrow-right:before {\n  content: \"\\f178\"; }\n\n/**\n * Page Back\n *\n * @atom .icon-arrow-left\n * @section Icons\n * @markup\n *  <i class=\"icon-arrow-left\"></i>\n */\n.icon-arrow-left:before {\n  content: \"\\f177\"; }\n\n/**\n * Special Selected / Preferred\n *\n * @atom .icon-star\n * @section Icons\n * @markup\n *  <i class=\"icon-star\"></i>\n */\n.icon-star:before {\n  content: \"\\f005\"; }\n\n/* common scsss variables for V4 client */\n/* small media width */\n/* spacing unit of measure */\n:host {\n  display: none;\n  /*block;*/\n  text-align: left;\n  visibility: visible;\n  font-family: \"franklin-gothic-urw\", arial, sans-serif;\n  font-weight: 400;\n  font-style: normal;\n  font-size: 16px;\n  line-height: calc($uvalib-main-font-size-unit*1.25);\n  color: #595959; }\n\n[hidden] {\n  display: none; }\n\n.alert-item {\n  min-height: 41px;\n  background-color: #ECC602;\n  border-width: 2px 0 0 0;\n  border-color: #FFF;\n  border-style: solid;\n  color: #2B2B2B;\n  display: flex;\n  flex-direction: row;\n  justify-content: center; }\n\n.alert-item div {\n  width: 100%;\n  max-width: 1200px;\n  padding: .15em; }\n\n.alert-item.alert1 {\n  background-color: #B30000;\n  color: #FFF; }\n\n.alert-item.alert2 {\n  background-color: #ECC602; }\n\n.alert-item.alert3 {\n  background-color: #FEF6C8;\n  color: #000; }\n\n.alert-item.alert1 p a {\n  text-decoration: underline;\n  color: #FFF; }\n\n.alert-item.alert3 p a {\n  text-decoration: underline; }\n\n.alert-item.alert1 p a:hover, .alert-item.alert2 p a:hover, .alert-item.alert3 p a:hover {\n  font-style: italic; }\n\n.alert-item.alert1 p a:focus, .alert-item.alert2 p a:focus, .alert-item.alert3 p a:focus {\n  outline: #BDBDBD dotted 3px;\n  padding: .15em; }\n\n.alert-item.alert3 uvalib-button::part(button) {\n  color: #000;\n  border-color: #B99C02; }\n\n.alert-item.alert3 uvalib-button:hover::part(button) {\n  background-color: #ECC602; }\n\n.alert-item.alert1 .alert-head:before, .alert-item.alert2 .alert-head:before {\n  font-family: \"Font Awesome 5 Free\";\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n  display: inline-block;\n  font-style: normal;\n  font-variant: normal;\n  text-rendering: auto;\n  text-transform: none;\n  line-height: 1;\n  font-weight: 900;\n  speak: none;\n  content: \"\\f06a\";\n  font-size: 2em;\n  padding-right: .25em; }\n\n.alert-head {\n  display: flex;\n  flex-direction: row; }\n\n.alert-title {\n  flex: 1;\n  flex-basis: 0.000000001px; }\n\n[slot=\"markdown-html\"] p {\n  margin: 0;\n  padding: 0; }\n\nuvalib-button {\n  color: #2B2B2B;\n  position: static;\n  z-index: auto; }\n\nuvalib-button:visited, uvalib-button:focus, uvalib-button:hover, uvalib-button:active {\n  font-weight: normal; }\n\nuvalib-button::part(button) {\n  text-transform: uppercase;\n  border: 1px solid #DADADA;\n  color: #2B2B2B;\n  background-color: inherit; }\n\n.alert-item.alert2 uvalib-button:hover::part(button) {\n  background-color: #B99C02;\n  color: #000; }\n\n/*********************************************/\n/*      CURRENT ALERT STYLING 11/2020        */\n/*********************************************/\n.uva-alert {\n  font-size: 1.06rem;\n  line-height: 1.5;\n  padding: 1.25rem 1.25rem 1rem 1.75rem;\n  position: relative;\n  color: #2B2B2B;\n  /* margin-bottom: 1em; */ }\n\n.uva-alert--a1 {\n  background-color: #FBCFDA;\n  border-left: 8px solid #DF1E43; }\n\n.uva-alert--a1::before {\n  content: \"\\f06a\";\n  font-family: \"Font Awesome 5 Pro\";\n  font-weight: 900;\n  font-size: 1.5em;\n  display: table-cell; }\n\n.uva-alert--a2 {\n  background-color: #FEF6C8;\n  border-left: 8px solid #ECC602; }\n\n.uva-alert--a2::before {\n  content: \"\\f071\";\n  font-family: \"Font Awesome 5 Pro\";\n  font-weight: 900;\n  font-size: 1.5em;\n  display: table-cell; }\n\n.uva-alert--a3 {\n  background-color: #BFE7F7;\n  border-left: 8px solid #007BAC; }\n\n.uva-alert--a3::before {\n  content: \"\\f05a\";\n  font-family: \"Font Awesome 5 Pro\";\n  font-weight: 900;\n  font-size: 1.5em;\n  display: table-cell; }\n\n.uva-alert--dismissable a.uva-alert--close {\n  font-size: 1.5em;\n  display: table-cell;\n  position: absolute;\n  top: .25em;\n  right: .45em;\n  text-decoration: none;\n  color: #2B2B2B; }\n\n.uva-alert--r1, .uva-alert--r2 {\n  border: 0.2em solid var(--alert-border-color);\n  border-radius: 0.5em; }\n\n.uva-alert--r1 {\n  background-color: #FEF6C8;\n  --alert-border-color: $uvalib-alert-r1-border; }\n\n.uva-alert--r2 {\n  background-color: #C8F2F4;\n  --alert-border-color: $uvalib-alert-r2-border; }\n\n.uva-alert--error, .uva-alert--confirmation {\n  margin: 0;\n  padding: 0; }\n\n.uva-alert--error {\n  color: #B30000; }\n\n.uva-alert--confirmation {\n  color: #4E9737; }\n\n.uva-alert__heading {\n  font-size: 1.33rem;\n  line-height: 1.1;\n  margin-top: 0;\n  margin-bottom: .5rem; }\n\n.uva-alert__body {\n  padding-left: 1.25rem;\n  display: table-cell;\n  vertical-align: top; }\n\n.uva-alert__text {\n  margin-bottom: 0;\n  margin-top: 0; }\n\n.uva-alert--a4 {\n  background-color: #25CAD3;\n  text-align: center; }\n\n.uva-alert--a4 .uva-alert__body {\n  display: inline-block;\n  padding-left: 1.25rem; }\n\n.uva-alert--a4 .uva-alert__body .uva-alert__text a {\n  color: #141E3C; }\n\n/* ALERT STYLING END */\n";

import('./fonts-ac694799.js');
import('./icons-1579a6d1.js');

// setup constructed style sheet
const uvalibAlertsStyles = new CSSStyleSheet();
uvalibAlertsStyles.replaceSync(css_248z);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, uvalibAlertsStyles];

class UvalibAlerts extends HTMLElement {

  // listen to these attributes for override info
  static get observedAttributes() {
    return ['override','alerts'];
  }

  // getters/setters properties for override info
  get override() {return !!(this._override);}
  set override(newOverride) {this._override = !!(newOverride); console.log("override set " +this.override);}
  get alerts() {return this._alerts;}
  set alerts(newAlerts) {
    this._alerts = (Array.isArray(newAlerts))? newAlerts:[];
    this._updateAlerts(this._alerts);
  }

  // attribute values
  attributeChangedCallback(name, oldValue, newValue) {
    switch(name){
      case "override":
        this.override = newValue===""? true:false;
        break;
      case "alerts":
        this.alerts = JSON.parse(newValue);
        break;
    }
  }

  constructor() {
    // Always call super first in constructor
    super();
    this._setupDom();
  }

  // attributes should be parsed by the time connected callback is called
  connectedCallback() {
    if (!this.override) 
      this._setupAlertsModel();
  }

  _setupAlertsModel(){
    import ('./debounce-9d40488e.js').then(function (n) { return n.d; }).then(function(debounce){    
      import('./uvalib-model-alerts-c8bd2419.js').then(function(){
        this._alertsModel = document.createElement('uvalib-model-alerts');
        this._alertsModel.addEventListener('seen-count-changed',debounce.default(function(e){
console.log("seen count changed");                  
          const count = (e.detail && e.detail.seenCount)? parseInt(e.detail.seenCount):0;
          this.seenCount = count;
          this.setAttribute('seen-count', count);
          this._alertsSeen = this._alertsModel.seen;
//          this._updateAlerts(this._alertsModel.alerts);
        }.bind(this),300).bind(this));
        this._alertsModel.addEventListener('alerts-changed',debounce.default(function(e){
console.log("alerts changed");          
          this._alertsSeen = this._alertsModel.seen;
          this._updateAlerts(this._alertsModel.alerts);
        }.bind(this),300).bind(this));
        this._alertsModel.setAttribute('auto',"");
        this.shadow.appendChild(this._alertsModel);
      }.bind(this));
    }.bind(this));    
  }

  _updateAlerts(alerts){
    if (Array.isArray(alerts) && alerts.length>0) {
      alerts = alerts.filter(alert=>{return this._getLevelCode(alert.severity)!==""}); // filter out any alerts that are not a1,a2,a3  
    }
    if (Array.isArray(alerts) && alerts.length>0) {
      this._setupStyle();
      var newContainer = document.createElement('div');          
      const atemp = alerts.filter(function(alert){ return (this._alertsSeen)? !this._alertsSeen.includes(alert.uuid):true; }.bind(this))
            .sort((a,b)=>(a.severity > b.severity)? 1:-1);
      if (atemp.length > 0) {  
        var importPromises = [];
        importPromises.push(import ('./uvalib-button-41de77e0.js'));
        Promise.all(importPromises).then(function(imports) {       
            atemp.forEach(function(alert){ this._addAlert(newContainer, alert); }.bind(this));
        }.bind(this));
      }
      this.shadow.replaceChild(newContainer, this._alertsContainer);
      this._alertsContainer = newContainer;
    } else {
      this._alertsContainer.innerHTML = "";
    }
  }

  _getLevelCode(severity){
    return (severity === "alert1")? "a1":
           (severity === "alert2")? "a2":
           (severity === "alert3")? "a3":
           "";
  }

  _addAlert(newContainer, alert){
    var node = document.createElement('div');
    node.innerHTML = `
    <div class="uva-alert uva-alert--${this._getLevelCode(alert.severity)} ${this._isHot(alert.severity)? "":"uva-alert--dismissable"}" uuid="${alert.uuid}" data-title="${alert.title}">
      <div class="uva-alert__body">
        <h3 class="uva-alert__heading">${alert.title}</h3>
        <p class="uva-alert__text">${alert.body}</p>
        <a href="#" class="dismissButton uva-alert--close" ${this._isHot(alert.severity)? "hidden":""}><i class="icon-window-close-regular"></i></a>
      </div>
    </div>      
    `;
    node.querySelector('.dismissButton').addEventListener('click',this._dismissIt.bind(this));

    newContainer.appendChild(node);
    this.style.display = "block";
  }

  _setupStyle(){    
    this.shadow.adoptedStyleSheets = [uvalibAlertsStyles];
// todo: attempt to only load constructed styles if called (we have alerts) 
// this was causing an error in Safari
//    if (!document.uvalibSheetLoaded) {
//      import('./uvalib-alerts.scss').then(function(style){
//        sheet.replace(style.default).then(function(){
//          document.uvalibSheetLoaded=true;
//          if (document.adoptedStyleSheets)
//            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
//          else document.adoptedStyleSheets = [sheet];
//          this.shadow.adoptedStyleSheets = [sheet];
//        }.bind(this));
//      }.bind(this));
//    }
  };
  _setupDom(){
    // setup a shadowDOM
    this.shadow = this.attachShadow({mode: 'open'});
    // and a place to stash the alerts
    this._alertsContainer = document.createElement('div');
    this.shadow.appendChild(this._alertsContainer);
  }
  _sizeChanged(){
    this.dispatchEvent(new CustomEvent('size-changed', {detail: {height: this.clientHeight}}));
  }
  _isHot(severity){
    return (severity==="alert1");
  }
  _dismissIt(e){
    e.preventDefault();    
    var uuid = e.currentTarget.parentElement.parentElement.getAttribute('uuid');
    // alert analytics that we have a view dismissed alerts event
    this.dispatchEvent(new CustomEvent('uvalib-analytics-event', {bubbles: true, composed: true, detail: {track:['alert','dismissed',e.currentTarget.parentElement.parentElement.dataset.title]}}));
    this._alertsModel.setSeen(uuid);
  } 
  unseeAll(){
    // alert analytics that we have a request to unseen all events (show them as not dismissed again)
    const l = this._alertsModel.seen.length;
    this.dispatchEvent(new CustomEvent('uvalib-analytics-event', {bubbles: true, composed: true, detail: {track:['alerts','unseeAll',l ]}}));
    this._alertsModel.setAllUnSeen();
  }
}

window.customElements.define('uvalib-alerts', UvalibAlerts);

class UvalibAlertsLevel4 extends UvalibAlerts {

  _setupAlertsModel(){
    import ('./debounce-9d40488e.js').then(function (n) { return n.d; }).then(function(debounce){    
      import('./uvalib-model-alerts-c8bd2419.js').then(function(){       
        this._alertsModel = document.createElement('uvalib-model-alerts');
        this._alertsModel.addEventListener('alerts-changed',debounce.default(function(e){
          if (Array.isArray(this._alertsModel.data)) {

            this.alert = this._alertsModel.data.filter(alert => alert.severity==="alert4");
            if (this.alert) this._updateAlerts(this.alert);
          }
        }.bind(this),300).bind(this));
        this._alertsModel.setAttribute('auto',"");
        this.shadow.appendChild(this._alertsModel);
      }.bind(this));
    }.bind(this));
  }

  _updateAlerts(alerts){
    if (Array.isArray(alerts) && alerts.length>0) {
      this._setupStyle();
      var newContainer = document.createElement('div');          
      this._addAlert(newContainer, alerts[0]);
      this.shadow.replaceChild(newContainer, this._alertsContainer);
      this._alertsContainer = newContainer;
    } else {
      this._alertsContainer.innerHTML = "";
    }
  }

  _addAlert(newContainer, alert){
    var node = document.createElement('div');
    node.innerHTML = `
      <div class="uva-alert uva-alert--a4" uuid="${alert.uuid}">
        <div class=""uva-alert__body">
          <h3 class="uva-alert__heading">${alert.title}</h3>
          <p class="uva-alert__text">${alert.body}</p>
        </div>
      </div>
    `;
    newContainer.appendChild(node);
    this.style.display = "block";
  }
}

window.customElements.define('uvalib-alerts-level4', UvalibAlertsLevel4);
