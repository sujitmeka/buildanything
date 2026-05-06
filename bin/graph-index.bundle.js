#!/usr/bin/env tsx
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target2) => (target2 = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target2, "default", { value: mod, enumerable: true }) : target2,
  mod
));

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports2) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports2.ALIAS = ALIAS;
    exports2.DOC = DOC;
    exports2.MAP = MAP;
    exports2.NODE_TYPE = NODE_TYPE;
    exports2.PAIR = PAIR;
    exports2.SCALAR = SCALAR;
    exports2.SEQ = SEQ;
    exports2.hasAnchor = hasAnchor;
    exports2.isAlias = isAlias;
    exports2.isCollection = isCollection;
    exports2.isDocument = isDocument;
    exports2.isMap = isMap;
    exports2.isNode = isNode;
    exports2.isPair = isPair;
    exports2.isScalar = isScalar;
    exports2.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports2.visit = visit;
    exports2.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports2.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports2.anchorIsValid = anchorIsValid;
    exports2.anchorNames = anchorNames;
    exports2.createNodeAnchors = createNodeAnchors;
    exports2.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports2) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports2.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports2.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports2) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports2.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports2.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports2.Scalar = Scalar;
    exports2.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports2.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports2.Collection = Collection;
    exports2.collectionFromPath = collectionFromPath;
    exports2.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports2) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports2.indentComment = indentComment;
    exports2.lineComment = lineComment;
    exports2.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports2) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports2.FOLD_BLOCK = FOLD_BLOCK;
    exports2.FOLD_FLOW = FOLD_FLOW;
    exports2.FOLD_QUOTED = FOLD_QUOTED;
    exports2.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports2.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports2.createStringifyContext = createStringifyContext;
    exports2.stringify = stringify;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports2.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports2) {
    "use strict";
    var node_process = require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports2.debug = debug;
    exports2.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      value = ctx && identity.isAlias(value) ? value.resolve(ctx.doc) : value;
      if (identity.isSeq(value))
        for (const it of value.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(value))
        for (const it of value)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, value);
    }
    function mergeValue(ctx, map, value) {
      const source = ctx && identity.isAlias(value) ? value.resolve(ctx.doc) : value;
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    exports2.addMergeToJSMap = addMergeToJSMap;
    exports2.isMergeKey = isMergeKey;
    exports2.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports2) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports2.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports2.Pair = Pair;
    exports2.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports2.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports2) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports2.YAMLMap = YAMLMap;
    exports2.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports2.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports2.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports2.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports2) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports2.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports2.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports2.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports2) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^\d/.test(n)) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports2.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports2.int = int;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports2.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports2.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports2) {
    "use strict";
    var node_buffer = require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports2.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports2.createPairs = createPairs;
    exports2.pairs = pairs;
    exports2.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports2.YAMLOMap = YAMLOMap;
    exports2.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports2.falseTag = falseTag;
    exports2.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports2.int = int;
    exports2.intBin = intBin;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports2.YAMLSet = YAMLSet;
    exports2.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports2.floatTime = floatTime;
    exports2.intTime = intTime;
    exports2.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports2.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports2.coreKnownTags = coreKnownTags;
    exports2.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports2.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports2.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports2.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports2) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports2.YAMLError = YAMLError;
    exports2.YAMLParseError = YAMLParseError;
    exports2.YAMLWarning = YAMLWarning;
    exports2.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports2) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports2.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports2) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports2.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports2) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports2.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports2.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports2) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports2.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports2) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports2.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports2) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports2.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports2.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports2.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines7(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines7(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports2.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + match[1];
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = { x: 2, u: 4, U: 8 }[next];
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      if (isNaN(code)) {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
      return String.fromCodePoint(code);
    }
    exports2.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports2.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports2) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports2.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports2.composeEmptyNode = composeEmptyNode;
    exports2.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports2) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports2.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          Array.prototype.push.apply(doc.errors, this.errors);
          Array.prototype.push.apply(doc.warnings, this.warnings);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports2.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports2) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports2.createScalarToken = createScalarToken;
    exports2.resolveAsScalar = resolveAsScalar;
    exports2.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports2) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports2.stringify = stringify;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports2) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports2.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports2) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports2.createScalarToken = cstScalar.createScalarToken;
    exports2.resolveAsScalar = cstScalar.resolveAsScalar;
    exports2.setScalarValue = cstScalar.setScalarValue;
    exports2.stringify = cstStringify.stringify;
    exports2.visit = cstVisit.visit;
    exports2.BOM = BOM;
    exports2.DOCUMENT = DOCUMENT;
    exports2.FLOW_END = FLOW_END;
    exports2.SCALAR = SCALAR;
    exports2.isCollection = isCollection;
    exports2.isScalar = isScalar;
    exports2.prettyToken = prettyToken;
    exports2.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports2) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return yield* this.parseBlockStart();
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        switch (this.charAt(0)) {
          case "!":
            return (yield* this.pushTag()) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
          case "&":
            return (yield* this.pushUntil(isNotAnchorChar)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
          case "-":
          // this is an error
          case "?":
          // this is an error outside flow collections
          case ":": {
            const inFlow = this.flowLevel > 0;
            const ch1 = this.charAt(1);
            if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
              if (!inFlow)
                this.indentNext = this.indentValue + 1;
              else if (this.flowKey)
                this.flowKey = false;
              return (yield* this.pushCount(1)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
            }
          }
        }
        return 0;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports2.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports2) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports2.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                Array.prototype.push.apply(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              Array.prototype.push.apply(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  Array.prototype.push.apply(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  Array.prototype.push.apply(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports2.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports2.parse = parse;
    exports2.parseAllDocuments = parseAllDocuments;
    exports2.parseDocument = parseDocument;
    exports2.stringify = stringify;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports2.Composer = composer.Composer;
    exports2.Document = Document.Document;
    exports2.Schema = Schema.Schema;
    exports2.YAMLError = errors.YAMLError;
    exports2.YAMLParseError = errors.YAMLParseError;
    exports2.YAMLWarning = errors.YAMLWarning;
    exports2.Alias = Alias.Alias;
    exports2.isAlias = identity.isAlias;
    exports2.isCollection = identity.isCollection;
    exports2.isDocument = identity.isDocument;
    exports2.isMap = identity.isMap;
    exports2.isNode = identity.isNode;
    exports2.isPair = identity.isPair;
    exports2.isScalar = identity.isScalar;
    exports2.isSeq = identity.isSeq;
    exports2.Pair = Pair.Pair;
    exports2.Scalar = Scalar.Scalar;
    exports2.YAMLMap = YAMLMap.YAMLMap;
    exports2.YAMLSeq = YAMLSeq.YAMLSeq;
    exports2.CST = cst;
    exports2.Lexer = lexer.Lexer;
    exports2.LineCounter = lineCounter.LineCounter;
    exports2.Parser = parser.Parser;
    exports2.parse = publicApi.parse;
    exports2.parseAllDocuments = publicApi.parseAllDocuments;
    exports2.parseDocument = publicApi.parseDocument;
    exports2.stringify = publicApi.stringify;
    exports2.visit = visit.visit;
    exports2.visitAsync = visit.visitAsync;
  }
});

// bin/graph-index.ts
var import_node_fs2 = require("node:fs");
var import_node_path2 = require("node:path");
var import_node_crypto3 = require("node:crypto");
var import_node_process = __toESM(require("node:process"));

// src/graph/ids.ts
var import_node_crypto = require("node:crypto");
var KEBAB_REPLACE = /[^a-z0-9]+/g;
var KEBAB_TRIM = /^-+|-+$/g;
function kebab(input) {
  return input.toLowerCase().replace(KEBAB_REPLACE, "-").replace(KEBAB_TRIM, "");
}
function normalizeForHash(input) {
  return input.trim().replace(/\s+/g, " ");
}
function sha256_8(input) {
  return (0, import_node_crypto.createHash)("sha256").update(normalizeForHash(input)).digest("hex").slice(0, 8);
}
function sha256Hex(input) {
  return (0, import_node_crypto.createHash)("sha256").update(input).digest("hex");
}
var ids = {
  feature: (name) => `feature__${kebab(name)}`,
  screen: (name) => `screen__${kebab(name)}`,
  state: (featureName, stateName) => `state__${kebab(featureName)}__${kebab(stateName)}`,
  transition: (featureName, fromState, toState) => `transition__${kebab(featureName)}__${kebab(fromState)}__${kebab(toState)}`,
  businessRule: (featureName, text) => `rule__${kebab(featureName)}__${sha256_8(text)}`,
  failureMode: (featureName, trigger) => `failure__${kebab(featureName)}__${sha256_8(trigger)}`,
  acceptanceCriterion: (featureName, text) => `accept__${kebab(featureName)}__${sha256_8(text)}`,
  persona: (label) => `persona__${kebab(label)}`,
  personaConstraint: (featureName, text) => `pconstraint__${kebab(featureName)}__${sha256_8(text)}`,
  // Slice 2 additions. Source of truth: docs/graph/05-slice2-schema.md.
  designDocRoot: () => "design_md__root",
  dnaAxis: (axisName) => `dna_axis__${kebab(axisName)}`,
  dnaGuideline: (polarity, text) => `dna_guideline__${polarity}__${sha256_8(text)}`,
  brandReference: (urlOrLabel) => `brand_reference__${sha256_8(urlOrLabel)}`,
  manifestEntry: (slot) => `manifest_entry__${kebab(slot)}`,
  componentSlot: (slot) => `slot__${kebab(slot)}`,
  // Slice 3 additions. Source of truth: docs/graph/07-slice3-schema.md.
  token: (layer, name) => `token__${kebab(layer)}__${kebab(name)}`,
  pageSpec: (screenName) => `page_spec__${kebab(screenName)}`,
  wireframeSection: (screenName, sectionName, order) => `wireframe_section__${kebab(screenName)}__${kebab(sectionName)}__${order}`,
  screenStateSlot: (screenName, stateName) => `screen_state_slot__${kebab(screenName)}__${kebab(stateName)}`,
  screenComponentUse: (screenName, slot, position) => `screen_component_use__${kebab(screenName)}__${kebab(slot)}__${kebab(position)}`,
  keyCopy: (screenName, text) => `key_copy__${kebab(screenName)}__${sha256_8(text)}`,
  // Slice 4 additions. Source of truth: docs/graph/09-slice4-schema.md.
  architectureModule: (name) => `module__${kebab(name)}`,
  apiContract: (endpoint) => `api_contract__${kebab(endpoint)}`,
  dataModel: (entityName) => `data_model__${kebab(entityName)}`,
  task: (taskId) => `task__${kebab(taskId)}`,
  decision: (decisionId) => `decision__${kebab(decisionId)}`,
  // Slice 5 additions. Source of truth: docs/graph/11-slice5-schema.md.
  screenshot: (basenameKebab, contentSha256First8) => `screenshot__${basenameKebab}__${contentSha256First8}`,
  imageComponentDetection: (screenshotId, label, order) => `image_component_detection__${screenshotId.replace(/^screenshot__/, "")}__${kebab(label)}__${order}`,
  dogfoodFinding: (findingId) => `dogfood_finding__${kebab(findingId)}`,
  brandDriftObservation: (observationId) => `brand_drift_observation__${kebab(observationId)}`
};

// src/graph/parser/product-spec.ts
var PRODUCED_BY = "product-spec-writer";
var PRODUCED_AT_STEP = "1.6";
var META_STATE_NAMES = /* @__PURE__ */ new Set([
  "loading",
  "empty",
  "error",
  "stale",
  "offline",
  "disabled",
  "permission-denied"
]);
function loc(line) {
  return `L${line}`;
}
function pushError(ctx, line, message) {
  ctx.errors.push({ line, message });
}
function splitLines(content) {
  const raw = content.split(/\r?\n/);
  return raw.map((text, i) => ({ n: i + 1, text }));
}
function partitionSections(lines, level, start, end) {
  const sections = [];
  const headingPrefix = "#".repeat(level) + " ";
  let i = start;
  while (i < end) {
    const line = lines[i];
    if (isHeadingAtLevel(line.text, level)) {
      const heading = line.text.slice(headingPrefix.length).trim();
      const bodyStart = i + 1;
      let j = bodyStart;
      while (j < end && !isHeadingAtOrAbove(lines[j].text, level)) j++;
      sections.push({
        heading,
        level,
        startLine: line.n,
        bodyLines: lines.slice(bodyStart, j)
      });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}
function isHeadingAtLevel(text, level) {
  const prefix = "#".repeat(level) + " ";
  if (!text.startsWith(prefix)) return false;
  return text[level] !== "#";
}
function isHeadingAtOrAbove(text, level) {
  for (let l = 1; l <= level; l++) {
    if (isHeadingAtLevel(text, l)) return true;
  }
  return false;
}
function parseTable(body) {
  const sepRe = /^\s*\|?\s*[-:| ]+\s*\|?\s*$/;
  const significant = body.filter((l) => l.text.trim().length > 0);
  let headerIdx = -1;
  for (let i = 0; i < significant.length - 1; i++) {
    if (significant[i].text.includes("|") && significant[i + 1].text.includes("|") && sepRe.test(significant[i + 1].text)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return null;
  const headerLine = significant[headerIdx];
  const headers = splitRow(headerLine.text).map((h) => h.toLowerCase());
  const rows = [];
  for (let i = headerIdx + 2; i < significant.length; i++) {
    const ln = significant[i];
    if (!ln.text.includes("|")) break;
    const cells = splitRow(ln.text);
    if (cells.length === 0) continue;
    const row = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = (cells[c] ?? "").trim();
    }
    rows.push({ cells: row, line: ln.n });
  }
  return { headers, rows };
}
function splitRow(text) {
  let s = text.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}
function parsePersonas(ctx, section) {
  const table = parseTable(section.bodyLines);
  if (!table) {
    pushError(ctx, section.startLine, "App Overview: persona table not found or malformed");
    return;
  }
  const required = ["persona", "role", "primary jtbd", "relationship to other personas"];
  for (const r of required) {
    if (!table.headers.includes(r)) {
      pushError(
        ctx,
        section.startLine,
        `App Overview: persona table missing required column "${r}"`
      );
      return;
    }
  }
  if (table.rows.length < 1) {
    pushError(ctx, section.startLine, "App Overview: persona table has zero rows");
    return;
  }
  let primaryCount = 0;
  for (const row of table.rows) {
    const rawName = row.cells["persona"] ?? "";
    if (!rawName) {
      pushError(ctx, row.line, "Persona row missing name");
      continue;
    }
    const isPrimary = /\(primary\)/i.test(rawName);
    if (isPrimary) primaryCount++;
    const cleanLabel = rawName.replace(/\(primary\)/gi, "").trim();
    const role = row.cells["role"] ?? "";
    const jtbd = row.cells["primary jtbd"] ?? "";
    const relationship = row.cells["relationship to other personas"] ?? "";
    if (!role || !jtbd) {
      pushError(ctx, row.line, `Persona "${cleanLabel}" missing role or JTBD`);
      continue;
    }
    const node = {
      id: ids.persona(cleanLabel),
      label: cleanLabel,
      entity_type: "persona",
      source_file: ctx.mdPath,
      source_location: loc(row.line),
      confidence: "EXTRACTED",
      description: relationship,
      role,
      is_primary: isPrimary,
      primary_jtbd: jtbd
    };
    ctx.nodes.push(node);
    ctx.personasByKey.set(cleanLabel.toLowerCase(), node);
  }
  if (primaryCount !== 1) {
    pushError(
      ctx,
      section.startLine,
      `App Overview: expected exactly one (primary) persona, found ${primaryCount}`
    );
  }
}
function parseScreenInventory(ctx, section) {
  const table = parseTable(section.bodyLines);
  if (!table) {
    pushError(ctx, section.startLine, "Screen Inventory: table not found or malformed");
    return [];
  }
  const required = ["screen", "description", "features"];
  for (const r of required) {
    if (!table.headers.includes(r)) {
      pushError(
        ctx,
        section.startLine,
        `Screen Inventory: missing required column "${r}"`
      );
      return [];
    }
  }
  const out = [];
  for (const row of table.rows) {
    const rawName = row.cells["screen"] ?? "";
    const description = row.cells["description"] ?? "";
    const features = row.cells["features"] ?? "";
    if (!rawName) {
      pushError(ctx, row.line, "Screen Inventory: row missing screen name");
      continue;
    }
    const featureNames = features.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    const countMatch = rawName.match(/\((\d+)\s+screens?\)/i);
    const cleanName = rawName.replace(/\(\d+\s+screens?\)/i, "").trim();
    const count = countMatch ? Number.parseInt(countMatch[1], 10) : void 0;
    const node = {
      id: ids.screen(cleanName),
      label: cleanName,
      entity_type: "screen",
      source_file: ctx.mdPath,
      source_location: loc(row.line),
      confidence: "EXTRACTED",
      description,
      feature_ids: featureNames.map((f) => ids.feature(f)),
      ...count ? { count } : {}
    };
    ctx.nodes.push(node);
    out.push({ rawName: cleanName, description, featureNames });
    for (const fname of featureNames) {
      ctx.edges.push({
        source: ids.feature(fname),
        target: node.id,
        relation: "has_screen",
        confidence: "EXTRACTED",
        source_file: ctx.mdPath,
        source_location: loc(row.line),
        produced_by_agent: PRODUCED_BY,
        produced_at_step: PRODUCED_AT_STEP
      });
    }
  }
  return out;
}
function parseCrossFeature(ctx, section) {
  const arrow = /^\s*-\s+(.+?)\s*(?:→|->)\s*(.+?)\s*:\s*(.*)$/u;
  for (const line of section.bodyLines) {
    const m = line.text.match(arrow);
    if (!m) continue;
    const lhs = m[1].trim();
    const rhs = m[2].trim();
    const ruleText = m[3].trim() || void 0;
    const lhsFeature = lhs.replace(/\s*\([^)]*\)\s*$/u, "").trim();
    const rhsFeatureRaw = rhs.replace(/\s*\([^)]*\)\s*$/u, "").trim();
    const rhsFeatures = rhsFeatureRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    for (const target2 of rhsFeatures) {
      ctx.edges.push({
        source: ids.feature(lhsFeature),
        target: ids.feature(target2),
        relation: "depends_on",
        confidence: "EXTRACTED",
        source_file: ctx.mdPath,
        source_location: loc(line.n),
        produced_by_agent: PRODUCED_BY,
        produced_at_step: PRODUCED_AT_STEP,
        ...ruleText ? { label: ruleText } : {}
      });
    }
  }
}
function parseFeature(ctx, section) {
  const headingLabel = section.heading.replace(/^Feature:\s*/i, "").trim();
  if (!headingLabel) {
    pushError(ctx, section.startLine, "Feature heading missing name");
    return;
  }
  const featureNode = {
    id: ids.feature(headingLabel),
    label: headingLabel,
    entity_type: "feature",
    source_file: ctx.mdPath,
    source_location: loc(section.startLine),
    confidence: "EXTRACTED",
    name: headingLabel,
    kebab_anchor: kebab(headingLabel)
  };
  ctx.nodes.push(featureNode);
  const subSections = partitionSubsections(section.bodyLines);
  const stateNamesInOrder = [];
  for (const sub of subSections) {
    const lower = sub.heading.toLowerCase();
    if (lower === "states") {
      parseStates(ctx, featureNode, sub, stateNamesInOrder);
    } else if (lower === "transitions") {
      parseTransitions(ctx, featureNode, sub);
    } else if (lower === "business rules") {
      parseBusinessRules(ctx, featureNode, sub);
    } else if (lower === "failure modes") {
      parseFailureModes(ctx, featureNode, sub);
    } else if (lower === "acceptance criteria") {
      parseAcceptanceCriteria(ctx, featureNode, sub);
    } else if (lower === "persona constraints") {
      parsePersonaConstraints(ctx, featureNode, sub);
    }
  }
}
function partitionSubsections(body) {
  const sections = [];
  let i = 0;
  while (i < body.length) {
    const line = body[i];
    if (isHeadingAtLevel(line.text, 3)) {
      const heading = line.text.slice(4).trim();
      const start = i + 1;
      let j = start;
      while (j < body.length && !isHeadingAtOrAbove(body[j].text, 3)) j++;
      sections.push({
        heading,
        level: 3,
        startLine: line.n,
        bodyLines: body.slice(start, j)
      });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}
function parseStates(ctx, feature, section, collect) {
  const inline = section.bodyLines.find((l) => /^\s*states\s*:/i.test(l.text));
  let entries = [];
  if (inline) {
    const after = inline.text.replace(/^\s*states\s*:\s*/i, "");
    entries = after.split(",").map((s) => s.trim()).filter((s) => s.length > 0).map((s) => ({
      name: s.replace(/\(initial\)/i, "").trim(),
      isInitial: /\(initial\)/i.test(s),
      line: inline.n
    }));
  } else {
    for (const line of section.bodyLines) {
      const m = line.text.match(/^\s*-\s+(.+?)\s*$/);
      if (!m) continue;
      const raw = m[1];
      entries.push({
        name: raw.replace(/\(initial\)/i, "").trim(),
        isInitial: /\(initial\)/i.test(raw),
        line: line.n
      });
    }
  }
  if (entries.length === 0) {
    pushError(ctx, section.startLine, `Feature "${feature.label}": States section is empty`);
    return;
  }
  if (!entries.some((e) => e.isInitial)) {
    entries[0].isInitial = true;
  }
  for (const e of entries) {
    const stateNode = {
      id: ids.state(feature.name, e.name),
      label: e.name,
      entity_type: "state",
      source_file: ctx.mdPath,
      source_location: loc(e.line),
      confidence: "EXTRACTED",
      feature_id: feature.id,
      is_initial: e.isInitial,
      meta_state: META_STATE_NAMES.has(kebab(e.name))
    };
    ctx.nodes.push(stateNode);
    ctx.edges.push({
      source: feature.id,
      target: stateNode.id,
      relation: "has_state",
      confidence: "EXTRACTED",
      source_file: ctx.mdPath,
      source_location: loc(e.line),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP
    });
    if (e.isInitial) {
      ctx.edges.push({
        source: feature.id,
        target: stateNode.id,
        relation: "has_initial_state",
        confidence: "EXTRACTED",
        source_file: ctx.mdPath,
        source_location: loc(e.line),
        produced_by_agent: PRODUCED_BY,
        produced_at_step: PRODUCED_AT_STEP
      });
    }
    collect.push({ name: e.name, line: e.line, isInitial: e.isInitial });
  }
}
function parseTransitions(ctx, feature, section) {
  const table = parseTable(section.bodyLines);
  if (!table) {
    pushError(
      ctx,
      section.startLine,
      `Feature "${feature.label}": Transitions table not found or malformed`
    );
    return;
  }
  const fromToKey = table.headers.find((h) => /from\s*(?:→|->)\s*to/u.test(h));
  if (!fromToKey) {
    pushError(
      ctx,
      section.startLine,
      `Feature "${feature.label}": Transitions table missing "From \u2192 To" column`
    );
    return;
  }
  for (const row of table.rows) {
    const fromTo = row.cells[fromToKey] ?? "";
    const m = fromTo.match(/^(.+?)\s*(?:→|->)\s*(.+)$/u);
    if (!m) {
      pushError(ctx, row.line, `Transition row malformed: "${fromTo}"`);
      continue;
    }
    const from = m[1].trim();
    const to = m[2].trim();
    const trigger = row.cells["trigger"] ?? "";
    const preconditions = row.cells["preconditions"] ?? "";
    const sideEffects = row.cells["side effects"] ?? "";
    const fromId = ids.state(feature.name, from);
    const toId = ids.state(feature.name, to);
    const transitionNode = {
      id: ids.transition(feature.name, from, to),
      label: `${from} \u2192 ${to}`,
      entity_type: "transition",
      source_file: ctx.mdPath,
      source_location: loc(row.line),
      confidence: "EXTRACTED",
      from_state_id: fromId,
      to_state_id: toId,
      trigger,
      preconditions,
      side_effects: sideEffects
    };
    ctx.nodes.push(transitionNode);
    ctx.edges.push({
      source: fromId,
      target: toId,
      relation: "transitions_to",
      confidence: "EXTRACTED",
      source_file: ctx.mdPath,
      source_location: loc(row.line),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP
    });
    ctx.edges.push({
      source: fromId,
      target: transitionNode.id,
      relation: "triggered_by_transition",
      confidence: "EXTRACTED",
      source_file: ctx.mdPath,
      source_location: loc(row.line),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP
    });
  }
}
function parseBusinessRules(ctx, feature, section) {
  const bullets = collectBullets(section.bodyLines);
  for (const b of bullets) {
    const text = b.text.trim();
    if (!text) continue;
    const decisionNeeded = /\[DECISION NEEDED/i.test(text);
    const value = extractRuleValue(text);
    const node = {
      id: ids.businessRule(feature.name, text),
      label: text.length > 80 ? text.slice(0, 77) + "..." : text,
      entity_type: "business_rule",
      source_file: ctx.mdPath,
      source_location: loc(b.line),
      confidence: "EXTRACTED",
      feature_id: feature.id,
      text,
      value,
      decision_needed: decisionNeeded
    };
    ctx.nodes.push(node);
    ctx.edges.push({
      source: feature.id,
      target: node.id,
      relation: "has_rule",
      confidence: "EXTRACTED",
      source_file: ctx.mdPath,
      source_location: loc(b.line),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP
    });
  }
}
function extractRuleValue(text) {
  const eq = text.match(/=\s*([^.\[]+?)(?:\s*\[|$)/);
  if (eq) return eq[1].trim();
  const num = text.match(
    /(\d+(?:\.\d+)?)\s*(seconds?|minutes?|hours?|days?|items?|orders?|requests?|%|percent|MB|GB|KB|ms)/i
  );
  if (num) return `${num[1]} ${num[2]}`;
  return null;
}
function parseFailureModes(ctx, feature, section) {
  const blocks = splitFailureBlocks(section.bodyLines);
  for (const block of blocks) {
    if (block.length === 0) continue;
    const headLine = block[0];
    const headText = headLine.text.replace(/^\s*-\s+/, "").trim();
    const trigger = headText.replace(/\s*(?:→|->)\s*$/u, "").trim();
    if (!trigger) continue;
    const userSees = readLabel(block, /^\s*user\s+sees\s*:/i);
    const userCan = readLabel(block, /^\s*user\s+can\s*:/i);
    const systemDoes = readLabel(block, /^\s*system\s*:/i);
    const node = {
      id: ids.failureMode(feature.name, trigger),
      label: trigger,
      entity_type: "failure_mode",
      source_file: ctx.mdPath,
      source_location: loc(headLine.n),
      confidence: "EXTRACTED",
      feature_id: feature.id,
      trigger,
      user_sees: userSees,
      user_can: userCan,
      system_does: systemDoes
    };
    ctx.nodes.push(node);
    ctx.edges.push({
      source: feature.id,
      target: node.id,
      relation: "has_failure_mode",
      confidence: "EXTRACTED",
      source_file: ctx.mdPath,
      source_location: loc(headLine.n),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP
    });
  }
}
function splitFailureBlocks(body) {
  const blocks = [];
  let current = [];
  for (const line of body) {
    const isBulletStart = /^\s*-\s+/.test(line.text);
    if (isBulletStart) {
      if (current.length > 0) blocks.push(current);
      current = [line];
    } else if (line.text.trim() === "") {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}
function readLabel(block, pattern) {
  const idx = block.findIndex((l) => pattern.test(l.text));
  if (idx < 0) return "";
  const first = block[idx].text.replace(pattern, "").trim();
  const labelStartRe = /^\s*(user\s+sees|user\s+can|system)\s*:/i;
  const parts = [];
  if (first) parts.push(first.replace(/^"+|"+$/g, ""));
  for (let i = idx + 1; i < block.length; i++) {
    const t = block[i].text.trim();
    if (!t) break;
    if (labelStartRe.test(t)) break;
    parts.push(t.replace(/^"+|"+$/g, ""));
  }
  return parts.join(" ").trim();
}
function parseAcceptanceCriteria(ctx, feature, section) {
  const re = /^\s*-\s+\[\s\]\s+(.+)$/;
  for (const line of section.bodyLines) {
    const m = line.text.match(re);
    if (!m) continue;
    const text = m[1].trim();
    if (!text) continue;
    const node = {
      id: ids.acceptanceCriterion(feature.name, text),
      label: text.length > 80 ? text.slice(0, 77) + "..." : text,
      entity_type: "acceptance_criterion",
      source_file: ctx.mdPath,
      source_location: loc(line.n),
      confidence: "EXTRACTED",
      feature_id: feature.id,
      text,
      verified: false
    };
    ctx.nodes.push(node);
    ctx.edges.push({
      source: feature.id,
      target: node.id,
      relation: "has_acceptance",
      confidence: "EXTRACTED",
      source_file: ctx.mdPath,
      source_location: loc(line.n),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP
    });
  }
}
function parsePersonaConstraints(ctx, feature, section) {
  let currentPersona = null;
  for (const line of section.bodyLines) {
    const text = line.text;
    const personaMatch = text.match(/^\s*-\s+Persona\s*:\s*(.+?)\s+(?:—|--|-)\s+(.*)$/u);
    if (personaMatch) {
      const rawName = personaMatch[1].trim();
      const cleanName = rawName.replace(/\(primary\)/gi, "").trim();
      const found = ctx.personasByKey.get(cleanName.toLowerCase());
      if (!found) {
        pushError(
          ctx,
          line.n,
          `Feature "${feature.label}": persona "${cleanName}" not found in App Overview persona table`
        );
        currentPersona = null;
      } else {
        currentPersona = found;
      }
      continue;
    }
    const constraintMatch = text.match(/^\s*Constraint\s*:\s*(.+)$/i);
    if (constraintMatch && currentPersona) {
      const full = constraintMatch[1].trim();
      const citeMatch = full.match(/\[([^\]]+)\]\s*$/);
      const constraintText = citeMatch ? full.slice(0, citeMatch.index).trim() : full;
      const citedSource = citeMatch ? citeMatch[1].trim() : "";
      const node = {
        id: ids.personaConstraint(feature.name, constraintText),
        label: constraintText.length > 80 ? constraintText.slice(0, 77) + "..." : constraintText,
        entity_type: "persona_constraint",
        source_file: ctx.mdPath,
        source_location: loc(line.n),
        confidence: "EXTRACTED",
        feature_id: feature.id,
        persona_id: currentPersona.id,
        constraint_text: constraintText,
        cited_source: citedSource
      };
      ctx.nodes.push(node);
      ctx.edges.push({
        source: node.id,
        target: feature.id,
        relation: "constrains",
        confidence: "EXTRACTED",
        source_file: ctx.mdPath,
        source_location: loc(line.n),
        produced_by_agent: PRODUCED_BY,
        produced_at_step: PRODUCED_AT_STEP
      });
      ctx.edges.push({
        source: node.id,
        target: currentPersona.id,
        relation: "applies_to_persona",
        confidence: "EXTRACTED",
        source_file: ctx.mdPath,
        source_location: loc(line.n),
        produced_by_agent: PRODUCED_BY,
        produced_at_step: PRODUCED_AT_STEP
      });
    }
  }
}
function collectBullets(body) {
  const out = [];
  let current = null;
  for (const line of body) {
    const m = line.text.match(/^(\s*)-\s+(.+)$/);
    if (m) {
      if (current) out.push(current);
      current = { text: m[2].trim(), line: line.n };
    } else if (current && /^\s+\S/.test(line.text)) {
      current.text += " " + line.text.trim();
    } else if (line.text.trim() === "") {
      if (current) {
        out.push(current);
        current = null;
      }
    }
  }
  if (current) out.push(current);
  return out;
}
function sortNodes(nodes) {
  return [...nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
function sortEdges(edges) {
  return [...edges].sort((a, b) => {
    const k = (e) => `${e.relation}\0${e.source}\0${e.target}\0${e.source_location ?? ""}`;
    const ka = k(a);
    const kb = k(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}
function extractProductSpec(input) {
  const { mdPath, mdContent } = input;
  const lines = splitLines(mdContent);
  const ctx = {
    mdPath,
    errors: [],
    nodes: [],
    edges: [],
    personasByKey: /* @__PURE__ */ new Map()
  };
  const topSections = partitionSections(lines, 2, 0, lines.length);
  const byHeading = (name) => topSections.find((s) => s.heading.trim().toLowerCase() === name.toLowerCase());
  const required = ["App Overview", "Screen Inventory", "Cross-Feature Interactions"];
  for (const r of required) {
    if (!byHeading(r)) {
      pushError(ctx, 1, `Missing required top-level section: "## ${r}"`);
    }
  }
  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }
  const overviewSection = byHeading("App Overview");
  parsePersonas(ctx, overviewSection);
  const featureSections = topSections.filter((s) => /^Feature\s*:/i.test(s.heading));
  if (featureSections.length === 0) {
    pushError(ctx, 1, "No `## Feature: ...` sections found");
  }
  for (const fs of featureSections) parseFeature(ctx, fs);
  parseScreenInventory(ctx, byHeading("Screen Inventory"));
  parseCrossFeature(ctx, byHeading("Cross-Feature Interactions"));
  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }
  const fragment = {
    version: 1,
    schema: "buildanything-slice-1",
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: (/* @__PURE__ */ new Date()).toISOString(),
    nodes: sortNodes(ctx.nodes),
    edges: sortEdges(ctx.edges)
  };
  return { ok: true, fragment, errors: [] };
}

// src/graph/parser/design-md.ts
var import_yaml = __toESM(require_dist());
var PRODUCED_BY2 = "design-brand-guardian";
var PRODUCED_AT_STEP2 = "3.0";
var REQUIRED_AXES = ["scope", "density", "character", "material", "motion", "type", "copy"];
var AXIS_SET = new Set(REQUIRED_AXES);
var AXIS_WORD_REGEXES = REQUIRED_AXES.map((axis) => ({
  axis,
  re: new RegExp(`\\b${axis}\\b`, "i")
}));
function loc2(line) {
  return `L${line}`;
}
function pushError2(ctx, line, message) {
  ctx.errors.push({ line, message });
}
function splitLines2(content) {
  return content.split(/\r?\n/).map((text, i) => ({ n: i + 1, text }));
}
function isHeadingAtLevel2(text, level) {
  const prefix = "#".repeat(level) + " ";
  return text.startsWith(prefix) && text[level] !== "#";
}
function isHeadingAtOrAbove2(text, level) {
  for (let l = 1; l <= level; l++) if (isHeadingAtLevel2(text, l)) return true;
  return false;
}
function partitionSections2(lines, level, start, end) {
  const sections = [];
  const prefix = "#".repeat(level) + " ";
  let i = start;
  while (i < end) {
    const line = lines[i];
    if (isHeadingAtLevel2(line.text, level)) {
      const heading = line.text.slice(prefix.length).trim();
      let j = i + 1;
      while (j < end && !isHeadingAtOrAbove2(lines[j].text, level)) j++;
      sections.push({ heading, level, startLine: line.n, bodyLines: lines.slice(i + 1, j) });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}
function findH3Sections(bodyLines) {
  const sections = [];
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];
    if (isHeadingAtLevel2(line.text, 3)) {
      const heading = line.text.slice(4).trim();
      let j = i + 1;
      while (j < bodyLines.length && !isHeadingAtOrAbove2(bodyLines[j].text, 3)) j++;
      sections.push({ heading, level: 3, startLine: line.n, bodyLines: bodyLines.slice(i + 1, j) });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}
function truncateLabel(text) {
  return text.length > 80 ? text.slice(0, 77) + "..." : text;
}
function makeEdge(source, target2, relation, sourceFile, sourceLoc) {
  return {
    source,
    target: target2,
    relation,
    confidence: "EXTRACTED",
    source_file: sourceFile,
    source_location: sourceLoc,
    produced_by_agent: PRODUCED_BY2,
    produced_at_step: PRODUCED_AT_STEP2
  };
}
function parseFrontmatter(lines, ctx) {
  if (lines.length === 0 || lines[0].text.trim() !== "---") {
    pushError2(ctx, 1, "Missing YAML frontmatter (no opening `---` at line 1)");
    return null;
  }
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].text.trim() === "---") {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx < 0) {
    pushError2(ctx, 1, "YAML frontmatter never closed (missing closing `---`)");
    return null;
  }
  const yamlText = lines.slice(1, closeIdx).map((l) => l.text).join("\n");
  let parsed;
  try {
    parsed = import_yaml.default.parse(yamlText);
  } catch (e) {
    pushError2(ctx, 1, `YAML parse error: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    pushError2(ctx, 1, "YAML frontmatter is not an object");
    return null;
  }
  const name = typeof parsed["name"] === "string" ? parsed["name"].trim() : "";
  if (!name) {
    pushError2(ctx, 1, "Missing required YAML key: `name`");
    return null;
  }
  const description = typeof parsed["description"] === "string" ? parsed["description"].trim() : "";
  const pass2Keys = ["colors", "typography", "rounded", "spacing", "components"];
  const yamlPass2Populated = pass2Keys.some((k) => {
    const v = parsed[k];
    if (v === null || v === void 0) return false;
    if (typeof v === "object" && Object.keys(v).length === 0) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    return true;
  });
  return { name, description, yamlPass2Populated, endLine: lines[closeIdx].n + 1 };
}
function extractOverviewDescription(bodyLines) {
  const parts = [];
  for (const line of bodyLines) {
    if (isHeadingAtLevel2(line.text, 3)) break;
    if (line.text.trim() === "") {
      if (parts.length > 0) break;
      continue;
    }
    parts.push(line.text.trim());
  }
  return parts.join(" ");
}
function parseBrandDna(section, _ctx) {
  const axes = [];
  const bulletRe = /^\s*-\s+\*\*([^:*]+)\*?\*?:\*?\*?\s*(.*)$/;
  const bodyLines = section.bodyLines;
  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    const m = line.text.match(bulletRe);
    if (!m) continue;
    const rawAxis = m[1].trim().toLowerCase();
    if (!AXIS_SET.has(rawAxis)) continue;
    const afterColon = m[2].trim();
    let value;
    let inlineRationale = "";
    const dashIdx = afterColon.indexOf("\u2014");
    if (dashIdx >= 0) {
      value = afterColon.slice(0, dashIdx).trim();
      inlineRationale = afterColon.slice(dashIdx + 1).trim();
    } else {
      value = afterColon;
    }
    const continuationParts = [];
    let j = i + 1;
    while (j < bodyLines.length) {
      const nextTrimmed = bodyLines[j].text.trim();
      if (nextTrimmed === "" || /^\s*-\s+\*\*/.test(bodyLines[j].text)) break;
      continuationParts.push(nextTrimmed);
      j++;
    }
    const rationale = [inlineRationale, ...continuationParts].filter((s) => s.length > 0).join(" ").trim();
    axes.push({ name: rawAxis, value, rationale, line: line.n });
  }
  return axes;
}
function parseLockedAt(section) {
  if (!section) return "";
  const isoRe = /\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z?)?/;
  for (const line of section.bodyLines) {
    const m = line.text.match(isoRe);
    if (m) return m[0];
  }
  return "";
}
function parseReferences(section) {
  if (!section) return [];
  const refs = [];
  const urlRe = /https?:\/\/[^)\s]+/;
  for (const line of section.bodyLines) {
    const bulletMatch = line.text.match(/^\s*-\s+(.+)$/);
    if (!bulletMatch) continue;
    const raw = bulletMatch[1].trim();
    let url = "";
    let label = "";
    const mdLink = raw.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
    if (mdLink) {
      label = mdLink[1].trim();
      url = mdLink[2].trim();
    } else {
      const urlMatch = raw.match(urlRe);
      if (urlMatch) {
        url = urlMatch[0];
        const beforeUrl = raw.slice(0, raw.indexOf(url));
        label = beforeUrl.replace(/\(\s*$/, "").replace(/\s*\u2014.*$/, "").trim();
        if (!label) label = url;
      } else {
        const dashIdx = raw.indexOf(" \u2014 ");
        label = dashIdx >= 0 ? raw.slice(0, dashIdx).trim() : raw.trim();
      }
    }
    const urlOrPath = url || label;
    const exemplifiesAxes = AXIS_WORD_REGEXES.filter(({ re }) => re.test(raw)).map(({ axis }) => axis).slice().sort();
    refs.push({ label, urlOrPath, exemplifiesAxes, line: line.n });
  }
  return refs;
}
function parseDosAndDonts(section, _ctx) {
  const h3s = findH3Sections(section.bodyLines);
  const hasPatternA = h3s.some(
    (s) => /^do['\u2018\u2019]?s$/i.test(s.heading) || /^don['\u2018\u2019]?ts$/i.test(s.heading)
  );
  const guidelines = [];
  if (hasPatternA) {
    for (const sub of h3s) {
      const headingLower = sub.heading.toLowerCase().replace(/['\u2018\u2019]/g, "");
      let polarity = null;
      if (/^dos$/.test(headingLower)) polarity = "do";
      else if (/^donts$/.test(headingLower)) polarity = "dont";
      if (!polarity) continue;
      for (const line of sub.bodyLines) {
        const m = line.text.match(/^\s*-\s+(.+)$/);
        if (!m) continue;
        guidelines.push({ polarity, text: m[1].trim(), axisScope: matchAxisScope(m[1]), line: line.n });
      }
    }
  } else {
    for (const line of section.bodyLines) {
      const m = line.text.match(/^\s*-\s+(.+)$/);
      if (!m) continue;
      const raw = m[1].trim();
      const parsed = classifyGuideline(raw);
      if (!parsed) continue;
      guidelines.push({ polarity: parsed.polarity, text: parsed.text, axisScope: matchAxisScope(raw), line: line.n });
    }
  }
  return guidelines;
}
function classifyGuideline(raw) {
  if (/^don['\u2018\u2019]?t\s+/i.test(raw))
    return { polarity: "dont", text: raw.replace(/^don['\u2018\u2019]?t\s+/i, "").trim() };
  if (/^do\s+/i.test(raw))
    return { polarity: "do", text: raw.replace(/^do\s+/i, "").trim() };
  if (/^DON['\u2018\u2019]?T:\s*/i.test(raw))
    return { polarity: "dont", text: raw.replace(/^DON['\u2018\u2019]?T:\s*/i, "").trim() };
  if (/^DO:\s*/i.test(raw))
    return { polarity: "do", text: raw.replace(/^DO:\s*/i, "").trim() };
  if (raw.startsWith("\u2713") || raw.startsWith("\u2713"))
    return { polarity: "do", text: raw.slice(1).trim() };
  if (raw.startsWith("\u2717") || raw.startsWith("\u2717"))
    return { polarity: "dont", text: raw.slice(1).trim() };
  return null;
}
function matchAxisScope(text) {
  const matches = AXIS_WORD_REGEXES.filter(({ re }) => re.test(text)).map(({ axis }) => axis);
  return matches.length === 1 ? matches[0] : null;
}
var PASS2_HEADINGS = /* @__PURE__ */ new Set(["colors", "typography", "layout", "elevation & depth", "shapes", "components"]);
var PLACEHOLDER_RE = /^\s*(<!--.*-->|_<placeholder>_|TBD|TODO)\s*$/i;
function isPass2SectionPopulated(section) {
  for (const line of section.bodyLines) {
    const trimmed = line.text.trim();
    if (trimmed === "" || PLACEHOLDER_RE.test(trimmed)) continue;
    return true;
  }
  return false;
}
function sortNodes2(nodes) {
  return [...nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
function sortEdges2(edges) {
  return [...edges].sort((a, b) => {
    const k = (e) => `${e.relation} ${e.source} ${e.target} ${e.source_location ?? ""}`;
    return k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0;
  });
}
function extractDesignMd(input) {
  const { mdPath, mdContent } = input;
  const lines = splitLines2(mdContent);
  const ctx = { mdPath, errors: [], nodes: [], edges: [] };
  const fm = parseFrontmatter(lines, ctx);
  if (!fm) return { ok: false, errors: ctx.errors };
  const h2Sections = partitionSections2(lines, 2, 0, lines.length);
  const overviewSection = h2Sections.find((s) => /^overview$/i.test(s.heading.trim())) ?? h2Sections.find((s) => /^brand\s*&\s*style$/i.test(s.heading.trim()));
  if (!overviewSection) {
    pushError2(ctx, 1, "Missing required `## Overview` h2");
    return { ok: false, errors: ctx.errors };
  }
  const description = fm.description || extractOverviewDescription(overviewSection.bodyLines);
  const overviewH3s = findH3Sections(overviewSection.bodyLines);
  const brandDnaSections = overviewH3s.filter((s) => s.heading.toLowerCase() === "brand dna");
  if (brandDnaSections.length === 0) {
    pushError2(ctx, overviewSection.startLine, "Missing required `### Brand DNA` h3 inside `## Overview`");
    return { ok: false, errors: ctx.errors };
  }
  if (brandDnaSections.length > 1) {
    pushError2(ctx, brandDnaSections[1].startLine, "Duplicate `### Brand DNA` h3 inside `## Overview`");
    return { ok: false, errors: ctx.errors };
  }
  const axes = parseBrandDna(brandDnaSections[0], ctx);
  const foundAxisNames = new Set(axes.map((a) => a.name));
  for (const req of REQUIRED_AXES) {
    if (!foundAxisNames.has(req)) pushError2(ctx, brandDnaSections[0].startLine, `Missing required axis: ${req}`);
  }
  if (ctx.errors.length > 0) return { ok: false, errors: ctx.errors };
  const lockedAt = parseLockedAt(overviewH3s.find((s) => s.heading.toLowerCase() === "locked at"));
  const refs = parseReferences(overviewH3s.find((s) => s.heading.toLowerCase() === "references"));
  const dosSection = h2Sections.find(
    (s) => /^do['\u2018\u2019]?s\s+and\s+don['\u2018\u2019]?ts$/i.test(s.heading.trim())
  );
  if (!dosSection) {
    pushError2(ctx, 1, "Missing required `## Do's and Don'ts` h2");
    return { ok: false, errors: ctx.errors };
  }
  const guidelines = parseDosAndDonts(dosSection, ctx);
  let pass2ProsePopulated = false;
  for (const s of h2Sections) {
    if (PASS2_HEADINGS.has(s.heading.toLowerCase()) && isPass2SectionPopulated(s)) {
      pass2ProsePopulated = true;
      break;
    }
  }
  const pass2 = fm.yamlPass2Populated || pass2ProsePopulated;
  const pass1 = axes.length === REQUIRED_AXES.length && axes.every((a) => a.value.length > 0) && guidelines.length >= 4;
  const rootId = ids.designDocRoot();
  const rootNode = {
    id: rootId,
    label: fm.name,
    entity_type: "design_doc_root",
    source_file: mdPath,
    source_location: "L1",
    confidence: "EXTRACTED",
    name: fm.name,
    description,
    locked_at: lockedAt,
    pass_complete: { pass1, pass2 }
  };
  ctx.nodes.push(rootNode);
  for (const axis of axes) {
    const axisId = ids.dnaAxis(axis.name);
    const node = {
      id: axisId,
      label: `${axis.name.charAt(0).toUpperCase() + axis.name.slice(1)}: ${axis.value}`,
      entity_type: "dna_axis",
      source_file: mdPath,
      source_location: loc2(axis.line),
      confidence: "EXTRACTED",
      axis_name: axis.name,
      value: axis.value,
      rationale: axis.rationale
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge(rootId, axisId, "has_axis", mdPath, loc2(axis.line)));
  }
  for (const ref of refs) {
    const refId = ids.brandReference(ref.urlOrPath);
    const node = {
      id: refId,
      label: ref.label,
      entity_type: "brand_reference",
      source_file: mdPath,
      source_location: loc2(ref.line),
      confidence: "EXTRACTED",
      url_or_path: ref.urlOrPath,
      exemplifies_axes: ref.exemplifiesAxes
    };
    ctx.nodes.push(node);
    for (const axisName of ref.exemplifiesAxes) {
      ctx.edges.push(makeEdge(refId, ids.dnaAxis(axisName), "references_axis", mdPath, loc2(ref.line)));
    }
  }
  for (const g of guidelines) {
    const gId = ids.dnaGuideline(g.polarity, g.text);
    const node = {
      id: gId,
      label: truncateLabel(g.text),
      entity_type: "brand_dna_guideline",
      source_file: mdPath,
      source_location: loc2(g.line),
      confidence: "EXTRACTED",
      polarity: g.polarity,
      text: g.text,
      axis_scope: g.axisScope
    };
    ctx.nodes.push(node);
    if (g.axisScope) {
      ctx.edges.push(makeEdge(gId, ids.dnaAxis(g.axisScope), "applies_to", mdPath, loc2(g.line)));
    }
  }
  const fragment = {
    version: 1,
    schema: "buildanything-slice-2",
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: (/* @__PURE__ */ new Date()).toISOString(),
    nodes: sortNodes2(ctx.nodes),
    edges: sortEdges2(ctx.edges)
  };
  return { ok: true, fragment, errors: [] };
}

// src/graph/parser/component-manifest.ts
var PRODUCED_BY3 = "design-ui-designer";
var PRODUCED_AT_STEP3 = "3.2";
var HARD_GATE_RE = /\[(?:hg|hard-gate)\]|\(hg\)/i;
var SEP_RE = /^\s*\|?\s*[-:| ]+\s*\|?\s*$/;
var EXPECTED_HEADERS = ["slot", "library", "variant", "source ref", "notes"];
function loc3(line) {
  return `L${line}`;
}
function pushError3(ctx, line, message) {
  ctx.errors.push({ line, message });
}
function splitLines3(content) {
  return content.split(/\r?\n/).map((text, i) => ({ n: i + 1, text }));
}
function splitRow2(text) {
  let s = text.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}
function findTables(lines) {
  const tables = [];
  let i = 0;
  while (i < lines.length - 1) {
    const cur = lines[i];
    const next = lines[i + 1];
    if (cur.text.includes("|") && next.text.includes("|") && SEP_RE.test(next.text)) {
      const rows = [];
      let j = i + 2;
      while (j < lines.length) {
        const ln = lines[j];
        if (!ln.text.includes("|")) break;
        if (SEP_RE.test(ln.text)) {
          j++;
          continue;
        }
        const cells = splitRow2(ln.text);
        if (cells.every((c) => c === "")) {
          j++;
          continue;
        }
        rows.push({ cells, line: ln.n });
        j++;
      }
      tables.push({ headerLine: cur.n, rows });
      i = j;
    } else {
      i++;
    }
  }
  return tables;
}
function isEmptyRef(s) {
  const t = s.trim();
  return t === "" || t === "\u2014" || t === "-" || t === "\u2013";
}
function sortNodes3(nodes) {
  return [...nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
function sortEdges3(edges) {
  return [...edges].sort((a, b) => {
    const k = (e) => `${e.relation} ${e.source} ${e.target}`;
    return k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0;
  });
}
function extractComponentManifest(input) {
  const { mdPath, mdContent } = input;
  const lines = splitLines3(mdContent);
  const ctx = { mdPath, errors: [], nodes: [], edges: [] };
  const tables = findTables(lines);
  if (tables.length === 0) {
    return {
      ok: false,
      errors: [{ line: 0, message: "No pipe tables found in component manifest" }]
    };
  }
  const allRows = [];
  for (const table of tables) {
    const headerCells = splitRow2(lines[table.headerLine - 1].text);
    const normalized = headerCells.map((h) => h.toLowerCase().trim());
    if (normalized.length < 5) {
      pushError3(ctx, table.headerLine, `L${table.headerLine}: table has fewer than 5 columns`);
      continue;
    }
    let headerOk = true;
    for (let c = 0; c < EXPECTED_HEADERS.length; c++) {
      if (normalized[c] !== EXPECTED_HEADERS[c]) {
        pushError3(
          ctx,
          table.headerLine,
          `Table header must be: Slot | Library | Variant | Source ref | Notes (got "${headerCells[c]}" at column ${c + 1})`
        );
        headerOk = false;
        break;
      }
    }
    if (!headerOk) continue;
    allRows.push(...table.rows);
  }
  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }
  const slotSeen = /* @__PURE__ */ new Map();
  for (const row of allRows) {
    const rawSlot = row.cells[0] ?? "";
    const slotKebab = kebab(rawSlot);
    if (!slotKebab) {
      pushError3(ctx, row.line, `Empty slot name at L${row.line}`);
      continue;
    }
    const existing = slotSeen.get(slotKebab);
    if (existing) {
      existing.push(row.line);
    } else {
      slotSeen.set(slotKebab, [row.line]);
    }
  }
  for (const [slotKebab, lineNums] of slotSeen) {
    if (lineNums.length > 1) {
      const refs = lineNums.map((n) => `L${n}`).join(" and ");
      pushError3(ctx, lineNums[0], `Duplicate slot "${slotKebab}" at ${refs}`);
    }
  }
  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }
  const emittedSlots = /* @__PURE__ */ new Set();
  for (const row of allRows) {
    const rawSlot = row.cells[0] ?? "";
    const slotKebab = kebab(rawSlot);
    const rawLibrary = (row.cells[1] ?? "").trim();
    const rawVariant = (row.cells[2] ?? "").trim();
    const rawSourceRef = (row.cells[3] ?? "").trim();
    const rawNotes = (row.cells[4] ?? "").trim();
    const isTbd = rawLibrary.toLowerCase() === "tbd" || rawVariant.toLowerCase() === "tbd";
    const library = rawLibrary.toLowerCase();
    const variant = isTbd ? rawVariant.toLowerCase() : rawVariant.trim();
    const sourceRef = isEmptyRef(rawSourceRef) ? null : rawSourceRef;
    const hardGate = isTbd ? false : HARD_GATE_RE.test(rawNotes);
    const fallbackProse = rawNotes.replace(HARD_GATE_RE, "").trim();
    const entryNode = {
      id: ids.manifestEntry(rawSlot),
      label: slotKebab,
      entity_type: "component_manifest_entry",
      source_file: mdPath,
      source_location: loc3(row.line),
      confidence: "EXTRACTED",
      slot: slotKebab,
      library,
      variant,
      source_ref: sourceRef,
      hard_gate: hardGate,
      ...fallbackProse ? { fallback_plan: fallbackProse } : {}
    };
    ctx.nodes.push(entryNode);
    if (!emittedSlots.has(slotKebab)) {
      emittedSlots.add(slotKebab);
      const slotNode = {
        id: ids.componentSlot(rawSlot),
        label: slotKebab,
        entity_type: "component_slot",
        source_file: mdPath,
        source_location: loc3(row.line),
        confidence: "EXTRACTED",
        slot_name: slotKebab
      };
      ctx.nodes.push(slotNode);
    }
    ctx.edges.push({
      source: ids.componentSlot(rawSlot),
      target: ids.manifestEntry(rawSlot),
      relation: "slot_filled_by",
      confidence: "EXTRACTED",
      source_file: mdPath,
      source_location: loc3(row.line),
      produced_by_agent: PRODUCED_BY3,
      produced_at_step: PRODUCED_AT_STEP3
    });
  }
  const fragment = {
    version: 1,
    schema: "buildanything-slice-2",
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: (/* @__PURE__ */ new Date()).toISOString(),
    nodes: sortNodes3(ctx.nodes),
    edges: sortEdges3(ctx.edges)
  };
  return { ok: true, fragment, errors: [] };
}

// src/graph/parser/page-spec.ts
var PRODUCED_BY4 = "design-ux-architect";
var PRODUCED_AT_STEP4 = "3.3";
function loc4(line) {
  return `L${line}`;
}
function pushError4(ctx, line, message) {
  ctx.errors.push({ line, message });
}
function splitLines4(content) {
  return content.split(/\r?\n/).map((text, i) => ({ n: i + 1, text }));
}
function isHeadingAtLevel3(text, level) {
  const prefix = "#".repeat(level) + " ";
  if (!text.startsWith(prefix)) return false;
  return text[level] !== "#";
}
function isHeadingAtOrAbove3(text, level) {
  for (let l = 1; l <= level; l++) {
    if (isHeadingAtLevel3(text, l)) return true;
  }
  return false;
}
function partitionSections3(lines, level, start, end) {
  const sections = [];
  const headingPrefix = "#".repeat(level) + " ";
  let i = start;
  while (i < end) {
    const line = lines[i];
    if (isHeadingAtLevel3(line.text, level)) {
      const heading = line.text.slice(headingPrefix.length).trim();
      const bodyStart = i + 1;
      let j = bodyStart;
      while (j < end && !isHeadingAtOrAbove3(lines[j].text, level)) j++;
      sections.push({ heading, level, startLine: line.n, bodyLines: lines.slice(bodyStart, j) });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}
function parseTable2(body) {
  const sepRe = /^\s*\|?\s*[-:| ]+\s*\|?\s*$/;
  const significant = body.filter((l) => l.text.trim().length > 0);
  let headerIdx = -1;
  for (let i = 0; i < significant.length - 1; i++) {
    if (significant[i].text.includes("|") && significant[i + 1].text.includes("|") && sepRe.test(significant[i + 1].text)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return null;
  const headers = splitRow3(significant[headerIdx].text).map((h) => h.toLowerCase());
  const rows = [];
  for (let i = headerIdx + 2; i < significant.length; i++) {
    const ln = significant[i];
    if (!ln.text.includes("|")) break;
    const cells = splitRow3(ln.text);
    if (cells.length === 0) continue;
    const row = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = (cells[c] ?? "").trim();
    }
    rows.push({ cells: row, line: ln.n });
  }
  return { headers, rows };
}
function splitRow3(text) {
  let s = text.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}
function makeEdge2(ctx, source, target2, relation, line) {
  return {
    source,
    target: target2,
    relation,
    confidence: "EXTRACTED",
    source_file: ctx.mdPath,
    source_location: loc4(line),
    produced_by_agent: PRODUCED_BY4,
    produced_at_step: PRODUCED_AT_STEP4
  };
}
function truncLabel(text) {
  return text.length > 80 ? text.slice(0, 77) + "..." : text;
}
function sortNodes4(nodes) {
  return [...nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
function sortEdges4(edges) {
  return [...edges].sort((a, b) => {
    const k = (e) => `${e.relation} ${e.source} ${e.target} ${e.source_location ?? ""}`;
    return k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0;
  });
}
function findH2(sections, name) {
  return sections.find((s) => s.heading.trim().toLowerCase() === name.toLowerCase());
}
function parseRoute(section) {
  if (!section) return null;
  for (const line of section.bodyLines) {
    const t = line.text.trim();
    if (!t) continue;
    const stripped = t.replace(/^`+|`+$/g, "").trim();
    if (!stripped || /^n\/a$/i.test(stripped) || /^modal$/i.test(stripped)) return null;
    return stripped;
  }
  return null;
}
function parseWireframe(ctx, section, screenName, pageSpecId) {
  let inFence = false;
  let fenceContent = [];
  let foundFence = false;
  for (const line of section.bodyLines) {
    if (!inFence && /^\s*```/.test(line.text)) {
      inFence = true;
      foundFence = true;
      continue;
    }
    if (inFence && /^\s*```/.test(line.text)) {
      inFence = false;
      break;
    }
    if (inFence) {
      fenceContent.push(line.text);
    }
  }
  if (!foundFence) {
    pushError4(ctx, section.startLine, `## ASCII Wireframe section has no fenced code block`);
    return null;
  }
  const wireframeText = fenceContent.join("\n");
  const markerRe = /\[([A-Z][A-Za-z0-9 :_-]*)\]/g;
  const seen = /* @__PURE__ */ new Set();
  const ordered = [];
  let m;
  while ((m = markerRe.exec(wireframeText)) !== null) {
    const name = m[1].trim();
    if (!seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
  }
  for (let i = 0; i < ordered.length; i++) {
    const sectionName = ordered[i];
    const node = {
      id: ids.wireframeSection(screenName, sectionName, i),
      label: sectionName,
      entity_type: "wireframe_section",
      source_file: ctx.mdPath,
      source_location: loc4(section.startLine),
      confidence: "EXTRACTED",
      section_name: sectionName,
      parent_page_spec_id: pageSpecId,
      order: i,
      prose: ""
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge2(ctx, pageSpecId, node.id, "has_section", section.startLine));
  }
  return wireframeText;
}
function parseContentHierarchy(ctx, section) {
  const table = parseTable2(section.bodyLines);
  if (table) {
    const sectionCol = table.headers.find((h) => h === "section" || h === "section name");
    if (sectionCol && table.rows.length > 0) {
      const entries2 = table.rows.map((r) => r.cells[sectionCol].trim()).filter((s) => s);
      if (entries2.length > 0) return entries2;
    }
  }
  const listRe = /^\s*(?:\d+\.|[-*])\s+(.+)$/;
  const entries = [];
  for (const line of section.bodyLines) {
    const m = line.text.match(listRe);
    if (m) entries.push(m[1].trim());
  }
  if (entries.length > 0) return entries;
  pushError4(ctx, section.startLine, `## Content Hierarchy is empty`);
  return null;
}
function parseStates2(ctx, section, screenName, screenId, pageSpecId) {
  const table = parseTable2(section.bodyLines);
  if (table && table.headers.includes("state") && table.headers.includes("appearance")) {
    for (const row of table.rows) {
      const stateName = (row.cells["state"] ?? "").trim();
      const appearance = (row.cells["appearance"] ?? "").trim();
      if (!stateName) continue;
      emitStateSlot(ctx, screenName, screenId, pageSpecId, stateName, appearance, row.line);
    }
    return;
  }
  const bulletRe = /^\s*-\s+(?:\*\*(.+?)\*\*\s*(?:—|--|-|:)?\s*(.*)$|(.+?):\s+(.*)$)/;
  for (const line of section.bodyLines) {
    const m = line.text.match(bulletRe);
    if (!m) continue;
    const stateName = (m[1] ?? m[3] ?? "").trim();
    const appearance = (m[2] ?? m[4] ?? "").trim();
    if (!stateName) continue;
    emitStateSlot(ctx, screenName, screenId, pageSpecId, stateName, appearance, line.n);
  }
}
function emitStateSlot(ctx, screenName, screenId, pageSpecId, stateName, appearance, line) {
  const node = {
    id: ids.screenStateSlot(screenName, stateName),
    label: stateName,
    entity_type: "screen_state_slot",
    source_file: ctx.mdPath,
    source_location: loc4(line),
    confidence: "EXTRACTED",
    screen_id: screenId,
    state_id: kebab(stateName),
    appearance_text: appearance
  };
  ctx.nodes.push(node);
  ctx.edges.push(makeEdge2(ctx, pageSpecId, node.id, "has_screen_state", line));
}
function parseKeyCopy(ctx, section, screenName, screenId, pageSpecId) {
  const quoteRe = /^\s*-\s+(?:\*\*)?["\u201C\u2018](.+)["\u201D\u2019](?:\*\*)?\s*(?:\u2014|--|(?:-\s))\s*(.*)$/;
  let count = 0;
  for (const line of section.bodyLines) {
    const m = line.text.match(quoteRe);
    if (!m) continue;
    const text = m[1].trim();
    let placement = m[2].trim();
    placement = placement.replace(/^placement:\s*/i, "").trim();
    const node = {
      id: ids.keyCopy(screenName, text),
      label: truncLabel(text),
      entity_type: "key_copy",
      source_file: ctx.mdPath,
      source_location: loc4(line.n),
      confidence: "EXTRACTED",
      screen_id: screenId,
      text,
      placement
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge2(ctx, pageSpecId, node.id, "key_copy_on_screen", line.n));
    count++;
  }
  if (count === 0) {
    pushError4(ctx, section.startLine, `## Key Copy yielded no parsed bullets`);
    return false;
  }
  return true;
}
function parseComponentPicks(ctx, section, screenName, screenId, pageSpecId) {
  const table = parseTable2(section.bodyLines);
  if (!table) return;
  const slotCol = table.headers.find((h) => h === "manifest slot" || h === "slot");
  const sectionCol = table.headers.find((h) => h === "section" || h === "section name");
  if (!slotCol || !sectionCol) return;
  const propsCol = table.headers.find((h) => h === "prop overrides" || h === "props" || h === "overrides");
  for (const row of table.rows) {
    const sectionName = (row.cells[sectionCol] ?? "").trim();
    let rawSlot = (row.cells[slotCol] ?? "").trim();
    rawSlot = rawSlot.replace(/^`+|`+$/g, "");
    rawSlot = rawSlot.replace(/\s*\*\([^)]*\)\*\s*$/, "").trim();
    rawSlot = rawSlot.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const slot = kebab(rawSlot);
    if (!slot || !sectionName) continue;
    const propOverrides = propsCol ? (row.cells[propsCol] ?? "").trim() : "";
    const node = {
      id: ids.screenComponentUse(screenName, slot, sectionName),
      label: `${slot} @ ${sectionName}`,
      entity_type: "screen_component_use",
      source_file: ctx.mdPath,
      source_location: loc4(row.line),
      confidence: "EXTRACTED",
      screen_id: screenId,
      slot,
      position_in_wireframe: sectionName,
      prop_overrides: propOverrides
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge2(ctx, pageSpecId, node.id, "slot_used_on_screen", row.line));
  }
}
function extractPageSpec(input) {
  const { mdPath, mdContent } = input;
  const lines = splitLines4(mdContent);
  const ctx = { mdPath, errors: [], nodes: [], edges: [] };
  const h1 = lines.find((l) => isHeadingAtLevel3(l.text, 1));
  const h1Match = h1?.text.match(/^#\s+Page:\s+(.+)$/);
  if (!h1 || !h1Match) {
    pushError4(ctx, h1?.n ?? 1, "Missing required h1: '# Page: <Screen Name>'");
    return { ok: false, errors: ctx.errors };
  }
  const screenName = h1Match[1].trim();
  const screenId = ids.screen(screenName);
  const pageSpecId = ids.pageSpec(screenName);
  const h2Sections = partitionSections3(lines, 2, 0, lines.length);
  const route = parseRoute(findH2(h2Sections, "Route"));
  const wireframeSec = findH2(h2Sections, "ASCII Wireframe");
  if (!wireframeSec) {
    pushError4(ctx, 1, "Missing required section: '## ASCII Wireframe'");
    return { ok: false, errors: ctx.errors };
  }
  const wireframeText = parseWireframe(ctx, wireframeSec, screenName, pageSpecId);
  if (wireframeText === null) return { ok: false, errors: ctx.errors };
  const hierarchySec = findH2(h2Sections, "Content Hierarchy");
  if (!hierarchySec) {
    pushError4(ctx, 1, "Missing required section: '## Content Hierarchy'");
    return { ok: false, errors: ctx.errors };
  }
  const contentHierarchy = parseContentHierarchy(ctx, hierarchySec);
  if (!contentHierarchy) return { ok: false, errors: ctx.errors };
  const statesSec = findH2(h2Sections, "States");
  if (statesSec) parseStates2(ctx, statesSec, screenName, screenId, pageSpecId);
  const keyCopySec = findH2(h2Sections, "Key Copy");
  if (!keyCopySec) {
    pushError4(ctx, 1, "Missing required section: '## Key Copy'");
    return { ok: false, errors: ctx.errors };
  }
  if (!parseKeyCopy(ctx, keyCopySec, screenName, screenId, pageSpecId)) {
    return { ok: false, errors: ctx.errors };
  }
  const compSec = findH2(h2Sections, "Component Picks");
  if (compSec) parseComponentPicks(ctx, compSec, screenName, screenId, pageSpecId);
  const pageNode = {
    id: pageSpecId,
    label: screenName,
    entity_type: "page_spec",
    source_file: mdPath,
    source_location: loc4(h1.n),
    confidence: "EXTRACTED",
    screen_id: screenId,
    wireframe_text: wireframeText,
    content_hierarchy: contentHierarchy,
    route
  };
  ctx.nodes.push(pageNode);
  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }
  const fragment = {
    version: 1,
    schema: "buildanything-slice-3",
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: (/* @__PURE__ */ new Date()).toISOString(),
    nodes: sortNodes4(ctx.nodes),
    edges: sortEdges4(ctx.edges)
  };
  return { ok: true, fragment, errors: [] };
}

// src/graph/parser/design-md-pass2.ts
var import_yaml2 = __toESM(require_dist());
var PRODUCED_BY_WEB = "design-ui-designer";
var PRODUCED_AT_STEP_WEB = "3.4";
var PRODUCED_BY_IOS = "ios-swift-ui-design";
var PRODUCED_AT_STEP_IOS = "3.2-ios";
var SCHEMA = "buildanything-slice-3";
var SKIP_KEYS = /* @__PURE__ */ new Set(["version", "name", "description"]);
var KNOWN_OBJECT_KEYS = {
  colors: "color",
  typography: "typography",
  rounded: "shape",
  spacing: "spacing",
  components: "component"
};
var PRIMITIVE_OK_KEYS = /* @__PURE__ */ new Set(["rounded", "spacing"]);
function parseFrontmatter2(content) {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== "---") return { yaml: "", found: false };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      return { yaml: lines.slice(1, i).join("\n"), found: true };
    }
  }
  return { yaml: "", found: false };
}
function stableStringify(v) {
  if (v === null || v === void 0) return String(v);
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const obj = v;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}
function layerForKey(key) {
  if (key in KNOWN_OBJECT_KEYS) return KNOWN_OBJECT_KEYS[key];
  if (key.startsWith("motion-")) return "motion";
  if (key.startsWith("elevation-")) return "elevation";
  if (key.startsWith("shape-")) return "shape";
  if (key.startsWith("type-")) return "type";
  return "component";
}
function getAxisProvenance(name, layer) {
  const lower = name.toLowerCase();
  if (lower.includes("glass") || lower.includes("blur")) return "material";
  if (layer === "color") return "character";
  if (layer === "typography") {
    if (name === "typography.scale" || name.endsWith(".scale")) return "density";
    return "type";
  }
  if (layer === "shape") return "character";
  if (layer === "spacing") return "density";
  if (layer === "motion") return "motion";
  if (layer === "elevation") return "material";
  if (layer === "type") return "type";
  if (layer === "component") return null;
  return null;
}
function typographyCategory(key) {
  const idx = key.indexOf("-");
  return idx > 0 ? key.slice(0, idx) : key;
}
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function emptyFragment(mdPath, mdContent) {
  return {
    version: 1,
    schema: SCHEMA,
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: (/* @__PURE__ */ new Date()).toISOString(),
    nodes: [],
    edges: []
  };
}
function collectTokens(parsed, ctx) {
  const tokens = [];
  for (const key of Object.keys(parsed)) {
    if (SKIP_KEYS.has(key)) continue;
    const val = parsed[key];
    if (val === null || val === void 0) continue;
    const isKnown = key in KNOWN_OBJECT_KEYS;
    const layer = layerForKey(key);
    if (isKnown) {
      if (isPlainObject(val) && Object.keys(val).length === 0) continue;
      if (!isPlainObject(val)) {
        if (PRIMITIVE_OK_KEYS.has(key)) {
          tokens.push({ name: key, value: String(val), layer, category: null });
          continue;
        }
        ctx.errors.push({ line: 1, message: `${key}: expected object, got ${typeof val}` });
        return null;
      }
      const obj = val;
      if (key === "colors") {
        for (const ck of Object.keys(obj)) {
          tokens.push({ name: `colors.${ck}`, value: String(obj[ck]), layer: "color", category: ck });
        }
      } else if (key === "typography") {
        for (const tk of Object.keys(obj)) {
          const tv = obj[tk];
          const value = isPlainObject(tv) ? stableStringify(tv) : String(tv);
          tokens.push({ name: `typography.${tk}`, value, layer: "typography", category: typographyCategory(tk) });
        }
      } else if (key === "rounded" || key === "spacing") {
        for (const sk of Object.keys(obj)) {
          tokens.push({ name: `${key}.${sk}`, value: String(obj[sk]), layer, category: sk });
        }
      } else if (key === "components") {
        for (const ck of Object.keys(obj)) {
          const cv = obj[ck];
          const value = isPlainObject(cv) ? stableStringify(cv) : String(cv);
          tokens.push({ name: `components.${ck}`, value, layer: "component", category: null });
        }
      }
    } else {
      const value = isPlainObject(val) ? stableStringify(val) : String(val);
      tokens.push({ name: key, value, layer, category: null });
    }
  }
  return tokens;
}
function extractDesignMdTokens(input) {
  const { mdPath, mdContent, projectType } = input;
  const producedBy = projectType === "ios" ? PRODUCED_BY_IOS : PRODUCED_BY_WEB;
  const producedAtStep = projectType === "ios" ? PRODUCED_AT_STEP_IOS : PRODUCED_AT_STEP_WEB;
  const { yaml, found } = parseFrontmatter2(mdContent);
  if (!found) return { ok: true, fragment: emptyFragment(mdPath, mdContent), errors: [] };
  let parsed;
  try {
    parsed = import_yaml2.default.parse(yaml);
  } catch (e) {
    return { ok: false, errors: [{ line: 1, message: `YAML parse error: ${e instanceof Error ? e.message : String(e)}` }] };
  }
  if (!parsed || !isPlainObject(parsed)) {
    return { ok: true, fragment: emptyFragment(mdPath, mdContent), errors: [] };
  }
  const ctx = { mdPath, errors: [] };
  const rawTokens = collectTokens(parsed, ctx);
  if (rawTokens === null) return { ok: false, errors: ctx.errors };
  if (rawTokens.length === 0) return { ok: true, fragment: emptyFragment(mdPath, mdContent), errors: [] };
  const nodes = rawTokens.map((t) => ({
    id: ids.token(t.layer, t.name),
    label: t.name,
    entity_type: "token",
    source_file: mdPath,
    source_location: "L1",
    confidence: "EXTRACTED",
    name: t.name,
    value: t.value,
    layer: t.layer,
    axis_provenance: getAxisProvenance(t.name, t.layer),
    category: t.category
  }));
  const edges = [];
  for (const node of nodes) {
    const tn = node;
    if (tn.axis_provenance !== null) {
      edges.push({
        source: tn.id,
        target: ids.dnaAxis(tn.axis_provenance),
        relation: "token_derived_from",
        confidence: "EXTRACTED",
        source_file: mdPath,
        source_location: "L1",
        produced_by_agent: producedBy,
        produced_at_step: producedAtStep
      });
    }
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => `${a.relation} ${a.source} ${a.target}`.localeCompare(`${b.relation} ${b.source} ${b.target}`));
  const fragment = {
    version: 1,
    schema: SCHEMA,
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: (/* @__PURE__ */ new Date()).toISOString(),
    nodes,
    edges
  };
  return { ok: true, fragment, errors: [] };
}

// src/graph/parser/architecture.ts
var PRODUCED_BY5 = "code-architect";
var PRODUCED_AT_STEP5 = "2.3.1";
var SKIP_HEADINGS = /* @__PURE__ */ new Set(["overview", "scope", "out of scope"]);
var REQUIRED_MODULE_NAMES = ["frontend", "backend", "auth", "data model", "security", "infrastructure", "api", "client", "server", "database", "ui", "web", "mobile", "storage", "networking"];
var ENDPOINT_RE = /^\*\*(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s*]+)\*\*(.*)$/;
var PATH_STOP_WORDS = /* @__PURE__ */ new Set([
  "api",
  "v1",
  "v2",
  "v3",
  "id",
  "ids",
  "uuid",
  "list",
  "new",
  "edit",
  "create",
  "update",
  "delete",
  "search",
  "me",
  "self"
]);
function loc5(line) {
  return `L${line}`;
}
function splitLines5(content) {
  return content.split(/\r?\n/).map((text, i) => ({ n: i + 1, text }));
}
function isHeadingAtLevel4(text, level) {
  const prefix = "#".repeat(level) + " ";
  if (!text.startsWith(prefix)) return false;
  return text[level] !== "#";
}
function isHeadingAtOrAbove4(text, level) {
  for (let l = 1; l <= level; l++) {
    if (isHeadingAtLevel4(text, l)) return true;
  }
  return false;
}
function partitionSections4(lines, level, start, end) {
  const sections = [];
  const headingPrefix = "#".repeat(level) + " ";
  let i = start;
  while (i < end) {
    const line = lines[i];
    if (isHeadingAtLevel4(line.text, level)) {
      const heading = line.text.slice(headingPrefix.length).trim();
      const bodyStart = i + 1;
      let j = bodyStart;
      while (j < end && !isHeadingAtOrAbove4(lines[j].text, level)) j++;
      sections.push({ heading, level, startLine: line.n, bodyLines: lines.slice(bodyStart, j) });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}
function makeEdge3(ctx, source, target2, relation, line, confidence = "EXTRACTED") {
  return {
    source,
    target: target2,
    relation,
    confidence,
    source_file: ctx.mdPath,
    source_location: loc5(line),
    produced_by_agent: PRODUCED_BY5,
    produced_at_step: PRODUCED_AT_STEP5
  };
}
function sortNodes5(nodes) {
  return [...nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
function sortEdges5(edges) {
  return [...edges].sort((a, b) => {
    const k = (e) => `${e.relation} ${e.source} ${e.target} ${e.source_location ?? ""}`;
    return k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0;
  });
}
function isTitleHeading(text) {
  return /^architecture\s*:/i.test(text);
}
function extractDescription(bodyLines) {
  const parts = [];
  for (const line of bodyLines) {
    if (isHeadingAtOrAbove4(line.text, 2)) break;
    const t = line.text.trim();
    if (t === "") {
      if (parts.length > 0) break;
      continue;
    }
    parts.push(t);
  }
  return parts.join(" ");
}
function extractBulletsUnderH3(bodyLines, h3Name) {
  let inSection = false;
  const bullets = [];
  for (const line of bodyLines) {
    if (isHeadingAtLevel4(line.text, 3)) {
      inSection = line.text.slice(4).trim().toLowerCase() === h3Name.toLowerCase();
      continue;
    }
    if (inSection) {
      if (isHeadingAtOrAbove4(line.text, 3)) break;
      const m = line.text.match(/^\s*-\s+(.+)$/);
      if (m) bullets.push(m[1].trim());
    }
  }
  return bullets;
}
function splitParenAware(value) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}
function parseEndpointAnnotation(trailing) {
  const provides = [];
  const consumes = [];
  const annotationRe = /\(\s*(provides|consumes)\s*:\s*([^)]+)\)/gi;
  let m;
  while ((m = annotationRe.exec(trailing)) !== null) {
    const kind = m[1].toLowerCase();
    const targets = m[2].split(",").map((s) => kebab(s.trim())).filter((s) => s.length > 0);
    if (kind === "provides") provides.push(...targets);
    else consumes.push(...targets);
  }
  return { provides, consumes };
}
function inferFeatureFromPath(path) {
  const segments = path.replace(/^\/+/, "").split("/").map((s) => s.replace(/^[:{].*[}]?$/, "").trim()).filter((s) => s.length > 0).map((s) => kebab(s));
  for (const seg of segments) {
    if (seg && !PATH_STOP_WORDS.has(seg)) return seg;
  }
  return null;
}
function inferFeatureFromModuleName(moduleName) {
  const kebabbed = kebab(moduleName);
  const GENERIC = /* @__PURE__ */ new Set([
    "frontend",
    "backend",
    "auth",
    "data-model",
    "security",
    "infrastructure",
    "api"
  ]);
  if (GENERIC.has(kebabbed)) return null;
  return kebabbed;
}
function emitFeatureEdges(ctx, contractId, line, explicit, inferred) {
  const seenProvides = /* @__PURE__ */ new Set();
  for (const f of explicit.provides) {
    if (!f || seenProvides.has(f)) continue;
    seenProvides.add(f);
    ctx.edges.push(
      makeEdge3(ctx, `feature__${f}`, contractId, "feature_provides_endpoint", line, "EXTRACTED")
    );
  }
  const seenConsumes = /* @__PURE__ */ new Set();
  for (const f of explicit.consumes) {
    if (!f || seenConsumes.has(f)) continue;
    seenConsumes.add(f);
    ctx.edges.push(
      makeEdge3(ctx, `feature__${f}`, contractId, "feature_consumes_endpoint", line, "EXTRACTED")
    );
  }
  for (const f of inferred.provides) {
    if (!f || seenProvides.has(f)) continue;
    seenProvides.add(f);
    ctx.edges.push(
      makeEdge3(ctx, `feature__${f}`, contractId, "feature_provides_endpoint", line, "INFERRED")
    );
  }
  for (const f of inferred.consumes) {
    if (!f || seenConsumes.has(f)) continue;
    seenConsumes.add(f);
    ctx.edges.push(
      makeEdge3(ctx, `feature__${f}`, contractId, "feature_consumes_endpoint", line, "INFERRED")
    );
  }
}
function isApiContractHeading(heading) {
  const lower = heading.toLowerCase();
  return lower.includes("api contract") || lower.includes("api contracts") || lower.includes("api endpoints") || lower === "api";
}
function parseApiContracts(ctx, bodyLines, moduleId, moduleLine, moduleName) {
  const h2Sections = partitionBodyH2(bodyLines);
  for (const sec of h2Sections) {
    if (!isApiContractHeading(sec.heading)) continue;
    parseEndpointsInSection(ctx, sec.bodyLines, moduleId, moduleName);
  }
  parseEndpointsInSection(ctx, bodyLines, moduleId, moduleName);
}
function partitionBodyH2(bodyLines) {
  const sections = [];
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];
    if (isHeadingAtLevel4(line.text, 2)) {
      const heading = line.text.slice(3).trim();
      const start = i + 1;
      let j = start;
      while (j < bodyLines.length && !isHeadingAtOrAbove4(bodyLines[j].text, 2)) j++;
      sections.push({ heading, level: 2, startLine: line.n, bodyLines: bodyLines.slice(start, j) });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}
function parseEndpointsInSection(ctx, lines, moduleId, moduleName) {
  const emittedEndpoints = new Set(ctx.nodes.filter((n) => n.entity_type === "api_contract").map((n) => n.endpoint));
  const endpointHits = [];
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].text.trim();
    const directMatch = text.match(ENDPOINT_RE);
    if (directMatch) {
      endpointHits.push({ idx: i, method: directMatch[1], path: directMatch[2], trailing: directMatch[3] ?? "" });
      continue;
    }
    if (text.includes("|")) {
      const cellRe = /\*\*(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s*]+)\*\*([^|]*)/g;
      let cm;
      while ((cm = cellRe.exec(text)) !== null) {
        endpointHits.push({ idx: i, method: cm[1], path: cm[2], trailing: cm[3] ?? "" });
      }
    }
  }
  for (const hit of endpointHits) {
    const endpoint = `${hit.method} ${hit.path}`;
    if (emittedEndpoints.has(endpoint)) continue;
    emittedEndpoints.add(endpoint);
    const headLine = lines[hit.idx];
    const nextHitIdx = endpointHits.findIndex((h) => h.idx > hit.idx);
    const blockEnd = nextHitIdx >= 0 ? endpointHits[nextHitIdx].idx : Math.min(hit.idx + 15, lines.length);
    const block = lines.slice(hit.idx + 1, blockEnd);
    let authRequired = false;
    let errorCodes = [];
    let requestSchema = "";
    let responseSchema = "";
    for (const line of block) {
      const t = line.text.trim();
      if (t.includes("|") && !t.startsWith("-")) break;
      const authMatch = t.match(/^-\s+Auth\s+required\s*:\s*(.+)$/i);
      if (authMatch) {
        authRequired = /yes/i.test(authMatch[1]);
        continue;
      }
      const errorMatch = t.match(/^-\s+Error\s+codes\s*:\s*(.+)$/i);
      if (errorMatch) {
        errorCodes = splitParenAware(errorMatch[1]).map((s) => s.trim()).filter((s) => s.length > 0);
        continue;
      }
      const reqMatch = t.match(/^-\s+Request\s*:\s*(.+)$/i);
      if (reqMatch) {
        requestSchema = reqMatch[1].trim().replace(/^`+|`+$/g, "").trim();
        continue;
      }
      const resMatch = t.match(/^-\s+Response\s*:\s*(.+)$/i);
      if (resMatch) {
        responseSchema = resMatch[1].trim().replace(/^`+|`+$/g, "").trim();
        continue;
      }
    }
    if (!authRequired && hit.trailing) {
      if (/session|auth|role=|moderator|signed.in/i.test(hit.trailing)) authRequired = true;
    }
    const node = {
      id: ids.apiContract(endpoint),
      label: endpoint,
      entity_type: "api_contract",
      source_file: ctx.mdPath,
      source_location: loc5(headLine.n),
      confidence: "EXTRACTED",
      endpoint,
      module_id: moduleId,
      request_schema: requestSchema,
      response_schema: responseSchema,
      auth_required: authRequired,
      error_codes: errorCodes
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge3(ctx, moduleId, node.id, "module_has_contract", headLine.n));
    const explicit = parseEndpointAnnotation(hit.trailing);
    const inferred = { provides: [], consumes: [] };
    if (explicit.provides.length === 0 && explicit.consumes.length === 0) {
      const pathHint = inferFeatureFromPath(hit.path);
      if (pathHint) inferred.provides.push(pathHint);
      const moduleHint = inferFeatureFromModuleName(moduleName);
      if (moduleHint) inferred.provides.push(moduleHint);
    }
    emitFeatureEdges(ctx, node.id, headLine.n, explicit, inferred);
  }
}
function parseDataModels(ctx, bodyLines, moduleId) {
  const entityRe = /^\*\*([A-Za-z][A-Za-z0-9_]*)\*\*\s*$/;
  const tableEntityRe = /^\*\*([A-Za-z][A-Za-z0-9_]*)\*\*$/;
  const entityStarts = [];
  const emittedEntities = /* @__PURE__ */ new Set();
  for (let i = 0; i < bodyLines.length; i++) {
    if (entityRe.test(bodyLines[i].text.trim())) entityStarts.push(i);
  }
  for (let ei = 0; ei < entityStarts.length; ei++) {
    const startIdx = entityStarts[ei];
    const endIdx = ei + 1 < entityStarts.length ? entityStarts[ei + 1] : bodyLines.length;
    const headLine = bodyLines[startIdx];
    const entityName = headLine.text.trim().match(entityRe)[1];
    if (emittedEntities.has(entityName.toLowerCase())) continue;
    emittedEntities.add(entityName.toLowerCase());
    let blockEnd = endIdx;
    for (let j = startIdx + 1; j < endIdx; j++) {
      if (isHeadingAtOrAbove4(bodyLines[j].text, 2)) {
        blockEnd = j;
        break;
      }
    }
    const block = bodyLines.slice(startIdx + 1, blockEnd);
    let fields = [];
    let indexes = [];
    for (const line of block) {
      const t = line.text.trim();
      const fieldsMatch = t.match(/^-\s+Fields\s*:\s*(.+)$/i);
      if (fieldsMatch) {
        fields = splitParenAware(fieldsMatch[1]).map((part) => {
          const colonIdx = part.indexOf(":");
          if (colonIdx < 0) return "";
          const name = part.slice(0, colonIdx).trim();
          let type = part.slice(colonIdx + 1).trim();
          const parenIdx = type.indexOf("(");
          if (parenIdx >= 0) type = type.slice(0, parenIdx).trim();
          return name && type ? `${name}:${type}` : "";
        }).filter((s) => s.length > 0);
        continue;
      }
      const indexMatch = t.match(/^-\s+Indexes\s*:\s*(.+)$/i);
      if (indexMatch) {
        indexes = splitParenAware(indexMatch[1]).map((part) => {
          const parenIdx = part.indexOf("(");
          return (parenIdx >= 0 ? part.slice(0, parenIdx) : part).trim();
        }).filter((s) => s.length > 0);
        continue;
      }
    }
    const node = {
      id: ids.dataModel(entityName),
      label: entityName,
      entity_type: "data_model",
      source_file: ctx.mdPath,
      source_location: loc5(headLine.n),
      confidence: "EXTRACTED",
      entity_name: entityName,
      module_id: moduleId,
      fields,
      indexes
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge3(ctx, moduleId, node.id, "module_has_data_model", headLine.n));
  }
  for (const line of bodyLines) {
    const t = line.text.trim();
    if (!t.includes("|")) continue;
    let row = t;
    if (row.startsWith("|")) row = row.slice(1);
    if (row.endsWith("|")) row = row.slice(0, -1);
    const cells = row.split("|").map((c) => c.trim());
    if (cells.length < 2) continue;
    const firstCell = cells[0];
    const entityMatch = firstCell.match(tableEntityRe);
    if (!entityMatch) continue;
    const entityName = entityMatch[1];
    if (emittedEntities.has(entityName.toLowerCase())) continue;
    emittedEntities.add(entityName.toLowerCase());
    const purpose = cells.length > 1 ? cells[1].replace(/\*\*/g, "").trim() : "";
    const node = {
      id: ids.dataModel(entityName),
      label: entityName,
      entity_type: "data_model",
      source_file: ctx.mdPath,
      source_location: loc5(line.n),
      confidence: "EXTRACTED",
      entity_name: entityName,
      module_id: moduleId,
      fields: [],
      indexes: []
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge3(ctx, moduleId, node.id, "module_has_data_model", line.n));
  }
}
function emitCrossModuleEdges(ctx, modules) {
  const entityOwner = /* @__PURE__ */ new Map();
  for (const node of ctx.nodes) {
    if (node.entity_type === "data_model") {
      const dm = node;
      entityOwner.set(dm.entity_name.toLowerCase(), dm.module_id);
    }
  }
  if (entityOwner.size === 0) return;
  const emittedEdges = /* @__PURE__ */ new Set();
  for (const mod of modules) {
    const bodyText = mod.bodyLines.map((l) => l.text).join("\n").toLowerCase();
    for (const [entity, ownerModuleId] of entityOwner) {
      if (ownerModuleId === mod.id) continue;
      if (bodyText.includes(entity)) {
        const edgeKey = `${mod.id}\u2192${ownerModuleId}`;
        if (emittedEdges.has(edgeKey)) continue;
        emittedEdges.add(edgeKey);
        ctx.edges.push(makeEdge3(ctx, mod.id, ownerModuleId, "depends_on", mod.bodyLines[0]?.n ?? 1, "INFERRED"));
      }
    }
  }
}
function extractArchitecture(input) {
  const { mdPath, mdContent } = input;
  const lines = splitLines5(mdContent);
  const ctx = { mdPath, errors: [], nodes: [], edges: [] };
  const h1Sections = partitionSections4(lines, 1, 0, lines.length);
  const candidates = [];
  for (const sec of h1Sections) {
    if (isTitleHeading(sec.heading)) continue;
    if (SKIP_HEADINGS.has(sec.heading.toLowerCase())) continue;
    candidates.push({ name: sec.heading, startLine: sec.startLine, bodyLines: sec.bodyLines });
  }
  for (const sec of h1Sections) {
    const h2s = partitionBodyH2(sec.bodyLines);
    for (const h2 of h2s) {
      const moduleMatch = h2.heading.match(/^Module\s*:\s*(.+)$/i);
      if (moduleMatch) {
        candidates.push({
          name: moduleMatch[1].trim(),
          startLine: h2.startLine,
          bodyLines: h2.bodyLines
        });
      } else if (!SKIP_HEADINGS.has(h2.heading.toLowerCase())) {
        candidates.push({
          name: h2.heading,
          startLine: h2.startLine,
          bodyLines: h2.bodyLines
        });
      }
    }
  }
  const candidateNamesLower = candidates.map((c) => c.name.toLowerCase());
  const hasRequired = REQUIRED_MODULE_NAMES.some(
    (req) => candidateNamesLower.some((cn) => cn.includes(req))
  );
  if (!hasRequired) {
    return {
      ok: false,
      errors: [
        {
          line: 1,
          message: "architecture.md has no recognizable module sections (none of: Frontend, Backend, Auth, Data Model, Security, Infrastructure)"
        }
      ]
    };
  }
  for (const cand of candidates) {
    const moduleId = ids.architectureModule(cand.name);
    const description = extractDescription(cand.bodyLines);
    const responsibilities = extractBulletsUnderH3(cand.bodyLines, "Responsibilities");
    const techStack = extractBulletsUnderH3(cand.bodyLines, "Tech Stack");
    const moduleNode = {
      id: moduleId,
      label: cand.name,
      entity_type: "architecture_module",
      source_file: mdPath,
      source_location: loc5(cand.startLine),
      confidence: "EXTRACTED",
      name: cand.name,
      description,
      responsibilities,
      tech_stack: techStack
    };
    ctx.nodes.push(moduleNode);
    parseApiContracts(ctx, cand.bodyLines, moduleId, cand.startLine, cand.name);
    const nameLower = cand.name.toLowerCase();
    if (nameLower.includes("data model") || nameLower.includes("database") || nameLower.includes("data")) {
      parseDataModels(ctx, cand.bodyLines, moduleId);
    }
  }
  emitCrossModuleEdges(ctx, candidates.map((c) => ({ id: ids.architectureModule(c.name), name: c.name, bodyLines: c.bodyLines })));
  const fragment = {
    version: 1,
    schema: "buildanything-slice-4",
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: (/* @__PURE__ */ new Date()).toISOString(),
    nodes: sortNodes5(ctx.nodes),
    edges: sortEdges5(ctx.edges)
  };
  return { ok: true, fragment, errors: [] };
}

// src/graph/parser/sprint-tasks.ts
var PRODUCED_BY6 = "planner";
var PRODUCED_AT_STEP6 = "2.3.2";
function loc6(line) {
  return `L${line}`;
}
function pushError5(ctx, line, message) {
  ctx.errors.push({ line, message });
}
function splitLines6(content) {
  return content.split(/\r?\n/).map((text, i) => ({ n: i + 1, text }));
}
function splitRow4(text) {
  let s = text.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}
var SEP_RE2 = /^\s*\|?\s*[-:| ]+\s*\|?\s*$/;
function findTables2(lines) {
  const tables = [];
  let i = 0;
  while (i < lines.length - 1) {
    const cur = lines[i];
    const next = lines[i + 1];
    if (cur.text.includes("|") && next.text.includes("|") && SEP_RE2.test(next.text)) {
      const headers = splitRow4(cur.text).map((h) => h.toLowerCase().trim());
      const rows = [];
      let j = i + 2;
      while (j < lines.length) {
        const ln = lines[j];
        if (!ln.text.includes("|")) break;
        if (SEP_RE2.test(ln.text)) {
          j++;
          continue;
        }
        const cells = splitRow4(ln.text);
        if (cells.every((c) => c === "")) {
          j++;
          continue;
        }
        const row = {};
        for (let c = 0; c < headers.length; c++) {
          row[headers[c]] = (cells[c] ?? "").trim();
        }
        rows.push({ cells: row, line: ln.n });
        j++;
      }
      tables.push({ headerLine: cur.n, headers, rows });
      i = j;
    } else {
      i++;
    }
  }
  return tables;
}
function isEmptyRef2(s) {
  const t = s.trim();
  return t === "" || t === "\u2014" || t === "-" || t === "\u2013";
}
function sortNodes6(nodes) {
  return [...nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
function sortEdges6(edges) {
  return [...edges].sort((a, b) => {
    const k = (e) => `${e.relation} ${e.source} ${e.target}`;
    return k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0;
  });
}
function makeEdge4(ctx, source, target2, relation, line) {
  return {
    source,
    target: target2,
    relation,
    confidence: "EXTRACTED",
    source_file: ctx.mdPath,
    source_location: loc6(line),
    produced_by_agent: PRODUCED_BY6,
    produced_at_step: PRODUCED_AT_STEP6
  };
}
function parseOwnsFiles(raw) {
  if (isEmptyRef2(raw)) return [];
  return raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}
var REQUIRED_COLUMNS = [
  "task id",
  "title",
  "size",
  "dependencies",
  "behavioral test",
  "owns files",
  "implementing phase",
  "feature",
  "screens"
];
var VALID_SIZES = /* @__PURE__ */ new Set(["S", "M", "L"]);
function extractSprintTasks(input) {
  const { mdPath, mdContent } = input;
  const lines = splitLines6(mdContent);
  const ctx = { mdPath, errors: [], nodes: [], edges: [] };
  const tables = findTables2(lines);
  if (tables.length === 0) {
    return {
      ok: false,
      errors: [{ line: 0, message: "No pipe tables found in sprint-tasks.md" }]
    };
  }
  const allRows = [];
  for (const table of tables) {
    if (table.headers.length < 9) {
      pushError5(
        ctx,
        table.headerLine,
        `Table has fewer than 9 columns (got ${table.headers.length})`
      );
      continue;
    }
    for (const col of REQUIRED_COLUMNS) {
      if (!table.headers.includes(col)) {
        const displayName = col.split(" ").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
        pushError5(ctx, table.headerLine, `Missing required column: '${displayName}'`);
      }
    }
    if (ctx.errors.length > 0) continue;
    for (const row of table.rows) {
      allRows.push({ row, headers: table.headers, headerLine: table.headerLine });
    }
  }
  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }
  const taskIdSeen = /* @__PURE__ */ new Map();
  for (const { row } of allRows) {
    const rawTaskId = row.cells["task id"] ?? "";
    if (rawTaskId.trim() === "") {
      pushError5(ctx, row.line, `Anonymous task at L${row.line} \u2014 Task ID is required`);
      continue;
    }
    const taskIdLower = rawTaskId.toLowerCase();
    const prev = taskIdSeen.get(taskIdLower);
    if (prev !== void 0) {
      pushError5(
        ctx,
        row.line,
        `Duplicate Task ID '${rawTaskId}' at L${prev} and L${row.line}`
      );
      continue;
    }
    taskIdSeen.set(taskIdLower, row.line);
    const size = (row.cells["size"] ?? "").trim().toUpperCase();
    if (!VALID_SIZES.has(size)) {
      pushError5(
        ctx,
        row.line,
        `Invalid Size '${(row.cells["size"] ?? "").trim()}' at L${row.line} \u2014 must be S, M, or L`
      );
      continue;
    }
    const taskId = rawTaskId.trim();
    const title = (row.cells["title"] ?? "").trim();
    const behavioralTest = (row.cells["behavioral test"] ?? "").trim();
    const implementingPhase = (row.cells["implementing phase"] ?? "").trim();
    const ownsFiles = parseOwnsFiles(row.cells["owns files"] ?? "");
    const featureRaw = (row.cells["feature"] ?? "").trim();
    const featureId = isEmptyRef2(featureRaw) ? null : ids.feature(featureRaw);
    const screensRaw = (row.cells["screens"] ?? "").trim();
    const screenIds = isEmptyRef2(screensRaw) ? [] : screensRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0).map((s) => ids.screen(s)).sort();
    const node = {
      id: ids.task(taskId),
      label: title,
      entity_type: "task",
      source_file: mdPath,
      source_location: loc6(row.line),
      confidence: "EXTRACTED",
      task_id: taskId,
      title,
      size,
      behavioral_test: behavioralTest,
      assigned_phase: implementingPhase,
      feature_id: featureId,
      screen_ids: screenIds,
      owns_files: ownsFiles
    };
    ctx.nodes.push(node);
    if (featureId) {
      ctx.edges.push(makeEdge4(ctx, node.id, featureId, "task_implements_feature", row.line));
    }
    for (const screenId of screenIds) {
      ctx.edges.push(makeEdge4(ctx, node.id, screenId, "task_touches_screen", row.line));
    }
    const depsRaw = (row.cells["dependencies"] ?? "").trim();
    if (!isEmptyRef2(depsRaw)) {
      const deps = depsRaw.split(",").map((d) => d.trim()).filter((d) => d.length > 0);
      for (const dep of deps) {
        ctx.edges.push(makeEdge4(ctx, node.id, ids.task(dep), "task_depends_on", row.line));
      }
    }
  }
  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }
  const fragment = {
    version: 1,
    schema: "buildanything-slice-4",
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: (/* @__PURE__ */ new Date()).toISOString(),
    nodes: sortNodes6(ctx.nodes),
    edges: sortEdges6(ctx.edges)
  };
  return { ok: true, fragment, errors: [] };
}

// src/graph/parser/decisions-jsonl.ts
var PRODUCED_BY7 = "orchestrator-scribe";
var PRODUCED_AT_STEP7 = "cross-phase";
var VALID_STATUSES = /* @__PURE__ */ new Set(["open", "triggered", "resolved"]);
function resolveRefToNodeId(ref) {
  const hashIdx = ref.indexOf("#");
  if (hashIdx < 0) return null;
  const file = ref.slice(0, hashIdx);
  const anchor = ref.slice(hashIdx + 1);
  if (!anchor) return null;
  if (file.endsWith("architecture.md")) {
    const slashIdx = anchor.indexOf("/");
    const moduleName = slashIdx >= 0 ? anchor.slice(0, slashIdx) : anchor;
    return ids.architectureModule(moduleName);
  }
  if (file.endsWith("design-doc.md") || file.endsWith("product-spec.md")) {
    const featureMatch = anchor.match(/^feature[- ](.+)$/i);
    if (featureMatch) return ids.feature(featureMatch[1]);
  }
  if (file.endsWith("sprint-tasks.md")) {
    return ids.task(anchor);
  }
  return null;
}
function loc7(line) {
  return `L${line}`;
}
function makeEdge5(source, target2, relation, sourceFile, line, decidedBy) {
  return {
    source,
    target: target2,
    relation,
    confidence: "EXTRACTED",
    source_file: sourceFile,
    source_location: loc7(line),
    produced_by_agent: decidedBy || PRODUCED_BY7,
    produced_at_step: PRODUCED_AT_STEP7
  };
}
function isCommentOrBlank(line) {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true;
  return trimmed.startsWith("//") || trimmed.startsWith("#");
}
function stripBom(content) {
  return content.charCodeAt(0) === 65279 ? content.slice(1) : content;
}
function validateRow(row, line) {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return { ok: false, error: { line, message: `Line ${line}: row is not a JSON object` } };
  }
  const r = row;
  const summaryRaw = r.summary ?? r.decision;
  if (typeof summaryRaw !== "string" || summaryRaw.length === 0) {
    return {
      ok: false,
      error: { line, message: `Line ${line}: missing or empty required field 'summary' (or 'decision')` }
    };
  }
  const requiredStrings = ["decision_id", "decided_by", "phase"];
  for (const field of requiredStrings) {
    if (typeof r[field] !== "string" || r[field].length === 0) {
      return {
        ok: false,
        error: { line, message: `Line ${line}: missing or empty required field '${field}'` }
      };
    }
  }
  const rel = "related_decision_id" in r ? r.related_decision_id : null;
  if (rel !== null && typeof rel !== "string") {
    return {
      ok: false,
      error: { line, message: `Line ${line}: 'related_decision_id' must be string or null` }
    };
  }
  if (typeof r.status !== "string" || !VALID_STATUSES.has(r.status)) {
    return {
      ok: false,
      error: {
        line,
        message: `Line ${line}: invalid 'status' value '${String(r.status)}' (must be open|triggered|resolved)`
      }
    };
  }
  let revisit = null;
  if ("revisit_criterion" in r) {
    const rc = r.revisit_criterion;
    if (rc !== null && typeof rc !== "string") {
      return {
        ok: false,
        error: { line, message: `Line ${line}: 'revisit_criterion' must be string or null` }
      };
    }
    revisit = rc;
  }
  let stepId = null;
  if ("step_id" in r) {
    const s = r.step_id;
    if (s !== null && typeof s !== "string") {
      return {
        ok: false,
        error: { line, message: `Line ${line}: 'step_id' must be string or null` }
      };
    }
    stepId = s;
  }
  let at;
  const atRaw = r.at ?? r.timestamp;
  if (atRaw !== void 0) {
    if (typeof atRaw !== "string") {
      return { ok: false, error: { line, message: `Line ${line}: 'at'/'timestamp' must be a string` } };
    }
    at = atRaw;
  }
  let ref = null;
  if ("ref" in r && r.ref !== void 0 && r.ref !== null) {
    if (typeof r.ref !== "string") {
      return { ok: false, error: { line, message: `Line ${line}: 'ref' must be a string or null` } };
    }
    ref = r.ref;
  }
  return {
    ok: true,
    row: {
      decision_id: r.decision_id,
      summary: summaryRaw,
      decided_by: r.decided_by,
      related_decision_id: rel,
      revisit_criterion: revisit,
      status: r.status,
      phase: r.phase,
      step_id: stepId,
      at,
      ref
    }
  };
}
function detectCycles(parsed) {
  const ids2 = new Set(parsed.map((p) => p.raw.decision_id));
  const next = /* @__PURE__ */ new Map();
  for (const p of parsed) {
    const target2 = p.raw.related_decision_id;
    if (target2 && ids2.has(target2)) next.set(p.raw.decision_id, target2);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = /* @__PURE__ */ new Map();
  for (const id of ids2) color.set(id, WHITE);
  const cycles = [];
  for (const start of ids2) {
    if (color.get(start) !== WHITE) continue;
    const path = [];
    const onPath = /* @__PURE__ */ new Set();
    let node = start;
    while (node !== void 0) {
      const c = color.get(node);
      if (c === GRAY && onPath.has(node)) {
        const idx = path.indexOf(node);
        const cycleNodes = path.slice(idx).concat(node);
        cycles.push(cycleNodes.join(" -> "));
        break;
      }
      if (c === BLACK) break;
      color.set(node, GRAY);
      path.push(node);
      onPath.add(node);
      node = next.get(node);
    }
    for (const n of path) color.set(n, BLACK);
  }
  return cycles;
}
function compareRows(a, b) {
  const aAt = a.raw.at;
  const bAt = b.raw.at;
  if (aAt && bAt) {
    if (aAt < bAt) return -1;
    if (aAt > bAt) return 1;
  } else if (aAt && !bAt) {
    return -1;
  } else if (!aAt && bAt) {
    return 1;
  }
  return a.raw.decision_id < b.raw.decision_id ? -1 : a.raw.decision_id > b.raw.decision_id ? 1 : 0;
}
function sortNodes7(nodes) {
  return [...nodes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
function sortEdges7(edges) {
  return [...edges].sort((a, b) => {
    const k = (e) => `${e.relation} ${e.source} ${e.target} ${e.source_location ?? ""}`;
    return k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0;
  });
}
function extractDecisionsJsonl(input) {
  const { mdPath } = input;
  const content = stripBom(input.mdContent);
  const errors = [];
  const lines = content.split(/\r?\n/);
  const parsed = [];
  const seenIds = /* @__PURE__ */ new Map();
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const text = lines[i];
    if (isCommentOrBlank(text)) continue;
    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ line: lineNo, message: `Line ${lineNo}: malformed JSON: ${msg}` });
      return { ok: false, errors };
    }
    const validation = validateRow(json, lineNo);
    if (!validation.ok) {
      errors.push(validation.error);
      return { ok: false, errors };
    }
    const row = validation.row;
    const prior = seenIds.get(row.decision_id);
    if (prior !== void 0) {
      errors.push({
        line: lineNo,
        message: `Line ${lineNo}: duplicate decision_id '${row.decision_id}' (first seen at line ${prior})`
      });
      return { ok: false, errors };
    }
    seenIds.set(row.decision_id, lineNo);
    parsed.push({ raw: row, line: lineNo });
  }
  parsed.sort(compareRows);
  const byId = /* @__PURE__ */ new Map();
  for (const p of parsed) byId.set(p.raw.decision_id, p);
  const nodes = [];
  const edges = [];
  for (const p of parsed) {
    const r = p.raw;
    const nodeId = ids.decision(r.decision_id);
    const node = {
      id: nodeId,
      label: r.decision_id,
      entity_type: "decision",
      source_file: mdPath,
      source_location: loc7(p.line),
      confidence: "EXTRACTED",
      decision_id: r.decision_id,
      summary: r.summary,
      decided_by: r.decided_by,
      related_decision_id: r.related_decision_id,
      revisit_criterion: r.revisit_criterion ?? null,
      status: r.status,
      phase: r.phase,
      step_id: r.step_id ?? null,
      ref: r.ref ?? null
    };
    nodes.push(node);
    if (r.related_decision_id) {
      const targetId = ids.decision(r.related_decision_id);
      const parent = byId.get(r.related_decision_id);
      let relation = "decision_relates_to";
      if (r.status === "resolved" && parent !== void 0 && (parent.raw.status === "open" || parent.raw.status === "triggered")) {
        relation = "decision_supersedes";
      }
      edges.push(makeEdge5(nodeId, targetId, relation, mdPath, p.line, r.decided_by));
    }
    if (r.ref) {
      const droveTarget = resolveRefToNodeId(r.ref);
      if (droveTarget) {
        edges.push(makeEdge5(nodeId, droveTarget, "decision_drove", mdPath, p.line, r.decided_by));
      } else {
        errors.push({ line: p.line, message: `WARNING: ref '${r.ref}' could not be resolved to a graph node` });
      }
    }
  }
  const cycles = detectCycles(parsed);
  if (cycles.length > 0) {
    return {
      ok: false,
      errors: cycles.map((cycle) => ({
        line: 0,
        message: `Cycle detected in decision relations: ${cycle}`
      }))
    };
  }
  const fragment = {
    version: 1,
    schema: "buildanything-slice-4",
    source_file: mdPath,
    source_sha: sha256Hex(input.mdContent),
    produced_at: (/* @__PURE__ */ new Date()).toISOString(),
    nodes: sortNodes7(nodes),
    edges: sortEdges7(edges)
  };
  return { ok: true, fragment, errors };
}

// src/graph/parser/screenshot.ts
var import_node_crypto2 = require("node:crypto");

// src/graph/util/dhash.ts
function dhash(bytes) {
  if (bytes.length === 0) {
    throw new Error("dhash: input bytes empty");
  }
  const len = bytes.length;
  const samples = new Uint8Array(65);
  for (let i = 0; i < 65; i++) {
    const pos = Math.min(Math.floor(i * len / 65), len - 1);
    samples[i] = bytes[pos];
  }
  let hex = "";
  for (let nibbleIdx = 0; nibbleIdx < 16; nibbleIdx++) {
    let nibble = 0;
    for (let bit = 0; bit < 4; bit++) {
      const i = nibbleIdx * 4 + bit;
      if (samples[i] > samples[i + 1]) {
        nibble |= 1 << 3 - bit;
      }
    }
    hex += nibble.toString(16);
  }
  return hex;
}

// src/graph/parser/screenshot.ts
var PRODUCED_BY_AGENT = "screenshot-extractor-stub";
var PRODUCED_AT_STEP8 = "varies";
var SCREENSHOT_STUB_CONFIDENCE = "INFERRED";
var VALID_IMAGE_CLASSES = /* @__PURE__ */ new Set(["reference", "brand_drift", "dogfood"]);
var DNA_AXIS_KEYWORDS = [
  "scope",
  "density",
  "character",
  "material",
  "motion",
  "type",
  "copy"
];
function makeEdge6(source, target2, relation, sourceFile) {
  return {
    source,
    target: target2,
    relation,
    confidence: "EXTRACTED",
    source_file: sourceFile,
    source_location: "L0",
    produced_by_agent: PRODUCED_BY_AGENT,
    produced_at_step: PRODUCED_AT_STEP8
  };
}
function basenameNoExt(filePath) {
  const last = filePath.split("/").pop() ?? filePath;
  const dotIdx = last.lastIndexOf(".");
  return dotIdx > 0 ? last.slice(0, dotIdx) : last;
}
function extractScreenshot(input) {
  const errors = [];
  const nodes = [];
  const edges = [];
  if (!input.imagePath || !input.imagePath.trim()) {
    errors.push({ message: "imagePath is empty or whitespace" });
    return { ok: false, nodes, edges, errors };
  }
  if (!input.imageBytes || input.imageBytes.length === 0) {
    errors.push({ message: "imageBytes is empty" });
    return { ok: false, nodes, edges, errors };
  }
  if (!VALID_IMAGE_CLASSES.has(input.imageClass)) {
    errors.push({
      message: `imageClass "${input.imageClass}" is not one of: reference, brand_drift, dogfood`
    });
    return { ok: false, nodes, edges, errors };
  }
  const perceptualHash = dhash(input.imageBytes);
  const contentSha8 = (0, import_node_crypto2.createHash)("sha256").update(input.imageBytes).digest("hex").slice(0, 8);
  const rawBasename = basenameNoExt(input.imagePath);
  const idBasename = `${rawBasename}--${input.imageClass}`;
  const screenshotId = ids.screenshot(kebab(idBasename), contentSha8);
  let caption;
  let dnaAxisTags;
  let dominantPalette;
  if (input.imageClass === "reference") {
    caption = "Stub caption \u2014 Slice 5 production mode dispatches a multimodal subagent";
    const lower = rawBasename.toLowerCase();
    dnaAxisTags = DNA_AXIS_KEYWORDS.filter((kw) => lower.includes(kw));
    dominantPalette = ["#000000", "#FFFFFF"];
  } else {
    caption = `Stub caption (${input.imageClass}) \u2014 Slice 5 production mode derives this from a multimodal subagent dispatch`;
    dnaAxisTags = [];
    dominantPalette = [];
  }
  const isDogfoodWithFinding = input.imageClass === "dogfood" && input.linkedFindingId && input.linkedFindingId.trim();
  const resolvedFindingId = isDogfoodWithFinding ? ids.dogfoodFinding(input.linkedFindingId) : null;
  if (isDogfoodWithFinding) {
    const findingNode = {
      id: resolvedFindingId,
      label: input.linkedFindingId,
      entity_type: "dogfood_finding",
      source_file: input.imagePath,
      source_location: "L0",
      confidence: SCREENSHOT_STUB_CONFIDENCE,
      finding_id: input.linkedFindingId,
      severity: input.findingSeverity ?? "minor",
      description: input.findingDescription ?? "Stub finding \u2014 Slice 5 production mode reads evidence/dogfood/findings.json",
      screenshot_id: screenshotId,
      affected_screen_id: input.linkedScreenId ?? null
    };
    nodes.push(findingNode);
  }
  const screenshotNode = {
    id: screenshotId,
    label: rawBasename,
    entity_type: "screenshot",
    source_file: input.imagePath,
    source_location: "L0",
    confidence: SCREENSHOT_STUB_CONFIDENCE,
    image_path: input.imagePath,
    image_class: input.imageClass,
    caption,
    perceptual_hash: perceptualHash,
    dominant_palette: dominantPalette,
    image_dimensions: "0x0",
    dna_axis_tags: dnaAxisTags,
    linked_screen_id: input.linkedScreenId ?? null,
    linked_finding_id: resolvedFindingId
  };
  nodes.push(screenshotNode);
  if (input.imageClass === "reference") {
    const detectionId = ids.imageComponentDetection(
      screenshotId,
      "stub-component",
      1
    );
    const detectionNode = {
      id: detectionId,
      label: "stub-component",
      entity_type: "image_component_detection",
      source_file: input.imagePath,
      source_location: "L0",
      confidence: SCREENSHOT_STUB_CONFIDENCE,
      screenshot_id: screenshotId,
      component_label: "stub-component",
      bounding_box: null,
      detection_confidence: null
    };
    nodes.push(detectionNode);
    edges.push(
      makeEdge6(screenshotId, detectionId, "image_has_component_detection", input.imagePath)
    );
  }
  if (input.linkedScreenId && input.linkedScreenId.trim()) {
    edges.push(
      makeEdge6(screenshotId, input.linkedScreenId, "screenshot_depicts_screen", input.imagePath)
    );
  }
  if (isDogfoodWithFinding) {
    edges.push(
      makeEdge6(screenshotId, resolvedFindingId, "screenshot_evidences_finding", input.imagePath)
    );
  }
  return { ok: true, nodes, edges, errors };
}

// src/graph/storage/index.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
function saveGraph(projectDir, fragment, targetFile = "slice-1.json") {
  const dir = (0, import_node_path.join)((0, import_node_path.resolve)(projectDir), ".buildanything", "graph");
  const target2 = (0, import_node_path.join)(dir, targetFile);
  const tmp = `${target2}.tmp`;
  (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(target2), { recursive: true });
  const content = JSON.stringify(fragment, null, 2) + "\n";
  try {
    (0, import_node_fs.writeFileSync)(tmp, content, "utf-8");
    const fd = (0, import_node_fs.openSync)(tmp, "r+");
    try {
      (0, import_node_fs.fsyncSync)(fd);
    } finally {
      (0, import_node_fs.closeSync)(fd);
    }
    (0, import_node_fs.renameSync)(tmp, target2);
  } catch (err) {
    try {
      if ((0, import_node_fs.existsSync)(tmp)) (0, import_node_fs.unlinkSync)(tmp);
    } catch {
    }
    throw err;
  }
}

// bin/graph-index.ts
var VALID_IMAGE_CLASSES2 = /* @__PURE__ */ new Set(["reference", "brand_drift", "dogfood"]);
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
function parseArgs(argv) {
  const positional2 = [];
  let imageClass;
  for (const arg of argv) {
    if (arg.startsWith("--image-class=")) {
      imageClass = arg.slice("--image-class=".length);
    } else if (arg === "--image-class") {
      import_node_process.default.stderr.write("[graph-index] error: --image-class requires =VALUE form (e.g. --image-class=reference)\n");
      import_node_process.default.exit(64);
    } else {
      positional2.push(arg);
    }
  }
  return { positional: positional2, imageClass };
}
function inferImageClassFromPath(absPath) {
  const normalized = absPath.replace(/\/+$/, "");
  if (normalized.endsWith("/design-references") || normalized.includes("/design-references/")) {
    return "reference";
  }
  if (normalized.endsWith("/evidence/brand-drift") || normalized.includes("/evidence/brand-drift/")) {
    return "brand_drift";
  }
  if (normalized.endsWith("/evidence/dogfood") || normalized.includes("/evidence/dogfood/")) {
    return "dogfood";
  }
  return null;
}
function targetFileForClass(c) {
  switch (c) {
    case "reference":
      return "slice-5-references.json";
    case "brand_drift":
      return "slice-5-brand-drift.json";
    case "dogfood":
      return "slice-5-dogfood.json";
  }
}
function collectImageFiles(dir) {
  const files = [];
  const entries = (0, import_node_fs2.readdirSync)(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = (0, import_node_path2.join)(dir, entry.name);
    if (entry.isDirectory()) {
      try {
        for (const sub of (0, import_node_fs2.readdirSync)(full, { withFileTypes: true })) {
          if (sub.isFile() && IMAGE_EXTENSIONS.has((0, import_node_path2.extname)(sub.name).toLowerCase())) {
            files.push((0, import_node_path2.join)(full, sub.name));
          }
        }
      } catch {
      }
    } else if (entry.isFile() && IMAGE_EXTENSIONS.has((0, import_node_path2.extname)(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files.sort();
}
function indexImageDirectory(absPath, imageClass) {
  const imageFiles = collectImageFiles(absPath);
  if (imageFiles.length === 0) {
    import_node_process.default.stdout.write(`[graph-index] info \u2014 no images in ${absPath}, writing empty fragment
`);
  }
  const allNodes = [];
  const allEdges = [];
  const hashChunks = [];
  const warnings = [];
  let successCount = 0;
  for (const filePath of imageFiles) {
    let bytes;
    try {
      bytes = (0, import_node_fs2.readFileSync)(filePath);
    } catch (err) {
      const msg = `failed to read ${filePath}: ${err instanceof Error ? err.message : String(err)}`;
      import_node_process.default.stderr.write(`[graph-index] warning: ${msg}
`);
      warnings.push(msg);
      continue;
    }
    hashChunks.push(bytes);
    try {
      const result = extractScreenshot({
        imagePath: (0, import_node_path2.relative)(import_node_process.default.cwd(), filePath),
        imageClass,
        imageBytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      });
      if (!result.ok) {
        const msg = `${filePath}: ${result.errors.map((e) => e.message).join("; ")}`;
        warnings.push(msg);
        continue;
      }
      allNodes.push(...result.nodes);
      allEdges.push(...result.edges);
      successCount++;
    } catch (err) {
      const msg = `${filePath}: ${err instanceof Error ? err.message : String(err)}`;
      warnings.push(msg);
      continue;
    }
  }
  if (imageFiles.length > 0 && successCount === 0) {
    for (const w of warnings) {
      import_node_process.default.stderr.write(`[graph-index] warning: ${w}
`);
    }
    import_node_process.default.exit(1);
  }
  const combined = Buffer.concat(hashChunks);
  const combinedHash = combined.length > 0 ? (0, import_node_crypto3.createHash)("sha256").update(combined).digest("hex") : "0".repeat(64);
  const relDir = (0, import_node_path2.relative)(import_node_process.default.cwd(), absPath) + "/";
  const fragment = {
    source_file: relDir,
    source_sha: combinedHash,
    produced_at: (/* @__PURE__ */ new Date()).toISOString(),
    version: 1,
    schema: "buildanything-slice-5",
    nodes: allNodes,
    edges: allEdges
  };
  const targetFile = targetFileForClass(imageClass);
  saveGraph(import_node_process.default.cwd(), fragment, targetFile);
  import_node_process.default.stdout.write(
    `[graph-index] ok \u2014 ${fragment.nodes.length} nodes, ${fragment.edges.length} edges \u2192 .buildanything/graph/${targetFile}
`
  );
  if (imageFiles.length > 0) {
    for (const w of warnings) {
      import_node_process.default.stdout.write(`[graph-index] warning: ${w}
`);
    }
    import_node_process.default.stdout.write(`[graph-index] indexed ${successCount}/${imageFiles.length} images; ${warnings.length} warnings
`);
  }
}
var { positional, imageClass: explicitImageClass } = parseArgs(import_node_process.default.argv.slice(2));
var target = positional[0];
if (!target) {
  import_node_process.default.stderr.write(
    "Usage: graph-index <path> [--image-class=reference|brand_drift|dogfood]\n  Recognized basenames: product-spec.md, DESIGN.md, component-manifest.md, architecture.md, sprint-tasks.md, decisions.jsonl\n  Directory mode: page-specs/ \u2192 indexes all *.md files inside\n  Image directory mode: design-references/ | evidence/brand-drift/ | evidence/dogfood/ \u2192 indexes all images\n  DESIGN.md produces both slice-2-dna.json (Pass 1) and slice-3-tokens.json (Pass 2, if tokens found)\n"
  );
  import_node_process.default.exit(64);
}
if (explicitImageClass !== void 0 && !VALID_IMAGE_CLASSES2.has(explicitImageClass)) {
  import_node_process.default.stderr.write(`[graph-index] error: --image-class must be one of: reference, brand_drift, dogfood (got: ${explicitImageClass})
`);
  import_node_process.default.exit(64);
}
try {
  const absPath = (0, import_node_path2.resolve)(target);
  let isDir = false;
  try {
    isDir = (0, import_node_fs2.statSync)(absPath).isDirectory();
  } catch {
  }
  if (isDir) {
    if ((0, import_node_path2.basename)(absPath) === "page-specs") {
      const mdFiles = (0, import_node_fs2.readdirSync)(absPath).filter((f) => f.endsWith(".md")).sort();
      if (mdFiles.length === 0) {
        import_node_process.default.stderr.write(`[graph-index] error: no .md files found in directory: ${absPath}
`);
        import_node_process.default.exit(1);
      }
      const allNodes = [];
      const allEdges = [];
      const contents = [];
      for (const file of mdFiles) {
        const filePath = (0, import_node_path2.join)(absPath, file);
        const content = (0, import_node_fs2.readFileSync)(filePath, "utf-8");
        contents.push(content);
        const result2 = extractPageSpec({ mdPath: filePath, mdContent: content });
        if (!result2.ok) {
          for (const err of result2.errors) {
            import_node_process.default.stderr.write(`[graph-index] ${file} L${err.line}: ${err.message}
`);
          }
          import_node_process.default.stderr.write(`[graph-index] fatal: page-spec parse failed for ${file}
`);
          import_node_process.default.exit(1);
        }
        allNodes.push(...result2.fragment.nodes);
        allEdges.push(...result2.fragment.edges);
      }
      const combinedHash = (0, import_node_crypto3.createHash)("sha256").update(contents.join("")).digest("hex");
      const relDir = (0, import_node_path2.relative)(import_node_process.default.cwd(), absPath) + "/";
      const fragment = {
        source_file: relDir,
        source_sha: combinedHash,
        produced_at: (/* @__PURE__ */ new Date()).toISOString(),
        version: 1,
        schema: "buildanything-slice-3",
        nodes: allNodes,
        edges: allEdges
      };
      saveGraph(import_node_process.default.cwd(), fragment, "slice-3-pages.json");
      import_node_process.default.stdout.write(
        `[graph-index] ok \u2014 ${fragment.nodes.length} nodes, ${fragment.edges.length} edges \u2192 .buildanything/graph/slice-3-pages.json
`
      );
      import_node_process.default.exit(0);
    }
    const inferred = inferImageClassFromPath(absPath);
    const resolvedClass = explicitImageClass ?? inferred;
    if (resolvedClass !== null) {
      indexImageDirectory(absPath, resolvedClass);
      import_node_process.default.exit(0);
    }
    import_node_process.default.stderr.write(
      `[graph-index] error: directory ${absPath} is not a recognized indexer target.
  Markdown directory: page-specs/
  Image directories (auto-detected): design-references/, evidence/brand-drift/, evidence/dogfood/
  Or pass --image-class=reference|brand_drift|dogfood to force.
`
    );
    import_node_process.default.exit(64);
  }
  if (!(() => {
    try {
      (0, import_node_fs2.readFileSync)(absPath);
      return true;
    } catch {
      return false;
    }
  })()) {
    import_node_process.default.stderr.write(
      "Usage: graph-index <path>\n  Recognized basenames: product-spec.md, DESIGN.md, component-manifest.md, architecture.md, sprint-tasks.md, decisions.jsonl\n  Directory mode: pass a page-specs/ directory to index all *.md files inside\n"
    );
    import_node_process.default.exit(64);
  }
  const mdContent = (0, import_node_fs2.readFileSync)(absPath, "utf-8");
  const base = (0, import_node_path2.basename)(absPath);
  let result;
  let targetFile;
  if (base === "product-spec.md") {
    result = extractProductSpec({ mdPath: absPath, mdContent });
    targetFile = "slice-1.json";
  } else if (base === "DESIGN.md") {
    result = extractDesignMd({ mdPath: absPath, mdContent });
    targetFile = "slice-2-dna.json";
  } else if (base === "component-manifest.md") {
    result = extractComponentManifest({ mdPath: absPath, mdContent });
    targetFile = "slice-2-manifest.json";
  } else if (base === "architecture.md") {
    result = extractArchitecture({ mdPath: absPath, mdContent });
    targetFile = "slice-4-architecture.json";
  } else if (base === "sprint-tasks.md") {
    result = extractSprintTasks({ mdPath: absPath, mdContent });
    targetFile = "slice-4-tasks.json";
  } else if (base === "decisions.jsonl") {
    result = extractDecisionsJsonl({ mdPath: absPath, mdContent });
    targetFile = "slice-4-decisions.json";
  } else {
    import_node_process.default.stderr.write(
      `Usage: graph-index <path>
  Recognized basenames: product-spec.md, DESIGN.md, component-manifest.md, architecture.md, sprint-tasks.md, decisions.jsonl
  Directory mode: pass a page-specs/ directory to index all *.md files inside
  Got: ${base}
`
    );
    import_node_process.default.exit(64);
  }
  if (result.ok) {
    const fragment = result.fragment;
    saveGraph(import_node_process.default.cwd(), fragment, targetFile);
    import_node_process.default.stdout.write(
      `[graph-index] ok \u2014 ${fragment.nodes.length} nodes, ${fragment.edges.length} edges \u2192 .buildanything/graph/${targetFile}
`
    );
  } else {
    for (const err of result.errors) {
      import_node_process.default.stderr.write(`[graph-index] L${err.line}: ${err.message}
`);
    }
    import_node_process.default.exit(1);
  }
  if (base === "DESIGN.md") {
    const pass2 = extractDesignMdTokens({ mdPath: absPath, mdContent });
    if (pass2.ok && pass2.fragment.nodes.length > 0) {
      saveGraph(import_node_process.default.cwd(), pass2.fragment, "slice-3-tokens.json");
      import_node_process.default.stdout.write(
        `[graph-index] ok \u2014 ${pass2.fragment.nodes.length} nodes, ${pass2.fragment.edges.length} edges \u2192 .buildanything/graph/slice-3-tokens.json
`
      );
    } else if (!pass2.ok) {
      for (const err of pass2.errors) {
        import_node_process.default.stderr.write(`[graph-index] warning (Pass 2): L${err.line}: ${err.message}
`);
      }
    }
    if (pass2.ok && pass2.fragment.nodes.length === 0 || !pass2.ok) {
      const stalePath = (0, import_node_path2.join)(import_node_process.default.cwd(), ".buildanything", "graph", "slice-3-tokens.json");
      try {
        if ((0, import_node_fs2.existsSync)(stalePath)) {
          (0, import_node_fs2.unlinkSync)(stalePath);
          import_node_process.default.stdout.write("[graph-index] Pass 2 empty \u2014 removed stale slice-3-tokens.json\n");
        }
      } catch {
      }
    }
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  import_node_process.default.stderr.write(`[graph-index] fatal: ${msg}
`);
  import_node_process.default.exit(2);
}
