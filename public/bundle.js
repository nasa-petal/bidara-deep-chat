var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_custom_element_data(node, prop, value) {
        if (prop in node) {
            node[prop] = typeof node[prop] === 'boolean' && value === '' ? true : value;
        }
        else {
            attr(node, prop, value);
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
    function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
    function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
    function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
    function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e2) { throw _e2; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e3) { didErr = true; err = _e3; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }
    function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
    function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
    function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }
    function _construct(Parent, args, Class) { if (_isNativeReflectConstruct()) { _construct = Reflect.construct.bind(); } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }
    function _isNativeFunction(fn) { try { return Function.toString.call(fn).indexOf("[native code]") !== -1; } catch (e) { return typeof fn === "function"; } }
    function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); Object.defineProperty(subClass, "prototype", { writable: false }); if (superClass) _setPrototypeOf(subClass, superClass); }
    function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }
    function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = _getPrototypeOf(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }
    function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } else if (call !== void 0) { throw new TypeError("Derived constructors may only return object or undefined"); } return _assertThisInitialized(self); }
    function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }
    function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }
    function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }
    function _regeneratorRuntime() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/facebook/regenerator/blob/main/LICENSE */ _regeneratorRuntime = function _regeneratorRuntime() { return e; }; var t, e = {}, r = Object.prototype, n = r.hasOwnProperty, o = Object.defineProperty || function (t, e, r) { t[e] = r.value; }, i = "function" == typeof Symbol ? Symbol : {}, a = i.iterator || "@@iterator", c = i.asyncIterator || "@@asyncIterator", u = i.toStringTag || "@@toStringTag"; function define(t, e, r) { return Object.defineProperty(t, e, { value: r, enumerable: !0, configurable: !0, writable: !0 }), t[e]; } try { define({}, ""); } catch (t) { define = function define(t, e, r) { return t[e] = r; }; } function wrap(t, e, r, n) { var i = e && e.prototype instanceof Generator ? e : Generator, a = Object.create(i.prototype), c = new Context(n || []); return o(a, "_invoke", { value: makeInvokeMethod(t, r, c) }), a; } function tryCatch(t, e, r) { try { return { type: "normal", arg: t.call(e, r) }; } catch (t) { return { type: "throw", arg: t }; } } e.wrap = wrap; var h = "suspendedStart", l = "suspendedYield", f = "executing", s = "completed", y = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} var p = {}; define(p, a, function () { return this; }); var d = Object.getPrototypeOf, v = d && d(d(values([]))); v && v !== r && n.call(v, a) && (p = v); var g = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(p); function defineIteratorMethods(t) { ["next", "throw", "return"].forEach(function (e) { define(t, e, function (t) { return this._invoke(e, t); }); }); } function AsyncIterator(t, e) { function invoke(r, o, i, a) { var c = tryCatch(t[r], t, o); if ("throw" !== c.type) { var u = c.arg, h = u.value; return h && "object" == _typeof(h) && n.call(h, "__await") ? e.resolve(h.__await).then(function (t) { invoke("next", t, i, a); }, function (t) { invoke("throw", t, i, a); }) : e.resolve(h).then(function (t) { u.value = t, i(u); }, function (t) { return invoke("throw", t, i, a); }); } a(c.arg); } var r; o(this, "_invoke", { value: function value(t, n) { function callInvokeWithMethodAndArg() { return new e(function (e, r) { invoke(t, n, e, r); }); } return r = r ? r.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg(); } }); } function makeInvokeMethod(e, r, n) { var o = h; return function (i, a) { if (o === f) throw new Error("Generator is already running"); if (o === s) { if ("throw" === i) throw a; return { value: t, done: !0 }; } for (n.method = i, n.arg = a;;) { var c = n.delegate; if (c) { var u = maybeInvokeDelegate(c, n); if (u) { if (u === y) continue; return u; } } if ("next" === n.method) n.sent = n._sent = n.arg;else if ("throw" === n.method) { if (o === h) throw o = s, n.arg; n.dispatchException(n.arg); } else "return" === n.method && n.abrupt("return", n.arg); o = f; var p = tryCatch(e, r, n); if ("normal" === p.type) { if (o = n.done ? s : l, p.arg === y) continue; return { value: p.arg, done: n.done }; } "throw" === p.type && (o = s, n.method = "throw", n.arg = p.arg); } }; } function maybeInvokeDelegate(e, r) { var n = r.method, o = e.iterator[n]; if (o === t) return r.delegate = null, "throw" === n && e.iterator["return"] && (r.method = "return", r.arg = t, maybeInvokeDelegate(e, r), "throw" === r.method) || "return" !== n && (r.method = "throw", r.arg = new TypeError("The iterator does not provide a '" + n + "' method")), y; var i = tryCatch(o, e.iterator, r.arg); if ("throw" === i.type) return r.method = "throw", r.arg = i.arg, r.delegate = null, y; var a = i.arg; return a ? a.done ? (r[e.resultName] = a.value, r.next = e.nextLoc, "return" !== r.method && (r.method = "next", r.arg = t), r.delegate = null, y) : a : (r.method = "throw", r.arg = new TypeError("iterator result is not an object"), r.delegate = null, y); } function pushTryEntry(t) { var e = { tryLoc: t[0] }; 1 in t && (e.catchLoc = t[1]), 2 in t && (e.finallyLoc = t[2], e.afterLoc = t[3]), this.tryEntries.push(e); } function resetTryEntry(t) { var e = t.completion || {}; e.type = "normal", delete e.arg, t.completion = e; } function Context(t) { this.tryEntries = [{ tryLoc: "root" }], t.forEach(pushTryEntry, this), this.reset(!0); } function values(e) { if (e || "" === e) { var r = e[a]; if (r) return r.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) { var o = -1, i = function next() { for (; ++o < e.length;) if (n.call(e, o)) return next.value = e[o], next.done = !1, next; return next.value = t, next.done = !0, next; }; return i.next = i; } } throw new TypeError(_typeof(e) + " is not iterable"); } return GeneratorFunction.prototype = GeneratorFunctionPrototype, o(g, "constructor", { value: GeneratorFunctionPrototype, configurable: !0 }), o(GeneratorFunctionPrototype, "constructor", { value: GeneratorFunction, configurable: !0 }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, u, "GeneratorFunction"), e.isGeneratorFunction = function (t) { var e = "function" == typeof t && t.constructor; return !!e && (e === GeneratorFunction || "GeneratorFunction" === (e.displayName || e.name)); }, e.mark = function (t) { return Object.setPrototypeOf ? Object.setPrototypeOf(t, GeneratorFunctionPrototype) : (t.__proto__ = GeneratorFunctionPrototype, define(t, u, "GeneratorFunction")), t.prototype = Object.create(g), t; }, e.awrap = function (t) { return { __await: t }; }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, c, function () { return this; }), e.AsyncIterator = AsyncIterator, e.async = function (t, r, n, o, i) { void 0 === i && (i = Promise); var a = new AsyncIterator(wrap(t, r, n, o), i); return e.isGeneratorFunction(r) ? a : a.next().then(function (t) { return t.done ? t.value : a.next(); }); }, defineIteratorMethods(g), define(g, u, "Generator"), define(g, a, function () { return this; }), define(g, "toString", function () { return "[object Generator]"; }), e.keys = function (t) { var e = Object(t), r = []; for (var n in e) r.push(n); return r.reverse(), function next() { for (; r.length;) { var t = r.pop(); if (t in e) return next.value = t, next.done = !1, next; } return next.done = !0, next; }; }, e.values = values, Context.prototype = { constructor: Context, reset: function reset(e) { if (this.prev = 0, this.next = 0, this.sent = this._sent = t, this.done = !1, this.delegate = null, this.method = "next", this.arg = t, this.tryEntries.forEach(resetTryEntry), !e) for (var r in this) "t" === r.charAt(0) && n.call(this, r) && !isNaN(+r.slice(1)) && (this[r] = t); }, stop: function stop() { this.done = !0; var t = this.tryEntries[0].completion; if ("throw" === t.type) throw t.arg; return this.rval; }, dispatchException: function dispatchException(e) { if (this.done) throw e; var r = this; function handle(n, o) { return a.type = "throw", a.arg = e, r.next = n, o && (r.method = "next", r.arg = t), !!o; } for (var o = this.tryEntries.length - 1; o >= 0; --o) { var i = this.tryEntries[o], a = i.completion; if ("root" === i.tryLoc) return handle("end"); if (i.tryLoc <= this.prev) { var c = n.call(i, "catchLoc"), u = n.call(i, "finallyLoc"); if (c && u) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } else if (c) { if (this.prev < i.catchLoc) return handle(i.catchLoc, !0); } else { if (!u) throw new Error("try statement without catch or finally"); if (this.prev < i.finallyLoc) return handle(i.finallyLoc); } } } }, abrupt: function abrupt(t, e) { for (var r = this.tryEntries.length - 1; r >= 0; --r) { var o = this.tryEntries[r]; if (o.tryLoc <= this.prev && n.call(o, "finallyLoc") && this.prev < o.finallyLoc) { var i = o; break; } } i && ("break" === t || "continue" === t) && i.tryLoc <= e && e <= i.finallyLoc && (i = null); var a = i ? i.completion : {}; return a.type = t, a.arg = e, i ? (this.method = "next", this.next = i.finallyLoc, y) : this.complete(a); }, complete: function complete(t, e) { if ("throw" === t.type) throw t.arg; return "break" === t.type || "continue" === t.type ? this.next = t.arg : "return" === t.type ? (this.rval = this.arg = t.arg, this.method = "return", this.next = "end") : "normal" === t.type && e && (this.next = e), y; }, finish: function finish(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.finallyLoc === t) return this.complete(r.completion, r.afterLoc), resetTryEntry(r), y; } }, "catch": function _catch(t) { for (var e = this.tryEntries.length - 1; e >= 0; --e) { var r = this.tryEntries[e]; if (r.tryLoc === t) { var n = r.completion; if ("throw" === n.type) { var o = n.arg; resetTryEntry(r); } return o; } } throw new Error("illegal catch attempt"); }, delegateYield: function delegateYield(e, r, n) { return this.delegate = { iterator: values(e), resultName: r, nextLoc: n }, "next" === this.method && (this.arg = t), y; } }, e; }
    function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }
    function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }
    function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
    function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
    function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
    function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
    function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
    function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
    function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
    var bs = /*#__PURE__*/function () {
      function bs() {
        _classCallCheck(this, bs);
      }
      _createClass(bs, null, [{
        key: "render",
        value: function render(e, t) {
          var i = document.createElement("div");
          i.id = "error-view", i.innerText = t, e.replaceChildren(i);
        }
      }]);
      return bs;
    }();
    var Dt = /*#__PURE__*/function () {
      function Dt() {
        _classCallCheck(this, Dt);
      }
      _createClass(Dt, null, [{
        key: "onLoad",
        value: function onLoad(e) {
          e.innerHTML = '<div id="large-loading-ring"></div>';
        }
      }, {
        key: "createElements",
        value: function createElements() {
          var e = document.createElement("div");
          return e.id = "validate-property-key-view", e;
        }
      }, {
        key: "render",
        value: function render(e, t, i) {
          var n = Dt.createElements(),
            r = {
              onSuccess: t,
              onFail: bs.render.bind(this, e, "Your 'key' has failed authentication"),
              onLoad: Dt.onLoad.bind(this, n)
            };
          i.key && i.verifyKey(i.key, r), e.replaceChildren(n);
        }
      }]);
      return Dt;
    }();
    var T = /*#__PURE__*/function () {
      function T() {
        _classCallCheck(this, T);
      }
      _createClass(T, null, [{
        key: "unsetStyle",
        value: function unsetStyle(e, t) {
          var i = Object.keys(t).reduce(function (n, r) {
            return n[r] = "", n;
          }, {});
          Object.assign(e.style, i);
        }
      }, {
        key: "unsetActivityCSSMouseStates",
        value: function unsetActivityCSSMouseStates(e, t) {
          t.click && T.unsetStyle(e, t.click), t.hover && T.unsetStyle(e, t.hover);
        }
      }, {
        key: "unsetAllCSSMouseStates",
        value: function unsetAllCSSMouseStates(e, t) {
          T.unsetActivityCSSMouseStates(e, t), t["default"] && T.unsetStyle(e, t["default"]);
        }
      }, {
        key: "processStateful",
        value: function processStateful(e, t, i) {
          var n = e["default"] || {},
            r = Object.assign(JSON.parse(JSON.stringify(_objectSpread(_objectSpread({}, n), t))), e == null ? void 0 : e.hover),
            o = Object.assign(JSON.parse(JSON.stringify(_objectSpread(_objectSpread({}, r), i))), e == null ? void 0 : e.click);
          return {
            "default": n,
            hover: r,
            click: o
          };
        }
      }, {
        key: "mergeStatefulStyles",
        value: function mergeStatefulStyles(e) {
          var t = {
            "default": {},
            hover: {},
            click: {}
          };
          return e.forEach(function (i) {
            t["default"] = Object.assign(t["default"], i["default"]), t.hover = Object.assign(t.hover, i.hover), t.click = Object.assign(t.click, i.click);
          }), t;
        }
      }, {
        key: "overwriteDefaultWithAlreadyApplied",
        value: function overwriteDefaultWithAlreadyApplied(e, t) {
          Object.keys(e["default"] || []).forEach(function (i) {
            var r;
            var n = i;
            t.style[n] && (r = e["default"]) != null && r[n] && (e["default"][i] = t.style[n]);
          });
        }
      }, {
        key: "applyToStyleIfNotDefined",
        value: function applyToStyleIfNotDefined(e, t) {
          for (var i in t) {
            var n = t[i];
            e[i] === "" && n && (e[i] = n);
          }
        }
      }]);
      return T;
    }();
    var Bn = /*#__PURE__*/function () {
      function Ot() {
        _classCallCheck(this, Ot);
      }
      _createClass(Ot, null, [{
        key: "apply",
        value: function apply(e, t) {
          if (t) try {
            Ot.applyStyleSheet(e, t);
          } catch (_unused) {
            Ot.addStyleElement(e, t);
          }
        }
      }, {
        key: "applyStyleSheet",
        value: function applyStyleSheet(e, t) {
          var i = new CSSStyleSheet();
          i.replaceSync(e), t.adoptedStyleSheets.push(i);
        }
      }, {
        key: "addStyleElement",
        value: function addStyleElement(e, t) {
          var i = document.createElement("style");
          i.innerHTML = e, t.appendChild(i);
        }
      }, {
        key: "applyDefaultStyleToComponent",
        value: function applyDefaultStyleToComponent(e, t) {
          t && T.applyToStyleIfNotDefined(e, t), T.applyToStyleIfNotDefined(e, Ot.DEFAULT_COMPONENT_STYLE);
        }
      }]);
      return Ot;
    }();
    Bn.DEFAULT_COMPONENT_STYLE = {
      height: "350px",
      width: "320px",
      border: "1px solid #cacaca",
      fontFamily: "'Inter', sans-serif, Avenir, Helvetica, Arial",
      fontSize: "0.9rem",
      backgroundColor: "white",
      position: "relative",
      // this is used to prevent inputAreaStyle background color from going beyond the container's rounded border
      // it will cause issues if there are elements that are meant to be outside of the chat component and in
      // that instance they should overwrite this
      // this is also causing the chat to squeeze when there is no space
      overflow: "hidden"
    };
    var Ei = Bn;
    var R = /* @__PURE__ */function (s) {
      return s.ESCAPE = "Escape", s.ENTER = "Enter", s.TAB = "Tab", s.ARROW_UP = "ArrowUp", s.ARROW_DOWN = "ArrowDown", s.ARROW_RIGHT = "ArrowRight", s.ARROW_LEFT = "ArrowLeft", s.BACKSPACE = "Backspace", s.DELETE = "Delete", s.META = "Meta", s.CONTROL = "Control", s;
    }(R || {});
    var ge = /*#__PURE__*/_createClass(function ge() {
      _classCallCheck(this, ge);
    });
    ge.IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    ge.IS_CHROMIUM = window.chrome;
    var zn = /*#__PURE__*/function () {
      function nt() {
        _classCallCheck(this, nt);
      }
      _createClass(nt, null, [{
        key: "add",
        value: function add(e, t, i) {
          t !== void 0 && e.addEventListener("keydown", nt.onKeyDown.bind(this, t)), e.oninput = nt.onInput.bind(this, t, i);
        }
        // preventing insertion early for a nicer UX
        // prettier-ignore
      }, {
        key: "onKeyDown",
        value: function onKeyDown(e, t) {
          var n = t.target.textContent;
          n && n.length >= e && !nt.PERMITTED_KEYS.has(t.key) && !nt.isKeyCombinationPermitted(t) && t.preventDefault();
        }
      }, {
        key: "isKeyCombinationPermitted",
        value: function isKeyCombinationPermitted(e) {
          return e.key === "a" ? e.ctrlKey || e.metaKey : !1;
        }
      }, {
        key: "onInput",
        value: function onInput(e, t, i) {
          var n = i.target,
            r = n.textContent || "";
          e !== void 0 && r.length > e && (n.textContent = r.substring(0, e), Qt.focusEndOfInput(n)), t == null || t();
        }
      }]);
      return nt;
    }();
    zn.PERMITTED_KEYS = /* @__PURE__ */new Set([R.BACKSPACE, R.DELETE, R.ARROW_RIGHT, R.ARROW_LEFT, R.ARROW_DOWN, R.ARROW_UP, R.META, R.CONTROL, R.ENTER]);
    var vs = zn;
    var ys = /*#__PURE__*/function () {
      function ys() {
        _classCallCheck(this, ys);
      }
      _createClass(ys, null, [{
        key: "sanitizePastedTextContent",
        value: function sanitizePastedTextContent(e) {
          var i, n;
          e.preventDefault();
          var t = (i = e.clipboardData) == null ? void 0 : i.getData("text/plain");
          (n = document.execCommand) == null || n.call(document, "insertHTML", !1, t);
        }
      }]);
      return ys;
    }();
    var Un = /*#__PURE__*/function () {
      function qe(e, t) {
        var _this = this;
        _classCallCheck(this, qe);
        var n;
        var i = qe.processConfig(t, e.textInput);
        this.elementRef = qe.createContainerElement((n = i == null ? void 0 : i.styles) == null ? void 0 : n.container), this.inputElementRef = this.createInputElement(i), this._config = i, this.elementRef.appendChild(this.inputElementRef), setTimeout(function () {
          var r;
          vs.add(_this.inputElementRef, (r = e.textInput) == null ? void 0 : r.characterLimit, e._validationHandler);
        });
      }
      _createClass(qe, [{
        key: "createInputElement",
        value: function createInputElement(e) {
          var i, n, r;
          var t = document.createElement("div");
          return t.id = qe.TEXT_INPUT_ID, t.classList.add("text-input-styling", "text-input-placeholder"), t.innerText = ((i = e == null ? void 0 : e.placeholder) == null ? void 0 : i.text) || "Ask me anything!", ge.IS_CHROMIUM && qe.preventAutomaticScrollUpOnNewLine(t), typeof (e == null ? void 0 : e.disabled) == "boolean" && e.disabled === !0 ? (t.contentEditable = "false", t.classList.add("text-input-disabled")) : (t.contentEditable = "true", this.addEventListeners(t, e)), Object.assign(t.style, (n = e == null ? void 0 : e.styles) == null ? void 0 : n.text), Object.assign(t.style, (r = e == null ? void 0 : e.placeholder) == null ? void 0 : r.style), t;
        }
      }, {
        key: "removeTextIfPlaceholder",
        value: function removeTextIfPlaceholder() {
          var e, t, i, n;
          this.inputElementRef.classList.contains("text-input-placeholder") && !this.inputElementRef.classList.contains("text-input-disabled") && ((e = this._config.placeholder) != null && e.style && (T.unsetStyle(this.inputElementRef, (t = this._config.placeholder) == null ? void 0 : t.style), Object.assign(this.inputElementRef.style, (n = (i = this._config) == null ? void 0 : i.styles) == null ? void 0 : n.text)), qe.clear(this.inputElementRef), this.inputElementRef.classList.remove("text-input-placeholder"));
        }
      }, {
        key: "addEventListeners",
        value: function addEventListeners(e, t) {
          var i, n, r;
          e.onfocus = this.onFocus.bind(this, (i = t == null ? void 0 : t.styles) == null ? void 0 : i.focus), (n = t == null ? void 0 : t.styles) != null && n.focus && (e.onblur = this.onBlur.bind(this, t.styles.focus, (r = t == null ? void 0 : t.styles) == null ? void 0 : r.container)), e.addEventListener("keydown", this.onKeydown.bind(this)), e.onpaste = ys.sanitizePastedTextContent;
        }
      }, {
        key: "onFocus",
        value: function onFocus(e) {
          var _this2 = this;
          ge.IS_SAFARI ? setTimeout(function () {
            _this2.removeTextIfPlaceholder();
          }) : this.removeTextIfPlaceholder(), Object.assign(this.elementRef.style, e);
        }
      }, {
        key: "onBlur",
        value: function onBlur(e, t) {
          T.unsetStyle(this.elementRef, e), t && Object.assign(this.elementRef.style, t);
        }
      }, {
        key: "onKeydown",
        value: function onKeydown(e) {
          var t;
          e.key === R.ENTER && !e.ctrlKey && !e.shiftKey && (e.preventDefault(), (t = this.submit) == null || t.call(this));
        }
      }], [{
        key: "processConfig",
        value: function processConfig(e, t) {
          var _t2, _t$disabled, _t$placeholder, _i$text;
          var i;
          return (_t2 = t) !== null && _t2 !== void 0 ? _t2 : t = {}, (_t$disabled = t.disabled) !== null && _t$disabled !== void 0 ? _t$disabled : t.disabled = e.isTextInputDisabled, (_t$placeholder = t.placeholder) !== null && _t$placeholder !== void 0 ? _t$placeholder : t.placeholder = {}, (_i$text = (i = t.placeholder).text) !== null && _i$text !== void 0 ? _i$text : i.text = e.textInputPlaceholderText, t;
        }
        // this is is a bug fix where if the browser is scrolled down and the user types in text that creates new line
        // the browser scrollbar will move up which leads to undesirable UX.
        // More details in this Stack Overflow question:
        // https://stackoverflow.com/questions/76285135/prevent-automatic-scroll-when-text-is-inserted-into-contenteditable-div
        // prettier-ignore
      }, {
        key: "preventAutomaticScrollUpOnNewLine",
        value: function preventAutomaticScrollUpOnNewLine(e) {
          var t;
          e.addEventListener("keydown", function () {
            t = window.scrollY;
          }), e.addEventListener("input", function () {
            t !== window.scrollY && window.scrollTo({
              top: t
            });
          });
        }
        // this also similarly prevents scroll up
      }, {
        key: "clear",
        value: function clear(e) {
          var t = window.scrollY;
          e.classList.contains("text-input-disabled") || (e.textContent = ""), ge.IS_CHROMIUM && window.scrollTo({
            top: t
          });
        }
      }, {
        key: "toggleEditability",
        value: function toggleEditability(e, t) {
          e.contentEditable = t ? "true" : "false";
        }
      }, {
        key: "createContainerElement",
        value: function createContainerElement(e) {
          var t = document.createElement("div");
          return t.id = "text-input-container", Object.assign(t.style, e), t;
        }
      }]);
      return qe;
    }();
    Un.TEXT_INPUT_ID = "text-input";
    var qi = Un;
    var Qt = /*#__PURE__*/function () {
      function Qt() {
        _classCallCheck(this, Qt);
      }
      _createClass(Qt, null, [{
        key: "focusEndOfInput",
        value: function focusEndOfInput(e) {
          var t = document.createRange();
          t.selectNodeContents(e), t.collapse(!1);
          var i = window.getSelection();
          i == null || i.removeAllRanges(), i == null || i.addRange(t);
        }
      }, {
        key: "focusFromParentElement",
        value: function focusFromParentElement(e) {
          var t = e.querySelector("#".concat(qi.TEXT_INPUT_ID));
          t && Qt.focusEndOfInput(t);
        }
      }]);
      return Qt;
    }();
    function on(s) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    function xs(s) {
      return s && JSON.stringify(s);
    }
    function Hi(s, e, t, i) {
      var n = "\n".concat(on(e), " message: ").concat(JSON.stringify(s), " \n"),
        r = t ? "".concat(on(e), " message after interceptor: ").concat(xs(i), " \n") : "";
      return n + r;
    }
    function Es(s, e, t, i) {
      return "".concat(Hi(s, e, t, i), "Make sure the ").concat(e, " message is using the Response format: https://deepchat.dev/docs/connect/#Response \nYou can also augment it using the responseInterceptor property: https://deepchat.dev/docs/interceptors#responseInterceptor");
    }
    function Ss(s, e, t) {
      var i = "response";
      return "".concat(Hi(s, i, e, t), "Make sure the ").concat(i, " message is using the {text: string} format, e.g: {text: \"Model Response\"}");
    }
    function ws(s, e) {
      var t = "request";
      return "".concat(Hi(s, t, e), "Make sure the ").concat(t, " message is using the {body: {text: string}} format, e.g: {body: {text: \"Model Response\"}}");
    }
    var an = "Make sure the events are using {text: string} or {html: string} format.\nYou can also augment them using the responseInterceptor property: https://deepchat.dev/docs/interceptors#responseInterceptor",
      C = {
        INVALID_KEY: "Invalid API Key",
        CONNECTION_FAILED: "Failed to connect",
        INVALID_RESPONSE: Es,
        INVALID_MODEL_REQUEST: ws,
        INVALID_MODEL_RESPONSE: Ss,
        INVALID_STREAM_EVENT: an,
        INVALID_STREAM_EVENT_MIX: "Cannot mix {text: string} and {html: string} responses.",
        NO_VALID_STREAM_EVENTS_SENT: "No valid stream events were sent.\n".concat(an)
      },
      qn = /*#__PURE__*/function () {
        function Hn() {
          _classCallCheck(this, Hn);
        }
        _createClass(Hn, null, [{
          key: "addElements",
          value: function addElements(e) {
            for (var _len = arguments.length, t = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
              t[_key - 1] = arguments[_key];
            }
            t.forEach(function (i) {
              return e.appendChild(i);
            });
          }
        }, {
          key: "isScrollbarAtBottomOfElement",
          value: function isScrollbarAtBottomOfElement(e) {
            var t = e.scrollHeight,
              i = e.clientHeight,
              n = e.scrollTop,
              r = t - i;
            return n >= r - Hn.CODE_SNIPPET_GENERATION_JUMP;
          }
        }, {
          key: "cloneElement",
          value: function cloneElement(e) {
            var t = e.cloneNode(!0);
            return e.parentNode.replaceChild(t, e), t;
          }
        }, {
          key: "scrollToBottom",
          value: function scrollToBottom(e) {
            e.scrollTop = e.scrollHeight;
          }
        }, {
          key: "scrollToTop",
          value: function scrollToTop(e) {
            e.scrollTop = 0;
          }
        }]);
        return Hn;
      }();
    qn.CODE_SNIPPET_GENERATION_JUMP = 0.5;
    var Y = qn;
    var Gn = /*#__PURE__*/function () {
      function Vn() {
        _classCallCheck(this, Vn);
      }
      _createClass(Vn, null, [{
        key: "speak",
        value: function speak(e, t) {
          if (window.SpeechSynthesisUtterance) {
            var i = new SpeechSynthesisUtterance(e);
            Object.assign(i, t), speechSynthesis.speak(i);
          }
        }
      }, {
        key: "processConfig",
        value: function processConfig(e, t) {
          var i = {};
          setTimeout(function () {
            if (_typeof(e) == "object" && (e.lang && (i.lang = e.lang), e.pitch && (i.pitch = e.pitch), e.rate && (i.rate = e.rate), e.volume && (i.volume = e.volume), e.voiceName)) {
              var n = window.speechSynthesis.getVoices().find(function (r) {
                var o;
                return r.name.toLocaleLowerCase() === ((o = e.voiceName) == null ? void 0 : o.toLocaleLowerCase());
              });
              n && (i.voice = n);
            }
            t(i);
          }, Vn.LOAD_VOICES_MS);
        }
      }]);
      return Vn;
    }();
    Gn.LOAD_VOICES_MS = 200;
    var Nt = Gn;
    var ke = /*#__PURE__*/function () {
      function ke() {
        _classCallCheck(this, ke);
      }
      _createClass(ke, null, [{
        key: "checkForContainerStyles",
        value: function checkForContainerStyles(e, t) {
          var i = e.containerStyle;
          i && (Object.assign(t.style, i), console.error("The containerStyle property is deprecated since version 1.3.14."), console.error("Please change to using the style property instead: https://deepchat.dev/docs/styles#style"));
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, {
        key: "handleResponseProperty",
        value: function handleResponseProperty(e) {
          return console.error("The {result: ....} response object type is deprecated since version 1.3.0."), console.error("Please change to using the new response object: https://deepchat.dev/docs/connect#Response"), e.result;
        }
      }, {
        key: "processInitialMessageFile",
        value: function processInitialMessageFile(e) {
          var t = e.file;
          t && (console.error("The file property in MessageContent is deprecated since version 1.3.17."), console.error("Please change to using the files array property: https://deepchat.dev/docs/messages/#MessageContent"), e.files = [t]);
        }
      }, {
        key: "processValidateInput",
        value: function processValidateInput(e) {
          var t = e.validateMessageBeforeSending;
          if (t) return console.error("The validateMessageBeforeSending property is deprecated since version 1.3.24."), console.error("Please change to using validateInput: https://deepchat.dev/docs/interceptors#validateInput"), t;
        }
      }, {
        key: "processSubmitUserMessage",
        value: function processSubmitUserMessage(e) {
          return console.error("The submitUserMessage(text: string) argument string type is deprecated since version 1.4.4."), console.error("Please change to using the new argument type: https://deepchat.dev/docs/methods#submitUserMessage"), {
            text: e
          };
        }
      }, {
        key: "flagHTMLUpdateClass",
        value: function flagHTMLUpdateClass(e) {
          var t;
          (t = e.children[0]) != null && t.classList.contains("deep-chat-update-message") && (console.error('The "deep-chat-update-message" html class is deprecated since version 1.4.4.'), console.error("Please change to using {..., overwrite: true} object: https://deepchat.dev/docs/connect#Response"));
        }
      }]);
      return ke;
    }();
    var ei = /*#__PURE__*/function () {
      function xe() {
        _classCallCheck(this, xe);
      }
      _createClass(xe, null, [{
        key: "getLastElementsByClass",
        value: function getLastElementsByClass(e, t, i) {
          var _loop = function _loop() {
              var r = e[n];
              if (r.bubbleElement.classList.contains(t[0]) && !t.slice(1).find(function (a) {
                return !r.bubbleElement.classList.contains(a);
              })) if (i) {
                if (!i.find(function (l) {
                  return r.bubbleElement.classList.contains(l);
                })) return {
                  v: r
                };
              } else return {
                v: r
              };
            },
            _ret;
          for (var n = e.length - 1; n >= 0; n -= 1) {
            _ret = _loop();
            if (_ret) return _ret.v;
          }
        }
      }, {
        key: "getLastMessage",
        value: function getLastMessage(e, t, i) {
          for (var n = e.length - 1; n >= 0; n -= 1) if (e[n].role === t) if (i) {
            if (e[n][i]) return e[n];
          } else return e[n];
        }
      }, {
        key: "getLastTextToElement",
        value: function getLastTextToElement(e, t) {
          for (var i = e.length - 1; i >= 0; i -= 1) if (e[i][0] === t) return e[i];
        }
        // IMPORTANT: If the overwrite message does not contain a role property it will look for the last 'ai' role message
        // and if messages have custom roles, it will still look to update the last 'ai' role message
        // prettier-ignore
      }, {
        key: "overwriteMessage",
        value: function overwriteMessage(e, t, i, n, r, o) {
          var a = xe.getLastElementsByClass(t, [xe.getRoleClass(n), o], ["loading-message-text"]),
            l = xe.getLastMessage(e, n, r);
          return l && (l[r] = i), a;
        }
      }, {
        key: "getRoleClass",
        value: function getRoleClass(e) {
          return "".concat(e, "-message");
        }
        // makes sure the bubble has dimensions when there is no text
      }, {
        key: "fillEmptyMessageElement",
        value: function fillEmptyMessageElement(e, t) {
          t.trim().length === 0 && (e.classList.add(xe.EMPTY_MESSAGE_CLASS), e.innerHTML = '<div style="color:#00000000">.</div>');
        }
      }, {
        key: "unfillEmptyMessageElement",
        value: function unfillEmptyMessageElement(e, t) {
          e.classList.contains(xe.EMPTY_MESSAGE_CLASS) && t.trim().length > 0 && e.replaceChildren();
        }
      }, {
        key: "getLastMessageBubbleElement",
        value: function getLastMessageBubbleElement(e) {
          var t, i, n;
          return Array.from(((n = (i = (t = xe.getLastMessageElement(e)) == null ? void 0 : t.children) == null ? void 0 : i[0]) == null ? void 0 : n.children) || []).find(function (r) {
            return r.classList.contains("message-bubble");
          });
        }
      }, {
        key: "getLastMessageElement",
        value: function getLastMessageElement(e) {
          return e.children[e.children.length - 1];
        }
      }]);
      return xe;
    }();
    ei.AI_ROLE = "ai";
    ei.USER_ROLE = "user";
    ei.EMPTY_MESSAGE_CLASS = "empty-message";
    var v = ei;
    var Te = /*#__PURE__*/function () {
      function Te() {
        _classCallCheck(this, Te);
      }
      _createClass(Te, null, [{
        key: "mouseUp",
        value: function mouseUp(e, t) {
          T.unsetAllCSSMouseStates(e, t), Object.assign(e.style, t["default"]), Object.assign(e.style, t.hover);
        }
      }, {
        key: "mouseDown",
        value: function mouseDown(e, t) {
          Object.assign(e.style, t.click);
        }
      }, {
        key: "mouseLeave",
        value: function mouseLeave(e, t) {
          T.unsetAllCSSMouseStates(e, t), Object.assign(e.style, t["default"]);
        }
      }, {
        key: "mouseEnter",
        value: function mouseEnter(e, t) {
          Object.assign(e.style, t.hover);
        }
      }, {
        key: "add",
        value: function add(e, t) {
          e.addEventListener("mouseenter", Te.mouseEnter.bind(this, e, t)), e.addEventListener("mouseleave", Te.mouseLeave.bind(this, e, t)), e.addEventListener("mousedown", Te.mouseDown.bind(this, e, t)), e.addEventListener("mouseup", Te.mouseUp.bind(this, e, t));
        }
      }]);
      return Te;
    }();
    var _s = "deep-chat-temporary-message",
      Ms = "deep-chat-suggestion-button",
      Ri = {
        "deep-chat-button": {
          styles: {
            "default": {
              backgroundColor: "white",
              padding: "5px",
              paddingLeft: "7px",
              paddingRight: "7px",
              border: "1px solid #c2c2c2",
              borderRadius: "6px",
              cursor: "pointer"
            },
            hover: {
              backgroundColor: "#fafafa"
            },
            click: {
              backgroundColor: "#f1f1f1"
            }
          }
        }
      },
      ln = Object.keys(Ri);
    var be = /*#__PURE__*/function () {
      function be() {
        _classCallCheck(this, be);
      }
      _createClass(be, null, [{
        key: "applySuggestionEvent",
        value: function applySuggestionEvent(e, t) {
          setTimeout(function () {
            t.addEventListener("click", function () {
              var i, n;
              (n = e.submitUserMessage) == null || n.call(e, {
                text: ((i = t.textContent) == null ? void 0 : i.trim()) || ""
              });
            });
          });
        }
      }, {
        key: "isElementTemporary",
        value: function isElementTemporary(e) {
          var t;
          return e ? (t = e.bubbleElement.children[0]) == null ? void 0 : t.classList.contains(_s) : !1;
        }
      }, {
        key: "doesElementContainDeepChatClass",
        value: function doesElementContainDeepChatClass(e) {
          return ln.find(function (t) {
            return e.classList.contains(t);
          });
        }
      }, {
        key: "applyEvents",
        value: function applyEvents(e, t) {
          var i = Ri[t].events;
          Object.keys(i || []).forEach(function (n) {
            e.addEventListener(n, i == null ? void 0 : i[n]);
          });
        }
      }, {
        key: "getProcessedStyles",
        value: function getProcessedStyles(e, t, i) {
          var n = Array.from(t.classList).reduce(function (a, l) {
              var d;
              var c = (d = e[l]) == null ? void 0 : d.styles;
              return c && e[l].styles && a.push(c), a;
            }, []),
            r = Ri[i].styles;
          if (r) {
            var a = JSON.parse(JSON.stringify(r));
            a["default"] && T.overwriteDefaultWithAlreadyApplied(a, t), n.unshift(a);
          }
          var o = T.mergeStatefulStyles(n);
          return T.processStateful(o, {}, {});
        }
      }, {
        key: "applyDeepChatUtilities",
        value: function applyDeepChatUtilities(e, t, i) {
          ln.forEach(function (r) {
            var o = i.getElementsByClassName(r);
            Array.from(o || []).forEach(function (a) {
              var l = be.getProcessedStyles(t, a, r);
              se.applyStylesToElement(a, l), be.applyEvents(a, r);
            });
          });
          var n = i.getElementsByClassName(Ms);
          Array.from(n).forEach(function (r) {
            return be.applySuggestionEvent(e, r);
          });
        }
      }]);
      return be;
    }();
    var se = /*#__PURE__*/function () {
      function se() {
        _classCallCheck(this, se);
      }
      _createClass(se, null, [{
        key: "applyStylesToElement",
        value: function applyStylesToElement(e, t) {
          var i = T.processStateful(t, {}, {});
          Te.add(e, i), Object.assign(e.style, i["default"]);
        }
      }, {
        key: "applyEventsToElement",
        value: function applyEventsToElement(e, t) {
          Object.keys(t).forEach(function (i) {
            var n = t[i];
            n && e.addEventListener(i, n);
          });
        }
      }, {
        key: "applyClassUtilitiesToElement",
        value: function applyClassUtilitiesToElement(e, t) {
          var i = t.events,
            n = t.styles;
          i && se.applyEventsToElement(e, i), n && !be.doesElementContainDeepChatClass(e) && se.applyStylesToElement(e, n);
        }
      }, {
        key: "applyCustomClassUtilities",
        value: function applyCustomClassUtilities(e, t) {
          Object.keys(e).forEach(function (i) {
            var n = t.getElementsByClassName(i);
            Array.from(n).forEach(function (r) {
              e[i] && se.applyClassUtilitiesToElement(r, e[i]);
            });
          });
        }
      }, {
        key: "apply",
        value: function apply(e, t) {
          be.applyDeepChatUtilities(e, e.htmlClassUtilities, t), se.applyCustomClassUtilities(e.htmlClassUtilities, t);
        }
      }]);
      return se;
    }();
    var Ye = /*#__PURE__*/function () {
      function Ye() {
        _classCallCheck(this, Ye);
      }
      _createClass(Ye, null, [{
        key: "addElement",
        value: function addElement(e, t) {
          e.elementRef.appendChild(t), e.elementRef.scrollTop = e.elementRef.scrollHeight;
        }
      }, {
        key: "createElements",
        value: function createElements(e, t, i) {
          var n = e.createNewMessageElement("", i);
          return n.bubbleElement.classList.add("html-message"), n.bubbleElement.innerHTML = t, n;
        }
      }, {
        key: "overwrite",
        value: function overwrite(e, t, i, n) {
          var r = e.messages,
            o = v.overwriteMessage(r, n, t, i, "html", "html-message");
          return o && (o.bubbleElement.innerHTML = t, se.apply(e, o.outerContainer), ke.flagHTMLUpdateClass(o.bubbleElement)), o;
        }
        // prettier-ignore
      }, {
        key: "add",
        value: function add(e, t, i, n, r) {
          var a;
          if (r != null && r.status) {
            var l = this.overwrite(e, t, i, n);
            if (l) return l;
            r.status = !1;
          }
          var o = Ye.createElements(e, t, i);
          return v.fillEmptyMessageElement(o.bubbleElement, t), se.apply(e, o.outerContainer), ke.flagHTMLUpdateClass(o.bubbleElement), e.applyCustomStyles(o, i, !1, (a = e.messageStyles) == null ? void 0 : a.html), Ye.addElement(e, o.outerContainer), o;
        }
      }]);
      return Ye;
    }();
    var kt;
    function Wn(s) {
      return kt = kt || document.createElement("textarea"), kt.innerHTML = "&" + s + ";", kt.value;
    }
    var Ts = Object.prototype.hasOwnProperty;
    function Cs(s, e) {
      return s ? Ts.call(s, e) : !1;
    }
    function Kn(s) {
      var e = [].slice.call(arguments, 1);
      return e.forEach(function (t) {
        if (t) {
          if (_typeof(t) != "object") throw new TypeError(t + "must be object");
          Object.keys(t).forEach(function (i) {
            s[i] = t[i];
          });
        }
      }), s;
    }
    var As = /\\([\\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;
    function ft(s) {
      return s.indexOf("\\") < 0 ? s : s.replace(As, "$1");
    }
    function Jn(s) {
      return !(s >= 55296 && s <= 57343 || s >= 64976 && s <= 65007 || (s & 65535) === 65535 || (s & 65535) === 65534 || s >= 0 && s <= 8 || s === 11 || s >= 14 && s <= 31 || s >= 127 && s <= 159 || s > 1114111);
    }
    function Oi(s) {
      if (s > 65535) {
        s -= 65536;
        var e = 55296 + (s >> 10),
          t = 56320 + (s & 1023);
        return String.fromCharCode(e, t);
      }
      return String.fromCharCode(s);
    }
    var ks = /&([a-z#][a-z0-9]{1,31});/gi,
      Is = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))/i;
    function Ls(s, e) {
      var t = 0,
        i = Wn(e);
      return e !== i ? i : e.charCodeAt(0) === 35 && Is.test(e) && (t = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10), Jn(t)) ? Oi(t) : s;
    }
    function Ie(s) {
      return s.indexOf("&") < 0 ? s : s.replace(ks, Ls);
    }
    var Rs = /[&<>"]/,
      Os = /[&<>"]/g,
      Ns = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
      };
    function Ps(s) {
      return Ns[s];
    }
    function z(s) {
      return Rs.test(s) ? s.replace(Os, Ps) : s;
    }
    var f = {};
    f.blockquote_open = function () {
      return "<blockquote>\n";
    };
    f.blockquote_close = function (s, e) {
      return "</blockquote>" + Re(s, e);
    };
    f.code = function (s, e) {
      return s[e].block ? "<pre><code>" + z(s[e].content) + "</code></pre>" + Re(s, e) : "<code>" + z(s[e].content) + "</code>";
    };
    f.fence = function (s, e, t, i, n) {
      var r = s[e],
        o = "",
        a = t.langPrefix,
        l = "",
        c,
        d,
        u;
      if (r.params) {
        if (c = r.params.split(/\s+/g), d = c.join(" "), Cs(n.rules.fence_custom, c[0])) return n.rules.fence_custom[c[0]](s, e, t, i, n);
        l = z(Ie(ft(d))), o = ' class="' + a + l + '"';
      }
      return t.highlight ? u = t.highlight.apply(t.highlight, [r.content].concat(c)) || z(r.content) : u = z(r.content), "<pre><code" + o + ">" + u + "</code></pre>" + Re(s, e);
    };
    f.fence_custom = {};
    f.heading_open = function (s, e) {
      return "<h" + s[e].hLevel + ">";
    };
    f.heading_close = function (s, e) {
      return "</h" + s[e].hLevel + ">\n";
    };
    f.hr = function (s, e, t) {
      return (t.xhtmlOut ? "<hr />" : "<hr>") + Re(s, e);
    };
    f.bullet_list_open = function () {
      return "<ul>\n";
    };
    f.bullet_list_close = function (s, e) {
      return "</ul>" + Re(s, e);
    };
    f.list_item_open = function () {
      return "<li>";
    };
    f.list_item_close = function () {
      return "</li>\n";
    };
    f.ordered_list_open = function (s, e) {
      var t = s[e],
        i = t.order > 1 ? ' start="' + t.order + '"' : "";
      return "<ol" + i + ">\n";
    };
    f.ordered_list_close = function (s, e) {
      return "</ol>" + Re(s, e);
    };
    f.paragraph_open = function (s, e) {
      return s[e].tight ? "" : "<p>";
    };
    f.paragraph_close = function (s, e) {
      var t = !(s[e].tight && e && s[e - 1].type === "inline" && !s[e - 1].content);
      return (s[e].tight ? "" : "</p>") + (t ? Re(s, e) : "");
    };
    f.link_open = function (s, e, t) {
      var i = s[e].title ? ' title="' + z(Ie(s[e].title)) + '"' : "",
        n = t.linkTarget ? ' target="' + t.linkTarget + '"' : "";
      return '<a href="' + z(s[e].href) + '"' + i + n + ">";
    };
    f.link_close = function () {
      return "</a>";
    };
    f.image = function (s, e, t) {
      var i = ' src="' + z(s[e].src) + '"',
        n = s[e].title ? ' title="' + z(Ie(s[e].title)) + '"' : "",
        r = ' alt="' + (s[e].alt ? z(Ie(ft(s[e].alt))) : "") + '"',
        o = t.xhtmlOut ? " /" : "";
      return "<img" + i + r + n + o + ">";
    };
    f.table_open = function () {
      return "<table>\n";
    };
    f.table_close = function () {
      return "</table>\n";
    };
    f.thead_open = function () {
      return "<thead>\n";
    };
    f.thead_close = function () {
      return "</thead>\n";
    };
    f.tbody_open = function () {
      return "<tbody>\n";
    };
    f.tbody_close = function () {
      return "</tbody>\n";
    };
    f.tr_open = function () {
      return "<tr>";
    };
    f.tr_close = function () {
      return "</tr>\n";
    };
    f.th_open = function (s, e) {
      var t = s[e];
      return "<th" + (t.align ? ' style="text-align:' + t.align + '"' : "") + ">";
    };
    f.th_close = function () {
      return "</th>";
    };
    f.td_open = function (s, e) {
      var t = s[e];
      return "<td" + (t.align ? ' style="text-align:' + t.align + '"' : "") + ">";
    };
    f.td_close = function () {
      return "</td>";
    };
    f.strong_open = function () {
      return "<strong>";
    };
    f.strong_close = function () {
      return "</strong>";
    };
    f.em_open = function () {
      return "<em>";
    };
    f.em_close = function () {
      return "</em>";
    };
    f.del_open = function () {
      return "<del>";
    };
    f.del_close = function () {
      return "</del>";
    };
    f.ins_open = function () {
      return "<ins>";
    };
    f.ins_close = function () {
      return "</ins>";
    };
    f.mark_open = function () {
      return "<mark>";
    };
    f.mark_close = function () {
      return "</mark>";
    };
    f.sub = function (s, e) {
      return "<sub>" + z(s[e].content) + "</sub>";
    };
    f.sup = function (s, e) {
      return "<sup>" + z(s[e].content) + "</sup>";
    };
    f.hardbreak = function (s, e, t) {
      return t.xhtmlOut ? "<br />\n" : "<br>\n";
    };
    f.softbreak = function (s, e, t) {
      return t.breaks ? t.xhtmlOut ? "<br />\n" : "<br>\n" : "\n";
    };
    f.text = function (s, e) {
      return z(s[e].content);
    };
    f.htmlblock = function (s, e) {
      return s[e].content;
    };
    f.htmltag = function (s, e) {
      return s[e].content;
    };
    f.abbr_open = function (s, e) {
      return '<abbr title="' + z(Ie(s[e].title)) + '">';
    };
    f.abbr_close = function () {
      return "</abbr>";
    };
    f.footnote_ref = function (s, e) {
      var t = Number(s[e].id + 1).toString(),
        i = "fnref" + t;
      return s[e].subId > 0 && (i += ":" + s[e].subId), '<sup class="footnote-ref"><a href="#fn' + t + '" id="' + i + '">[' + t + "]</a></sup>";
    };
    f.footnote_block_open = function (s, e, t) {
      var i = t.xhtmlOut ? "<hr class=\"footnotes-sep\" />\n" : "<hr class=\"footnotes-sep\">\n";
      return i + "<section class=\"footnotes\">\n<ol class=\"footnotes-list\">\n";
    };
    f.footnote_block_close = function () {
      return "</ol>\n</section>\n";
    };
    f.footnote_open = function (s, e) {
      var t = Number(s[e].id + 1).toString();
      return '<li id="fn' + t + '"  class="footnote-item">';
    };
    f.footnote_close = function () {
      return "</li>\n";
    };
    f.footnote_anchor = function (s, e) {
      var t = Number(s[e].id + 1).toString(),
        i = "fnref" + t;
      return s[e].subId > 0 && (i += ":" + s[e].subId), ' <a href="#' + i + '" class="footnote-backref">↩</a>';
    };
    f.dl_open = function () {
      return "<dl>\n";
    };
    f.dt_open = function () {
      return "<dt>";
    };
    f.dd_open = function () {
      return "<dd>";
    };
    f.dl_close = function () {
      return "</dl>\n";
    };
    f.dt_close = function () {
      return "</dt>\n";
    };
    f.dd_close = function () {
      return "</dd>\n";
    };
    function $n(s, e) {
      return ++e >= s.length - 2 ? e : s[e].type === "paragraph_open" && s[e].tight && s[e + 1].type === "inline" && s[e + 1].content.length === 0 && s[e + 2].type === "paragraph_close" && s[e + 2].tight ? $n(s, e + 2) : e;
    }
    var Re = f.getBreak = function (e, t) {
      return t = $n(e, t), t < e.length && e[t].type === "list_item_close" ? "" : "\n";
    };
    function Gi() {
      this.rules = Kn({}, f), this.getBreak = f.getBreak;
    }
    Gi.prototype.renderInline = function (s, e, t) {
      for (var i = this.rules, n = s.length, r = 0, o = ""; n--;) o += i[s[r].type](s, r++, e, t, this);
      return o;
    };
    Gi.prototype.render = function (s, e, t) {
      for (var i = this.rules, n = s.length, r = -1, o = ""; ++r < n;) s[r].type === "inline" ? o += this.renderInline(s[r].children, e, t) : o += i[s[r].type](s, r, e, t, this);
      return o;
    };
    function H() {
      this.__rules__ = [], this.__cache__ = null;
    }
    H.prototype.__find__ = function (s) {
      for (var e = this.__rules__.length, t = -1; e--;) if (this.__rules__[++t].name === s) return t;
      return -1;
    };
    H.prototype.__compile__ = function () {
      var s = this,
        e = [""];
      s.__rules__.forEach(function (t) {
        t.enabled && t.alt.forEach(function (i) {
          e.indexOf(i) < 0 && e.push(i);
        });
      }), s.__cache__ = {}, e.forEach(function (t) {
        s.__cache__[t] = [], s.__rules__.forEach(function (i) {
          i.enabled && (t && i.alt.indexOf(t) < 0 || s.__cache__[t].push(i.fn));
        });
      });
    };
    H.prototype.at = function (s, e, t) {
      var i = this.__find__(s),
        n = t || {};
      if (i === -1) throw new Error("Parser rule not found: " + s);
      this.__rules__[i].fn = e, this.__rules__[i].alt = n.alt || [], this.__cache__ = null;
    };
    H.prototype.before = function (s, e, t, i) {
      var n = this.__find__(s),
        r = i || {};
      if (n === -1) throw new Error("Parser rule not found: " + s);
      this.__rules__.splice(n, 0, {
        name: e,
        enabled: !0,
        fn: t,
        alt: r.alt || []
      }), this.__cache__ = null;
    };
    H.prototype.after = function (s, e, t, i) {
      var n = this.__find__(s),
        r = i || {};
      if (n === -1) throw new Error("Parser rule not found: " + s);
      this.__rules__.splice(n + 1, 0, {
        name: e,
        enabled: !0,
        fn: t,
        alt: r.alt || []
      }), this.__cache__ = null;
    };
    H.prototype.push = function (s, e, t) {
      var i = t || {};
      this.__rules__.push({
        name: s,
        enabled: !0,
        fn: e,
        alt: i.alt || []
      }), this.__cache__ = null;
    };
    H.prototype.enable = function (s, e) {
      s = Array.isArray(s) ? s : [s], e && this.__rules__.forEach(function (t) {
        t.enabled = !1;
      }), s.forEach(function (t) {
        var i = this.__find__(t);
        if (i < 0) throw new Error("Rules manager: invalid rule name " + t);
        this.__rules__[i].enabled = !0;
      }, this), this.__cache__ = null;
    };
    H.prototype.disable = function (s) {
      s = Array.isArray(s) ? s : [s], s.forEach(function (e) {
        var t = this.__find__(e);
        if (t < 0) throw new Error("Rules manager: invalid rule name " + e);
        this.__rules__[t].enabled = !1;
      }, this), this.__cache__ = null;
    };
    H.prototype.getRules = function (s) {
      return this.__cache__ === null && this.__compile__(), this.__cache__[s] || [];
    };
    function Ds(s) {
      s.inlineMode ? s.tokens.push({
        type: "inline",
        content: s.src.replace(/\n/g, " ").trim(),
        level: 0,
        lines: [0, 1],
        children: []
      }) : s.block.parse(s.src, s.options, s.env, s.tokens);
    }
    function Oe(s, e, t, i, n) {
      this.src = s, this.env = i, this.options = t, this.parser = e, this.tokens = n, this.pos = 0, this.posMax = this.src.length, this.level = 0, this.pending = "", this.pendingLevel = 0, this.cache = [], this.isInLabel = !1, this.linkLevel = 0, this.linkContent = "", this.labelUnmatchedScopes = 0;
    }
    Oe.prototype.pushPending = function () {
      this.tokens.push({
        type: "text",
        content: this.pending,
        level: this.pendingLevel
      }), this.pending = "";
    };
    Oe.prototype.push = function (s) {
      this.pending && this.pushPending(), this.tokens.push(s), this.pendingLevel = this.level;
    };
    Oe.prototype.cacheSet = function (s, e) {
      for (var t = this.cache.length; t <= s; t++) this.cache.push(0);
      this.cache[s] = e;
    };
    Oe.prototype.cacheGet = function (s) {
      return s < this.cache.length ? this.cache[s] : 0;
    };
    function mt(s, e) {
      var t,
        i,
        n,
        r = -1,
        o = s.posMax,
        a = s.pos,
        l = s.isInLabel;
      if (s.isInLabel) return -1;
      if (s.labelUnmatchedScopes) return s.labelUnmatchedScopes--, -1;
      for (s.pos = e + 1, s.isInLabel = !0, t = 1; s.pos < o;) {
        if (n = s.src.charCodeAt(s.pos), n === 91) t++;else if (n === 93 && (t--, t === 0)) {
          i = !0;
          break;
        }
        s.parser.skipToken(s);
      }
      return i ? (r = s.pos, s.labelUnmatchedScopes = 0) : s.labelUnmatchedScopes = t - 1, s.pos = a, s.isInLabel = l, r;
    }
    function js(s, e, t, i) {
      var n, r, o, a, l, c;
      if (s.charCodeAt(0) !== 42 || s.charCodeAt(1) !== 91 || s.indexOf("]:") === -1 || (n = new Oe(s, e, t, i, []), r = mt(n, 1), r < 0 || s.charCodeAt(r + 1) !== 58)) return -1;
      for (a = n.posMax, o = r + 2; o < a && n.src.charCodeAt(o) !== 10; o++);
      return l = s.slice(2, r), c = s.slice(r + 2, o).trim(), c.length === 0 ? -1 : (i.abbreviations || (i.abbreviations = {}), _typeof(i.abbreviations[":" + l]) > "u" && (i.abbreviations[":" + l] = c), o);
    }
    function Fs(s) {
      var e = s.tokens,
        t,
        i,
        n,
        r;
      if (!s.inlineMode) {
        for (t = 1, i = e.length - 1; t < i; t++) if (e[t - 1].type === "paragraph_open" && e[t].type === "inline" && e[t + 1].type === "paragraph_close") {
          for (n = e[t].content; n.length && (r = js(n, s.inline, s.options, s.env), !(r < 0));) n = n.slice(r).trim();
          e[t].content = n, n.length || (e[t - 1].tight = !0, e[t + 1].tight = !0);
        }
      }
    }
    function Ni(s) {
      var e = Ie(s);
      try {
        e = decodeURI(e);
      } catch (_unused2) {}
      return encodeURI(e);
    }
    function Yn(s, e) {
      var t,
        i,
        n,
        r = e,
        o = s.posMax;
      if (s.src.charCodeAt(e) === 60) {
        for (e++; e < o;) {
          if (t = s.src.charCodeAt(e), t === 10) return !1;
          if (t === 62) return n = Ni(ft(s.src.slice(r + 1, e))), s.parser.validateLink(n) ? (s.pos = e + 1, s.linkContent = n, !0) : !1;
          if (t === 92 && e + 1 < o) {
            e += 2;
            continue;
          }
          e++;
        }
        return !1;
      }
      for (i = 0; e < o && (t = s.src.charCodeAt(e), !(t === 32 || t < 32 || t === 127));) {
        if (t === 92 && e + 1 < o) {
          e += 2;
          continue;
        }
        if (t === 40 && (i++, i > 1) || t === 41 && (i--, i < 0)) break;
        e++;
      }
      return r === e || (n = ft(s.src.slice(r, e)), !s.parser.validateLink(n)) ? !1 : (s.linkContent = n, s.pos = e, !0);
    }
    function Zn(s, e) {
      var t,
        i = e,
        n = s.posMax,
        r = s.src.charCodeAt(e);
      if (r !== 34 && r !== 39 && r !== 40) return !1;
      for (e++, r === 40 && (r = 41); e < n;) {
        if (t = s.src.charCodeAt(e), t === r) return s.pos = e + 1, s.linkContent = ft(s.src.slice(i + 1, e)), !0;
        if (t === 92 && e + 1 < n) {
          e += 2;
          continue;
        }
        e++;
      }
      return !1;
    }
    function Xn(s) {
      return s.trim().replace(/\s+/g, " ").toUpperCase();
    }
    function Bs(s, e, t, i) {
      var n, r, o, a, l, c, d, u, h;
      if (s.charCodeAt(0) !== 91 || s.indexOf("]:") === -1 || (n = new Oe(s, e, t, i, []), r = mt(n, 0), r < 0 || s.charCodeAt(r + 1) !== 58)) return -1;
      for (a = n.posMax, o = r + 2; o < a && (l = n.src.charCodeAt(o), !(l !== 32 && l !== 10)); o++);
      if (!Yn(n, o)) return -1;
      for (d = n.linkContent, o = n.pos, c = o, o = o + 1; o < a && (l = n.src.charCodeAt(o), !(l !== 32 && l !== 10)); o++);
      for (o < a && c !== o && Zn(n, o) ? (u = n.linkContent, o = n.pos) : (u = "", o = c); o < a && n.src.charCodeAt(o) === 32;) o++;
      return o < a && n.src.charCodeAt(o) !== 10 ? -1 : (h = Xn(s.slice(1, r)), _typeof(i.references[h]) > "u" && (i.references[h] = {
        title: u,
        href: d
      }), o);
    }
    function zs(s) {
      var e = s.tokens,
        t,
        i,
        n,
        r;
      if (s.env.references = s.env.references || {}, !s.inlineMode) {
        for (t = 1, i = e.length - 1; t < i; t++) if (e[t].type === "inline" && e[t - 1].type === "paragraph_open" && e[t + 1].type === "paragraph_close") {
          for (n = e[t].content; n.length && (r = Bs(n, s.inline, s.options, s.env), !(r < 0));) n = n.slice(r).trim();
          e[t].content = n, n.length || (e[t - 1].tight = !0, e[t + 1].tight = !0);
        }
      }
    }
    function Us(s) {
      var e = s.tokens,
        t,
        i,
        n;
      for (i = 0, n = e.length; i < n; i++) t = e[i], t.type === "inline" && s.inline.parse(t.content, s.options, s.env, t.children);
    }
    function qs(s) {
      var e,
        t,
        i,
        n,
        r,
        o,
        a,
        l,
        c,
        d = 0,
        u = !1,
        h = {};
      if (s.env.footnotes && (s.tokens = s.tokens.filter(function (p) {
        return p.type === "footnote_reference_open" ? (u = !0, l = [], c = p.label, !1) : p.type === "footnote_reference_close" ? (u = !1, h[":" + c] = l, !1) : (u && l.push(p), !u);
      }), !!s.env.footnotes.list)) {
        for (o = s.env.footnotes.list, s.tokens.push({
          type: "footnote_block_open",
          level: d++
        }), e = 0, t = o.length; e < t; e++) {
          for (s.tokens.push({
            type: "footnote_open",
            id: e,
            level: d++
          }), o[e].tokens ? (a = [], a.push({
            type: "paragraph_open",
            tight: !1,
            level: d++
          }), a.push({
            type: "inline",
            content: "",
            level: d,
            children: o[e].tokens
          }), a.push({
            type: "paragraph_close",
            tight: !1,
            level: --d
          })) : o[e].label && (a = h[":" + o[e].label]), s.tokens = s.tokens.concat(a), s.tokens[s.tokens.length - 1].type === "paragraph_close" ? r = s.tokens.pop() : r = null, n = o[e].count > 0 ? o[e].count : 1, i = 0; i < n; i++) s.tokens.push({
            type: "footnote_anchor",
            id: e,
            subId: i,
            level: d
          });
          r && s.tokens.push(r), s.tokens.push({
            type: "footnote_close",
            level: --d
          });
        }
        s.tokens.push({
          type: "footnote_block_close",
          level: --d
        });
      }
    }
    var cn = " \n()[]'\".,!?-";
    function Si(s) {
      return s.replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, "\\$1");
    }
    function Hs(s) {
      var e,
        t,
        i,
        n,
        r,
        o,
        a,
        l,
        c,
        d,
        u,
        h,
        p = s.tokens;
      if (s.env.abbreviations) {
        for (s.env.abbrRegExp || (h = "(^|[" + cn.split("").map(Si).join("") + "])(" + Object.keys(s.env.abbreviations).map(function (g) {
          return g.substr(1);
        }).sort(function (g, m) {
          return m.length - g.length;
        }).map(Si).join("|") + ")($|[" + cn.split("").map(Si).join("") + "])", s.env.abbrRegExp = new RegExp(h, "g")), d = s.env.abbrRegExp, t = 0, i = p.length; t < i; t++) if (p[t].type === "inline") {
          for (n = p[t].children, e = n.length - 1; e >= 0; e--) if (r = n[e], r.type === "text") {
            for (l = 0, o = r.content, d.lastIndex = 0, c = r.level, a = []; u = d.exec(o);) d.lastIndex > l && a.push({
              type: "text",
              content: o.slice(l, u.index + u[1].length),
              level: c
            }), a.push({
              type: "abbr_open",
              title: s.env.abbreviations[":" + u[2]],
              level: c++
            }), a.push({
              type: "text",
              content: u[2],
              level: c
            }), a.push({
              type: "abbr_close",
              level: --c
            }), l = d.lastIndex - u[3].length;
            a.length && (l < o.length && a.push({
              type: "text",
              content: o.slice(l),
              level: c
            }), p[t].children = n = [].concat(n.slice(0, e), a, n.slice(e + 1)));
          }
        }
      }
    }
    var Gs = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/,
      Vs = /\((c|tm|r|p)\)/ig,
      Ws = {
        c: "©",
        r: "®",
        p: "§",
        tm: "™"
      };
    function Ks(s) {
      return s.indexOf("(") < 0 ? s : s.replace(Vs, function (e, t) {
        return Ws[t.toLowerCase()];
      });
    }
    function Js(s) {
      var e, t, i, n, r;
      if (s.options.typographer) {
        for (r = s.tokens.length - 1; r >= 0; r--) if (s.tokens[r].type === "inline") for (n = s.tokens[r].children, e = n.length - 1; e >= 0; e--) t = n[e], t.type === "text" && (i = t.content, i = Ks(i), Gs.test(i) && (i = i.replace(/\+-/g, "±").replace(/\.{2,}/g, "…").replace(/([?!])…/g, "$1..").replace(/([?!]){4,}/g, "$1$1$1").replace(/,{2,}/g, ",").replace(/(^|[^-])---([^-]|$)/mg, "$1—$2").replace(/(^|\s)--(\s|$)/mg, "$1–$2").replace(/(^|[^-\s])--([^-\s]|$)/mg, "$1–$2")), t.content = i);
      }
    }
    var $s = /['"]/,
      dn = /['"]/g,
      Ys = /[-\s()\[\]]/,
      un = "’";
    function hn(s, e) {
      return e < 0 || e >= s.length ? !1 : !Ys.test(s[e]);
    }
    function ze(s, e, t) {
      return s.substr(0, e) + t + s.substr(e + 1);
    }
    function Zs(s) {
      var e, t, i, n, r, o, a, l, c, d, u, h, p, g, m, S, w;
      if (s.options.typographer) {
        for (w = [], m = s.tokens.length - 1; m >= 0; m--) if (s.tokens[m].type === "inline") {
          for (S = s.tokens[m].children, w.length = 0, e = 0; e < S.length; e++) if (t = S[e], !(t.type !== "text" || $s.test(t.text))) {
            for (a = S[e].level, p = w.length - 1; p >= 0 && !(w[p].level <= a); p--);
            w.length = p + 1, i = t.content, r = 0, o = i.length;
            e: for (; r < o && (dn.lastIndex = r, n = dn.exec(i), !!n);) {
              if (l = !hn(i, n.index - 1), r = n.index + 1, g = n[0] === "'", c = !hn(i, r), !c && !l) {
                g && (t.content = ze(t.content, n.index, un));
                continue;
              }
              if (u = !c, h = !l, h) {
                for (p = w.length - 1; p >= 0 && (d = w[p], !(w[p].level < a)); p--) if (d.single === g && w[p].level === a) {
                  d = w[p], g ? (S[d.token].content = ze(S[d.token].content, d.pos, s.options.quotes[2]), t.content = ze(t.content, n.index, s.options.quotes[3])) : (S[d.token].content = ze(S[d.token].content, d.pos, s.options.quotes[0]), t.content = ze(t.content, n.index, s.options.quotes[1])), w.length = p;
                  continue e;
                }
              }
              u ? w.push({
                token: e,
                pos: n.index,
                single: g,
                level: a
              }) : h && g && (t.content = ze(t.content, n.index, un));
            }
          }
        }
      }
    }
    var wi = [["block", Ds], ["abbr", Fs], ["references", zs], ["inline", Us], ["footnote_tail", qs], ["abbr2", Hs], ["replacements", Js], ["smartquotes", Zs]];
    function Qn() {
      this.options = {}, this.ruler = new H();
      for (var s = 0; s < wi.length; s++) this.ruler.push(wi[s][0], wi[s][1]);
    }
    Qn.prototype.process = function (s) {
      var e, t, i;
      for (i = this.ruler.getRules(""), e = 0, t = i.length; e < t; e++) i[e](s);
    };
    function Ne(s, e, t, i, n) {
      var r, o, a, l, c, d, u;
      for (this.src = s, this.parser = e, this.options = t, this.env = i, this.tokens = n, this.bMarks = [], this.eMarks = [], this.tShift = [], this.blkIndent = 0, this.line = 0, this.lineMax = 0, this.tight = !1, this.parentType = "root", this.ddIndent = -1, this.level = 0, this.result = "", o = this.src, d = 0, u = !1, a = l = d = 0, c = o.length; l < c; l++) {
        if (r = o.charCodeAt(l), !u) if (r === 32) {
          d++;
          continue;
        } else u = !0;
        (r === 10 || l === c - 1) && (r !== 10 && l++, this.bMarks.push(a), this.eMarks.push(l), this.tShift.push(d), u = !1, d = 0, a = l + 1);
      }
      this.bMarks.push(o.length), this.eMarks.push(o.length), this.tShift.push(0), this.lineMax = this.bMarks.length - 1;
    }
    Ne.prototype.isEmpty = function (e) {
      return this.bMarks[e] + this.tShift[e] >= this.eMarks[e];
    };
    Ne.prototype.skipEmptyLines = function (e) {
      for (var t = this.lineMax; e < t && !(this.bMarks[e] + this.tShift[e] < this.eMarks[e]); e++);
      return e;
    };
    Ne.prototype.skipSpaces = function (e) {
      for (var t = this.src.length; e < t && this.src.charCodeAt(e) === 32; e++);
      return e;
    };
    Ne.prototype.skipChars = function (e, t) {
      for (var i = this.src.length; e < i && this.src.charCodeAt(e) === t; e++);
      return e;
    };
    Ne.prototype.skipCharsBack = function (e, t, i) {
      if (e <= i) return e;
      for (; e > i;) if (t !== this.src.charCodeAt(--e)) return e + 1;
      return e;
    };
    Ne.prototype.getLines = function (e, t, i, n) {
      var r,
        o,
        a,
        l,
        c,
        d = e;
      if (e >= t) return "";
      if (d + 1 === t) return o = this.bMarks[d] + Math.min(this.tShift[d], i), a = n ? this.eMarks[d] + 1 : this.eMarks[d], this.src.slice(o, a);
      for (l = new Array(t - e), r = 0; d < t; d++, r++) c = this.tShift[d], c > i && (c = i), c < 0 && (c = 0), o = this.bMarks[d] + c, d + 1 < t || n ? a = this.eMarks[d] + 1 : a = this.eMarks[d], l[r] = this.src.slice(o, a);
      return l.join("");
    };
    function Xs(s, e, t) {
      var i, n;
      if (s.tShift[e] - s.blkIndent < 4) return !1;
      for (n = i = e + 1; i < t;) {
        if (s.isEmpty(i)) {
          i++;
          continue;
        }
        if (s.tShift[i] - s.blkIndent >= 4) {
          i++, n = i;
          continue;
        }
        break;
      }
      return s.line = i, s.tokens.push({
        type: "code",
        content: s.getLines(e, n, 4 + s.blkIndent, !0),
        block: !0,
        lines: [e, s.line],
        level: s.level
      }), !0;
    }
    function Qs(s, e, t, i) {
      var n,
        r,
        o,
        a,
        l,
        c = !1,
        d = s.bMarks[e] + s.tShift[e],
        u = s.eMarks[e];
      if (d + 3 > u || (n = s.src.charCodeAt(d), n !== 126 && n !== 96) || (l = d, d = s.skipChars(d, n), r = d - l, r < 3) || (o = s.src.slice(d, u).trim(), o.indexOf("`") >= 0)) return !1;
      if (i) return !0;
      for (a = e; a++, !(a >= t || (d = l = s.bMarks[a] + s.tShift[a], u = s.eMarks[a], d < u && s.tShift[a] < s.blkIndent));) if (s.src.charCodeAt(d) === n && !(s.tShift[a] - s.blkIndent >= 4) && (d = s.skipChars(d, n), !(d - l < r) && (d = s.skipSpaces(d), !(d < u)))) {
        c = !0;
        break;
      }
      return r = s.tShift[e], s.line = a + (c ? 1 : 0), s.tokens.push({
        type: "fence",
        params: o,
        content: s.getLines(e + 1, a, r, !0),
        lines: [e, s.line],
        level: s.level
      }), !0;
    }
    function er(s, e, t, i) {
      var n,
        r,
        o,
        a,
        l,
        c,
        d,
        u,
        h,
        p,
        g,
        m = s.bMarks[e] + s.tShift[e],
        S = s.eMarks[e];
      if (m > S || s.src.charCodeAt(m++) !== 62 || s.level >= s.options.maxNesting) return !1;
      if (i) return !0;
      for (s.src.charCodeAt(m) === 32 && m++, l = s.blkIndent, s.blkIndent = 0, a = [s.bMarks[e]], s.bMarks[e] = m, m = m < S ? s.skipSpaces(m) : m, r = m >= S, o = [s.tShift[e]], s.tShift[e] = m - s.bMarks[e], u = s.parser.ruler.getRules("blockquote"), n = e + 1; n < t && (m = s.bMarks[n] + s.tShift[n], S = s.eMarks[n], !(m >= S)); n++) {
        if (s.src.charCodeAt(m++) === 62) {
          s.src.charCodeAt(m) === 32 && m++, a.push(s.bMarks[n]), s.bMarks[n] = m, m = m < S ? s.skipSpaces(m) : m, r = m >= S, o.push(s.tShift[n]), s.tShift[n] = m - s.bMarks[n];
          continue;
        }
        if (r) break;
        for (g = !1, h = 0, p = u.length; h < p; h++) if (u[h](s, n, t, !0)) {
          g = !0;
          break;
        }
        if (g) break;
        a.push(s.bMarks[n]), o.push(s.tShift[n]), s.tShift[n] = -1337;
      }
      for (c = s.parentType, s.parentType = "blockquote", s.tokens.push({
        type: "blockquote_open",
        lines: d = [e, 0],
        level: s.level++
      }), s.parser.tokenize(s, e, n), s.tokens.push({
        type: "blockquote_close",
        level: --s.level
      }), s.parentType = c, d[1] = s.line, h = 0; h < o.length; h++) s.bMarks[h + e] = a[h], s.tShift[h + e] = o[h];
      return s.blkIndent = l, !0;
    }
    function tr(s, e, t, i) {
      var n,
        r,
        o,
        a = s.bMarks[e],
        l = s.eMarks[e];
      if (a += s.tShift[e], a > l || (n = s.src.charCodeAt(a++), n !== 42 && n !== 45 && n !== 95)) return !1;
      for (r = 1; a < l;) {
        if (o = s.src.charCodeAt(a++), o !== n && o !== 32) return !1;
        o === n && r++;
      }
      return r < 3 ? !1 : (i || (s.line = e + 1, s.tokens.push({
        type: "hr",
        lines: [e, s.line],
        level: s.level
      })), !0);
    }
    function pn(s, e) {
      var t, i, n;
      return i = s.bMarks[e] + s.tShift[e], n = s.eMarks[e], i >= n || (t = s.src.charCodeAt(i++), t !== 42 && t !== 45 && t !== 43) || i < n && s.src.charCodeAt(i) !== 32 ? -1 : i;
    }
    function fn(s, e) {
      var t,
        i = s.bMarks[e] + s.tShift[e],
        n = s.eMarks[e];
      if (i + 1 >= n || (t = s.src.charCodeAt(i++), t < 48 || t > 57)) return -1;
      for (;;) {
        if (i >= n) return -1;
        if (t = s.src.charCodeAt(i++), !(t >= 48 && t <= 57)) {
          if (t === 41 || t === 46) break;
          return -1;
        }
      }
      return i < n && s.src.charCodeAt(i) !== 32 ? -1 : i;
    }
    function ir(s, e) {
      var t,
        i,
        n = s.level + 2;
      for (t = e + 2, i = s.tokens.length - 2; t < i; t++) s.tokens[t].level === n && s.tokens[t].type === "paragraph_open" && (s.tokens[t + 2].tight = !0, s.tokens[t].tight = !0, t += 2);
    }
    function nr(s, e, t, i) {
      var n,
        r,
        o,
        a,
        l,
        c,
        d,
        u,
        h,
        p,
        g,
        m,
        S,
        w,
        G,
        A,
        V,
        X,
        oe = !0,
        Q,
        N,
        Be,
        xi;
      if ((u = fn(s, e)) >= 0) S = !0;else if ((u = pn(s, e)) >= 0) S = !1;else return !1;
      if (s.level >= s.options.maxNesting) return !1;
      if (m = s.src.charCodeAt(u - 1), i) return !0;
      for (G = s.tokens.length, S ? (d = s.bMarks[e] + s.tShift[e], g = Number(s.src.substr(d, u - d - 1)), s.tokens.push({
        type: "ordered_list_open",
        order: g,
        lines: V = [e, 0],
        level: s.level++
      })) : s.tokens.push({
        type: "bullet_list_open",
        lines: V = [e, 0],
        level: s.level++
      }), n = e, A = !1, Q = s.parser.ruler.getRules("list"); n < t && (w = s.skipSpaces(u), h = s.eMarks[n], w >= h ? p = 1 : p = w - u, p > 4 && (p = 1), p < 1 && (p = 1), r = u - s.bMarks[n] + p, s.tokens.push({
        type: "list_item_open",
        lines: X = [e, 0],
        level: s.level++
      }), a = s.blkIndent, l = s.tight, o = s.tShift[e], c = s.parentType, s.tShift[e] = w - s.bMarks[e], s.blkIndent = r, s.tight = !0, s.parentType = "list", s.parser.tokenize(s, e, t, !0), (!s.tight || A) && (oe = !1), A = s.line - e > 1 && s.isEmpty(s.line - 1), s.blkIndent = a, s.tShift[e] = o, s.tight = l, s.parentType = c, s.tokens.push({
        type: "list_item_close",
        level: --s.level
      }), n = e = s.line, X[1] = n, w = s.bMarks[e], !(n >= t || s.isEmpty(n) || s.tShift[n] < s.blkIndent));) {
        for (xi = !1, N = 0, Be = Q.length; N < Be; N++) if (Q[N](s, n, t, !0)) {
          xi = !0;
          break;
        }
        if (xi) break;
        if (S) {
          if (u = fn(s, n), u < 0) break;
        } else if (u = pn(s, n), u < 0) break;
        if (m !== s.src.charCodeAt(u - 1)) break;
      }
      return s.tokens.push({
        type: S ? "ordered_list_close" : "bullet_list_close",
        level: --s.level
      }), V[1] = n, s.line = n, oe && ir(s, G), !0;
    }
    function sr(s, e, t, i) {
      var n,
        r,
        o,
        a,
        l,
        c = s.bMarks[e] + s.tShift[e],
        d = s.eMarks[e];
      if (c + 4 > d || s.src.charCodeAt(c) !== 91 || s.src.charCodeAt(c + 1) !== 94 || s.level >= s.options.maxNesting) return !1;
      for (a = c + 2; a < d; a++) {
        if (s.src.charCodeAt(a) === 32) return !1;
        if (s.src.charCodeAt(a) === 93) break;
      }
      return a === c + 2 || a + 1 >= d || s.src.charCodeAt(++a) !== 58 ? !1 : (i || (a++, s.env.footnotes || (s.env.footnotes = {}), s.env.footnotes.refs || (s.env.footnotes.refs = {}), l = s.src.slice(c + 2, a - 2), s.env.footnotes.refs[":" + l] = -1, s.tokens.push({
        type: "footnote_reference_open",
        label: l,
        level: s.level++
      }), n = s.bMarks[e], r = s.tShift[e], o = s.parentType, s.tShift[e] = s.skipSpaces(a) - a, s.bMarks[e] = a, s.blkIndent += 4, s.parentType = "footnote", s.tShift[e] < s.blkIndent && (s.tShift[e] += s.blkIndent, s.bMarks[e] -= s.blkIndent), s.parser.tokenize(s, e, t, !0), s.parentType = o, s.blkIndent -= 4, s.tShift[e] = r, s.bMarks[e] = n, s.tokens.push({
        type: "footnote_reference_close",
        level: --s.level
      })), !0);
    }
    function rr(s, e, t, i) {
      var n,
        r,
        o,
        a = s.bMarks[e] + s.tShift[e],
        l = s.eMarks[e];
      if (a >= l || (n = s.src.charCodeAt(a), n !== 35 || a >= l)) return !1;
      for (r = 1, n = s.src.charCodeAt(++a); n === 35 && a < l && r <= 6;) r++, n = s.src.charCodeAt(++a);
      return r > 6 || a < l && n !== 32 ? !1 : (i || (l = s.skipCharsBack(l, 32, a), o = s.skipCharsBack(l, 35, a), o > a && s.src.charCodeAt(o - 1) === 32 && (l = o), s.line = e + 1, s.tokens.push({
        type: "heading_open",
        hLevel: r,
        lines: [e, s.line],
        level: s.level
      }), a < l && s.tokens.push({
        type: "inline",
        content: s.src.slice(a, l).trim(),
        level: s.level + 1,
        lines: [e, s.line],
        children: []
      }), s.tokens.push({
        type: "heading_close",
        hLevel: r,
        level: s.level
      })), !0);
    }
    function or(s, e, t) {
      var i,
        n,
        r,
        o = e + 1;
      return o >= t || s.tShift[o] < s.blkIndent || s.tShift[o] - s.blkIndent > 3 || (n = s.bMarks[o] + s.tShift[o], r = s.eMarks[o], n >= r) || (i = s.src.charCodeAt(n), i !== 45 && i !== 61) || (n = s.skipChars(n, i), n = s.skipSpaces(n), n < r) ? !1 : (n = s.bMarks[e] + s.tShift[e], s.line = o + 1, s.tokens.push({
        type: "heading_open",
        hLevel: i === 61 ? 1 : 2,
        lines: [e, s.line],
        level: s.level
      }), s.tokens.push({
        type: "inline",
        content: s.src.slice(n, s.eMarks[e]).trim(),
        level: s.level + 1,
        lines: [e, s.line - 1],
        children: []
      }), s.tokens.push({
        type: "heading_close",
        hLevel: i === 61 ? 1 : 2,
        level: s.level
      }), !0);
    }
    var es = {};
    ["article", "aside", "button", "blockquote", "body", "canvas", "caption", "col", "colgroup", "dd", "div", "dl", "dt", "embed", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "iframe", "li", "map", "object", "ol", "output", "p", "pre", "progress", "script", "section", "style", "table", "tbody", "td", "textarea", "tfoot", "th", "tr", "thead", "ul", "video"].forEach(function (s) {
      es[s] = !0;
    });
    var ar = /^<([a-zA-Z]{1,15})[\s\/>]/,
      lr = /^<\/([a-zA-Z]{1,15})[\s>]/;
    function cr(s) {
      var e = s | 32;
      return e >= 97 && e <= 122;
    }
    function dr(s, e, t, i) {
      var n,
        r,
        o,
        a = s.bMarks[e],
        l = s.eMarks[e],
        c = s.tShift[e];
      if (a += c, !s.options.html || c > 3 || a + 2 >= l || s.src.charCodeAt(a) !== 60) return !1;
      if (n = s.src.charCodeAt(a + 1), n === 33 || n === 63) {
        if (i) return !0;
      } else if (n === 47 || cr(n)) {
        if (n === 47) {
          if (r = s.src.slice(a, l).match(lr), !r) return !1;
        } else if (r = s.src.slice(a, l).match(ar), !r) return !1;
        if (es[r[1].toLowerCase()] !== !0) return !1;
        if (i) return !0;
      } else return !1;
      for (o = e + 1; o < s.lineMax && !s.isEmpty(o);) o++;
      return s.line = o, s.tokens.push({
        type: "htmlblock",
        level: s.level,
        lines: [e, s.line],
        content: s.getLines(e, o, 0, !0)
      }), !0;
    }
    function _i(s, e) {
      var t = s.bMarks[e] + s.blkIndent,
        i = s.eMarks[e];
      return s.src.substr(t, i - t);
    }
    function ur(s, e, t, i) {
      var n, r, o, a, l, c, d, u, h, p, g;
      if (e + 2 > t || (l = e + 1, s.tShift[l] < s.blkIndent) || (o = s.bMarks[l] + s.tShift[l], o >= s.eMarks[l]) || (n = s.src.charCodeAt(o), n !== 124 && n !== 45 && n !== 58) || (r = _i(s, e + 1), !/^[-:| ]+$/.test(r)) || (c = r.split("|"), c <= 2)) return !1;
      for (u = [], a = 0; a < c.length; a++) {
        if (h = c[a].trim(), !h) {
          if (a === 0 || a === c.length - 1) continue;
          return !1;
        }
        if (!/^:?-+:?$/.test(h)) return !1;
        h.charCodeAt(h.length - 1) === 58 ? u.push(h.charCodeAt(0) === 58 ? "center" : "right") : h.charCodeAt(0) === 58 ? u.push("left") : u.push("");
      }
      if (r = _i(s, e).trim(), r.indexOf("|") === -1 || (c = r.replace(/^\||\|$/g, "").split("|"), u.length !== c.length)) return !1;
      if (i) return !0;
      for (s.tokens.push({
        type: "table_open",
        lines: p = [e, 0],
        level: s.level++
      }), s.tokens.push({
        type: "thead_open",
        lines: [e, e + 1],
        level: s.level++
      }), s.tokens.push({
        type: "tr_open",
        lines: [e, e + 1],
        level: s.level++
      }), a = 0; a < c.length; a++) s.tokens.push({
        type: "th_open",
        align: u[a],
        lines: [e, e + 1],
        level: s.level++
      }), s.tokens.push({
        type: "inline",
        content: c[a].trim(),
        lines: [e, e + 1],
        level: s.level,
        children: []
      }), s.tokens.push({
        type: "th_close",
        level: --s.level
      });
      for (s.tokens.push({
        type: "tr_close",
        level: --s.level
      }), s.tokens.push({
        type: "thead_close",
        level: --s.level
      }), s.tokens.push({
        type: "tbody_open",
        lines: g = [e + 2, 0],
        level: s.level++
      }), l = e + 2; l < t && !(s.tShift[l] < s.blkIndent || (r = _i(s, l).trim(), r.indexOf("|") === -1)); l++) {
        for (c = r.replace(/^\||\|$/g, "").split("|"), s.tokens.push({
          type: "tr_open",
          level: s.level++
        }), a = 0; a < c.length; a++) s.tokens.push({
          type: "td_open",
          align: u[a],
          level: s.level++
        }), d = c[a].substring(c[a].charCodeAt(0) === 124 ? 1 : 0, c[a].charCodeAt(c[a].length - 1) === 124 ? c[a].length - 1 : c[a].length).trim(), s.tokens.push({
          type: "inline",
          content: d,
          level: s.level,
          children: []
        }), s.tokens.push({
          type: "td_close",
          level: --s.level
        });
        s.tokens.push({
          type: "tr_close",
          level: --s.level
        });
      }
      return s.tokens.push({
        type: "tbody_close",
        level: --s.level
      }), s.tokens.push({
        type: "table_close",
        level: --s.level
      }), p[1] = g[1] = l, s.line = l, !0;
    }
    function It(s, e) {
      var t,
        i,
        n = s.bMarks[e] + s.tShift[e],
        r = s.eMarks[e];
      return n >= r || (i = s.src.charCodeAt(n++), i !== 126 && i !== 58) || (t = s.skipSpaces(n), n === t) || t >= r ? -1 : t;
    }
    function hr(s, e) {
      var t,
        i,
        n = s.level + 2;
      for (t = e + 2, i = s.tokens.length - 2; t < i; t++) s.tokens[t].level === n && s.tokens[t].type === "paragraph_open" && (s.tokens[t + 2].tight = !0, s.tokens[t].tight = !0, t += 2);
    }
    function pr(s, e, t, i) {
      var n, r, o, a, l, c, d, u, h, p, g, m, S, w;
      if (i) return s.ddIndent < 0 ? !1 : It(s, e) >= 0;
      if (d = e + 1, s.isEmpty(d) && ++d > t || s.tShift[d] < s.blkIndent || (n = It(s, d), n < 0) || s.level >= s.options.maxNesting) return !1;
      c = s.tokens.length, s.tokens.push({
        type: "dl_open",
        lines: l = [e, 0],
        level: s.level++
      }), o = e, r = d;
      e: for (;;) {
        for (w = !0, S = !1, s.tokens.push({
          type: "dt_open",
          lines: [o, o],
          level: s.level++
        }), s.tokens.push({
          type: "inline",
          content: s.getLines(o, o + 1, s.blkIndent, !1).trim(),
          level: s.level + 1,
          lines: [o, o],
          children: []
        }), s.tokens.push({
          type: "dt_close",
          level: --s.level
        });;) {
          if (s.tokens.push({
            type: "dd_open",
            lines: a = [d, 0],
            level: s.level++
          }), m = s.tight, h = s.ddIndent, u = s.blkIndent, g = s.tShift[r], p = s.parentType, s.blkIndent = s.ddIndent = s.tShift[r] + 2, s.tShift[r] = n - s.bMarks[r], s.tight = !0, s.parentType = "deflist", s.parser.tokenize(s, r, t, !0), (!s.tight || S) && (w = !1), S = s.line - r > 1 && s.isEmpty(s.line - 1), s.tShift[r] = g, s.tight = m, s.parentType = p, s.blkIndent = u, s.ddIndent = h, s.tokens.push({
            type: "dd_close",
            level: --s.level
          }), a[1] = d = s.line, d >= t || s.tShift[d] < s.blkIndent) break e;
          if (n = It(s, d), n < 0) break;
          r = d;
        }
        if (d >= t || (o = d, s.isEmpty(o)) || s.tShift[o] < s.blkIndent || (r = o + 1, r >= t) || (s.isEmpty(r) && r++, r >= t) || s.tShift[r] < s.blkIndent || (n = It(s, r), n < 0)) break;
      }
      return s.tokens.push({
        type: "dl_close",
        level: --s.level
      }), l[1] = d, s.line = d, w && hr(s, c), !0;
    }
    function fr(s, e) {
      var t,
        i,
        n,
        r,
        o,
        a = e + 1,
        l;
      if (t = s.lineMax, a < t && !s.isEmpty(a)) {
        for (l = s.parser.ruler.getRules("paragraph"); a < t && !s.isEmpty(a); a++) if (!(s.tShift[a] - s.blkIndent > 3)) {
          for (n = !1, r = 0, o = l.length; r < o; r++) if (l[r](s, a, t, !0)) {
            n = !0;
            break;
          }
          if (n) break;
        }
      }
      return i = s.getLines(e, a, s.blkIndent, !1).trim(), s.line = a, i.length && (s.tokens.push({
        type: "paragraph_open",
        tight: !1,
        lines: [e, s.line],
        level: s.level
      }), s.tokens.push({
        type: "inline",
        content: i,
        level: s.level + 1,
        lines: [e, s.line],
        children: []
      }), s.tokens.push({
        type: "paragraph_close",
        tight: !1,
        level: s.level
      })), !0;
    }
    var Lt = [["code", Xs], ["fences", Qs, ["paragraph", "blockquote", "list"]], ["blockquote", er, ["paragraph", "blockquote", "list"]], ["hr", tr, ["paragraph", "blockquote", "list"]], ["list", nr, ["paragraph", "blockquote"]], ["footnote", sr, ["paragraph"]], ["heading", rr, ["paragraph", "blockquote"]], ["lheading", or], ["htmlblock", dr, ["paragraph", "blockquote"]], ["table", ur, ["paragraph"]], ["deflist", pr, ["paragraph"]], ["paragraph", fr]];
    function Vi() {
      this.ruler = new H();
      for (var s = 0; s < Lt.length; s++) this.ruler.push(Lt[s][0], Lt[s][1], {
        alt: (Lt[s][2] || []).slice()
      });
    }
    Vi.prototype.tokenize = function (s, e, t) {
      for (var i = this.ruler.getRules(""), n = i.length, r = e, o = !1, a, l; r < t && (s.line = r = s.skipEmptyLines(r), !(r >= t || s.tShift[r] < s.blkIndent));) {
        for (l = 0; l < n && (a = i[l](s, r, t, !1), !a); l++);
        if (s.tight = !o, s.isEmpty(s.line - 1) && (o = !0), r = s.line, r < t && s.isEmpty(r)) {
          if (o = !0, r++, r < t && s.parentType === "list" && s.isEmpty(r)) break;
          s.line = r;
        }
      }
    };
    var mr = /[\n\t]/g,
      gr = /\r[\n\u0085]|[\u2424\u2028\u0085]/g,
      br = /\u00a0/g;
    Vi.prototype.parse = function (s, e, t, i) {
      var n,
        r = 0,
        o = 0;
      if (!s) return [];
      s = s.replace(br, " "), s = s.replace(gr, "\n"), s.indexOf("	") >= 0 && (s = s.replace(mr, function (a, l) {
        var c;
        return s.charCodeAt(l) === 10 ? (r = l + 1, o = 0, a) : (c = "    ".slice((l - r - o) % 4), o = l - r + 1, c);
      })), n = new Ne(s, this, e, t, i), this.tokenize(n, n.line, n.lineMax);
    };
    function vr(s) {
      switch (s) {
        case 10:
        case 92:
        case 96:
        case 42:
        case 95:
        case 94:
        case 91:
        case 93:
        case 33:
        case 38:
        case 60:
        case 62:
        case 123:
        case 125:
        case 36:
        case 37:
        case 64:
        case 126:
        case 43:
        case 61:
        case 58:
          return !0;
        default:
          return !1;
      }
    }
    function yr(s, e) {
      for (var t = s.pos; t < s.posMax && !vr(s.src.charCodeAt(t));) t++;
      return t === s.pos ? !1 : (e || (s.pending += s.src.slice(s.pos, t)), s.pos = t, !0);
    }
    function xr(s, e) {
      var t,
        i,
        n = s.pos;
      if (s.src.charCodeAt(n) !== 10) return !1;
      if (t = s.pending.length - 1, i = s.posMax, !e) if (t >= 0 && s.pending.charCodeAt(t) === 32) {
        if (t >= 1 && s.pending.charCodeAt(t - 1) === 32) {
          for (var r = t - 2; r >= 0; r--) if (s.pending.charCodeAt(r) !== 32) {
            s.pending = s.pending.substring(0, r + 1);
            break;
          }
          s.push({
            type: "hardbreak",
            level: s.level
          });
        } else s.pending = s.pending.slice(0, -1), s.push({
          type: "softbreak",
          level: s.level
        });
      } else s.push({
        type: "softbreak",
        level: s.level
      });
      for (n++; n < i && s.src.charCodeAt(n) === 32;) n++;
      return s.pos = n, !0;
    }
    var Wi = [];
    for (var mn = 0; mn < 256; mn++) Wi.push(0);
    "\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("").forEach(function (s) {
      Wi[s.charCodeAt(0)] = 1;
    });
    function Er(s, e) {
      var t,
        i = s.pos,
        n = s.posMax;
      if (s.src.charCodeAt(i) !== 92) return !1;
      if (i++, i < n) {
        if (t = s.src.charCodeAt(i), t < 256 && Wi[t] !== 0) return e || (s.pending += s.src[i]), s.pos += 2, !0;
        if (t === 10) {
          for (e || s.push({
            type: "hardbreak",
            level: s.level
          }), i++; i < n && s.src.charCodeAt(i) === 32;) i++;
          return s.pos = i, !0;
        }
      }
      return e || (s.pending += "\\"), s.pos++, !0;
    }
    function Sr(s, e) {
      var t,
        i,
        n,
        r,
        o,
        a = s.pos,
        l = s.src.charCodeAt(a);
      if (l !== 96) return !1;
      for (t = a, a++, i = s.posMax; a < i && s.src.charCodeAt(a) === 96;) a++;
      for (n = s.src.slice(t, a), r = o = a; (r = s.src.indexOf("`", o)) !== -1;) {
        for (o = r + 1; o < i && s.src.charCodeAt(o) === 96;) o++;
        if (o - r === n.length) return e || s.push({
          type: "code",
          content: s.src.slice(a, r).replace(/[ \n]+/g, " ").trim(),
          block: !1,
          level: s.level
        }), s.pos = o, !0;
      }
      return e || (s.pending += n), s.pos += n.length, !0;
    }
    function wr(s, e) {
      var t,
        i,
        n,
        r = s.posMax,
        o = s.pos,
        a,
        l;
      if (s.src.charCodeAt(o) !== 126 || e || o + 4 >= r || s.src.charCodeAt(o + 1) !== 126 || s.level >= s.options.maxNesting || (a = o > 0 ? s.src.charCodeAt(o - 1) : -1, l = s.src.charCodeAt(o + 2), a === 126) || l === 126 || l === 32 || l === 10) return !1;
      for (i = o + 2; i < r && s.src.charCodeAt(i) === 126;) i++;
      if (i > o + 3) return s.pos += i - o, e || (s.pending += s.src.slice(o, i)), !0;
      for (s.pos = o + 2, n = 1; s.pos + 1 < r;) {
        if (s.src.charCodeAt(s.pos) === 126 && s.src.charCodeAt(s.pos + 1) === 126 && (a = s.src.charCodeAt(s.pos - 1), l = s.pos + 2 < r ? s.src.charCodeAt(s.pos + 2) : -1, l !== 126 && a !== 126 && (a !== 32 && a !== 10 ? n-- : l !== 32 && l !== 10 && n++, n <= 0))) {
          t = !0;
          break;
        }
        s.parser.skipToken(s);
      }
      return t ? (s.posMax = s.pos, s.pos = o + 2, e || (s.push({
        type: "del_open",
        level: s.level++
      }), s.parser.tokenize(s), s.push({
        type: "del_close",
        level: --s.level
      })), s.pos = s.posMax + 2, s.posMax = r, !0) : (s.pos = o, !1);
    }
    function _r(s, e) {
      var t,
        i,
        n,
        r = s.posMax,
        o = s.pos,
        a,
        l;
      if (s.src.charCodeAt(o) !== 43 || e || o + 4 >= r || s.src.charCodeAt(o + 1) !== 43 || s.level >= s.options.maxNesting || (a = o > 0 ? s.src.charCodeAt(o - 1) : -1, l = s.src.charCodeAt(o + 2), a === 43) || l === 43 || l === 32 || l === 10) return !1;
      for (i = o + 2; i < r && s.src.charCodeAt(i) === 43;) i++;
      if (i !== o + 2) return s.pos += i - o, e || (s.pending += s.src.slice(o, i)), !0;
      for (s.pos = o + 2, n = 1; s.pos + 1 < r;) {
        if (s.src.charCodeAt(s.pos) === 43 && s.src.charCodeAt(s.pos + 1) === 43 && (a = s.src.charCodeAt(s.pos - 1), l = s.pos + 2 < r ? s.src.charCodeAt(s.pos + 2) : -1, l !== 43 && a !== 43 && (a !== 32 && a !== 10 ? n-- : l !== 32 && l !== 10 && n++, n <= 0))) {
          t = !0;
          break;
        }
        s.parser.skipToken(s);
      }
      return t ? (s.posMax = s.pos, s.pos = o + 2, e || (s.push({
        type: "ins_open",
        level: s.level++
      }), s.parser.tokenize(s), s.push({
        type: "ins_close",
        level: --s.level
      })), s.pos = s.posMax + 2, s.posMax = r, !0) : (s.pos = o, !1);
    }
    function Mr(s, e) {
      var t,
        i,
        n,
        r = s.posMax,
        o = s.pos,
        a,
        l;
      if (s.src.charCodeAt(o) !== 61 || e || o + 4 >= r || s.src.charCodeAt(o + 1) !== 61 || s.level >= s.options.maxNesting || (a = o > 0 ? s.src.charCodeAt(o - 1) : -1, l = s.src.charCodeAt(o + 2), a === 61) || l === 61 || l === 32 || l === 10) return !1;
      for (i = o + 2; i < r && s.src.charCodeAt(i) === 61;) i++;
      if (i !== o + 2) return s.pos += i - o, e || (s.pending += s.src.slice(o, i)), !0;
      for (s.pos = o + 2, n = 1; s.pos + 1 < r;) {
        if (s.src.charCodeAt(s.pos) === 61 && s.src.charCodeAt(s.pos + 1) === 61 && (a = s.src.charCodeAt(s.pos - 1), l = s.pos + 2 < r ? s.src.charCodeAt(s.pos + 2) : -1, l !== 61 && a !== 61 && (a !== 32 && a !== 10 ? n-- : l !== 32 && l !== 10 && n++, n <= 0))) {
          t = !0;
          break;
        }
        s.parser.skipToken(s);
      }
      return t ? (s.posMax = s.pos, s.pos = o + 2, e || (s.push({
        type: "mark_open",
        level: s.level++
      }), s.parser.tokenize(s), s.push({
        type: "mark_close",
        level: --s.level
      })), s.pos = s.posMax + 2, s.posMax = r, !0) : (s.pos = o, !1);
    }
    function gn(s) {
      return s >= 48 && s <= 57 || s >= 65 && s <= 90 || s >= 97 && s <= 122;
    }
    function bn(s, e) {
      var t = e,
        i,
        n,
        r,
        o = !0,
        a = !0,
        l = s.posMax,
        c = s.src.charCodeAt(e);
      for (i = e > 0 ? s.src.charCodeAt(e - 1) : -1; t < l && s.src.charCodeAt(t) === c;) t++;
      return t >= l && (o = !1), r = t - e, r >= 4 ? o = a = !1 : (n = t < l ? s.src.charCodeAt(t) : -1, (n === 32 || n === 10) && (o = !1), (i === 32 || i === 10) && (a = !1), c === 95 && (gn(i) && (o = !1), gn(n) && (a = !1))), {
        can_open: o,
        can_close: a,
        delims: r
      };
    }
    function Tr(s, e) {
      var t,
        i,
        n,
        r,
        o,
        a,
        l,
        c = s.posMax,
        d = s.pos,
        u = s.src.charCodeAt(d);
      if (u !== 95 && u !== 42 || e) return !1;
      if (l = bn(s, d), t = l.delims, !l.can_open) return s.pos += t, e || (s.pending += s.src.slice(d, s.pos)), !0;
      if (s.level >= s.options.maxNesting) return !1;
      for (s.pos = d + t, a = [t]; s.pos < c;) {
        if (s.src.charCodeAt(s.pos) === u) {
          if (l = bn(s, s.pos), i = l.delims, l.can_close) {
            for (r = a.pop(), o = i; r !== o;) {
              if (o < r) {
                a.push(r - o);
                break;
              }
              if (o -= r, a.length === 0) break;
              s.pos += r, r = a.pop();
            }
            if (a.length === 0) {
              t = r, n = !0;
              break;
            }
            s.pos += i;
            continue;
          }
          l.can_open && a.push(i), s.pos += i;
          continue;
        }
        s.parser.skipToken(s);
      }
      return n ? (s.posMax = s.pos, s.pos = d + t, e || ((t === 2 || t === 3) && s.push({
        type: "strong_open",
        level: s.level++
      }), (t === 1 || t === 3) && s.push({
        type: "em_open",
        level: s.level++
      }), s.parser.tokenize(s), (t === 1 || t === 3) && s.push({
        type: "em_close",
        level: --s.level
      }), (t === 2 || t === 3) && s.push({
        type: "strong_close",
        level: --s.level
      })), s.pos = s.posMax + t, s.posMax = c, !0) : (s.pos = d, !1);
    }
    var Cr = /\\([ \\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;
    function Ar(s, e) {
      var t,
        i,
        n = s.posMax,
        r = s.pos;
      if (s.src.charCodeAt(r) !== 126 || e || r + 2 >= n || s.level >= s.options.maxNesting) return !1;
      for (s.pos = r + 1; s.pos < n;) {
        if (s.src.charCodeAt(s.pos) === 126) {
          t = !0;
          break;
        }
        s.parser.skipToken(s);
      }
      return !t || r + 1 === s.pos || (i = s.src.slice(r + 1, s.pos), i.match(/(^|[^\\])(\\\\)*\s/)) ? (s.pos = r, !1) : (s.posMax = s.pos, s.pos = r + 1, e || s.push({
        type: "sub",
        level: s.level,
        content: i.replace(Cr, "$1")
      }), s.pos = s.posMax + 1, s.posMax = n, !0);
    }
    var kr = /\\([ \\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;
    function Ir(s, e) {
      var t,
        i,
        n = s.posMax,
        r = s.pos;
      if (s.src.charCodeAt(r) !== 94 || e || r + 2 >= n || s.level >= s.options.maxNesting) return !1;
      for (s.pos = r + 1; s.pos < n;) {
        if (s.src.charCodeAt(s.pos) === 94) {
          t = !0;
          break;
        }
        s.parser.skipToken(s);
      }
      return !t || r + 1 === s.pos || (i = s.src.slice(r + 1, s.pos), i.match(/(^|[^\\])(\\\\)*\s/)) ? (s.pos = r, !1) : (s.posMax = s.pos, s.pos = r + 1, e || s.push({
        type: "sup",
        level: s.level,
        content: i.replace(kr, "$1")
      }), s.pos = s.posMax + 1, s.posMax = n, !0);
    }
    function Lr(s, e) {
      var t,
        i,
        n,
        r,
        o,
        a,
        l,
        c,
        d = !1,
        u = s.pos,
        h = s.posMax,
        p = s.pos,
        g = s.src.charCodeAt(p);
      if (g === 33 && (d = !0, g = s.src.charCodeAt(++p)), g !== 91 || s.level >= s.options.maxNesting || (t = p + 1, i = mt(s, p), i < 0)) return !1;
      if (a = i + 1, a < h && s.src.charCodeAt(a) === 40) {
        for (a++; a < h && (c = s.src.charCodeAt(a), !(c !== 32 && c !== 10)); a++);
        if (a >= h) return !1;
        for (p = a, Yn(s, a) ? (r = s.linkContent, a = s.pos) : r = "", p = a; a < h && (c = s.src.charCodeAt(a), !(c !== 32 && c !== 10)); a++);
        if (a < h && p !== a && Zn(s, a)) for (o = s.linkContent, a = s.pos; a < h && (c = s.src.charCodeAt(a), !(c !== 32 && c !== 10)); a++);else o = "";
        if (a >= h || s.src.charCodeAt(a) !== 41) return s.pos = u, !1;
        a++;
      } else {
        if (s.linkLevel > 0) return !1;
        for (; a < h && (c = s.src.charCodeAt(a), !(c !== 32 && c !== 10)); a++);
        if (a < h && s.src.charCodeAt(a) === 91 && (p = a + 1, a = mt(s, a), a >= 0 ? n = s.src.slice(p, a++) : a = p - 1), n || (_typeof(n) > "u" && (a = i + 1), n = s.src.slice(t, i)), l = s.env.references[Xn(n)], !l) return s.pos = u, !1;
        r = l.href, o = l.title;
      }
      return e || (s.pos = t, s.posMax = i, d ? s.push({
        type: "image",
        src: r,
        title: o,
        alt: s.src.substr(t, i - t),
        level: s.level
      }) : (s.push({
        type: "link_open",
        href: r,
        title: o,
        level: s.level++
      }), s.linkLevel++, s.parser.tokenize(s), s.linkLevel--, s.push({
        type: "link_close",
        level: --s.level
      }))), s.pos = a, s.posMax = h, !0;
    }
    function Rr(s, e) {
      var t,
        i,
        n,
        r,
        o = s.posMax,
        a = s.pos;
      return a + 2 >= o || s.src.charCodeAt(a) !== 94 || s.src.charCodeAt(a + 1) !== 91 || s.level >= s.options.maxNesting || (t = a + 2, i = mt(s, a + 1), i < 0) ? !1 : (e || (s.env.footnotes || (s.env.footnotes = {}), s.env.footnotes.list || (s.env.footnotes.list = []), n = s.env.footnotes.list.length, s.pos = t, s.posMax = i, s.push({
        type: "footnote_ref",
        id: n,
        level: s.level
      }), s.linkLevel++, r = s.tokens.length, s.parser.tokenize(s), s.env.footnotes.list[n] = {
        tokens: s.tokens.splice(r)
      }, s.linkLevel--), s.pos = i + 1, s.posMax = o, !0);
    }
    function Or(s, e) {
      var t,
        i,
        n,
        r,
        o = s.posMax,
        a = s.pos;
      if (a + 3 > o || !s.env.footnotes || !s.env.footnotes.refs || s.src.charCodeAt(a) !== 91 || s.src.charCodeAt(a + 1) !== 94 || s.level >= s.options.maxNesting) return !1;
      for (i = a + 2; i < o; i++) {
        if (s.src.charCodeAt(i) === 32 || s.src.charCodeAt(i) === 10) return !1;
        if (s.src.charCodeAt(i) === 93) break;
      }
      return i === a + 2 || i >= o || (i++, t = s.src.slice(a + 2, i - 1), _typeof(s.env.footnotes.refs[":" + t]) > "u") ? !1 : (e || (s.env.footnotes.list || (s.env.footnotes.list = []), s.env.footnotes.refs[":" + t] < 0 ? (n = s.env.footnotes.list.length, s.env.footnotes.list[n] = {
        label: t,
        count: 0
      }, s.env.footnotes.refs[":" + t] = n) : n = s.env.footnotes.refs[":" + t], r = s.env.footnotes.list[n].count, s.env.footnotes.list[n].count++, s.push({
        type: "footnote_ref",
        id: n,
        subId: r,
        level: s.level
      })), s.pos = i, s.posMax = o, !0);
    }
    var Nr = ["coap", "doi", "javascript", "aaa", "aaas", "about", "acap", "cap", "cid", "crid", "data", "dav", "dict", "dns", "file", "ftp", "geo", "go", "gopher", "h323", "http", "https", "iax", "icap", "im", "imap", "info", "ipp", "iris", "iris.beep", "iris.xpc", "iris.xpcs", "iris.lwz", "ldap", "mailto", "mid", "msrp", "msrps", "mtqp", "mupdate", "news", "nfs", "ni", "nih", "nntp", "opaquelocktoken", "pop", "pres", "rtsp", "service", "session", "shttp", "sieve", "sip", "sips", "sms", "snmp", "soap.beep", "soap.beeps", "tag", "tel", "telnet", "tftp", "thismessage", "tn3270", "tip", "tv", "urn", "vemmi", "ws", "wss", "xcon", "xcon-userid", "xmlrpc.beep", "xmlrpc.beeps", "xmpp", "z39.50r", "z39.50s", "adiumxtra", "afp", "afs", "aim", "apt", "attachment", "aw", "beshare", "bitcoin", "bolo", "callto", "chrome", "chrome-extension", "com-eventbrite-attendee", "content", "cvs", "dlna-playsingle", "dlna-playcontainer", "dtn", "dvb", "ed2k", "facetime", "feed", "finger", "fish", "gg", "git", "gizmoproject", "gtalk", "hcp", "icon", "ipn", "irc", "irc6", "ircs", "itms", "jar", "jms", "keyparc", "lastfm", "ldaps", "magnet", "maps", "market", "message", "mms", "ms-help", "msnim", "mumble", "mvn", "notes", "oid", "palm", "paparazzi", "platform", "proxy", "psyc", "query", "res", "resource", "rmi", "rsync", "rtmp", "secondlife", "sftp", "sgn", "skype", "smb", "soldat", "spotify", "ssh", "steam", "svn", "teamspeak", "things", "udp", "unreal", "ut2004", "ventrilo", "view-source", "webcal", "wtai", "wyciwyg", "xfire", "xri", "ymsgr"],
      Pr = /^<([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/,
      Dr = /^<([a-zA-Z.\-]{1,25}):([^<>\x00-\x20]*)>/;
    function jr(s, e) {
      var t,
        i,
        n,
        r,
        o,
        a = s.pos;
      return s.src.charCodeAt(a) !== 60 || (t = s.src.slice(a), t.indexOf(">") < 0) ? !1 : (i = t.match(Dr), i ? Nr.indexOf(i[1].toLowerCase()) < 0 || (r = i[0].slice(1, -1), o = Ni(r), !s.parser.validateLink(r)) ? !1 : (e || (s.push({
        type: "link_open",
        href: o,
        level: s.level
      }), s.push({
        type: "text",
        content: r,
        level: s.level + 1
      }), s.push({
        type: "link_close",
        level: s.level
      })), s.pos += i[0].length, !0) : (n = t.match(Pr), n ? (r = n[0].slice(1, -1), o = Ni("mailto:" + r), s.parser.validateLink(o) ? (e || (s.push({
        type: "link_open",
        href: o,
        level: s.level
      }), s.push({
        type: "text",
        content: r,
        level: s.level + 1
      }), s.push({
        type: "link_close",
        level: s.level
      })), s.pos += n[0].length, !0) : !1) : !1));
    }
    function ti(s, e) {
      return s = s.source, e = e || "", function t(i, n) {
        return i ? (n = n.source || n, s = s.replace(i, n), t) : new RegExp(s, e);
      };
    }
    var Fr = /[a-zA-Z_:][a-zA-Z0-9:._-]*/,
      Br = /[^"'=<>`\x00-\x20]+/,
      zr = /'[^']*'/,
      Ur = /"[^"]*"/,
      qr = ti(/(?:unquoted|single_quoted|double_quoted)/)("unquoted", Br)("single_quoted", zr)("double_quoted", Ur)(),
      Hr = ti(/(?:\s+attr_name(?:\s*=\s*attr_value)?)/)("attr_name", Fr)("attr_value", qr)(),
      Gr = ti(/<[A-Za-z][A-Za-z0-9]*attribute*\s*\/?>/)("attribute", Hr)(),
      Vr = /<\/[A-Za-z][A-Za-z0-9]*\s*>/,
      Wr = /<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->/,
      Kr = /<[?].*?[?]>/,
      Jr = /<![A-Z]+\s+[^>]*>/,
      $r = /<!\[CDATA\[[\s\S]*?\]\]>/,
      Yr = ti(/^(?:open_tag|close_tag|comment|processing|declaration|cdata)/)("open_tag", Gr)("close_tag", Vr)("comment", Wr)("processing", Kr)("declaration", Jr)("cdata", $r)();
    function Zr(s) {
      var e = s | 32;
      return e >= 97 && e <= 122;
    }
    function Xr(s, e) {
      var t,
        i,
        n,
        r = s.pos;
      return !s.options.html || (n = s.posMax, s.src.charCodeAt(r) !== 60 || r + 2 >= n) || (t = s.src.charCodeAt(r + 1), t !== 33 && t !== 63 && t !== 47 && !Zr(t)) || (i = s.src.slice(r).match(Yr), !i) ? !1 : (e || s.push({
        type: "htmltag",
        content: s.src.slice(r, r + i[0].length),
        level: s.level
      }), s.pos += i[0].length, !0);
    }
    var Qr = /^&#((?:x[a-f0-9]{1,8}|[0-9]{1,8}));/i,
      eo = /^&([a-z][a-z0-9]{1,31});/i;
    function to(s, e) {
      var t,
        i,
        n,
        r = s.pos,
        o = s.posMax;
      if (s.src.charCodeAt(r) !== 38) return !1;
      if (r + 1 < o) {
        if (t = s.src.charCodeAt(r + 1), t === 35) {
          if (n = s.src.slice(r).match(Qr), n) return e || (i = n[1][0].toLowerCase() === "x" ? parseInt(n[1].slice(1), 16) : parseInt(n[1], 10), s.pending += Jn(i) ? Oi(i) : Oi(65533)), s.pos += n[0].length, !0;
        } else if (n = s.src.slice(r).match(eo), n) {
          var a = Wn(n[1]);
          if (n[1] !== a) return e || (s.pending += a), s.pos += n[0].length, !0;
        }
      }
      return e || (s.pending += "&"), s.pos++, !0;
    }
    var Mi = [["text", yr], ["newline", xr], ["escape", Er], ["backticks", Sr], ["del", wr], ["ins", _r], ["mark", Mr], ["emphasis", Tr], ["sub", Ar], ["sup", Ir], ["links", Lr], ["footnote_inline", Rr], ["footnote_ref", Or], ["autolink", jr], ["htmltag", Xr], ["entity", to]];
    function ii() {
      this.ruler = new H();
      for (var s = 0; s < Mi.length; s++) this.ruler.push(Mi[s][0], Mi[s][1]);
      this.validateLink = io;
    }
    ii.prototype.skipToken = function (s) {
      var e = this.ruler.getRules(""),
        t = e.length,
        i = s.pos,
        n,
        r;
      if ((r = s.cacheGet(i)) > 0) {
        s.pos = r;
        return;
      }
      for (n = 0; n < t; n++) if (e[n](s, !0)) {
        s.cacheSet(i, s.pos);
        return;
      }
      s.pos++, s.cacheSet(i, s.pos);
    };
    ii.prototype.tokenize = function (s) {
      for (var e = this.ruler.getRules(""), t = e.length, i = s.posMax, n, r; s.pos < i;) {
        for (r = 0; r < t && (n = e[r](s, !1), !n); r++);
        if (n) {
          if (s.pos >= i) break;
          continue;
        }
        s.pending += s.src[s.pos++];
      }
      s.pending && s.pushPending();
    };
    ii.prototype.parse = function (s, e, t, i) {
      var n = new Oe(s, this, e, t, i);
      this.tokenize(n);
    };
    function io(s) {
      var e = ["vbscript", "javascript", "file", "data"],
        t = s.trim().toLowerCase();
      return t = Ie(t), !(t.indexOf(":") !== -1 && e.indexOf(t.split(":")[0]) !== -1);
    }
    var no = {
        options: {
          html: !1,
          // Enable HTML tags in source
          xhtmlOut: !1,
          // Use '/' to close single tags (<br />)
          breaks: !1,
          // Convert '\n' in paragraphs into <br>
          langPrefix: "language-",
          // CSS language prefix for fenced blocks
          linkTarget: "",
          // set target to open link in
          // Enable some language-neutral replacements + quotes beautification
          typographer: !1,
          // Double + single quotes replacement pairs, when typographer enabled,
          // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
          quotes: "“”‘’",
          // Highlighter function. Should return escaped HTML,
          // or '' if input not changed
          //
          // function (/*str, lang*/) { return ''; }
          //
          highlight: null,
          maxNesting: 20
          // Internal protection, recursion limit
        },
        components: {
          core: {
            rules: ["block", "inline", "references", "replacements", "smartquotes", "references", "abbr2", "footnote_tail"]
          },
          block: {
            rules: ["blockquote", "code", "fences", "footnote", "heading", "hr", "htmlblock", "lheading", "list", "paragraph", "table"]
          },
          inline: {
            rules: ["autolink", "backticks", "del", "emphasis", "entity", "escape", "footnote_ref", "htmltag", "links", "newline", "text"]
          }
        }
      },
      so = {
        options: {
          html: !1,
          // Enable HTML tags in source
          xhtmlOut: !1,
          // Use '/' to close single tags (<br />)
          breaks: !1,
          // Convert '\n' in paragraphs into <br>
          langPrefix: "language-",
          // CSS language prefix for fenced blocks
          linkTarget: "",
          // set target to open link in
          // Enable some language-neutral replacements + quotes beautification
          typographer: !1,
          // Double + single quotes replacement pairs, when typographer enabled,
          // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
          quotes: "“”‘’",
          // Highlighter function. Should return escaped HTML,
          // or '' if input not changed
          //
          // function (/*str, lang*/) { return ''; }
          //
          highlight: null,
          maxNesting: 20
          // Internal protection, recursion limit
        },
        components: {
          // Don't restrict core/block/inline rules
          core: {},
          block: {},
          inline: {}
        }
      },
      ro = {
        options: {
          html: !0,
          // Enable HTML tags in source
          xhtmlOut: !0,
          // Use '/' to close single tags (<br />)
          breaks: !1,
          // Convert '\n' in paragraphs into <br>
          langPrefix: "language-",
          // CSS language prefix for fenced blocks
          linkTarget: "",
          // set target to open link in
          // Enable some language-neutral replacements + quotes beautification
          typographer: !1,
          // Double + single quotes replacement pairs, when typographer enabled,
          // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
          quotes: "“”‘’",
          // Highlighter function. Should return escaped HTML,
          // or '' if input not changed
          //
          // function (/*str, lang*/) { return ''; }
          //
          highlight: null,
          maxNesting: 20
          // Internal protection, recursion limit
        },
        components: {
          core: {
            rules: ["block", "inline", "references", "abbr2"]
          },
          block: {
            rules: ["blockquote", "code", "fences", "heading", "hr", "htmlblock", "lheading", "list", "paragraph"]
          },
          inline: {
            rules: ["autolink", "backticks", "emphasis", "entity", "escape", "htmltag", "links", "newline", "text"]
          }
        }
      },
      oo = {
        "default": no,
        full: so,
        commonmark: ro
      };
    function ts(s, e, t) {
      this.src = e, this.env = t, this.options = s.options, this.tokens = [], this.inlineMode = !1, this.inline = s.inline, this.block = s.block, this.renderer = s.renderer, this.typographer = s.typographer;
    }
    function he(s, e) {
      typeof s != "string" && (e = s, s = "default"), e && e.linkify != null && console.warn("linkify option is removed. Use linkify plugin instead:\n\nimport Remarkable from 'remarkable';\nimport linkify from 'remarkable/linkify';\nnew Remarkable().use(linkify)\n"), this.inline = new ii(), this.block = new Vi(), this.core = new Qn(), this.renderer = new Gi(), this.ruler = new H(), this.options = {}, this.configure(oo[s]), this.set(e || {});
    }
    he.prototype.set = function (s) {
      Kn(this.options, s);
    };
    he.prototype.configure = function (s) {
      var e = this;
      if (!s) throw new Error("Wrong `remarkable` preset, check name/content");
      s.options && e.set(s.options), s.components && Object.keys(s.components).forEach(function (t) {
        s.components[t].rules && e[t].ruler.enable(s.components[t].rules, !0);
      });
    };
    he.prototype.use = function (s, e) {
      return s(this, e), this;
    };
    he.prototype.parse = function (s, e) {
      var t = new ts(this, s, e);
      return this.core.process(t), t.tokens;
    };
    he.prototype.render = function (s, e) {
      return e = e || {}, this.renderer.render(this.parse(s, e), this.options, e);
    };
    he.prototype.parseInline = function (s, e) {
      var t = new ts(this, s, e);
      return t.inlineMode = !0, this.core.process(t), t.tokens;
    };
    he.prototype.renderInline = function (s, e) {
      return e = e || {}, this.renderer.render(this.parseInline(s, e), this.options, e);
    };
    var Pi = /*#__PURE__*/function () {
      function Pi() {
        _classCallCheck(this, Pi);
      }
      _createClass(Pi, null, [{
        key: "createNew",
        value: function createNew() {
          var e = window.hljs;
          return e ? new he({
            highlight: function highlight(t, i) {
              if (i && e.getLanguage(i)) try {
                return e.highlight(i, t).value;
              } catch (_unused3) {
                console.error("failed to setup the highlight dependency");
              }
              try {
                return e.highlightAuto(t).value;
              } catch (_unused4) {
                console.error("failed to automatically highlight messages");
              }
              return "";
            },
            html: !1,
            // Enable HTML tags in source
            xhtmlOut: !1,
            // Use '/' to close single tags (<br />)
            breaks: !1,
            // Convert '\n' in paragraphs into <br>
            langPrefix: "language-",
            // CSS language prefix for fenced blocks
            linkTarget: "_blank",
            // set target to open in a new tab
            typographer: !0
            // Enable smartypants and other sweet transforms
          }) : new he({
            highlight: function highlight(t) {
              return t;
            },
            linkTarget: "_blank"
            // set target to open in a new tab
          });
        }
      }]);
      return Pi;
    }();
    var is = /*#__PURE__*/function () {
      function Pt() {
        _classCallCheck(this, Pt);
      }
      _createClass(Pt, null, [{
        key: "addMessage",
        value: function addMessage(e, t, i, n) {
          var r;
          e.elementRef.appendChild(t.outerContainer), e.applyCustomStyles(t, n, !0, (r = e.messageStyles) == null ? void 0 : r[i]), e.elementRef.scrollTop = e.elementRef.scrollHeight;
        }
      }, {
        key: "wrapInLink",
        value: function wrapInLink(e, t) {
          var i = document.createElement("a");
          return i.href = t, i.target = "_blank", i.appendChild(e), i;
        }
      }, {
        key: "processContent",
        value: function processContent(e, t) {
          return !t || t.startsWith("data") ? e : Pt.wrapInLink(e, t);
        }
      }, {
        key: "waitToLoadThenScroll",
        value: function waitToLoadThenScroll(e) {
          setTimeout(function () {
            e.scrollTop = e.scrollHeight;
          }, 60);
        }
      }, {
        key: "scrollDownOnImageLoad",
        value: function scrollDownOnImageLoad(e, t) {
          if (e.startsWith("data")) Pt.waitToLoadThenScroll(t);else try {
            fetch(e, {
              mode: "no-cors"
            })["catch"](function () {})["finally"](function () {
              Pt.waitToLoadThenScroll(t);
            });
          } catch (_unused5) {
            t.scrollTop = t.scrollHeight;
          }
        }
        // The strategy is to emit the actual file reference in the `onNewMessage` event for the user to inspect it
        // But it is not actually used by anything in the chat, hence it is removed when adding a message
        // after the body has been stringified and parsed - the file reference will disappear, hence this readds it
      }, {
        key: "reAddFileRefToObject",
        value: function reAddFileRefToObject(e, t) {
          var i;
          (i = e.files) == null || i.forEach(function (n, r) {
            var o;
            n.ref && (o = t.message.files) != null && o[r] && (t.message.files[r].ref = n.ref);
          });
        }
        // the chat does not use the actual file
      }, {
        key: "removeFileRef",
        value: function removeFileRef(e) {
          var t = _objectSpread({}, e);
          return delete t.ref, t;
        }
      }]);
      return Pt;
    }();
    is.DEFAULT_FILE_NAME = "file";
    var ne = is;
    var jt = /*#__PURE__*/function () {
      function jt() {
        _classCallCheck(this, jt);
      }
      _createClass(jt, null, [{
        key: "onNewMessage",
        value: function onNewMessage(e, t, i) {
          var r;
          var n = JSON.parse(JSON.stringify({
            message: t,
            isInitial: i
          }));
          ne.reAddFileRefToObject(t, n), (r = e.onNewMessage) == null || r.call(e, n), e.dispatchEvent(new CustomEvent("new-message", {
            detail: n
          }));
        }
      }, {
        key: "onClearMessages",
        value: function onClearMessages(e) {
          var t;
          (t = e.onClearMessages) == null || t.call(e), e.dispatchEvent(new CustomEvent("clear-messages"));
        }
      }, {
        key: "onRender",
        value: function onRender(e) {
          var t;
          (t = e.onComponentRender) == null || t.call(e), e.dispatchEvent(new CustomEvent("render"));
        }
      }, {
        key: "onError",
        value: function onError(e, t) {
          var i;
          (i = e.onError) == null || i.call(e, t), e.dispatchEvent(new CustomEvent("error", {
            detail: t
          }));
        }
      }]);
      return jt;
    }();
    var D = /*#__PURE__*/function () {
      function D() {
        _classCallCheck(this, D);
      }
      _createClass(D, null, [{
        key: "applyCustomStylesToElements",
        value: function applyCustomStylesToElements(e, t, i) {
          if (i && (Object.assign(e.outerContainer.style, i.outerContainer), Object.assign(e.innerContainer.style, i.innerContainer), Object.assign(e.bubbleElement.style, i.bubble), t)) {
            var n = e.bubbleElement.children[0],
              r = n.tagName.toLocaleLowerCase() !== "a" ? n : n.children[0];
            Object.assign(r.style, i.media);
          }
        }
      }, {
        key: "applySideStyles",
        value: function applySideStyles(e, t, i, n) {
          n && (D.applyCustomStylesToElements(e, i, n.shared), t === v.USER_ROLE ? D.applyCustomStylesToElements(e, i, n.user) : (D.applyCustomStylesToElements(e, i, n.ai), D.applyCustomStylesToElements(e, i, n[t])));
        }
      }, {
        key: "isMessageSideStyles",
        value: function isMessageSideStyles(e) {
          return !!(e.ai || e.shared || e.user);
        }
        // prettier-ignore
      }, {
        key: "applyCustomStyles",
        value: function applyCustomStyles(e, t, i, n, r) {
          var o;
          r && e["default"] !== r ? D.isMessageSideStyles(r) ? (D.applySideStyles(t, i, n, e["default"]), D.applySideStyles(t, i, n, r)) : (D.applyCustomStylesToElements(t, n, (o = e["default"]) == null ? void 0 : o.shared), D.applyCustomStylesToElements(t, n, r)) : D.applySideStyles(t, i, n, e["default"]);
        }
        // prettier-ignore
      }, {
        key: "extractParticularSharedStyles",
        value: function extractParticularSharedStyles(e, t) {
          if (!(t != null && t.shared)) return;
          var i = t.shared,
            n = {
              outerContainer: {},
              innerContainer: {},
              bubble: {},
              media: {}
            };
          return e.forEach(function (r) {
            var o, a, l, c;
            n.outerContainer[r] = ((o = i.outerContainer) == null ? void 0 : o[r]) || "", n.innerContainer[r] = ((a = i.innerContainer) == null ? void 0 : a[r]) || "", n.bubble[r] = ((l = i.bubble) == null ? void 0 : l[r]) || "", n.media[r] = ((c = i.media) == null ? void 0 : c[r]) || "";
          }), n;
        }
      }]);
      return D;
    }();
    var ao = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iaXNvLTg4NTktMSI/Pgo8c3ZnIGZpbGw9IiMwMDAwMDAiIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIAoJCXZpZXdCb3g9IjAgMCAzMiAzMiIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+Cgk8cGF0aCBkPSJNMjMsMzAuMzZIOWMtMi40MDQsMC00LjM2LTEuOTU2LTQuMzYtNC4zNlYxNWMwLTIuNDA0LDEuOTU2LTQuMzYsNC4zNi00LjM2aDMuNjU5CgkJYzAuMTY3LTEuNTY2LDEuNDE1LTIuODEzLDIuOTgxLTIuOTgxVjUuMzMzYy0xLjEzMS0wLjE3NC0yLTEuMTU0LTItMi4zMzNjMC0xLjMwMSwxLjA1OS0yLjM2LDIuMzYtMi4zNgoJCWMxLjMwMiwwLDIuMzYsMS4wNTksMi4zNiwyLjM2YzAsMS4xNzktMC44NjksMi4xNTktMiwyLjMzM1Y3LjY2YzEuNTY2LDAuMTY3LDIuODE0LDEuNDE1LDIuOTgxLDIuOTgxSDIzCgkJYzIuNDA0LDAsNC4zNiwxLjk1Niw0LjM2LDQuMzZ2MTFDMjcuMzYsMjguNDA0LDI1LjQwNCwzMC4zNiwyMywzMC4zNnogTTksMTEuMzZjLTIuMDA3LDAtMy42NCwxLjYzMy0zLjY0LDMuNjR2MTEKCQljMCwyLjAwNywxLjYzMywzLjY0LDMuNjQsMy42NGgxNGMyLjAwNywwLDMuNjQtMS42MzMsMy42NC0zLjY0VjE1YzAtMi4wMDctMS42MzMtMy42NC0zLjY0LTMuNjRIOXogTTEzLjM4NCwxMC42NGg1LjIzMQoJCUMxOC40MzksOS4zNTQsMTcuMzM0LDguMzYsMTYsOC4zNkMxNC42NjcsOC4zNiwxMy41NjEsOS4zNTQsMTMuMzg0LDEwLjY0eiBNMTYsMS4zNmMtMC45MDQsMC0xLjY0LDAuNzM2LTEuNjQsMS42NAoJCVMxNS4wOTYsNC42NCwxNiw0LjY0YzAuOTA0LDAsMS42NC0wLjczNiwxLjY0LTEuNjRTMTYuOTA0LDEuMzYsMTYsMS4zNnogTTIwLDI3LjM2aC04Yy0xLjMwMSwwLTIuMzYtMS4wNTktMi4zNi0yLjM2CgkJczEuMDU5LTIuMzYsMi4zNi0yLjM2aDhjMS4zMDIsMCwyLjM2LDEuMDU5LDIuMzYsMi4zNlMyMS4zMDIsMjcuMzYsMjAsMjcuMzZ6IE0xMiwyMy4zNmMtMC45MDQsMC0xLjY0LDAuNzM1LTEuNjQsMS42NAoJCXMwLjczNiwxLjY0LDEuNjQsMS42NGg4YzAuOTA0LDAsMS42NC0wLjczNSwxLjY0LTEuNjRzLTAuNzM1LTEuNjQtMS42NC0xLjY0SDEyeiBNMzEsMjMuODZoLTJjLTAuMTk5LDAtMC4zNi0wLjE2MS0wLjM2LTAuMzZWMTUKCQljMC0wLjE5OSwwLjE2MS0wLjM2LDAuMzYtMC4zNmgyYzAuMTk5LDAsMC4zNiwwLjE2MSwwLjM2LDAuMzZ2OC41QzMxLjM2LDIzLjY5OSwzMS4xOTksMjMuODYsMzEsMjMuODZ6IE0yOS4zNiwyMy4xNGgxLjI3OXYtNy43OAoJCUgyOS4zNlYyMy4xNHogTTMsMjMuODZIMWMtMC4xOTksMC0wLjM2LTAuMTYxLTAuMzYtMC4zNlYxNWMwLTAuMTk5LDAuMTYxLTAuMzYsMC4zNi0wLjM2aDJjMC4xOTksMCwwLjM2LDAuMTYxLDAuMzYsMC4zNnY4LjUKCQlDMy4zNiwyMy42OTksMy4xOTksMjMuODYsMywyMy44NnogTTEuMzYsMjMuMTRoMS4yOHYtNy43OEgxLjM2VjIzLjE0eiBNMjAsMjAuMzZjLTEuMzAyLDAtMi4zNi0xLjA1OS0yLjM2LTIuMzYKCQlzMS4wNTktMi4zNiwyLjM2LTIuMzZzMi4zNiwxLjA1OSwyLjM2LDIuMzZDMjIuMzYsMTkuMzAyLDIxLjMwMiwyMC4zNiwyMCwyMC4zNnogTTIwLDE2LjM2Yy0wLjkwNCwwLTEuNjQsMC43MzYtMS42NCwxLjY0CgkJczAuNzM1LDEuNjQsMS42NCwxLjY0czEuNjQtMC43MzUsMS42NC0xLjY0UzIwLjkwNCwxNi4zNiwyMCwxNi4zNnogTTEyLDIwLjM2Yy0xLjMwMSwwLTIuMzYtMS4wNTktMi4zNi0yLjM2czEuMDU5LTIuMzYsMi4zNi0yLjM2CgkJczIuMzYsMS4wNTksMi4zNiwyLjM2QzE0LjM2LDE5LjMwMiwxMy4zMDEsMjAuMzYsMTIsMjAuMzZ6IE0xMiwxNi4zNmMtMC45MDQsMC0xLjY0LDAuNzM2LTEuNjQsMS42NHMwLjczNiwxLjY0LDEuNjQsMS42NAoJCXMxLjY0LTAuNzM1LDEuNjQtMS42NFMxMi45MDQsMTYuMzYsMTIsMTYuMzZ6Ii8+Cgk8cmVjdCBzdHlsZT0iZmlsbDpub25lOyIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIi8+Cjwvc3ZnPg==",
      lo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPoAAAD6CAMAAAC/MqoPAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAADNQTFRF////9vX18vLy/Pz86enp4+Li2tnZ1tbWzczM+fn57Ozs4N/f09LS0M/P5uXl7+/v3dzcwtncCAAAAAFiS0dEAIgFHUgAAAAJcEhZcwAAAEgAAABIAEbJaz4AAAZNSURBVHja7d3bdtsqEABQYABZSLH9/3+ZpnUsIcF5iOM6PfElNoMHMfPQdq3GmL0GkLhEUqLaUExnOtOZznSmM53pTGc605nOdKYznelMZzrTmV4LXSqllKyJDkob26xWq8Zae/iH0QoWTm9d1xur4WuypQJtTd+5dqn0VjcxzNO5/57mEBvdLo8Oron6aseWOjYOFkVvjQs3DmgyONMuht52EfztP+4hdu0i6LCO808/M8c1lE/fuPGej41uUzgdtoO/75N+2ELJ9I3b3//hPXbiMenm3pR/Jt4USgcLBIp4Bh10gqKVhvLo0klCxeSky96nKcj3siw6pJIL4XsoiQ7apyvMY/V3HHrSRioLopvEhSpTCn2TPEuwKYMOIX0tAxRBf/Hpa+lfSqBv9gi1FPsNfTrMAiVmIE/vJhz61FGnQxRIEYE4vfNYdN8Rp6MlHaHotHTn8ejekaZPAjEmyvQWdZFTtYTpXqCGJ0zvcek9Yfoel76nS0ffv1NMp1ca+pkgyfRCGind4L7OWWc605l+cxjsyhqy9AGbPpClc1/nvl5VX0c/3Alk6RU3+Am7shNZ+h6bvidLr7jBB+zKBrL0irOOudmIUDzTmf5gIP+iEuXtRuTVaEmY/oZLfyNMrzjryPc0gerMTdpVg0tvjJUU6bLPcGOoUv46SLL6Wi8yhLf06C7TUyekI0efRaaYqdFltkeNpPumRPSMDxgBYvSM035FrKAmH72hRW99PrpvSdEHkTEGUvSsK3yKVDkuJ92RohcZaehzzirPpOg+J92Tolfc4Cumx5xVXpGiZ34+ICX6W84qv5GiR5NPbiIpOv6BCoSvSkTX+eiaGP092zINvBOj4x8mSf9FqejvNo/cvpOji19ZbmviL0GPLsYMFzgzCor0+Bv/ePDvSJKOb9dJ5UlnbnEHiHgzv6cdTpJOWuc/u3FEucLDOL75xGtBiefrcwgoC9NDSH/jkH6pAuXmBqPQ9HSUPVdZBH1GGOrMXAQdYxcKZfxAoK+KKBKFLosoEoX+u4giUehz8jlcnAuhp78I46yDYNAd+QLR6K+pr+yvxdBTHyVDubQh0UfSxaHSd0lbvNkVRE87JGOtc+PQd2QLQ6fHhJkKsSh6yg13tO08JPprsgrrXWH0dJd2vH1MLPprot4eXoujpzrdhngiD40ek2y92lggPcnWa8qN1Yz0BFuvZhRl0uOfR0v4Ewuli/Bg4Qr3lArqGdndQ3UPO1EunXYwnelMZzrTmc50pjOd6UxnOtOZznSmM53pTGf6kuj6oedFKV0s3fX6sX1S3bsi6a4PD7+/YAqYeBw6pIB/4qEgOqxdSPbGiim4NRRCbzs3Jj0L4UfXtQXQVRfn5IdA/Bw7RZzurEV6EtdsLeGXkIPuA+K1UoVeA0l62zmN/LqfSSft9KkepmoRuvi3nd5uKNFB9zbbXEANqdr941XO0NJx2v2jdJenpf+/3bvn0ts16ph+sd6hX7dPo2+2cZzE02Ia43bzDHqr+2Evnhz74ZHU30ffbKOeng1/NPV30Ns1gYQnSP2P6e65Pfxc6h02XZqXQCjhJ6kPL6bFo4NrGvAU4UII4SE2P1vQuZkuOxckVfehisF1MjUddN/MZBN+kvq5uf0O/xa66gyNS9ktMWlz44rO1Z8C19i5FPdHzPamXn+F3hryPfxMr78+4F+kq22kO6Rf6fUQt+puuustyWv4rbG3l/duztFB96GYoe1cTBdXMr+nw9qVM6ZfxOvzezff0nXi/ZOndvrR6Zvpm0c3h6nhdb+5iS7tsIim/qXZD9+97/Jf+rpZ5BET1ayv0GUzLhEuhBBjIy/RdVPgndutIRt9nt7p5cKFEEJ3Z+jQFDZL+XnMDXxHB73gxn5s9Kc3d3/pFciFkN/QTSXHJpX5l66gDrkQoP6hL3xsPw39la4qOiV8tH78XeSbue6N9mvWa6J/ybpc1CT1Wnh5Qq9meP8IOKH3ddH7E/ri1iYux/SXDrXR4UiPdck/wUpU+FtPf6/orja6O9KL3l56LOvVxe5Ib2qjN0d6Vbex4ghWlU3bPqI90If66MNng680FNpbJijH6kCvaF3uMzQ3+IrpFerV4Y9dffQdN3im10ivbuImhD3Qq5u4HdZkua8znelMZ/pS4z9CPVKkxowNxgAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAxNy0wMy0yN1QxNTo0NToxNSswMDowMN1xSg4AAAAldEVYdGRhdGU6bW9kaWZ5ADIwMTctMDMtMjdUMTU6NDU6MTUrMDA6MDCsLPKyAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAABJRU5ErkJggg==";
    var ce = /*#__PURE__*/function () {
      function ce() {
        _classCallCheck(this, ce);
      }
      _createClass(ce, null, [{
        key: "applyCustomStylesToElements",
        value: function applyCustomStylesToElements(e, t, i) {
          Object.assign(e.style, i.container), Object.assign(t.style, i.avatar);
        }
      }, {
        key: "applyCustomStyles",
        value: function applyCustomStyles(e, t, i, n) {
          var r, o, a, l;
          if ((r = i["default"]) != null && r.styles && ce.applyCustomStylesToElements(e, t, i["default"].styles), n === v.USER_ROLE) (o = i.user) != null && o.styles && ce.applyCustomStylesToElements(e, t, i.user.styles);else {
            (a = i.ai) != null && a.styles && ce.applyCustomStylesToElements(e, t, i.ai.styles);
            var c = (l = i[n]) == null ? void 0 : l.styles;
            c && ce.applyCustomStylesToElements(e, t, c);
          }
        }
      }, {
        key: "createAvatar",
        value: function createAvatar(e, t) {
          var r, o, a, l, c;
          var i = document.createElement("img");
          e === v.USER_ROLE ? i.src = ((r = t == null ? void 0 : t.user) == null ? void 0 : r.src) || ((o = t == null ? void 0 : t["default"]) == null ? void 0 : o.src) || lo : i.src = ((a = t == null ? void 0 : t[e]) == null ? void 0 : a.src) || ((l = t == null ? void 0 : t.ai) == null ? void 0 : l.src) || ((c = t == null ? void 0 : t["default"]) == null ? void 0 : c.src) || ao, i.classList.add("avatar");
          var n = document.createElement("div");
          return n.classList.add("avatar-container"), n.appendChild(i), t && ce.applyCustomStyles(n, i, t, e), n;
        }
      }, {
        key: "getPosition",
        value: function getPosition(e, t) {
          var _i2, _i3, _i4;
          var n, r, o, a, l, c;
          var i = (r = (n = t == null ? void 0 : t[e]) == null ? void 0 : n.styles) == null ? void 0 : r.position;
          return e !== v.USER_ROLE && ((_i2 = i) !== null && _i2 !== void 0 ? _i2 : i = (a = (o = t == null ? void 0 : t.ai) == null ? void 0 : o.styles) == null ? void 0 : a.position), (_i3 = i) !== null && _i3 !== void 0 ? _i3 : i = (c = (l = t == null ? void 0 : t["default"]) == null ? void 0 : l.styles) == null ? void 0 : c.position, (_i4 = i) !== null && _i4 !== void 0 ? _i4 : i = e === v.USER_ROLE ? "right" : "left", i;
        }
      }, {
        key: "add",
        value: function add(e, t, i) {
          var n = typeof i == "boolean" ? void 0 : i,
            r = ce.createAvatar(t, n),
            o = ce.getPosition(t, n);
          r.classList.add(o === "left" ? "left-item-position" : "right-item-position"), e.insertAdjacentElement(o === "left" ? "beforebegin" : "afterend", r);
        }
      }]);
      return ce;
    }();
    var Ve = /*#__PURE__*/function () {
      function Ve() {
        _classCallCheck(this, Ve);
      }
      _createClass(Ve, null, [{
        key: "getPosition",
        value: function getPosition(e, t) {
          var _i5, _i6, _i7;
          var n, r, o;
          var i = (n = t == null ? void 0 : t[e]) == null ? void 0 : n.position;
          return e !== v.USER_ROLE && ((_i5 = i) !== null && _i5 !== void 0 ? _i5 : i = (r = t == null ? void 0 : t.ai) == null ? void 0 : r.position), (_i6 = i) !== null && _i6 !== void 0 ? _i6 : i = (o = t == null ? void 0 : t["default"]) == null ? void 0 : o.position, (_i7 = i) !== null && _i7 !== void 0 ? _i7 : i = e === v.USER_ROLE ? "right" : "left", i;
        }
      }, {
        key: "applyStyle",
        value: function applyStyle(e, t, i) {
          var n, r, o, a;
          Object.assign(e.style, (n = i["default"]) == null ? void 0 : n.style), t === v.USER_ROLE ? Object.assign(e.style, (r = i.user) == null ? void 0 : r.style) : (Object.assign(e.style, (o = i.ai) == null ? void 0 : o.style), Object.assign(e.style, (a = i[t]) == null ? void 0 : a.style));
        }
      }, {
        key: "getNameText",
        value: function getNameText(e, t) {
          var i, n, r, o, a, l;
          return e === v.USER_ROLE ? ((i = t.user) == null ? void 0 : i.text) || ((n = t["default"]) == null ? void 0 : n.text) || "User" : e === v.AI_ROLE ? ((r = t.ai) == null ? void 0 : r.text) || ((o = t["default"]) == null ? void 0 : o.text) || "AI" : ((a = t[e]) == null ? void 0 : a.text) || ((l = t["default"]) == null ? void 0 : l.text) || e;
        }
      }, {
        key: "createName",
        value: function createName(e, t) {
          var i = document.createElement("div");
          return i.classList.add("name"), i.textContent = Ve.getNameText(e, t), Ve.applyStyle(i, e, t), i;
        }
      }, {
        key: "add",
        value: function add(e, t, i) {
          var n = typeof i == "boolean" ? {} : i,
            r = Ve.createName(t, n),
            o = Ve.getPosition(t, n);
          r.classList.add(o === "left" ? "left-item-position" : "right-item-position"), e.insertAdjacentElement(o === "left" ? "beforebegin" : "afterend", r);
        }
      }]);
      return Ve;
    }();
    var Ke = /*#__PURE__*/function () {
      function Ke(e) {
        var _this3 = this;
        _classCallCheck(this, Ke);
        this.messageElementRefs = [], this.messages = [], this.htmlClassUtilities = {}, this.textElementsToText = [], this.elementRef = Ke.createContainerElement(), this.messageStyles = e.messageStyles, this._remarkable = Pi.createNew(), this._avatars = e.avatars, this._names = e.names, this._onNewMessage = jt.onNewMessage.bind(this, e), e.htmlClassUtilities && (this.htmlClassUtilities = e.htmlClassUtilities), setTimeout(function () {
          _this3.submitUserMessage = e.submitUserMessage;
        });
      }
      _createClass(Ke, [{
        key: "addNewTextMessage",
        value: function addNewTextMessage(e, t, i) {
          if (i != null && i.status) {
            var r = this.overwriteText(t, e, this.messageElementRefs);
            if (r) return r;
            i.status = !1;
          }
          var n = this.createAndAppendNewMessageElement(e, t);
          return n.bubbleElement.classList.add("text-message"), this.applyCustomStyles(n, t, !1), v.fillEmptyMessageElement(n.bubbleElement, e), this.textElementsToText.push([n, e]), n;
        }
      }, {
        key: "overwriteText",
        value: function overwriteText(e, t, i) {
          var n = v.overwriteMessage(this.messages, i, t, e, "text", "text-message");
          if (n) {
            this.renderText(n.bubbleElement, t);
            var r = v.getLastTextToElement(this.textElementsToText, n);
            r && (r[1] = t);
          }
          return n;
        }
      }, {
        key: "createAndAppendNewMessageElement",
        value: function createAndAppendNewMessageElement(e, t) {
          var _this4 = this;
          var i = this.createNewMessageElement(e, t);
          return this.elementRef.appendChild(i.outerContainer), setTimeout(function () {
            return Y.scrollToBottom(_this4.elementRef);
          }), i;
        }
      }, {
        key: "createNewMessageElement",
        value: function createNewMessageElement(e, t) {
          var n;
          (n = this._introPanel) == null || n.hide();
          var i = this.messageElementRefs[this.messageElementRefs.length - 1];
          return Ke.isTemporaryElement(i) && (i.outerContainer.remove(), this.messageElementRefs.pop()), this.createMessageElements(e, t);
        }
      }, {
        key: "createMessageElements",
        value: function createMessageElements(e, t) {
          var i = Ke.createBaseElements(),
            n = i.outerContainer,
            r = i.innerContainer,
            o = i.bubbleElement;
          return n.appendChild(r), this.addInnerContainerElements(o, e, t), this.messageElementRefs.push(i), i;
        }
      }, {
        key: "addInnerContainerElements",
        value:
        // prettier-ignore
        function addInnerContainerElements(e, t, i) {
          return e.classList.add("message-bubble", v.getRoleClass(i), i === v.USER_ROLE ? "user-message-text" : "ai-message-text"), this.renderText(e, t), this._avatars && ce.add(e, i, this._avatars), this._names && Ve.add(e, i, this._names), {
            bubbleElement: e
          };
        }
        // prettier-ignore
      }, {
        key: "applyCustomStyles",
        value: function applyCustomStyles(e, t, i, n) {
          e && this.messageStyles && D.applyCustomStyles(this.messageStyles, e, t, i, n);
        }
      }, {
        key: "removeLastMessage",
        value: function removeLastMessage() {
          this.messageElementRefs[this.messageElementRefs.length - 1].outerContainer.remove(), this.messageElementRefs.pop();
        }
      }, {
        key: "sendClientUpdate",
        value: function sendClientUpdate(e) {
          var t = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : !1;
          var i;
          (i = this._onNewMessage) == null || i.call(this, e, t);
        }
      }, {
        key: "renderText",
        value: function renderText(e, t) {
          e.innerHTML = this._remarkable.render(t), e.innerText.trim().length === 0 && (e.innerText = t);
        }
        // this is mostly used for enabling highlight.js to highlight code if it downloads later
      }, {
        key: "refreshTextMessages",
        value: function refreshTextMessages() {
          var _this5 = this;
          this._remarkable = Pi.createNew(), this.textElementsToText.forEach(function (e) {
            _this5.renderText(e[0].bubbleElement, e[1]);
          });
        }
      }], [{
        key: "createContainerElement",
        value: function createContainerElement() {
          var e = document.createElement("div");
          return e.id = "messages", e;
        }
      }, {
        key: "isTemporaryElement",
        value: function isTemporaryElement(e) {
          return (e == null ? void 0 : e.bubbleElement.classList.contains("loading-message-text")) || be.isElementTemporary(e);
        }
      }, {
        key: "createBaseElements",
        value: function createBaseElements() {
          var e = document.createElement("div"),
            t = document.createElement("div");
          t.classList.add("inner-message-container"), e.appendChild(t), e.classList.add("outer-message-container");
          var i = document.createElement("div");
          return i.classList.add("message-bubble"), t.appendChild(i), {
            outerContainer: e,
            innerContainer: t,
            bubbleElement: i
          };
        }
      }, {
        key: "createMessageContent",
        value: function createMessageContent(e) {
          var t = e.text,
            i = e.files,
            n = e.html,
            r = e._sessionId,
            o = e.role,
            a = {
              role: o || v.AI_ROLE
            };
          return t && (a.text = t), i && (a.files = i), n && (a.html = n), !t && !i && !n && (a.text = ""), r && (a._sessionId = r), a;
        }
      }]);
      return Ke;
    }();
    var Ki = /*#__PURE__*/function () {
      // used for extracting at end and for isStreaming
      function st(e) {
        _classCallCheck(this, st);
        this._streamedContent = "", this._streamType = "", this._hasStreamEnded = !1, this._messages = e;
      }
      _createClass(st, [{
        key: "upsertStreamedMessage",
        value: function upsertStreamedMessage(e) {
          var r;
          if (this._hasStreamEnded) return;
          if ((e == null ? void 0 : e.text) === void 0 && (e == null ? void 0 : e.html) === void 0) return console.error(C.INVALID_STREAM_EVENT);
          var t = (e == null ? void 0 : e.text) || (e == null ? void 0 : e.html) || "",
            i = Y.isScrollbarAtBottomOfElement(this._messages.elementRef),
            n = (e == null ? void 0 : e.text) !== void 0 ? "text" : "html";
          if (!this._elements && this._streamedContent === "") this.setInitialState(n, t, e == null ? void 0 : e.role);else {
            if (this._streamType !== n) return console.error(C.INVALID_STREAM_EVENT_MIX);
            this.updateBasedOnType(t, n, (r = this._elements) == null ? void 0 : r.bubbleElement, e == null ? void 0 : e.overwrite);
          }
          i && Y.scrollToBottom(this._messages.elementRef);
        }
      }, {
        key: "setInitialState",
        value: function setInitialState(e, t, i) {
          var _i8;
          this._streamType = e, (_i8 = i) !== null && _i8 !== void 0 ? _i8 : i = v.AI_ROLE, this._elements = e === "text" ? this._messages.addNewTextMessage(t, i) : Ye.add(this._messages, t, i, this._messages.messageElementRefs), this._elements.bubbleElement.classList.add(st.MESSAGE_CLASS), this._streamedContent = t, this._activeMessageRole = i;
        }
      }, {
        key: "updateBasedOnType",
        value: function updateBasedOnType(e, t, i) {
          var n = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : !1;
          v.unfillEmptyMessageElement(i, e), (t === "text" ? this.updateText : this.updateHTML).bind(this)(e, i, n);
        }
      }, {
        key: "updateText",
        value: function updateText(e, t, i) {
          this._streamedContent = i ? e : this._streamedContent + e, this._messages.textElementsToText[this._messages.textElementsToText.length - 1][1] = this._streamedContent, this._messages.renderText(t, this._streamedContent);
        }
      }, {
        key: "updateHTML",
        value: function updateHTML(e, t, i) {
          if (i) this._streamedContent = e, t.innerHTML = e;else {
            var n = document.createElement("span");
            n.innerHTML = e, t.appendChild(n), this._streamedContent = st.HTML_CONTENT_PLACEHOLDER;
          }
        }
      }, {
        key: "finaliseStreamedMessage",
        value: function finaliseStreamedMessage() {
          var r, o;
          var _this$_messages = this._messages,
            e = _this$_messages.textElementsToText,
            t = _this$_messages.elementRef,
            i = (r = v.getLastMessageBubbleElement(t)) == null ? void 0 : r.classList;
          if (i != null && i.contains("loading-message-text")) throw Error(C.NO_VALID_STREAM_EVENTS_SENT);
          if (!(i != null && i.contains(st.MESSAGE_CLASS))) return;
          var n = {
            role: this._activeMessageRole || v.AI_ROLE
          };
          this._streamType === "text" ? (e[e.length - 1][1] = this._streamedContent, n.text = this._streamedContent, this._messages.textToSpeech && Nt.speak(this._streamedContent, this._messages.textToSpeech)) : this._streamType === "html" && (this._streamedContent === st.HTML_CONTENT_PLACEHOLDER && (this._streamedContent = ((o = v.getLastMessageBubbleElement(t)) == null ? void 0 : o.innerHTML) || ""), this._elements && se.apply(this._messages, this._elements.outerContainer), n.html = this._streamedContent), n && (this._messages.messages.push(n), this._messages.sendClientUpdate(Ke.createMessageContent(n), !1)), this._hasStreamEnded = !0;
        }
      }]);
      return st;
    }();
    Ki.MESSAGE_CLASS = "streamed-message";
    Ki.HTML_CONTENT_PLACEHOLDER = "htmlplaceholder";
    var Ze = Ki;
    var ns = /*#__PURE__*/function () {
      function rt() {
        _classCallCheck(this, rt);
      }
      _createClass(rt, null, [{
        key: "tempRemoveContentHeader",
        value: // need to pass stringifyBody boolean separately as binding is throwing an error for some reason
        // prettier-ignore
        function () {
          var _tempRemoveContentHeader = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee(e, t, i) {
            var n, r;
            return _regeneratorRuntime().wrap(function _callee$(_context) {
              while (1) switch (_context.prev = _context.next) {
                case 0:
                  if (e != null && e.headers) {
                    _context.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  n = e.headers[rt.CONTENT_TYPE];
                  delete e.headers[rt.CONTENT_TYPE];
                  _context.prev = 4;
                  _context.next = 7;
                  return t(i);
                case 7:
                  r = _context.sent;
                  _context.next = 13;
                  break;
                case 10:
                  _context.prev = 10;
                  _context.t0 = _context["catch"](4);
                  throw e.headers[rt.CONTENT_TYPE] = n, _context.t0;
                case 13:
                  return _context.abrupt("return", (e.headers[rt.CONTENT_TYPE] = n, r));
                case 14:
                case "end":
                  return _context.stop();
              }
            }, _callee, null, [[4, 10]]);
          }));
          function tempRemoveContentHeader(_x5, _x6, _x7) {
            return _tempRemoveContentHeader.apply(this, arguments);
          }
          return tempRemoveContentHeader;
        }()
      }, {
        key: "displayError",
        value: function displayError(e, t) {
          var i = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "Service error, please try again.";
          if (console.error(t), _typeof(t) == "object") return Object.keys(t).length === 0 ? e.addNewErrorMessage("service", i) : e.addNewErrorMessage("service", JSON.stringify(t));
          e.addNewErrorMessage("service", t);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, {
        key: "fetch",
        value: function (_fetch) {
          function fetch(_x, _x2, _x3, _x4) {
            return _fetch.apply(this, arguments);
          }
          fetch.toString = function () {
            return _fetch.toString();
          };
          return fetch;
        }(function (e, t, i, n) {
          var o, a;
          var r = {
            method: ((o = e.requestSettings) == null ? void 0 : o.method) || "POST",
            headers: t
          };
          return r.method !== "GET" && (r.body = i ? JSON.stringify(n) : n), e.requestSettings.credentials && (r.credentials = e.requestSettings.credentials), fetch(((a = e.requestSettings) == null ? void 0 : a.url) || e.url || "", r);
        })
      }, {
        key: "processResponseByType",
        value: function processResponseByType(e) {
          var t = e.headers.get("content-type");
          return t != null && t.includes("application/json") ? e.json() : t != null && t.includes("text/plain") || !t ? e : e.blob();
        }
      }, {
        key: "processRequestInterceptor",
        value: function () {
          var _processRequestInterceptor = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee2(e, t) {
            var o, i, n, r;
            return _regeneratorRuntime().wrap(function _callee2$(_context2) {
              while (1) switch (_context2.prev = _context2.next) {
                case 0:
                  _context2.next = 2;
                  return (o = e.requestInterceptor) == null ? void 0 : o.call(e, t);
                case 2:
                  _context2.t0 = _context2.sent;
                  if (_context2.t0) {
                    _context2.next = 5;
                    break;
                  }
                  _context2.t0 = t;
                case 5:
                  i = _context2.t0;
                  n = i;
                  r = i;
                  return _context2.abrupt("return", {
                    body: n.body,
                    headers: n.headers,
                    error: r.error
                  });
                case 9:
                case "end":
                  return _context2.stop();
              }
            }, _callee2);
          }));
          function processRequestInterceptor(_x8, _x9) {
            return _processRequestInterceptor.apply(this, arguments);
          }
          return processRequestInterceptor;
        }()
      }, {
        key: "validateResponseFormat",
        value: function validateResponseFormat(e) {
          return e && _typeof(e) == "object" && (typeof e.error == "string" || typeof e.text == "string" || typeof e.html == "string" || Array.isArray(e.files));
        }
      }, {
        key: "onInterceptorError",
        value: function onInterceptorError(e, t, i) {
          e.addNewErrorMessage("service", t), i == null || i();
        }
      }]);
      return rt;
    }();
    ns.CONTENT_TYPE = "Content-Type";
    var E = ns;
    function co(_x10, _x11) {
      return _co.apply(this, arguments);
    }
    function _co() {
      _co = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee103(s, e) {
        var t, i;
        return _regeneratorRuntime().wrap(function _callee103$(_context103) {
          while (1) switch (_context103.prev = _context103.next) {
            case 0:
              t = s.getReader();
            case 1:
              _context103.next = 3;
              return t.read();
            case 3:
              if ((i = _context103.sent).done) {
                _context103.next = 7;
                break;
              }
              e(i.value);
            case 5:
              _context103.next = 1;
              break;
            case 7:
            case "end":
              return _context103.stop();
          }
        }, _callee103);
      }));
      return _co.apply(this, arguments);
    }
    function uo(s) {
      var e,
        t,
        i,
        n = !1;
      return function (o) {
        e === void 0 ? (e = o, t = 0, i = -1) : e = po(e, o);
        var a = e.length;
        var l = 0;
        for (; t < a;) {
          n && (e[t] === 10 && (l = ++t), n = !1);
          var c = -1;
          for (; t < a && c === -1; ++t) switch (e[t]) {
            case 58:
              i === -1 && (i = t - l);
              break;
            case 13:
              n = !0;
            case 10:
              c = t;
              break;
          }
          if (c === -1) break;
          s(e.subarray(l, c), i), l = t, i = -1;
        }
        l === a ? e = void 0 : l !== 0 && (e = e.subarray(l), t -= l);
      };
    }
    function ho(s, e, t) {
      var i = vn();
      var n = new TextDecoder();
      return function (o, a) {
        if (o.length === 0) t == null || t(i), i = vn();else if (a > 0) {
          var l = n.decode(o.subarray(0, a)),
            c = a + (o[a + 1] === 32 ? 2 : 1),
            d = n.decode(o.subarray(c));
          switch (l) {
            case "data":
              i.data = i.data ? i.data + "\n" + d : d;
              break;
            case "event":
              i.event = d;
              break;
            case "id":
              s(i.id = d);
              break;
            case "retry":
              var u = parseInt(d, 10);
              isNaN(u) || e(i.retry = u);
              break;
          }
        }
      };
    }
    function po(s, e) {
      var t = new Uint8Array(s.length + e.length);
      return t.set(s), t.set(e, s.length), t;
    }
    function vn() {
      return {
        data: "",
        event: "",
        id: "",
        retry: void 0
      };
    }
    var fo = globalThis && globalThis.__rest || function (s, e) {
      var t = {};
      for (var i in s) Object.prototype.hasOwnProperty.call(s, i) && e.indexOf(i) < 0 && (t[i] = s[i]);
      if (s != null && typeof Object.getOwnPropertySymbols == "function") for (var n = 0, i = Object.getOwnPropertySymbols(s); n < i.length; n++) e.indexOf(i[n]) < 0 && Object.prototype.propertyIsEnumerable.call(s, i[n]) && (t[i[n]] = s[i[n]]);
      return t;
    };
    var Di = "text/event-stream",
      mo = 1e3,
      yn = "last-event-id";
    function go(s, e) {
      var t = e.signal,
        i = e.headers,
        n = e.onopen,
        r = e.onmessage,
        o = e.onclose,
        a = e.onerror,
        l = e.openWhenHidden,
        c = e.fetch,
        d = fo(e, ["signal", "headers", "onopen", "onmessage", "onclose", "onerror", "openWhenHidden", "fetch"]);
      return new Promise(function (u, h) {
        var p = Object.assign({}, i);
        p.accept || (p.accept = Di);
        var g;
        function m() {
          g.abort(), document.hidden || X();
        }
        l || document.addEventListener("visibilitychange", m);
        var S = mo,
          w = 0;
        function G() {
          document.removeEventListener("visibilitychange", m), window.clearTimeout(w), g.abort();
        }
        t == null || t.addEventListener("abort", function () {
          G(), u();
        });
        var A = c !== null && c !== void 0 ? c : window.fetch,
          V = n !== null && n !== void 0 ? n : bo;
        function X() {
          return _X.apply(this, arguments);
        }
        function _X() {
          _X = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee3() {
            var oe, Q, N;
            return _regeneratorRuntime().wrap(function _callee3$(_context3) {
              while (1) switch (_context3.prev = _context3.next) {
                case 0:
                  g = new AbortController();
                  _context3.prev = 1;
                  _context3.next = 4;
                  return A(s, Object.assign(Object.assign({}, d), {
                    headers: p,
                    signal: g.signal
                  }));
                case 4:
                  Q = _context3.sent;
                  _context3.next = 7;
                  return V(Q);
                case 7:
                  _context3.next = 9;
                  return co(Q.body, uo(ho(function (N) {
                    N ? p[yn] = N : delete p[yn];
                  }, function (N) {
                    S = N;
                  }, r)));
                case 9:
                  o == null || o();
                  G();
                  u();
                  _context3.next = 17;
                  break;
                case 14:
                  _context3.prev = 14;
                  _context3.t0 = _context3["catch"](1);
                  if (!g.signal.aborted) try {
                    N = (oe = a == null ? void 0 : a(_context3.t0)) !== null && oe !== void 0 ? oe : S;
                    window.clearTimeout(w), w = window.setTimeout(X, N);
                  } catch (N) {
                    G(), h(N);
                  }
                case 17:
                case "end":
                  return _context3.stop();
              }
            }, _callee3, null, [[1, 14]]);
          }));
          return _X.apply(this, arguments);
        }
        X();
      });
    }
    function bo(s) {
      var e = s.headers.get("content-type");
      if (!(e != null && e.startsWith(Di))) throw new Error("Expected content-type to be ".concat(Di, ", Actual: ").concat(e));
    }
    var ss = /*#__PURE__*/function () {
      function ot() {
        _classCallCheck(this, ot);
      }
      _createClass(ot, null, [{
        key: "generateResponse",
        value: function generateResponse(e) {
          var t = e.messages[e.messages.length - 1];
          if (t.files && t.files.length > 0) {
            if (t.files.length > 1) return "These are interesting files!";
            var i = t.files[0];
            return i.src && i.src.startsWith("data:image/gif") ? "That is a nice gif!" : i.type === "image" ? "That is a nice image!" : i.type === "audio" ? "I like the sound of that!" : "That is an interesting file!";
          }
          if (t.text) {
            if (t.text.charAt(t.text.length - 1) === "?") return "I'm sorry but I can't answer that question...";
            if (t.text.includes("updog")) return "What's updog?";
          }
          return "Hi there! This is a demo response!";
        }
      }, {
        key: "getCustomResponse",
        value: function getCustomResponse(e, t) {
          return typeof e == "function" ? e(t) : e;
        }
      }, {
        key: "getResponse",
        value: function getResponse(e) {
          return e.customDemoResponse ? ot.getCustomResponse(e.customDemoResponse, e.messages[e.messages.length - 1]) : {
            text: ot.generateResponse(e)
          };
        }
        // timeout is used to simulate a timeout for a response to come back
      }, {
        key: "request",
        value: function request(e, t) {
          var i = ot.getResponse(t);
          setTimeout( /*#__PURE__*/_asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee4() {
            var r, o, n;
            return _regeneratorRuntime().wrap(function _callee4$(_context4) {
              while (1) switch (_context4.prev = _context4.next) {
                case 0:
                  _context4.next = 2;
                  return (o = (r = e.deepChat).responseInterceptor) == null ? void 0 : o.call(r, i);
                case 2:
                  _context4.t0 = _context4.sent;
                  if (_context4.t0) {
                    _context4.next = 5;
                    break;
                  }
                  _context4.t0 = i;
                case 5:
                  n = _context4.t0;
                  n.error ? (t.addNewErrorMessage("service", n.error), e.completionsHandlers.onFinish()) : I.isSimulation(e.deepChat.stream) ? I.simulate(t, e.streamHandlers, n) : (t.addNewMessage(n), e.completionsHandlers.onFinish());
                case 7:
                case "end":
                  return _context4.stop();
              }
            }, _callee4);
          })), 400);
        }
        // timeout is used to simulate a timeout for a response to come back
      }, {
        key: "requestStream",
        value: function requestStream(e, t) {
          setTimeout(function () {
            var i = ot.getResponse(e);
            I.simulate(e, t, i);
          }, 400);
        }
      }]);
      return ot;
    }();
    ss.URL = "deep-chat-demo";
    var ve = ss;
    var I = /*#__PURE__*/function () {
      function I() {
        _classCallCheck(this, I);
      }
      _createClass(I, null, [{
        key: "request",
        value: // prettier-ignore
        function () {
          var _request = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee7(e, t, i) {
            var n,
              p,
              g,
              m,
              S,
              w,
              G,
              r,
              _yield$E$processReque,
              o,
              a,
              l,
              _e$streamHandlers,
              c,
              d,
              u,
              h,
              _args7 = arguments;
            return _regeneratorRuntime().wrap(function _callee7$(_context7) {
              while (1) switch (_context7.prev = _context7.next) {
                case 0:
                  n = _args7.length > 3 && _args7[3] !== undefined ? _args7[3] : !0;
                  r = {
                    body: t,
                    headers: (p = e.requestSettings) == null ? void 0 : p.headers
                  };
                  _context7.next = 4;
                  return E.processRequestInterceptor(e.deepChat, r);
                case 4:
                  _yield$E$processReque = _context7.sent;
                  o = _yield$E$processReque.body;
                  a = _yield$E$processReque.headers;
                  l = _yield$E$processReque.error;
                  _e$streamHandlers = e.streamHandlers;
                  c = _e$streamHandlers.onOpen;
                  d = _e$streamHandlers.onClose;
                  u = _e$streamHandlers.abortStream;
                  if (!l) {
                    _context7.next = 14;
                    break;
                  }
                  return _context7.abrupt("return", E.onInterceptorError(i, l, d));
                case 14:
                  if (!((g = e.requestSettings) != null && g.handler)) {
                    _context7.next = 16;
                    break;
                  }
                  return _context7.abrupt("return", Ae.stream(e, o, i));
                case 16:
                  if (!(((m = e.requestSettings) == null ? void 0 : m.url) === ve.URL)) {
                    _context7.next = 18;
                    break;
                  }
                  return _context7.abrupt("return", ve.requestStream(i, e.streamHandlers));
                case 18:
                  h = new Ze(i);
                  go(((S = e.requestSettings) == null ? void 0 : S.url) || e.url || "", {
                    method: ((w = e.requestSettings) == null ? void 0 : w.method) || "POST",
                    headers: a,
                    credentials: (G = e.requestSettings) == null ? void 0 : G.credentials,
                    body: n ? JSON.stringify(o) : o,
                    openWhenHidden: !0,
                    // keep stream open when browser tab not open
                    onopen: function onopen(A) {
                      return _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee5() {
                        return _regeneratorRuntime().wrap(function _callee5$(_context5) {
                          while (1) switch (_context5.prev = _context5.next) {
                            case 0:
                              if (!A.ok) {
                                _context5.next = 2;
                                break;
                              }
                              return _context5.abrupt("return", c());
                            case 2:
                              _context5.next = 4;
                              return E.processResponseByType(A);
                            case 4:
                              throw _context5.sent;
                            case 5:
                            case "end":
                              return _context5.stop();
                          }
                        }, _callee5);
                      }))();
                    },
                    onmessage: function onmessage(A) {
                      return _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee6() {
                        var V, X, oe, Q, N;
                        return _regeneratorRuntime().wrap(function _callee6$(_context6) {
                          while (1) switch (_context6.prev = _context6.next) {
                            case 0:
                              if (!(JSON.stringify(A.data) !== JSON.stringify("[DONE]"))) {
                                _context6.next = 9;
                                break;
                              }
                              Q = JSON.parse(A.data);
                              _context6.next = 4;
                              return (X = (V = e.deepChat).responseInterceptor) == null ? void 0 : X.call(V, Q);
                            case 4:
                              _context6.t0 = _context6.sent;
                              if (_context6.t0) {
                                _context6.next = 7;
                                break;
                              }
                              _context6.t0 = Q;
                            case 7:
                              N = _context6.t0;
                              (oe = e.extractResultData) == null || oe.call(e, N).then(function (Be) {
                                h.upsertStreamedMessage(Be);
                              })["catch"](function (Be) {
                                return E.displayError(i, Be);
                              });
                            case 9:
                            case "end":
                              return _context6.stop();
                          }
                        }, _callee6);
                      }))();
                    },
                    onerror: function onerror(A) {
                      throw d(), A;
                    },
                    onclose: function onclose() {
                      h.finaliseStreamedMessage(), d();
                    },
                    signal: u.signal
                  })["catch"](function (A) {
                    var V;
                    (V = e.extractResultData) == null || V.call(e, A).then(function () {
                      E.displayError(i, A);
                    })["catch"](function (X) {
                      E.displayError(i, X);
                    });
                  });
                case 20:
                case "end":
                  return _context7.stop();
              }
            }, _callee7);
          }));
          function request(_x12, _x13, _x14) {
            return _request.apply(this, arguments);
          }
          return request;
        }()
      }, {
        key: "simulate",
        value: function simulate(e, t, i) {
          var n = t;
          if ((i.files || i.html) && e.addNewMessage(_objectSpread({
            sendUpdate: !1,
            ignoreText: !0
          }, i), !1), i.text) {
            t.onOpen();
            var r = i.text.split("");
            I.populateMessages(r, new Ze(e), n);
          }
        }
      }, {
        key: "populateMessages",
        value: function populateMessages(e, t, i) {
          var n = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
          var r = e[n];
          if (r) {
            t.upsertStreamedMessage({
              text: r
            });
            var o = setTimeout(function () {
              I.populateMessages(e, t, i, n + 1);
            }, i.simulationInterim || 6);
            i.abortStream.abort = function () {
              I.abort(o, t, i.onClose);
            };
          } else t.finaliseStreamedMessage(), i.onClose();
        }
      }, {
        key: "isSimulation",
        value: function isSimulation(e) {
          return _typeof(e) == "object" && !!e.simulation;
        }
      }, {
        key: "abort",
        value: function abort(e, t, i) {
          clearTimeout(e), t.finaliseStreamedMessage(), i();
        }
      }]);
      return I;
    }();
    var Ae = /*#__PURE__*/function () {
      function Ae() {
        _classCallCheck(this, Ae);
      }
      _createClass(Ae, null, [{
        key: "request",
        value: function () {
          var _request2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee9(e, t, i) {
            var a, l, n, r, o;
            return _regeneratorRuntime().wrap(function _callee9$(_context9) {
              while (1) switch (_context9.prev = _context9.next) {
                case 0:
                  n = !0;
                  r = /*#__PURE__*/function () {
                    var _ref2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee8(c) {
                      var u, h, d;
                      return _regeneratorRuntime().wrap(function _callee8$(_context8) {
                        while (1) switch (_context8.prev = _context8.next) {
                          case 0:
                            if (n) {
                              _context8.next = 2;
                              break;
                            }
                            return _context8.abrupt("return");
                          case 2:
                            n = !1;
                            _context8.next = 5;
                            return (h = (u = e.deepChat).responseInterceptor) == null ? void 0 : h.call(u, c);
                          case 5:
                            _context8.t0 = _context8.sent;
                            if (_context8.t0) {
                              _context8.next = 8;
                              break;
                            }
                            _context8.t0 = c;
                          case 8:
                            d = _context8.t0;
                            E.validateResponseFormat(d) ? typeof d.error == "string" ? (console.error(d.error), i.addNewErrorMessage("service", d.error), e.completionsHandlers.onFinish()) : I.isSimulation(e.deepChat.stream) ? I.simulate(i, e.streamHandlers, d) : (i.addNewMessage(d), e.completionsHandlers.onFinish()) : (console.error(C.INVALID_RESPONSE(c, "server", !!e.deepChat.responseInterceptor, d)), i.addNewErrorMessage("service", "Error in server message"), e.completionsHandlers.onFinish());
                          case 10:
                          case "end":
                            return _context8.stop();
                        }
                      }, _callee8);
                    }));
                    return function r(_x18) {
                      return _ref2.apply(this, arguments);
                    };
                  }(), o = Ae.generateOptionalSignals();
                  (l = (a = e.requestSettings).handler) == null || l.call(a, t, _objectSpread(_objectSpread({}, o), {}, {
                    onResponse: r
                  }));
                case 3:
                case "end":
                  return _context9.stop();
              }
            }, _callee9);
          }));
          function request(_x15, _x16, _x17) {
            return _request2.apply(this, arguments);
          }
          return request;
        }() // prettier-ignore
      }, {
        key: "stream",
        value: function stream(e, t, i) {
          var u, h;
          var n = !0,
            r = !1;
          var o = new Ze(i),
            a = function a() {
              r || !n || (e.streamHandlers.onOpen(), r = !0);
            },
            l = function l() {
              n && (o.finaliseStreamedMessage(), e.streamHandlers.onClose(), n = !1);
            },
            c = function c(p) {
              n && (!p || _typeof(p) != "object" || typeof p.error != "string" && typeof p.html != "string" && typeof p.text != "string" ? console.error(C.INVALID_RESPONSE(p, "server", !1)) : p.error ? (console.error(p.error), o.finaliseStreamedMessage(), e.streamHandlers.onClose(), i.addNewErrorMessage("service", p.error), n = !1) : o.upsertStreamedMessage(p));
            };
          e.streamHandlers.abortStream.abort = function () {
            o.finaliseStreamedMessage(), e.streamHandlers.onClose(), n = !1;
          };
          var d = Ae.generateOptionalSignals();
          (h = (u = e.requestSettings).handler) == null || h.call(u, t, _objectSpread(_objectSpread({}, d), {}, {
            onOpen: a,
            onResponse: c,
            onClose: l,
            stopClicked: e.streamHandlers.stopClicked
          }));
        }
        // prettier-ignore
      }, {
        key: "websocket",
        value: function websocket(e, t) {
          var l, c;
          var i = {
            isOpen: !1,
            newUserMessage: {
              listener: function listener() {}
            }
          };
          e.websocket = i;
          var n = function n() {
              t.removeError(), i.isOpen = !0;
            },
            r = function r() {
              i.isOpen = !1;
            },
            o = /*#__PURE__*/function () {
              var _ref3 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee10(d) {
                var h, p, u;
                return _regeneratorRuntime().wrap(function _callee10$(_context10) {
                  while (1) switch (_context10.prev = _context10.next) {
                    case 0:
                      if (i.isOpen) {
                        _context10.next = 2;
                        break;
                      }
                      return _context10.abrupt("return");
                    case 2:
                      _context10.next = 4;
                      return (p = (h = e.deepChat).responseInterceptor) == null ? void 0 : p.call(h, d);
                    case 4:
                      _context10.t0 = _context10.sent;
                      if (_context10.t0) {
                        _context10.next = 7;
                        break;
                      }
                      _context10.t0 = d;
                    case 7:
                      u = _context10.t0;
                      E.validateResponseFormat(u) ? typeof u.error == "string" ? (console.error(u.error), t.isLastMessageError() || t.addNewErrorMessage("service", u.error)) : e.deepChat.stream ? I.simulate(t, e.streamHandlers, u) : t.addNewMessage(u) : (console.error(C.INVALID_RESPONSE(d, "server", !!e.deepChat.responseInterceptor, u)), t.addNewErrorMessage("service", "Error in server message"));
                    case 9:
                    case "end":
                      return _context10.stop();
                  }
                }, _callee10);
              }));
              return function o(_x19) {
                return _ref3.apply(this, arguments);
              };
            }(),
            a = Ae.generateOptionalSignals();
          (c = (l = e.requestSettings).handler) == null || c.call(l, void 0, _objectSpread(_objectSpread({}, a), {}, {
            onOpen: n,
            onResponse: o,
            onClose: r,
            newUserMessage: i.newUserMessage
          }));
        }
      }, {
        key: "generateOptionalSignals",
        value: function generateOptionalSignals() {
          return {
            onClose: function onClose() {},
            onOpen: function onOpen() {},
            stopClicked: {
              listener: function listener() {}
            },
            newUserMessage: {
              listener: function listener() {}
            }
          };
        }
      }]);
      return Ae;
    }();
    var _ = /*#__PURE__*/function () {
      function _() {
        _classCallCheck(this, _);
      }
      _createClass(_, null, [{
        key: "request",
        value: // prettier-ignore
        function () {
          var _request3 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee12(e, t, i) {
            var n,
              h,
              p,
              g,
              r,
              _yield$E$processReque2,
              o,
              a,
              l,
              c,
              d,
              u,
              _args12 = arguments;
            return _regeneratorRuntime().wrap(function _callee12$(_context12) {
              while (1) switch (_context12.prev = _context12.next) {
                case 0:
                  n = _args12.length > 3 && _args12[3] !== undefined ? _args12[3] : !0;
                  r = {
                    body: t,
                    headers: (h = e.requestSettings) == null ? void 0 : h.headers
                  };
                  _context12.next = 4;
                  return E.processRequestInterceptor(e.deepChat, r);
                case 4:
                  _yield$E$processReque2 = _context12.sent;
                  o = _yield$E$processReque2.body;
                  a = _yield$E$processReque2.headers;
                  l = _yield$E$processReque2.error;
                  c = e.completionsHandlers.onFinish;
                  if (!l) {
                    _context12.next = 11;
                    break;
                  }
                  return _context12.abrupt("return", E.onInterceptorError(i, l, c));
                case 11:
                  if (!((p = e.requestSettings) != null && p.handler)) {
                    _context12.next = 13;
                    break;
                  }
                  return _context12.abrupt("return", Ae.request(e, o, i));
                case 13:
                  if (!(((g = e.requestSettings) == null ? void 0 : g.url) === ve.URL)) {
                    _context12.next = 15;
                    break;
                  }
                  return _context12.abrupt("return", ve.request(e, i));
                case 15:
                  d = !0;
                  u = E.fetch.bind(this, e, a, n);
                  u(o).then(function (m) {
                    return d = !!m.ok, m;
                  }).then(function (m) {
                    return E.processResponseByType(m);
                  }).then( /*#__PURE__*/function () {
                    var _ref4 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee11(m) {
                      var G, A, S, w;
                      return _regeneratorRuntime().wrap(function _callee11$(_context11) {
                        while (1) switch (_context11.prev = _context11.next) {
                          case 0:
                            if (e.extractResultData) {
                              _context11.next = 2;
                              break;
                            }
                            return _context11.abrupt("return");
                          case 2:
                            _context11.next = 4;
                            return (A = (G = e.deepChat).responseInterceptor) == null ? void 0 : A.call(G, m);
                          case 4:
                            _context11.t0 = _context11.sent;
                            if (_context11.t0) {
                              _context11.next = 7;
                              break;
                            }
                            _context11.t0 = m;
                          case 7:
                            S = _context11.t0;
                            _context11.next = 10;
                            return e.extractResultData(S, u, o);
                          case 10:
                            w = _context11.sent;
                            if (d) {
                              _context11.next = 13;
                              break;
                            }
                            throw m;
                          case 13:
                            if (!(!w || _typeof(w) != "object")) {
                              _context11.next = 15;
                              break;
                            }
                            throw Error(C.INVALID_RESPONSE(m, "response", !!e.deepChat.responseInterceptor, S));
                          case 15:
                            w.makingAnotherRequest || (I.isSimulation(e.deepChat.stream) ? I.simulate(i, e.streamHandlers, w) : (i.addNewMessage(w), c()));
                          case 16:
                          case "end":
                            return _context11.stop();
                        }
                      }, _callee11);
                    }));
                    return function (_x23) {
                      return _ref4.apply(this, arguments);
                    };
                  }())["catch"](function (m) {
                    E.displayError(i, m), c();
                  });
                case 18:
                case "end":
                  return _context12.stop();
              }
            }, _callee12, this);
          }));
          function request(_x20, _x21, _x22) {
            return _request3.apply(this, arguments);
          }
          return request;
        }()
      }, {
        key: "executePollRequest",
        value: function executePollRequest(e, t, i, n) {
          var r = e.completionsHandlers.onFinish;
          fetch(t, i).then(function (o) {
            return o.json();
          }).then( /*#__PURE__*/function () {
            var _ref5 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee13(o) {
              var l, c, a;
              return _regeneratorRuntime().wrap(function _callee13$(_context13) {
                while (1) switch (_context13.prev = _context13.next) {
                  case 0:
                    if (e.extractPollResultData) {
                      _context13.next = 2;
                      break;
                    }
                    return _context13.abrupt("return");
                  case 2:
                    _context13.t0 = e;
                    _context13.next = 5;
                    return (c = (l = e.deepChat).responseInterceptor) == null ? void 0 : c.call(l, o);
                  case 5:
                    _context13.t1 = _context13.sent;
                    if (_context13.t1) {
                      _context13.next = 8;
                      break;
                    }
                    _context13.t1 = o;
                  case 8:
                    _context13.t2 = _context13.t1;
                    _context13.next = 11;
                    return _context13.t0.extractPollResultData.call(_context13.t0, _context13.t2);
                  case 11:
                    a = _context13.sent;
                    a.timeoutMS ? setTimeout(function () {
                      _.executePollRequest(e, t, i, n);
                    }, a.timeoutMS) : I.isSimulation(e.deepChat.stream) ? I.simulate(n, e.streamHandlers, a) : (n.addNewMessage(a), r());
                  case 13:
                  case "end":
                    return _context13.stop();
                }
              }, _callee13);
            }));
            return function (_x24) {
              return _ref5.apply(this, arguments);
            };
          }())["catch"](function (o) {
            E.displayError(n, o), r();
          });
        }
        // prettier-ignore
      }, {
        key: "poll",
        value: function () {
          var _poll = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee14(e, t, i) {
            var n,
              p,
              g,
              m,
              r,
              _yield$E$processReque3,
              o,
              a,
              l,
              c,
              d,
              u,
              h,
              _args14 = arguments;
            return _regeneratorRuntime().wrap(function _callee14$(_context14) {
              while (1) switch (_context14.prev = _context14.next) {
                case 0:
                  n = _args14.length > 3 && _args14[3] !== undefined ? _args14[3] : !0;
                  r = {
                    body: t,
                    headers: (p = e.requestSettings) == null ? void 0 : p.headers
                  };
                  _context14.next = 4;
                  return E.processRequestInterceptor(e.deepChat, r);
                case 4:
                  _yield$E$processReque3 = _context14.sent;
                  o = _yield$E$processReque3.body;
                  a = _yield$E$processReque3.headers;
                  l = _yield$E$processReque3.error;
                  if (!l) {
                    _context14.next = 10;
                    break;
                  }
                  return _context14.abrupt("return", E.onInterceptorError(i, l));
                case 10:
                  c = ((g = e.requestSettings) == null ? void 0 : g.url) || e.url || "", d = ((m = e.requestSettings) == null ? void 0 : m.method) || "POST", u = n ? JSON.stringify(o) : o, h = {
                    method: d,
                    body: u,
                    headers: a
                  };
                  e.requestSettings.credentials && (h.credentials = e.requestSettings.credentials), _.executePollRequest(e, c, h, i);
                case 12:
                case "end":
                  return _context14.stop();
              }
            }, _callee14);
          }));
          function poll(_x25, _x26, _x27) {
            return _poll.apply(this, arguments);
          }
          return poll;
        }() // prettier-ignore
      }, {
        key: "verifyKey",
        value: function verifyKey(e, t, i, n, r, o, a, l, c) {
          if (e === "") return o(C.INVALID_KEY);
          a(), fetch(t, {
            method: n,
            headers: i,
            body: c || null
          }).then(function (d) {
            return E.processResponseByType(d);
          }).then(function (d) {
            l(d, e, r, o);
          })["catch"](function (d) {
            o(C.CONNECTION_FAILED), console.error(d);
          });
        }
      }]);
      return _;
    }();
    var Xe = /*#__PURE__*/function () {
      function Xe() {
        _classCallCheck(this, Xe);
      }
      _createClass(Xe, null, [{
        key: "getCharacterLimitMessages",
        value: function getCharacterLimitMessages(e, t) {
          var r;
          if (t === -1) return e;
          var i = 0,
            n = e.length - 1;
          for (n; n >= 0; n -= 1) {
            var o = (r = e[n]) == null ? void 0 : r.text;
            if (o !== void 0 && (i += o.length, i > t)) {
              e[n].text = o.substring(0, o.length - (i - t));
              break;
            }
          }
          return e.slice(Math.max(n, 0));
        }
      }, {
        key: "getMaxMessages",
        value: function getMaxMessages(e, t) {
          return e.slice(Math.max(e.length - t, 0));
        }
        // prettier-ignore
        // if maxMessages is not defined we send all messages
        // if maxMessages above 0 we send that number
        // if maxMessages 0 or below we send only what is in the request
      }, {
        key: "processMessages",
        value: function processMessages(e, t, i) {
          return t !== void 0 ? t > 0 && (e = Xe.getMaxMessages(e, t)) : e = [e[e.length - 1]], e = JSON.parse(JSON.stringify(e)), i === void 0 ? e : Xe.getCharacterLimitMessages(e, i);
        }
      }]);
      return Xe;
    }();
    var $ = /*#__PURE__*/function () {
      function $() {
        _classCallCheck(this, $);
      }
      _createClass($, null, [{
        key: "setup",
        value: function setup(e) {
          e.requestSettings.url !== ve.URL && (e.permittedErrorPrefixes = ["Connection error", "Error in server message"], e.websocket = "pending");
        }
      }, {
        key: "createConnection",
        value: function createConnection(e, t) {
          if (!document.body.contains(e.deepChat)) return;
          var i = e.requestSettings.websocket;
          if (i) {
            if (e.requestSettings.handler) return Ae.websocket(e, t);
            try {
              var n = typeof i != "boolean" ? i : void 0,
                r = new WebSocket(e.requestSettings.url || "", n);
              e.websocket = r, e.websocket.onopen = function () {
                var o, a;
                t.removeError(), e.websocket && _typeof(e.websocket) == "object" && $.assignListeners(e, r, t), (a = (o = e.deepChat)._validationHandler) == null || a.call(o);
              }, e.websocket.onerror = function (o) {
                console.error(o), $.retryConnection(e, t);
              };
            } catch (n) {
              console.error(n), $.retryConnection(e, t);
            }
          }
        }
      }, {
        key: "retryConnection",
        value: function retryConnection(e, t) {
          var i, n;
          (n = (i = e.deepChat)._validationHandler) == null || n.call(i), document.body.contains(e.deepChat) && (e.websocket = "pending", t.isLastMessageError() || t.addNewErrorMessage("service", "Connection error"), setTimeout(function () {
            $.createConnection(e, t);
          }, 5e3));
        }
      }, {
        key: "assignListeners",
        value: function assignListeners(e, t, i) {
          t.onmessage = /*#__PURE__*/function () {
            var _ref6 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee15(n) {
              var r, o, a, l, c;
              return _regeneratorRuntime().wrap(function _callee15$(_context15) {
                while (1) switch (_context15.prev = _context15.next) {
                  case 0:
                    if (!e.extractResultData) {
                      _context15.next = 20;
                      break;
                    }
                    _context15.prev = 1;
                    a = JSON.parse(n.data);
                    _context15.next = 5;
                    return (o = (r = e.deepChat).responseInterceptor) == null ? void 0 : o.call(r, a);
                  case 5:
                    _context15.t0 = _context15.sent;
                    if (_context15.t0) {
                      _context15.next = 8;
                      break;
                    }
                    _context15.t0 = a;
                  case 8:
                    l = _context15.t0;
                    _context15.next = 11;
                    return e.extractResultData(l);
                  case 11:
                    c = _context15.sent;
                    if (!(!c || _typeof(c) != "object")) {
                      _context15.next = 14;
                      break;
                    }
                    throw Error(C.INVALID_RESPONSE(a, "server", !!e.deepChat.responseInterceptor, l));
                  case 14:
                    I.isSimulation(e.deepChat.stream) ? I.simulate(i, e.streamHandlers, c) : i.addNewMessage(c);
                    _context15.next = 20;
                    break;
                  case 17:
                    _context15.prev = 17;
                    _context15.t1 = _context15["catch"](1);
                    E.displayError(i, _context15.t1, "Error in server message");
                  case 20:
                  case "end":
                    return _context15.stop();
                }
              }, _callee15, null, [[1, 17]]);
            }));
            return function (_x28) {
              return _ref6.apply(this, arguments);
            };
          }(), t.onclose = function () {
            console.error("Connection closed"), i.isLastMessageError() || i.addNewErrorMessage("service", "Connection error"), e.deepChat.stream && e.streamHandlers.abortStream.abort(), $.createConnection(e, i);
          };
        }
      }, {
        key: "sendWebsocket",
        value: function () {
          var _sendWebsocket = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee16(e, t, i) {
            var n,
              d,
              u,
              r,
              o,
              _yield$E$processReque4,
              a,
              l,
              c,
              _args16 = arguments;
            return _regeneratorRuntime().wrap(function _callee16$(_context16) {
              while (1) switch (_context16.prev = _context16.next) {
                case 0:
                  n = _args16.length > 3 && _args16[3] !== undefined ? _args16[3] : !0;
                  r = e.websocket;
                  if (!(!r || r === "pending")) {
                    _context16.next = 4;
                    break;
                  }
                  return _context16.abrupt("return");
                case 4:
                  o = {
                    body: t,
                    headers: (d = e.requestSettings) == null ? void 0 : d.headers
                  };
                  _context16.next = 7;
                  return E.processRequestInterceptor(e.deepChat, o);
                case 7:
                  _yield$E$processReque4 = _context16.sent;
                  a = _yield$E$processReque4.body;
                  l = _yield$E$processReque4.error;
                  if (!l) {
                    _context16.next = 12;
                    break;
                  }
                  return _context16.abrupt("return", i.addNewErrorMessage("service", l));
                case 12:
                  if ($.isWebSocket(r)) {
                    _context16.next = 14;
                    break;
                  }
                  return _context16.abrupt("return", r.newUserMessage.listener(a));
                case 14:
                  c = n ? JSON.stringify(a) : a;
                  if (!(((u = e.requestSettings) == null ? void 0 : u.url) === ve.URL)) {
                    _context16.next = 17;
                    break;
                  }
                  return _context16.abrupt("return", ve.request(e, i));
                case 17:
                  r.readyState === void 0 || r.readyState !== r.OPEN ? (console.error("Connection is not open"), i.isLastMessageError() || i.addNewErrorMessage("service", "Connection error")) : (r.send(JSON.stringify(c)), e.completionsHandlers.onFinish());
                case 18:
                case "end":
                  return _context16.stop();
              }
            }, _callee16);
          }));
          function sendWebsocket(_x29, _x30, _x31) {
            return _sendWebsocket.apply(this, arguments);
          }
          return sendWebsocket;
        }()
      }, {
        key: "canSendMessage",
        value: function canSendMessage(e) {
          return e ? e === "pending" ? !1 : $.isWebSocket(e) ? e.readyState !== void 0 && e.readyState === e.OPEN : e.isOpen : !0;
        }
        // if false then it is the internal websocket handler
      }, {
        key: "isWebSocket",
        value: function isWebSocket(e) {
          return e.send !== void 0;
        }
      }]);
      return $;
    }();
    var L = /*#__PURE__*/function () {
      function L() {
        _classCallCheck(this, L);
      }
      _createClass(L, null, [{
        key: "parseConfig",
        value:
        // prettier-ignore
        function parseConfig(e, t, i, n) {
          var o;
          var r = {
            files: t
          };
          if (_typeof(n) == "object") {
            var a = n.files,
              l = n.request,
              c = n.button;
            a && (a.infoModal && (r.files.infoModal = a.infoModal, (o = a.infoModal) != null && o.textMarkDown && (r.infoModalTextMarkUp = i.render(a.infoModal.textMarkDown))), a.acceptedFormats && (r.files.acceptedFormats = a.acceptedFormats), a.maxNumberOfFiles && (r.files.maxNumberOfFiles = a.maxNumberOfFiles)), r.button = c, l && (l.headers || l.method || l.url || l.credentials || e.headers || e.method || e.url || e.credentials) && (r.request = {
              url: (l == null ? void 0 : l.url) || e.url,
              method: (l == null ? void 0 : l.method) || e.method,
              headers: (l == null ? void 0 : l.headers) || e.headers,
              credentials: (l == null ? void 0 : l.credentials) || e.credentials
            });
          }
          return r;
        }
      }, {
        key: "processMixedFiles",
        value: function processMixedFiles(e, t, i) {
          if (i) {
            var n = {
              acceptedFormats: ""
            };
            e.fileTypes.mixedFiles = L.parseConfig(e.requestSettings, n, t, i);
          }
        }
        // needs to be set after audio to overwrite maxNumberOfFiles
        // prettier-ignore
      }, {
        key: "processMicrophone",
        value: function processMicrophone(e, t, i, n) {
          var _l$files, _h$maxNumberOfFiles;
          var a, l, c, d, u, h;
          var o = _objectSpread({
            acceptedFormats: "audio/*"
          }, ((a = e.fileTypes.audio) == null ? void 0 : a.files) || {});
          i && (navigator.mediaDevices.getUserMedia !== void 0 ? (e.recordAudio = L.parseConfig(e.requestSettings, o, t, i), _typeof(i) == "object" && i.files && ((_l$files = (l = e.recordAudio).files) !== null && _l$files !== void 0 ? _l$files : l.files = {}, e.recordAudio.files.format = (c = i.files) == null ? void 0 : c.format, e.recordAudio.files.maxDurationSeconds = (d = i.files) == null ? void 0 : d.maxDurationSeconds, (u = e.fileTypes.audio) != null && u.files && ((_h$maxNumberOfFiles = (h = e.fileTypes.audio.files).maxNumberOfFiles) !== null && _h$maxNumberOfFiles !== void 0 ? _h$maxNumberOfFiles : h.maxNumberOfFiles = i.files.maxNumberOfFiles))) : n || (e.fileTypes.audio = L.parseConfig(e.requestSettings, o, t, i)));
        }
        // prettier-ignore
      }, {
        key: "processAudioConfig",
        value: function processAudioConfig(e, t, i, n) {
          if (!i && !n) return;
          var o = _objectSpread({
            acceptedFormats: "audio/*"
          }, (n == null ? void 0 : n.files) || {});
          e.fileTypes.audio = L.parseConfig(e.requestSettings, o, t, i);
        }
        // prettier-ignore
      }, {
        key: "processGifConfig",
        value: function processGifConfig(e, t, i, n) {
          if (!i && !n) return;
          var o = _objectSpread({
            acceptedFormats: "image/gif"
          }, (n == null ? void 0 : n.files) || {});
          e.fileTypes.gifs = L.parseConfig(e.requestSettings, o, t, i);
        }
        // needs to be set after images to overwrite maxNumberOfFiles
        // prettier-ignore
      }, {
        key: "processCamera",
        value: function processCamera(e, t, i, n) {
          var _l$files2;
          var a, l, c, d;
          var o = _objectSpread({
            acceptedFormats: "image/*"
          }, ((a = e.fileTypes.images) == null ? void 0 : a.files) || {});
          i && (navigator.mediaDevices.getUserMedia !== void 0 ? (e.camera = L.parseConfig(e.requestSettings, o, t, i), _typeof(i) == "object" && (e.camera.modalContainerStyle = i.modalContainerStyle, i.files && ((_l$files2 = (l = e.camera).files) !== null && _l$files2 !== void 0 ? _l$files2 : l.files = {}, e.camera.files.format = (c = i.files) == null ? void 0 : c.format, e.camera.files.dimensions = (d = i.files) == null ? void 0 : d.dimensions))) : n || (e.fileTypes.images = L.parseConfig(e.requestSettings, o, t, i)));
        }
        // prettier-ignore
      }, {
        key: "processImagesConfig",
        value: function processImagesConfig(e, t, i, n) {
          if (!i && !n) return;
          var o = _objectSpread({
            acceptedFormats: "image/*"
          }, (n == null ? void 0 : n.files) || {});
          e.fileTypes.images = L.parseConfig(e.requestSettings, o, t, i);
        }
        // default for direct service
      }, {
        key: "populateDefaultFileIO",
        value: function populateDefaultFileIO(e, t) {
          var _e$files, _i$acceptedFormats, _n$maxNumberOfFiles;
          var i, n;
          e && ((_e$files = e.files) !== null && _e$files !== void 0 ? _e$files : e.files = {}, (_i$acceptedFormats = (i = e.files).acceptedFormats) !== null && _i$acceptedFormats !== void 0 ? _i$acceptedFormats : i.acceptedFormats = t, (_n$maxNumberOfFiles = (n = e.files).maxNumberOfFiles) !== null && _n$maxNumberOfFiles !== void 0 ? _n$maxNumberOfFiles : n.maxNumberOfFiles = 1);
        }
      }, {
        key: "set",
        value: function set(e, t, i) {
          L.populateDefaultFileIO(i == null ? void 0 : i.audio, ".4a,.mp3,.webm,.mp4,.mpga,.wav,.mpeg,.m4a"), L.populateDefaultFileIO(i == null ? void 0 : i.images, ".png,.jpg");
          var n = Pi.createNew();
          L.processImagesConfig(t, n, e.images, i == null ? void 0 : i.images), L.processCamera(t, n, e.camera, e.images), L.processGifConfig(t, n, e.gifs, i == null ? void 0 : i.gifs), L.processAudioConfig(t, n, e.audio, i == null ? void 0 : i.audio), L.processMicrophone(t, n, e.microphone, e.audio), L.processMixedFiles(t, n, e.mixedFiles);
        }
      }]);
      return L;
    }();
    var Le = /*#__PURE__*/function () {
      function Le(e, t, i) {
        var _a$url;
        _classCallCheck(this, Le);
        var n, r, o, a;
        this.rawBody = {}, this.validateConfigKey = !1, this.canSendMessage = Le.canSendMessage, this.requestSettings = {}, this.fileTypes = {}, this.completionsHandlers = {}, this.streamHandlers = {}, this.deepChat = e, this.demo = i, Object.assign(this.rawBody, (n = e.request) == null ? void 0 : n.additionalBodyProps), this.totalMessagesMaxCharLength = (r = e == null ? void 0 : e.requestBodyLimits) == null ? void 0 : r.totalMessagesMaxCharLength, this.maxMessages = (o = e == null ? void 0 : e.requestBodyLimits) == null ? void 0 : o.maxMessages, L.set(e, this, t), e.request && (this.requestSettings = e.request), this.demo && ((_a$url = (a = this.requestSettings).url) !== null && _a$url !== void 0 ? _a$url : a.url = ve.URL), this.requestSettings.websocket && $.setup(this);
      }
      _createClass(Le, [{
        key: "verifyKey",
        value: function verifyKey(e, t) {}
      }, {
        key: "getServiceIOByType",
        value: function getServiceIOByType(e) {
          if (e.type.startsWith("audio") && this.fileTypes.audio) return this.fileTypes.audio;
          if (e.type.startsWith("image")) {
            if (this.fileTypes.gifs && e.type.endsWith("/gif")) return this.fileTypes.gifs;
            if (this.fileTypes.images) return this.fileTypes.images;
            if (this.camera) return this.camera;
          }
          return this.fileTypes.mixedFiles;
        }
      }, {
        key: "request",
        value: function () {
          var _request4 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee17(e, t) {
            var i,
              n,
              _args17 = arguments;
            return _regeneratorRuntime().wrap(function _callee17$(_context17) {
              while (1) switch (_context17.prev = _context17.next) {
                case 0:
                  i = _args17.length > 2 && _args17[2] !== undefined ? _args17[2] : !0;
                  n = this.deepChat.stream;
                  return _context17.abrupt("return", n && !I.isSimulation(n) ? I.request(this, e, t) : _.request(this, e, t, i));
                case 3:
                case "end":
                  return _context17.stop();
              }
            }, _callee17, this);
          }));
          function request(_x32, _x33) {
            return _request4.apply(this, arguments);
          }
          return request;
        }()
      }, {
        key: "callAPIWithText",
        value: function () {
          var _callAPIWithText = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee18(e, t) {
            var _o$headers, _a$ContentType;
            var r, o, a, l, i, n;
            return _regeneratorRuntime().wrap(function _callee18$(_context18) {
              while (1) switch (_context18.prev = _context18.next) {
                case 0:
                  i = _objectSpread({
                    messages: t
                  }, this.rawBody);
                  n = !1;
                  (r = this.requestSettings.headers) != null && r["Content-Type"] || ((_o$headers = (o = this.requestSettings).headers) !== null && _o$headers !== void 0 ? _o$headers : o.headers = {}, (_a$ContentType = (a = this.requestSettings.headers)["Content-Type"]) !== null && _a$ContentType !== void 0 ? _a$ContentType : a["Content-Type"] = "application/json", n = !0);
                  _context18.next = 5;
                  return this.request(i, e);
                case 5:
                  n && ((l = this.requestSettings.headers) == null || delete l["Content-Type"]);
                case 6:
                case "end":
                  return _context18.stop();
              }
            }, _callee18, this);
          }));
          function callAPIWithText(_x34, _x35) {
            return _callAPIWithText.apply(this, arguments);
          }
          return callAPIWithText;
        }()
      }, {
        key: "callApiWithFiles",
        value: function () {
          var _callApiWithFiles = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee19(e, t, i) {
            var n, r, o;
            return _regeneratorRuntime().wrap(function _callee19$(_context19) {
              while (1) switch (_context19.prev = _context19.next) {
                case 0:
                  n = Le.createCustomFormDataBody(this.rawBody, t, i), r = this.requestSettings, o = this.getServiceIOByType(i[0]);
                  this.requestSettings = (o == null ? void 0 : o.request) || this.requestSettings;
                  _context19.next = 4;
                  return this.request(n, e, !1);
                case 4:
                  this.requestSettings = r;
                case 5:
                case "end":
                  return _context19.stop();
              }
            }, _callee19, this);
          }));
          function callApiWithFiles(_x36, _x37, _x38) {
            return _callApiWithFiles.apply(this, arguments);
          }
          return callApiWithFiles;
        }()
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee20(e, t, i) {
            return _regeneratorRuntime().wrap(function _callee20$(_context20) {
              while (1) switch (_context20.prev = _context20.next) {
                case 0:
                  i ? this.callApiWithFiles(e, t, i) : this.callAPIWithText(e, t);
                case 1:
                case "end":
                  return _context20.stop();
              }
            }, _callee20, this);
          }));
          function callServiceAPI(_x39, _x40, _x41) {
            return _callServiceAPI.apply(this, arguments);
          }
          return callServiceAPI;
        }() // prettier-ignore
      }, {
        key: "callAPI",
        value: function () {
          var _callAPI = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee21(e, t) {
            var i, n;
            return _regeneratorRuntime().wrap(function _callee21$(_context21) {
              while (1) switch (_context21.prev = _context21.next) {
                case 0:
                  if (this.requestSettings) {
                    _context21.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  i = Xe.processMessages(t.messages, this.maxMessages, this.totalMessagesMaxCharLength);
                  if (this.requestSettings.websocket) {
                    n = _objectSpread({
                      messages: i
                    }, this.rawBody);
                    $.sendWebsocket(this, n, t, !1);
                  } else this.callServiceAPI(t, i, e.files);
                case 4:
                case "end":
                  return _context21.stop();
              }
            }, _callee21, this);
          }));
          function callAPI(_x42, _x43) {
            return _callAPI.apply(this, arguments);
          }
          return callAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee22(e) {
            return _regeneratorRuntime().wrap(function _callee22$(_context22) {
              while (1) switch (_context22.prev = _context22.next) {
                case 0:
                  if (!e.error) {
                    _context22.next = 2;
                    break;
                  }
                  throw e.error;
                case 2:
                  if (!e.result) {
                    _context22.next = 4;
                    break;
                  }
                  return _context22.abrupt("return", ke.handleResponseProperty(e));
                case 4:
                  if (!E.validateResponseFormat(e)) {
                    _context22.next = 6;
                    break;
                  }
                  return _context22.abrupt("return", e);
                case 6:
                case "end":
                  return _context22.stop();
              }
            }, _callee22);
          }));
          function extractResultData(_x44) {
            return _extractResultData.apply(this, arguments);
          }
          return extractResultData;
        }()
      }, {
        key: "isDirectConnection",
        value: function isDirectConnection() {
          return !1;
        }
      }, {
        key: "isWebModel",
        value: function isWebModel() {
          return !1;
        }
      }], [{
        key: "canSendMessage",
        value: function canSendMessage(e, t, i) {
          return i ? !0 : !!(e && e.trim() !== "") || !!(t && t.length > 0);
        }
      }, {
        key: "createCustomFormDataBody",
        value: function createCustomFormDataBody(e, t, i) {
          var n = new FormData();
          i.forEach(function (a) {
            return n.append("files", a);
          }), Object.keys(e).forEach(function (a) {
            return n.append(a, String(e[a]));
          });
          var r = 0;
          t.slice(0, t.length - 1).forEach(function (a) {
            n.append("message".concat(r += 1), JSON.stringify(a));
          });
          var o = t[t.length - 1];
          return o.text && (delete o.files, n.append("message".concat(r += 1), JSON.stringify(o))), n;
        }
      }]);
      return Le;
    }();
    var U = /*#__PURE__*/function (_Le) {
      _inherits(U, _Le);
      var _super = _createSuper(U);
      // prettier-ignore
      function U(e, t, i, n, r) {
        var _this6;
        _classCallCheck(this, U);
        var o;
        _this6 = _super.call(this, e, r), _this6.insertKeyPlaceholderText = "API Key", _this6.getKeyLink = "", Object.assign(_this6.rawBody, (o = e.request) == null ? void 0 : o.additionalBodyProps), _this6.keyVerificationDetails = t, _this6.buildHeadersFunc = i, n && _this6.setApiKeyProperties(n), _this6.requestSettings = _this6.buildRequestSettings(_this6.key || "", e.request);
        return _this6;
      }
      _createClass(U, [{
        key: "setApiKeyProperties",
        value: function setApiKeyProperties(e) {
          this.key = e.key, e.validateKeyProperty && (this.validateConfigKey = e.validateKeyProperty);
        }
      }, {
        key: "buildRequestSettings",
        value: function buildRequestSettings(e, t) {
          var _i$headers;
          var i = t !== null && t !== void 0 ? t : {};
          return (_i$headers = i.headers) !== null && _i$headers !== void 0 ? _i$headers : i.headers = {}, Object.assign(i.headers, this.buildHeadersFunc(e)), i;
        }
      }, {
        key: "keyAuthenticated",
        value: function keyAuthenticated(e, t) {
          this.requestSettings = this.buildRequestSettings(t, this.requestSettings), this.key = t, e();
        }
        // prettier-ignore
      }, {
        key: "verifyKey",
        value: function verifyKey(e, t) {
          var _this$keyVerification = this.keyVerificationDetails,
            i = _this$keyVerification.url,
            n = _this$keyVerification.method,
            r = _this$keyVerification.handleVerificationResult,
            o = _this$keyVerification.createHeaders,
            a = _this$keyVerification.body,
            l = (o == null ? void 0 : o(e)) || this.buildHeadersFunc(e);
          _.verifyKey(e, i, l, n, this.keyAuthenticated.bind(this, t.onSuccess), t.onFail, t.onLoad, r, a);
        }
      }, {
        key: "isDirectConnection",
        value: function isDirectConnection() {
          return !0;
        }
      }]);
      return U;
    }(Le);
    var Ft = /*#__PURE__*/function () {
      function Ft() {
        _classCallCheck(this, Ft);
      }
      _createClass(Ft, null, [{
        key: "waitForPropertiesToBeUpdatedBeforeRender",
        value: function waitForPropertiesToBeUpdatedBeforeRender(e) {
          e._propUpdated_ = !1, setTimeout(function () {
            e._propUpdated_ ? Ft.waitForPropertiesToBeUpdatedBeforeRender(e) : (e._waitingToRender_ = !1, e.onRender());
          });
        }
      }, {
        key: "attemptRender",
        value: function attemptRender(e) {
          e._propUpdated_ = !0, e._waitingToRender_ || (e._waitingToRender_ = !0, Ft.waitForPropertiesToBeUpdatedBeforeRender(e));
        }
      }]);
      return Ft;
    }();
    var Ji = /*#__PURE__*/function (_HTMLElement) {
      _inherits(He, _HTMLElement);
      var _super2 = _createSuper(He);
      // If this is not working, try using propertyName directly
      function He() {
        var _this7;
        _classCallCheck(this, He);
        _this7 = _super2.call(this), _this7._waitingToRender_ = !1, _this7._propUpdated_ = !1, Object.keys(He._attributeToProperty_).forEach(function (e) {
          var t = He._attributeToProperty_[e];
          _this7.constructPropertyAccessors(t), _this7.hasOwnProperty(e) || _this7.constructPropertyAccessors(t, e);
        });
        return _this7;
      }
      _createClass(He, [{
        key: "constructPropertyAccessors",
        value:
        // need to be called here as accessors need to be set for the class instance
        function constructPropertyAccessors(e, t) {
          var i;
          Object.defineProperty(this, t || e, {
            get: function get() {
              return i;
            },
            set: function set(o) {
              i = o, t ? this[e] = o : Ft.attemptRender(this);
            }
          });
        }
      }, {
        key: "attributeChangedCallback",
        value: function attributeChangedCallback(e, t, i) {
          if (t === i) return;
          var n = He._attributes_[e](i),
            r = He._attributeToProperty_[e];
          this[r] = n;
        }
      }, {
        key: "onRender",
        value: function onRender() {}
      }], [{
        key: "observedAttributes",
        get: function get() {
          return Object.keys(He._attributes_) || [];
        }
      }]);
      return He;
    }( /*#__PURE__*/_wrapNativeSuper(HTMLElement));
    Ji._attributes_ = {};
    Ji._attributeToProperty_ = {};
    var vo = Ji;
    var yo = "<?xml version=\"1.0\" standalone=\"no\"?>\n<svg version=\"1.1\"\n\txmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns:inkscape=\"http://www.inkscape.org/namespaces/inkscape\"\n\txmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"0.9em\" height=\"0.9em\"\n\tviewBox=\"0 0 1200 1200\" enable-background=\"new 0 0 1200 1200\">\n\t\t<path d=\"\n\t\t\tM669.727,273.516c-22.891-2.476-46.15-3.895-69.727-4.248c-103.025,0.457-209.823,25.517-310.913,73.536\n\t\t\tc-75.058,37.122-148.173,89.529-211.67,154.174C46.232,529.978,6.431,577.76,0,628.74c0.76,44.162,48.153,98.67,77.417,131.764\n\t\t\tc59.543,62.106,130.754,113.013,211.67,154.174c2.75,1.335,5.51,2.654,8.276,3.955l-75.072,131.102l102.005,60.286l551.416-960.033\n\t\t\tl-98.186-60.008L669.727,273.516z M902.563,338.995l-74.927,129.857c34.47,44.782,54.932,100.006,54.932,159.888\n\t\t\tc0,149.257-126.522,270.264-282.642,270.264c-6.749,0-13.29-0.728-19.922-1.172l-49.585,85.84c22.868,2.449,45.99,4.233,69.58,4.541\n\t\t\tc103.123-0.463,209.861-25.812,310.84-73.535c75.058-37.122,148.246-89.529,211.743-154.174\n\t\t\tc31.186-32.999,70.985-80.782,77.417-131.764c-0.76-44.161-48.153-98.669-77.417-131.763\n\t\t\tc-59.543-62.106-130.827-113.013-211.743-154.175C908.108,341.478,905.312,340.287,902.563,338.995L902.563,338.995z\n\t\t\tM599.927,358.478c6.846,0,13.638,0.274,20.361,0.732l-58.081,100.561c-81.514,16.526-142.676,85.88-142.676,168.897\n\t\t\tc0,20.854,3.841,40.819,10.913,59.325c0.008,0.021-0.008,0.053,0,0.074l-58.228,100.854\n\t\t\tc-34.551-44.823-54.932-100.229-54.932-160.182C317.285,479.484,443.808,358.477,599.927,358.478L599.927,358.478z M768.896,570.513\n\t\t\tL638.013,797.271c81.076-16.837,141.797-85.875,141.797-168.603C779.81,608.194,775.724,588.729,768.896,570.513L768.896,570.513z\"\n\t\t\t/>\n</svg>\n",
      xo = "<?xml version=\"1.0\" standalone=\"no\"?>\n<svg version=\"1.1\"\n\txmlns:sodipodi=\"http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd\" xmlns:inkscape=\"http://www.inkscape.org/namespaces/inkscape\"\n\txmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"0.9em\" height=\"0.9em\"\n\tviewBox=\"0 0 1200 1200\" enable-background=\"new 0 0 1200 1200\">\n\t\t<path id=\"path6686\" inkscape:connector-curvature=\"0\" d=\"M779.843,599.925c0,95.331-80.664,172.612-180.169,172.612\n\t\t\tc-99.504,0-180.168-77.281-180.168-172.612c0-95.332,80.664-172.612,180.168-172.612\n\t\t\tC699.179,427.312,779.843,504.594,779.843,599.925z M600,240.521c-103.025,0.457-209.814,25.538-310.904,73.557\n\t\t\tc-75.058,37.122-148.206,89.496-211.702,154.141C46.208,501.218,6.431,549,0,599.981c0.76,44.161,48.13,98.669,77.394,131.763\n\t\t\tc59.543,62.106,130.786,113.018,211.702,154.179c94.271,45.751,198.616,72.092,310.904,73.557\n\t\t\tc103.123-0.464,209.888-25.834,310.866-73.557c75.058-37.122,148.243-89.534,211.74-154.179\n\t\t\tc31.185-32.999,70.962-80.782,77.394-131.763c-0.76-44.161-48.13-98.671-77.394-131.764\n\t\t\tc-59.543-62.106-130.824-112.979-211.74-154.141C816.644,268.36,712.042,242.2,600,240.521z M599.924,329.769\n\t\t\tc156.119,0,282.675,120.994,282.675,270.251c0,149.256-126.556,270.25-282.675,270.25S317.249,749.275,317.249,600.02\n\t\t\tC317.249,450.763,443.805,329.769,599.924,329.769L599.924,329.769z\"/>\n</svg>\n";
    var q = /*#__PURE__*/function () {
      function q() {
        _classCallCheck(this, q);
      }
      _createClass(q, null, [{
        key: "createSVGElement",
        value: function createSVGElement(e) {
          return new DOMParser().parseFromString(e, "image/svg+xml").documentElement;
        }
      }]);
      return q;
    }();
    var rs = /*#__PURE__*/function () {
      function Ge() {
        _classCallCheck(this, Ge);
      }
      _createClass(Ge, null, [{
        key: "changeVisibility",
        value:
        // prettier-ignore
        function changeVisibility(e, t, i, n) {
          n.target.id === Ge.VISIBLE_ICON_ID ? (t.style.display = "none", i.style.display = "block", e.type = "password") : (t.style.display = "block", i.style.display = "none", e.type = "text");
        }
      }, {
        key: "createIconElement",
        value: function createIconElement(e, t) {
          var i = q.createSVGElement(e);
          return i.id = t, i.classList.add("visibility-icon"), i;
        }
        // prettier-ignore
      }, {
        key: "create",
        value: function create(e) {
          var t = document.createElement("div");
          t.id = "visibility-icon-container";
          var i = Ge.createIconElement(xo, Ge.VISIBLE_ICON_ID);
          i.style.display = "none", t.appendChild(i);
          var n = Ge.createIconElement(yo, "not-visible-icon");
          return t.appendChild(n), t.onclick = Ge.changeVisibility.bind(this, e, i, n), t;
        }
      }]);
      return Ge;
    }();
    rs.VISIBLE_ICON_ID = "visible-icon";
    var Eo = rs;
    var P = /*#__PURE__*/function () {
      function P() {
        _classCallCheck(this, P);
      }
      _createClass(P, null, [{
        key: "createCautionText",
        value: function createCautionText() {
          var e = document.createElement("a");
          return e.classList.add("insert-key-input-help-text"), e.innerText = "Please exercise CAUTION when inserting your API key outside of deepchat.dev or localhost!!", e;
        }
      }, {
        key: "createHelpLink",
        value: function createHelpLink(e) {
          var t = document.createElement("a");
          return t.classList.add("insert-key-input-help-text"), t.href = e, t.innerText = "Find more info here", t.target = "_blank", t;
        }
      }, {
        key: "createFailText",
        value: function createFailText() {
          var e = document.createElement("div");
          return e.id = "insert-key-input-invalid-text", e.style.display = "none", e;
        }
      }, {
        key: "createHelpTextContainer",
        value: function createHelpTextContainer(e) {
          var t = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : !0;
          var i = document.createElement("div");
          i.id = "insert-key-help-text-container";
          var n = document.createElement("div");
          n.id = "insert-key-help-text-contents";
          var r = P.createFailText();
          if (n.appendChild(r), e) {
            var o = P.createHelpLink(e);
            n.appendChild(o);
          }
          if (t === !0) {
            var _o2 = P.createCautionText();
            n.appendChild(_o2);
          }
          return i.appendChild(n), {
            helpTextContainerElement: i,
            failTextElement: r
          };
        }
      }, {
        key: "onFail",
        value: function onFail(e, t, i, n) {
          e.classList.replace("insert-key-input-valid", "insert-key-input-invalid"), i.innerText = n, i.style.display = "block", t.innerText = "Start", e.classList.remove("loading");
        }
      }, {
        key: "onLoad",
        value: function onLoad(e, t) {
          e.classList.add("loading"), t.innerHTML = '<div id="loading-ring"></div>';
        }
        // prettier-ignore
      }, {
        key: "verifyKey",
        value: function verifyKey(e, t, i) {
          var n = e.value.trim();
          i.verifyKey(n, t);
        }
        // prettier-ignore
      }, {
        key: "addVerificationEvents",
        value: function addVerificationEvents(e, t, i, n, r) {
          var o = {
              onSuccess: n,
              onFail: P.onFail.bind(this, e, t, i),
              onLoad: P.onLoad.bind(this, e, t)
            },
            a = P.verifyKey.bind(this, e, o, r);
          t.onclick = a, e.onkeydown = function (l) {
            !e.classList.contains("loading") && l.key === R.ENTER && a();
          };
        }
      }, {
        key: "createStartButton",
        value: function createStartButton() {
          var e = document.createElement("div");
          return e.id = "start-button", e.innerText = "Start", e;
        }
      }, {
        key: "onInputFocus",
        value: function onInputFocus(e) {
          e.target.classList.replace("insert-key-input-invalid", "insert-key-input-valid");
        }
      }, {
        key: "createInput",
        value: function createInput(e) {
          var t = document.createElement("div");
          t.id = "insert-key-input-container";
          var i = document.createElement("input");
          return i.id = "insert-key-input", i.placeholder = e || "API Key", i.type = "password", i.classList.add("insert-key-input-valid"), i.onfocus = P.onInputFocus, t.appendChild(i), t;
        }
        // prettier-ignore
      }, {
        key: "createContents",
        value: function createContents(e, t) {
          var d;
          var i = document.createElement("div");
          i.id = "insert-key-contents";
          var n = P.createInput(t.insertKeyPlaceholderText),
            r = n.children[0],
            o = Eo.create(r);
          n.appendChild(o), i.appendChild(n);
          var a = P.createStartButton(),
            _P$createHelpTextCont = P.createHelpTextContainer(t.getKeyLink, (d = t.deepChat._insertKeyViewStyles) == null ? void 0 : d.displayCautionText),
            l = _P$createHelpTextCont.helpTextContainerElement,
            c = _P$createHelpTextCont.failTextElement;
          return i.appendChild(a), i.appendChild(l), P.addVerificationEvents(r, a, c, e, t), i;
        }
      }, {
        key: "createElements",
        value: function createElements(e, t) {
          var i = document.createElement("div");
          i.id = "insert-key-view";
          var n = P.createContents(e, t);
          return i.appendChild(n), i;
        }
      }, {
        key: "render",
        value: function render(e, t, i) {
          var n = P.createElements(t, i);
          e.replaceChildren(n);
        }
      }]);
      return P;
    }();
    var yt = /*#__PURE__*/function () {
      function pe() {
        _classCallCheck(this, pe);
      }
      _createClass(pe, null, [{
        key: "enableButtons",
        value: function enableButtons(e, t) {
          var i = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
          window.webLLM ? (e && (e.disabled = !1), t && (t.disabled = !1)) : i < $i.MODULE_SEARCH_LIMIT_S * 4 && setTimeout(function () {
            return pe.enableButtons(e, t, i + 1);
          }, 250);
        }
        // prettier-ignore
      }, {
        key: "setUpInitial",
        value: function setUpInitial(e, t, i, n) {
          var r = (t == null ? void 0 : t.downloadClass) || pe.DOWNLOAD_BUTTON_CLASS,
            o = (t == null ? void 0 : t.uploadClass) || pe.UPLOAD_BUTTON_CLASS,
            a = (t == null ? void 0 : t.fileInputClass) || pe.FILE_INPUT_CLASS;
          return setTimeout(function () {
            var l = i == null ? void 0 : i.getElementsByClassName(r)[0],
              c = i == null ? void 0 : i.getElementsByClassName(a)[0],
              d = i == null ? void 0 : i.getElementsByClassName(o)[0];
            l && (l.onclick = function () {
              return e();
            }), c && (c.onchange = function () {
              c.files && c.files.length > 0 && e(c.files);
            }), d && (d.onclick = function () {
              return c.click();
            }), (l || d) && pe.enableButtons(l, d);
          }), (t == null ? void 0 : t.initialHtml) || "<div>\n        Download or upload a web model that will run entirely on your browser: <br/> \n        <button disabled class=\"".concat(r, " deep-chat-button deep-chat-web-model-button\">Download</button>\n        ").concat(n ? "" : "<input type=\"file\" class=\"".concat(a, "\" hidden multiple />\n          <button disabled class=\"").concat(o, " deep-chat-button deep-chat-web-model-button\">Upload</button>"), "\n      </div>");
        }
      }, {
        key: "exportFile",
        value: function exportFile(e) {
          var t = document.createElement("a"),
            i = 4;
          var _loop2 = function _loop2(n) {
            setTimeout(function () {
              var r = n * i;
              for (var o = r; o < Math.min(r + i, e.length); o += 1) {
                var a = URL.createObjectURL(e[o]);
                t.href = a, t.download = e[o].name, document.body.appendChild(t), t.click(), URL.revokeObjectURL(a);
              }
            }, 500 * n);
          };
          for (var n = 0; n < e.length / i; n += 1) {
            _loop2(n);
          }
        }
        // prettier-ignore
      }, {
        key: "setUpAfterLoad",
        value: function setUpAfterLoad(e, t, i, n) {
          var r = (t == null ? void 0 : t.exportFilesClass) || pe.EXPORT_BUTTON_CLASS;
          return setTimeout(function () {
            var o = i == null ? void 0 : i.getElementsByClassName(r)[0];
            o && (o.onclick = function () {
              return pe.exportFile(e);
            });
          }), (t == null ? void 0 : t.afterLoadHtml) || "<div>\n        Model loaded successfully and has been cached for future requests.\n        ".concat(n ? "" : "<br/> <button style=\"margin-top: 5px\" class=\"".concat(r, " deep-chat-button\">Export</button>"), "\n      </div>");
        }
      }]);
      return pe;
    }();
    yt.DOWNLOAD_BUTTON_CLASS = "deep-chat-download-button";
    yt.UPLOAD_BUTTON_CLASS = "deep-chat-upload-button";
    yt.FILE_INPUT_CLASS = "deep-chat-file-input";
    yt.EXPORT_BUTTON_CLASS = "deep-chat-export-button";
    var xn = yt;
    var En = {
        model_list: [{
          model_url: "https://huggingface.co/mlc-ai/Llama-2-7b-chat-hf-q4f32_1-MLC/resolve/main/",
          local_id: "Llama-2-7b-chat-hf-q4f32_1",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-2-7b-chat-hf/Llama-2-7b-chat-hf-q4f32_1-ctx4k_cs1k-webgpu.wasm"
        }, {
          model_url: "https://huggingface.co/mlc-ai/Llama-2-7b-chat-hf-q4f16_1-MLC/resolve/main/",
          local_id: "Llama-2-7b-chat-hf-q4f16_1",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-2-7b-chat-hf/Llama-2-7b-chat-hf-q4f16_1-ctx4k_cs1k-webgpu.wasm",
          required_features: ["shader-f16"]
        }, {
          model_url: "https://huggingface.co/mlc-ai/Llama-2-13b-chat-hf-q4f16_1-MLC/resolve/main/",
          local_id: "Llama-2-13b-chat-hf-q4f16_1",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-2-13b-chat-hf/Llama-2-13b-chat-hf-q4f16_1-ctx4k_cs1k-webgpu.wasm",
          required_features: ["shader-f16"]
        }, {
          model_url: "https://huggingface.co/mlc-ai/Llama-2-70b-chat-hf-q4f16_1-MLC/resolve/main/",
          local_id: "Llama-2-70b-chat-hf-q4f16_1",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-2-70b-chat-hf/Llama-2-70b-chat-hf-q4f16_1-ctx4k_cs1k-webgpu.wasm",
          required_features: ["shader-f16"]
        }, {
          model_url: "https://huggingface.co/mlc-ai/RedPajama-INCITE-Chat-3B-v1-q4f16_1-MLC/resolve/main/",
          local_id: "RedPajama-INCITE-Chat-3B-v1-q4f16_1",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/RedPajama-INCITE-Chat-3B-v1/RedPajama-INCITE-Chat-3B-v1-q4f16_1-ctx2k-webgpu.wasm",
          required_features: ["shader-f16"]
        }, {
          model_url: "https://huggingface.co/mlc-ai/RedPajama-INCITE-Chat-3B-v1-q4f32_1-MLC/resolve/main/",
          local_id: "RedPajama-INCITE-Chat-3B-v1-q4f32_1",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/RedPajama-INCITE-Chat-3B-v1/RedPajama-INCITE-Chat-3B-v1-q4f32_1-ctx2k-webgpu.wasm"
        }, {
          model_url: "https://huggingface.co/mlc-ai/WizardMath-7B-V1.1-q4f16_1-MLC/resolve/main/",
          local_id: "WizardMath-7B-V1.1-q4f16_1",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Mistral-7B-Instruct-v0.2/Mistral-7B-Instruct-v0.2-q4f16_1-sw4k_cs1k-webgpu.wasm",
          required_features: ["shader-f16"]
        }, {
          model_url: "https://huggingface.co/mlc-ai/Mistral-7B-Instruct-v0.2-q4f16_1-MLC/resolve/main/",
          local_id: "Mistral-7B-Instruct-v0.2-q4f16_1",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Mistral-7B-Instruct-v0.2/Mistral-7B-Instruct-v0.2-q4f16_1-sw4k_cs1k-webgpu.wasm",
          required_features: ["shader-f16"]
        }, {
          model_url: "https://huggingface.co/mlc-ai/OpenHermes-2.5-Mistral-7B-q4f16_1-MLC/resolve/main/",
          local_id: "OpenHermes-2.5-Mistral-7B-q4f16_1",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Mistral-7B-Instruct-v0.2/Mistral-7B-Instruct-v0.2-q4f16_1-sw4k_cs1k-webgpu.wasm",
          required_features: ["shader-f16"]
        }, {
          model_url: "https://huggingface.co/mlc-ai/NeuralHermes-2.5-Mistral-7B-q4f16_1-MLC/resolve/main/",
          local_id: "NeuralHermes-2.5-Mistral-7B-q4f16_1",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Mistral-7B-Instruct-v0.2/Mistral-7B-Instruct-v0.2-q4f16_1-sw4k_cs1k-webgpu.wasm",
          required_features: ["shader-f16"]
        },
        // Models below fit for 128MB buffer limit (e.g. webgpu on Android)
        {
          model_url: "https://huggingface.co/mlc-ai/Llama-2-7b-chat-hf-q4f16_1-MLC/resolve/main/",
          local_id: "Llama-2-7b-chat-hf-q4f16_1-1k",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Llama-2-7b-chat-hf/Llama-2-7b-chat-hf-q4f16_1-ctx1k-webgpu.wasm",
          required_features: ["shader-f16"]
        }, {
          model_url: "https://huggingface.co/mlc-ai/RedPajama-INCITE-Chat-3B-v1-q4f16_1-MLC/resolve/main/",
          local_id: "RedPajama-INCITE-Chat-3B-v1-q4f16_1-1k",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/RedPajama-INCITE-Chat-3B-v1/RedPajama-INCITE-Chat-3B-v1-q4f16_1-ctx1k-webgpu.wasm",
          required_features: ["shader-f16"]
        }, {
          model_url: "https://huggingface.co/mlc-ai/RedPajama-INCITE-Chat-3B-v1-q4f32_1-MLC/resolve/main/",
          local_id: "RedPajama-INCITE-Chat-3B-v1-q4f32_1-1k",
          model_lib_url: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/RedPajama-INCITE-Chat-3B-v1/RedPajama-INCITE-Chat-3B-v1-q4f32_1-ctx1k-webgpu.wasm"
        }],
        use_web_worker: !0
      },
      et = /*#__PURE__*/function (_Le2) {
        _inherits(M, _Le2);
        var _super3 = _createSuper(M);
        function M(e) {
          var _this8;
          _classCallCheck(this, M);
          var t, i;
          _this8 = _super3.call(this, e), _this8._isModelLoaded = !1, _this8._isModelLoading = !1, _this8._loadOnFirstMessage = !1, _this8._webModel = {}, _this8.permittedErrorPrefixes = [M.MULTIPLE_MODELS_ERROR, M.WEB_LLM_NOT_FOUND_ERROR, M.GENERIC_ERROR], _this8._conversationHistory = [], _typeof(e.webModel) == "object" && (_this8._webModel = e.webModel), (t = _this8._webModel.load) != null && t.clearCache && M.clearAllCache(), _this8.findModelInWindow(e), _this8.canSendMessage = _this8.canSubmit.bind(_assertThisInitialized(_this8)), _this8._chatEl = (i = e.shadowRoot) == null ? void 0 : i.children[0], e.initialMessages && M.setUpHistory(_this8._conversationHistory, e.initialMessages);
          return _this8;
        }
        // need ref of messages object as web model exhibits unique behaviour to manipulate chat
        _createClass(M, [{
          key: "setUpMessages",
          value: function setUpMessages(e) {
            var _this9 = this;
            this._messages = e, this._removeIntro = function () {
              e.removeIntroductoryMessage(), _this9._removeIntro = void 0;
            };
          }
        }, {
          key: "findModelInWindow",
          value: function findModelInWindow(e) {
            var _this10 = this;
            var t = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
            var i;
            window.webLLM ? this.configureInit(this.shouldAddInitialMessage(e.introMessage)) : t > M.MODULE_SEARCH_LIMIT_S ? ((i = this._messages) == null || i.addNewErrorMessage("service", M.WEB_LLM_NOT_FOUND_ERROR), console.error("The deep-chat-web-llm module has not been attached to the window object. Please see the following guide:"), console.error("https://deepchat.dev/examples/externalModules")) : setTimeout(function () {
              return _this10.findModelInWindow(e, t + 1);
            }, 1e3);
          }
        }, {
          key: "shouldAddInitialMessage",
          value: function shouldAddInitialMessage(e) {
            var t;
            return !e && this._webModel && ((t = this._webModel.introMessage) == null ? void 0 : t.displayed) !== !1;
          }
        }, {
          key: "scrollToTop",
          value: function scrollToTop(e) {
            var _this11 = this;
            var t;
            ((t = this._webModel.introMessage) == null ? void 0 : t.autoScroll) !== !1 && setTimeout(function () {
              var i, n;
              (i = _this11._messages) != null && i.elementRef && Y.scrollToTop((n = _this11._messages) == null ? void 0 : n.elementRef);
            }, e);
          }
          // prettier-ignore
        }, {
          key: "getIntroMessage",
          value: function getIntroMessage(e) {
            if (!this.shouldAddInitialMessage(e) || !this._chatEl) return;
            var t = xn.setUpInitial(this.init.bind(this), this._webModel.introMessage, this._chatEl, !!this._webModel.worker);
            return this.scrollToTop(1), {
              role: v.AI_ROLE,
              html: t,
              sendUpdate: !1
            };
          }
        }, {
          key: "configureInit",
          value: function () {
            var _configureInit = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee23(e) {
              var t;
              return _regeneratorRuntime().wrap(function _callee23$(_context23) {
                while (1) switch (_context23.prev = _context23.next) {
                  case 0:
                    t = this._webModel.load;
                    if (!t) {
                      _context23.next = 8;
                      break;
                    }
                    if (!t.onInit) {
                      _context23.next = 5;
                      break;
                    }
                    this.init();
                    return _context23.abrupt("return");
                  case 5:
                    if (!t.onMessage) {
                      _context23.next = 8;
                      break;
                    }
                    this._loadOnFirstMessage = !0;
                    return _context23.abrupt("return");
                  case 8:
                    e || this.init();
                  case 9:
                  case "end":
                    return _context23.stop();
                }
              }, _callee23, this);
            }));
            function configureInit(_x45) {
              return _configureInit.apply(this, arguments);
            }
            return configureInit;
          }()
        }, {
          key: "init",
          value: function () {
            var _init = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee24(e) {
              var i, t;
              return _regeneratorRuntime().wrap(function _callee24$(_context24) {
                while (1) switch (_context24.prev = _context24.next) {
                  case 0:
                    (i = this._messages) == null || i.removeError();
                    t = this.attemptToCreateChat();
                    _context24.t0 = t;
                    if (!_context24.t0) {
                      _context24.next = 6;
                      break;
                    }
                    _context24.next = 6;
                    return this.loadModel(t, e);
                  case 6:
                  case "end":
                    return _context24.stop();
                }
              }, _callee24, this);
            }));
            function init(_x46) {
              return _init.apply(this, arguments);
            }
            return init;
          }()
        }, {
          key: "attemptToCreateChat",
          value: function attemptToCreateChat() {
            var t;
            if (M.chat) {
              (t = this._messages) == null || t.addNewErrorMessage("service", M.MULTIPLE_MODELS_ERROR), console.error(M.MULTIPLE_MODELS_ERROR);
              return;
            }
            if (this._isModelLoaded || this._isModelLoading) return;
            var e = this._webModel.worker;
            return En.use_web_worker && e ? new window.webLLM.ChatWorkerClient(e) : new window.webLLM.ChatModule();
          }
        }, {
          key: "getConfig",
          value: function getConfig() {
            var i;
            var e = M.DEFAULT_MODEL;
            this._webModel.model && (e = this._webModel.model);
            var t = JSON.parse(JSON.stringify(En));
            if (this._webModel.urls) {
              var n = t.model_list.find(function (r) {
                return r.local_id = e;
              });
              n && (this._webModel.urls.model && (n.model_url = this._webModel.urls.model), this._webModel.urls.wasm && (n.model_lib_url = this._webModel.urls.wasm));
            }
            return (i = this._webModel.load) != null && i.skipCache && (t.use_cache = !1), {
              model: e,
              appConfig: t
            };
          }
          // prettier-ignore
        }, {
          key: "loadModel",
          value: function () {
            var _loadModel = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee25(e, t) {
              var _this12 = this;
              var o, a, l, c, d, i, n, r, _this$getConfig, u, h, p, _u;
              return _regeneratorRuntime().wrap(function _callee25$(_context25) {
                while (1) switch (_context25.prev = _context25.next) {
                  case 0:
                    this.scrollToTop(), M.chat = e, this._isModelLoading = !0;
                    i = ((o = this._webModel.introMessage) == null ? void 0 : o.displayed) === !1;
                    n = function n(u) {
                      var h;
                      (h = _this12._messages) == null || h.addNewMessage({
                        html: "<div>".concat(u.text, "</div>"),
                        overwrite: !0,
                        sendUpdate: !1
                      }), i && (setTimeout(function () {
                        var p;
                        return Y.scrollToBottom((p = _this12._messages) == null ? void 0 : p.elementRef);
                      }), i = !1);
                    };
                    M.chat.setInitProgressCallback(n);
                    _context25.prev = 4;
                    _this$getConfig = this.getConfig(), u = _this$getConfig.model, h = _this$getConfig.appConfig, p = {};
                    this._webModel.instruction && (p.conv_config = {
                      system: this._webModel.instruction
                    });
                    this._conversationHistory.length > 0 && (p.conversation_history = this._conversationHistory);
                    _context25.next = 10;
                    return M.chat.reload(u, p, h, t);
                  case 10:
                    r = _context25.sent;
                    _context25.next = 16;
                    break;
                  case 13:
                    _context25.prev = 13;
                    _context25.t0 = _context25["catch"](4);
                    return _context25.abrupt("return", this.unloadChat(_context25.t0));
                  case 16:
                    if ((a = this._webModel.introMessage) != null && a.removeAfterLoad) this._webModel.introMessage.displayed === !1 ? (c = this._messages) == null || c.removeLastMessage() : (d = this._removeIntro) == null || d.call(this);else {
                      _u = xn.setUpAfterLoad(r, this._webModel.introMessage, this._chatEl, !!this._webModel.worker);
                      (l = this._messages) == null || l.addNewMessage({
                        html: _u,
                        overwrite: !0,
                        sendUpdate: !1
                      });
                    }
                    this._isModelLoaded = !0, this._isModelLoading = !1;
                  case 18:
                  case "end":
                    return _context25.stop();
                }
              }, _callee25, this, [[4, 13]]);
            }));
            function loadModel(_x47, _x48) {
              return _loadModel.apply(this, arguments);
            }
            return loadModel;
          }()
        }, {
          key: "unloadChat",
          value: function () {
            var _unloadChat = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee26(e) {
              var t;
              return _regeneratorRuntime().wrap(function _callee26$(_context26) {
                while (1) switch (_context26.prev = _context26.next) {
                  case 0:
                    (t = this._messages) == null || t.addNewErrorMessage("service", M.GENERIC_ERROR);
                    console.error(e);
                    this._isModelLoaded = !1;
                    this._isModelLoading = !1;
                    _context26.t0 = M.chat;
                    if (!_context26.t0) {
                      _context26.next = 9;
                      break;
                    }
                    _context26.next = 8;
                    return M.chat.unload();
                  case 8:
                    M.chat = void 0;
                  case 9:
                  case "end":
                    return _context26.stop();
                }
              }, _callee26, this);
            }));
            function unloadChat(_x49) {
              return _unloadChat.apply(this, arguments);
            }
            return unloadChat;
          }()
        }, {
          key: "immediateResp",
          value: function () {
            var _immediateResp = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee27(e, t, i) {
              var n, r;
              return _regeneratorRuntime().wrap(function _callee27$(_context27) {
                while (1) switch (_context27.prev = _context27.next) {
                  case 0:
                    _context27.next = 2;
                    return i.generate(t, void 0, 0);
                  case 2:
                    _context27.t0 = _context27.sent;
                    n = {
                      text: _context27.t0
                    };
                    _context27.next = 6;
                    return M.processResponse(this.deepChat, e, n);
                  case 6:
                    r = _context27.sent;
                    r && e.addNewMessage(r), this.completionsHandlers.onFinish();
                  case 8:
                  case "end":
                    return _context27.stop();
                }
              }, _callee27, this);
            }));
            function immediateResp(_x50, _x51, _x52) {
              return _immediateResp.apply(this, arguments);
            }
            return immediateResp;
          }()
        }, {
          key: "streamResp",
          value: function () {
            var _streamResp = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee29(e, t, i) {
              var _this13 = this;
              var n;
              return _regeneratorRuntime().wrap(function _callee29$(_context29) {
                while (1) switch (_context29.prev = _context29.next) {
                  case 0:
                    this.streamHandlers.abortStream.abort = function () {
                      i.interruptGenerate();
                    }, this.streamHandlers.onOpen();
                    n = new Ze(e);
                    _context29.next = 4;
                    return i.generate(t, /*#__PURE__*/function () {
                      var _ref7 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee28(r, o) {
                        var a;
                        return _regeneratorRuntime().wrap(function _callee28$(_context28) {
                          while (1) switch (_context28.prev = _context28.next) {
                            case 0:
                              _context28.next = 2;
                              return M.processResponse(_this13.deepChat, e, {
                                text: o
                              });
                            case 2:
                              a = _context28.sent;
                              a && n.upsertStreamedMessage({
                                text: a.text,
                                overwrite: !0
                              });
                            case 4:
                            case "end":
                              return _context28.stop();
                          }
                        }, _callee28);
                      }));
                      return function (_x56, _x57) {
                        return _ref7.apply(this, arguments);
                      };
                    }());
                  case 4:
                    n.finaliseStreamedMessage();
                    this.streamHandlers.onClose();
                  case 6:
                  case "end":
                    return _context29.stop();
                }
              }, _callee29, this);
            }));
            function streamResp(_x53, _x54, _x55) {
              return _streamResp.apply(this, arguments);
            }
            return streamResp;
          }()
        }, {
          key: "generateRespByType",
          value: function () {
            var _generateRespByType = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee30(e, t, i, n) {
              var r;
              return _regeneratorRuntime().wrap(function _callee30$(_context30) {
                while (1) switch (_context30.prev = _context30.next) {
                  case 0:
                    _context30.prev = 0;
                    if (!i) {
                      _context30.next = 6;
                      break;
                    }
                    _context30.next = 4;
                    return this.streamResp(e, t, n);
                  case 4:
                    _context30.next = 8;
                    break;
                  case 6:
                    _context30.next = 8;
                    return this.immediateResp(e, t, n);
                  case 8:
                    _context30.next = 13;
                    break;
                  case 10:
                    _context30.prev = 10;
                    _context30.t0 = _context30["catch"](0);
                    (r = this._messages) == null || r.addNewErrorMessage("service"), console.log(_context30.t0);
                  case 13:
                  case "end":
                    return _context30.stop();
                }
              }, _callee30, this, [[0, 10]]);
            }));
            function generateRespByType(_x58, _x59, _x60, _x61) {
              return _generateRespByType.apply(this, arguments);
            }
            return generateRespByType;
          }()
        }, {
          key: "generateResp",
          value: function () {
            var _generateResp = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee31(e, t, i) {
              var n, _yield$E$processReque5, r, o, a, l, c;
              return _regeneratorRuntime().wrap(function _callee31$(_context31) {
                while (1) switch (_context31.prev = _context31.next) {
                  case 0:
                    n = t[t.length - 1].text;
                    _context31.next = 3;
                    return E.processRequestInterceptor(this.deepChat, {
                      body: {
                        text: n
                      }
                    });
                  case 3:
                    _yield$E$processReque5 = _context31.sent;
                    r = _yield$E$processReque5.body;
                    o = _yield$E$processReque5.error;
                    a = !!this.deepChat.stream;
                    try {
                      if (o) E.displayError(e, new Error(o)), (a ? this.streamHandlers.onClose : this.completionsHandlers.onFinish)();else if (!r || !r.text) {
                        l = C.INVALID_MODEL_REQUEST({
                          body: r
                        }, !1);
                        console.error(l);
                        c = a ? this.streamHandlers.onClose : this.completionsHandlers.onFinish;
                        E.onInterceptorError(e, l, c);
                      } else this.generateRespByType(e, r.text, !!this.deepChat.stream, i);
                    } catch (l) {
                      this.unloadChat(l);
                    }
                  case 8:
                  case "end":
                    return _context31.stop();
                }
              }, _callee31, this);
            }));
            function generateResp(_x62, _x63, _x64) {
              return _generateResp.apply(this, arguments);
            }
            return generateResp;
          }()
        }, {
          key: "callServiceAPI",
          value: function () {
            var _callServiceAPI2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee32(e, t) {
              var i, n;
              return _regeneratorRuntime().wrap(function _callee32$(_context32) {
                while (1) switch (_context32.prev = _context32.next) {
                  case 0:
                    if (this._isModelLoaded) {
                      _context32.next = 7;
                      break;
                    }
                    if (!this._loadOnFirstMessage) {
                      _context32.next = 6;
                      break;
                    }
                    _context32.next = 4;
                    return this.init();
                  case 4:
                    _context32.next = 7;
                    break;
                  case 6:
                    return _context32.abrupt("return");
                  case 7:
                    !M.chat || this._isModelLoading || ((i = this._webModel.introMessage) != null && i.removeAfterMessage && ((n = this._removeIntro) == null || n.call(this)), e.addLoadingMessage(), this.generateResp(e, t, M.chat));
                  case 8:
                  case "end":
                    return _context32.stop();
                }
              }, _callee32, this);
            }));
            function callServiceAPI(_x65, _x66) {
              return _callServiceAPI2.apply(this, arguments);
            }
            return callServiceAPI;
          }()
        }, {
          key: "canSubmit",
          value: function canSubmit(e) {
            return !(e != null && e.trim()) || this._isModelLoading ? !1 : this._loadOnFirstMessage ? !0 : !!this._isModelLoaded;
          }
        }, {
          key: "isWebModel",
          value: function isWebModel() {
            return !0;
          }
        }], [{
          key: "setUpHistory",
          value: function setUpHistory(e, t) {
            t.forEach(function (i, n) {
              if (i.role === v.USER_ROLE && i.text) {
                var r = t[n + 1];
                r != null && r.text && r.role !== v.USER_ROLE && e.push([i.text, r.text]);
              }
            });
          }
        }, {
          key: "processResponse",
          value: function () {
            var _processResponse = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee33(e, t, i) {
              var r, n, o;
              return _regeneratorRuntime().wrap(function _callee33$(_context33) {
                while (1) switch (_context33.prev = _context33.next) {
                  case 0:
                    _context33.next = 2;
                    return (r = e.responseInterceptor) == null ? void 0 : r.call(e, i);
                  case 2:
                    _context33.t0 = _context33.sent;
                    if (_context33.t0) {
                      _context33.next = 5;
                      break;
                    }
                    _context33.t0 = i;
                  case 5:
                    n = _context33.t0;
                    if (!n.error) {
                      _context33.next = 11;
                      break;
                    }
                    E.displayError(t, new Error(n.error));
                    return _context33.abrupt("return");
                  case 11:
                    if (!(!n || !n.text)) {
                      _context33.next = 15;
                      break;
                    }
                    o = C.INVALID_MODEL_RESPONSE(i, !!e.responseInterceptor, n);
                    E.displayError(t, new Error(o));
                    return _context33.abrupt("return");
                  case 15:
                    return _context33.abrupt("return", n);
                  case 16:
                  case "end":
                    return _context33.stop();
                }
              }, _callee33);
            }));
            function processResponse(_x67, _x68, _x69) {
              return _processResponse.apply(this, arguments);
            }
            return processResponse;
          }()
        }, {
          key: "clearAllCache",
          value: function clearAllCache() {
            M.clearCache("webllm/model"), M.clearCache("webllm/wasm");
          }
        }, {
          key: "clearCache",
          value: function clearCache(e) {
            caches.open(e).then(function (t) {
              t.keys().then(function (i) {
                i.forEach(function (n) {
                  t["delete"](n);
                });
              });
            });
          }
        }]);
        return M;
      }(Le);
    et.GENERIC_ERROR = "Error, please check the [troubleshooting](https://deepchat.dev/docs/webModel#troubleshooting) section of documentation for help.";
    et.MULTIPLE_MODELS_ERROR = "Cannot run multiple web models";
    et.WEB_LLM_NOT_FOUND_ERROR = "WebLLM module not found";
    et.DEFAULT_MODEL = "Llama-2-7b-chat-hf-q4f32_1";
    et.MODULE_SEARCH_LIMIT_S = 5;
    var $i = et;
    var Bt = /*#__PURE__*/function () {
      function Bt() {
        _classCallCheck(this, Bt);
      }
      _createClass(Bt, null, [{
        key: "buildHeaders",
        value: function buildHeaders(e) {
          return {
            Authorization: "Bearer ".concat(e),
            "Content-Type": "application/json"
            // bigcode/santacoder expects this so adding just-in-case
          };
        }
        // prettier-ignore
      }, {
        key: "handleVerificationResult",
        value: function handleVerificationResult(e, t, i, n) {
          var r = e;
          Array.isArray(r.error) && r.error[0] === "Error in `parameters`: field required" ? i(t) : n(C.INVALID_KEY);
        }
      }, {
        key: "buildKeyVerificationDetails",
        value: function buildKeyVerificationDetails() {
          return {
            url: "https://api-inference.huggingface.co/models/gpt2",
            method: "POST",
            handleVerificationResult: Bt.handleVerificationResult
          };
        }
      }]);
      return Bt;
    }();
    var os = /*#__PURE__*/function (_U) {
      _inherits(ji, _U);
      var _super4 = _createSuper(ji);
      // prettier-ignore
      function ji(e, t, i, n, r, o) {
        var _this14;
        _classCallCheck(this, ji);
        _this14 = _super4.call(this, e, Bt.buildKeyVerificationDetails(), Bt.buildHeaders, r, o), _this14.insertKeyPlaceholderText = "Hugging Face Token", _this14.getKeyLink = "https://huggingface.co/settings/tokens", _this14.introPanelMarkUp = "\n    <div style=\"width: 100%; text-align: center; margin-left: -10px\"><b>Hugging Face</b></div>\n    <p>First message may take an extented amount of time to complete as the model needs to be initialized.</p>", _this14.permittedErrorPrefixes = ["Authorization header"], _this14.url = "".concat(ji.URL_PREFIX).concat(i), _this14.textInputPlaceholderText = t, _typeof(n) == "object" && (n.model && (_this14.url = "".concat(ji.URL_PREFIX).concat(n.model)), n.options && (_this14.rawBody.options = n.options), n.parameters && (_this14.rawBody.parameters = n.parameters));
        return _this14;
      }
      // prettier-ignore
      _createClass(ji, [{
        key: "preprocessBody",
        value: function preprocessBody(e, t, i) {
          var _n$options;
          var n = JSON.parse(JSON.stringify(e)),
            r = t[t.length - 1].text;
          if (r) return (_n$options = n.options) !== null && _n$options !== void 0 ? _n$options : n.options = {}, n.options.wait_for_model = !0, _objectSpread({
            inputs: r
          }, n);
        }
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI3 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee34(e, t, i) {
            var n;
            return _regeneratorRuntime().wrap(function _callee34$(_context34) {
              while (1) switch (_context34.prev = _context34.next) {
                case 0:
                  if (this.requestSettings) {
                    _context34.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  n = this.preprocessBody(this.rawBody, t, i);
                  _.request(this, n, e);
                case 4:
                case "end":
                  return _context34.stop();
              }
            }, _callee34, this);
          }));
          function callServiceAPI(_x70, _x71, _x72) {
            return _callServiceAPI3.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }]);
      return ji;
    }(U);
    os.URL_PREFIX = "https://api-inference.huggingface.co/models/";
    var Pe = os;
    var xt = /*#__PURE__*/function (_Pe) {
      _inherits(xt, _Pe);
      var _super5 = _createSuper(xt);
      // prettier-ignore
      function xt(e, t, i, n, r, o) {
        var _this15;
        _classCallCheck(this, xt);
        _this15 = _super5.call(this, e, t, i, n, r, o), _this15.isTextInputDisabled = !0, _this15.canSendMessage = xt.canSendFile;
        return _this15;
      }
      _createClass(xt, [{
        key: "preprocessBody",
        value: function preprocessBody(e, t, i) {
          return i[0];
        }
        // prettier-ignore
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI4 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee35(e, t, i) {
            return _regeneratorRuntime().wrap(function _callee35$(_context35) {
              while (1) switch (_context35.prev = _context35.next) {
                case 0:
                  if (this.requestSettings) {
                    _context35.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  if (i != null && i[0]) {
                    _context35.next = 4;
                    break;
                  }
                  throw new Error("No file was added");
                case 4:
                  _.poll(this, i[0], e, !1);
                case 5:
                case "end":
                  return _context35.stop();
              }
            }, _callee35, this);
          }));
          function callServiceAPI(_x73, _x74, _x75) {
            return _callServiceAPI4.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }], [{
        key: "canSendFile",
        value: function canSendFile(e, t) {
          return !!(t != null && t[0]);
        }
      }]);
      return xt;
    }(Pe);
    var So = /*#__PURE__*/function (_xt) {
      _inherits(So, _xt);
      var _super6 = _createSuper(So);
      // prettier-ignore
      function So(e) {
        _classCallCheck(this, So);
        var n, r, o;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.huggingFace) == null ? void 0 : r.audioClassification,
          i = (o = e.directConnection) == null ? void 0 : o.huggingFace;
        return _super6.call(this, e, "Attach an audio file", "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition", t, i, {
          audio: {}
        });
      }
      _createClass(So, [{
        key: "extractPollResultData",
        value: function () {
          var _extractPollResultData = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee36(e) {
            var t;
            return _regeneratorRuntime().wrap(function _callee36$(_context36) {
              while (1) switch (_context36.prev = _context36.next) {
                case 0:
                  if (!e.estimated_time) {
                    _context36.next = 2;
                    break;
                  }
                  return _context36.abrupt("return", {
                    timeoutMS: (e.estimated_time + 1) * 1e3
                  });
                case 2:
                  if (!e.error) {
                    _context36.next = 4;
                    break;
                  }
                  throw e.error;
                case 4:
                  return _context36.abrupt("return", {
                    text: ((t = e[0]) == null ? void 0 : t.label) || ""
                  });
                case 5:
                case "end":
                  return _context36.stop();
              }
            }, _callee36);
          }));
          function extractPollResultData(_x76) {
            return _extractPollResultData.apply(this, arguments);
          }
          return extractPollResultData;
        }()
      }]);
      return So;
    }(xt);
    var wo = /*#__PURE__*/function (_xt2) {
      _inherits(wo, _xt2);
      var _super7 = _createSuper(wo);
      function wo(e) {
        _classCallCheck(this, wo);
        var n, r, o;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.huggingFace) == null ? void 0 : r.imageClassification,
          i = (o = e.directConnection) == null ? void 0 : o.huggingFace;
        return _super7.call(this, e, "Attach an image file", "google/vit-base-patch16-224", t, i, {
          images: {}
        });
      }
      _createClass(wo, [{
        key: "extractPollResultData",
        value: function () {
          var _extractPollResultData2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee37(e) {
            var t;
            return _regeneratorRuntime().wrap(function _callee37$(_context37) {
              while (1) switch (_context37.prev = _context37.next) {
                case 0:
                  if (!e.estimated_time) {
                    _context37.next = 2;
                    break;
                  }
                  return _context37.abrupt("return", {
                    timeoutMS: (e.estimated_time + 1) * 1e3
                  });
                case 2:
                  if (!e.error) {
                    _context37.next = 4;
                    break;
                  }
                  throw e.error;
                case 4:
                  return _context37.abrupt("return", {
                    text: ((t = e[0]) == null ? void 0 : t.label) || ""
                  });
                case 5:
                case "end":
                  return _context37.stop();
              }
            }, _callee37);
          }));
          function extractPollResultData(_x77) {
            return _extractPollResultData2.apply(this, arguments);
          }
          return extractPollResultData;
        }()
      }]);
      return wo;
    }(xt);
    var Et = "data:image/png;base64,";
    var re = /*#__PURE__*/function () {
      function re() {
        _classCallCheck(this, re);
      }
      _createClass(re, null, [{
        key: "buildHeaders",
        value: function buildHeaders(e) {
          return {
            Authorization: "Bearer ".concat(e),
            "Content-Type": "application/json"
          };
        }
        // prettier-ignore
      }, {
        key: "handleVerificationResult",
        value: function handleVerificationResult(e, t, i, n) {
          e.message ? n(C.INVALID_KEY) : i(t);
        }
      }, {
        key: "buildKeyVerificationDetails",
        value: function buildKeyVerificationDetails() {
          return {
            url: "https://api.stability.ai/v1/engines/list",
            method: "GET",
            handleVerificationResult: re.handleVerificationResult
          };
        }
      }]);
      return re;
    }();
    var ni = /*#__PURE__*/function (_U2) {
      _inherits(ni, _U2);
      var _super8 = _createSuper(ni);
      // prettier-ignore
      function ni(e, t, i, n, r) {
        var _this16;
        _classCallCheck(this, ni);
        _this16 = _super8.call(this, e, t, i, n, r), _this16.insertKeyPlaceholderText = "Stability AI API Key", _this16.getKeyLink = "https://platform.stability.ai/docs/getting-started/authentication", _this16.permittedErrorPrefixes = ["Incorrect", "invalid_"];
        return _this16;
      }
      return _createClass(ni);
    }(U);
    var zt = /*#__PURE__*/function (_ni) {
      _inherits(zt, _ni);
      var _super9 = _createSuper(zt);
      function zt(e) {
        var _this17;
        _classCallCheck(this, zt);
        var o;
        var t = JSON.parse(JSON.stringify(e.directConnection)),
          i = t == null ? void 0 : t.stabilityAI,
          n = {
            images: {
              files: {
                acceptedFormats: ".png",
                maxNumberOfFiles: 1
              }
            }
          };
        _this17 = _super9.call(this, e, re.buildKeyVerificationDetails(), re.buildHeaders, i, n), _this17.url = "https://api.stability.ai/v1/generation/esrgan-v1-x2plus/image-to-image/upscale", _this17.textInputPlaceholderText = "Describe image changes", _this17.introPanelMarkUp = "\n    <div style=\"width: 100%; text-align: center; margin-left: -10px\"><b>Stability AI</b></div>\n    <div style=\"width: 100%; text-align: center; margin-left: -10px; margin-top: 5px\"><b>Image to Image Upscale</b></div>\n    <p>Upload an image to generate a new one with higher resolution.</p>\n    <p>Click <a href=\"https://platform.stability.ai/\">here</a> for more info.</p>";
        var r = (o = t == null ? void 0 : t.stabilityAI) == null ? void 0 : o.imageToImageUpscale;
        _typeof(r) == "object" && (r.engine_id && (_this17.url = "https://api.stability.ai/v1/generation/".concat(r.engine_id, "/image-to-image/upscale")), zt.cleanConfig(r), Object.assign(_this17.rawBody, r)), _this17.canSendMessage = zt.canSendFileMessage;
        return _this17;
      }
      _createClass(zt, [{
        key: "createFormDataBody",
        value: function createFormDataBody(e, t) {
          var i = new FormData();
          return i.append("image", t), Object.keys(e).forEach(function (n) {
            i.append(n, String(e[n]));
          }), i;
        }
        // prettier-ignore
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI5 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee38(e, t, i) {
            var n;
            return _regeneratorRuntime().wrap(function _callee38$(_context38) {
              while (1) switch (_context38.prev = _context38.next) {
                case 0:
                  if (this.requestSettings) {
                    _context38.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  if (i) {
                    _context38.next = 4;
                    break;
                  }
                  throw new Error("Image was not found");
                case 4:
                  n = this.createFormDataBody(this.rawBody, i[0]);
                  E.tempRemoveContentHeader(this.requestSettings, _.request.bind(this, this, n, e), !1);
                case 6:
                case "end":
                  return _context38.stop();
              }
            }, _callee38, this);
          }));
          function callServiceAPI(_x78, _x79, _x80) {
            return _callServiceAPI5.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee39(e) {
            return _regeneratorRuntime().wrap(function _callee39$(_context39) {
              while (1) switch (_context39.prev = _context39.next) {
                case 0:
                  if (!e.message) {
                    _context39.next = 2;
                    break;
                  }
                  throw e.message;
                case 2:
                  return _context39.abrupt("return", {
                    files: e.artifacts.map(function (i) {
                      return {
                        src: "".concat(Et).concat(i.base64),
                        type: "image"
                      };
                    })
                  });
                case 3:
                case "end":
                  return _context39.stop();
              }
            }, _callee39);
          }));
          function extractResultData(_x81) {
            return _extractResultData2.apply(this, arguments);
          }
          return extractResultData;
        }()
      }], [{
        key: "cleanConfig",
        value: function cleanConfig(e) {
          delete e.engine_id;
        }
      }, {
        key: "canSendFileMessage",
        value: function canSendFileMessage(e, t) {
          return !!(t != null && t[0]);
        }
      }]);
      return zt;
    }(ni);
    var Ut = /*#__PURE__*/function (_ni2) {
      _inherits(Ut, _ni2);
      var _super10 = _createSuper(Ut);
      function Ut(e) {
        var _this18;
        _classCallCheck(this, Ut);
        var o;
        var t = JSON.parse(JSON.stringify(e.directConnection)),
          i = t == null ? void 0 : t.stabilityAI,
          n = {
            images: {
              files: {
                acceptedFormats: ".png",
                maxNumberOfFiles: 2
              }
            }
          };
        _this18 = _super10.call(this, e, re.buildKeyVerificationDetails(), re.buildHeaders, i, n), _this18.url = "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image/masking", _this18._maskSource = "MASK_IMAGE_WHITE", _this18.textInputPlaceholderText = "Describe image changes", _this18.introPanelMarkUp = "\n    <div style=\"width: 100%; text-align: center; margin-left: -10px\"><b>Stability AI</b></div>\n    <div style=\"width: 100%; text-align: center; margin-left: -10px; margin-top: 5px\"><b>Image to Image Masking</b></div>\n    <p>Upload an image, its mask image to create a new one based on the changes you have described for the mask area.</p>\n    <p>Click <a href=\"https://platform.stability.ai/\">here</a> for more info.</p>";
        var r = (o = t == null ? void 0 : t.stabilityAI) == null ? void 0 : o.imageToImageMasking;
        _typeof(r) == "object" && (r.engine_id && (_this18.url = "https://api.stability.ai/v1/generation/".concat(r.engine_id, "/image-to-image/masking")), r.weight !== void 0 && r.weight !== null && (_this18._imageWeight = r.weight), r.mask_source !== void 0 && r.mask_source !== null && (_this18._maskSource = r.mask_source), Ut.cleanConfig(r), Object.assign(_this18.rawBody, r)), _this18.canSendMessage = Ut.canSendFileTextMessage;
        return _this18;
      }
      _createClass(Ut, [{
        key: "createFormDataBody",
        value: function createFormDataBody(e, t, i, n) {
          var r = new FormData();
          return r.append("init_image", t), r.append("mask_source", String(this._maskSource)), r.append("mask_image", i), n && n !== "" && r.append("text_prompts[0][text]", n), this._imageWeight !== void 0 && this._imageWeight !== null && r.append("text_prompts[0][weight]", String(this._imageWeight)), Object.keys(e).forEach(function (o) {
            r.append(o, String(e[o]));
          }), r.get("weight") === void 0 && r.append("weight", String(1)), r;
        }
        // prettier-ignore
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI6 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee40(e, t, i) {
            var o, a, n, r;
            return _regeneratorRuntime().wrap(function _callee40$(_context40) {
              while (1) switch (_context40.prev = _context40.next) {
                case 0:
                  if (this.requestSettings) {
                    _context40.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  if (!(!i || !i[0] || !i[1])) {
                    _context40.next = 4;
                    break;
                  }
                  throw new Error("Image was not found");
                case 4:
                  n = (a = (o = t[t.length - 1]) == null ? void 0 : o.text) == null ? void 0 : a.trim(), r = this.createFormDataBody(this.rawBody, i[0], i[1], n);
                  E.tempRemoveContentHeader(this.requestSettings, _.request.bind(this, this, r, e), !1);
                case 6:
                case "end":
                  return _context40.stop();
              }
            }, _callee40, this);
          }));
          function callServiceAPI(_x82, _x83, _x84) {
            return _callServiceAPI6.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData3 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee41(e) {
            return _regeneratorRuntime().wrap(function _callee41$(_context41) {
              while (1) switch (_context41.prev = _context41.next) {
                case 0:
                  if (!e.message) {
                    _context41.next = 2;
                    break;
                  }
                  throw e.message;
                case 2:
                  return _context41.abrupt("return", {
                    files: e.artifacts.map(function (i) {
                      return {
                        src: "".concat(Et).concat(i.base64),
                        type: "image"
                      };
                    })
                  });
                case 3:
                case "end":
                  return _context41.stop();
              }
            }, _callee41);
          }));
          function extractResultData(_x85) {
            return _extractResultData3.apply(this, arguments);
          }
          return extractResultData;
        }()
      }], [{
        key: "cleanConfig",
        value: function cleanConfig(e) {
          delete e.engine_id, delete e.weight;
        }
      }, {
        key: "canSendFileTextMessage",
        value: function canSendFileTextMessage(e, t) {
          return !!(t != null && t[0]) && !!(e && e.trim() !== "");
        }
      }]);
      return Ut;
    }(ni);
    var _o = /*#__PURE__*/function (_xt3) {
      _inherits(_o, _xt3);
      var _super11 = _createSuper(_o);
      function _o(e) {
        _classCallCheck(this, _o);
        var n, r, o;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.huggingFace) == null ? void 0 : r.audioSpeechRecognition,
          i = (o = e.directConnection) == null ? void 0 : o.huggingFace;
        return _super11.call(this, e, "Attach an audio file", "facebook/wav2vec2-large-960h-lv60-self", t, i, {
          audio: {}
        });
      }
      _createClass(_o, [{
        key: "extractPollResultData",
        value: function () {
          var _extractPollResultData3 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee42(e) {
            return _regeneratorRuntime().wrap(function _callee42$(_context42) {
              while (1) switch (_context42.prev = _context42.next) {
                case 0:
                  if (!e.estimated_time) {
                    _context42.next = 2;
                    break;
                  }
                  return _context42.abrupt("return", {
                    timeoutMS: (e.estimated_time + 1) * 1e3
                  });
                case 2:
                  if (!e.error) {
                    _context42.next = 4;
                    break;
                  }
                  throw e.error;
                case 4:
                  return _context42.abrupt("return", {
                    text: e.text || ""
                  });
                case 5:
                case "end":
                  return _context42.stop();
              }
            }, _callee42);
          }));
          function extractPollResultData(_x86) {
            return _extractPollResultData3.apply(this, arguments);
          }
          return extractPollResultData;
        }()
      }]);
      return _o;
    }(xt);
    var Mo = /*#__PURE__*/function (_Pe2) {
      _inherits(Mo, _Pe2);
      var _super12 = _createSuper(Mo);
      function Mo(e) {
        _classCallCheck(this, Mo);
        var n, r, o;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.huggingFace) == null ? void 0 : r.textGeneration,
          i = (o = e.directConnection) == null ? void 0 : o.huggingFace;
        return _super12.call(this, e, "Once upon a time", "gpt2", t, i);
      }
      _createClass(Mo, [{
        key: "extractResultData",
        value: function () {
          var _extractResultData4 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee43(e) {
            return _regeneratorRuntime().wrap(function _callee43$(_context43) {
              while (1) switch (_context43.prev = _context43.next) {
                case 0:
                  if (!e.error) {
                    _context43.next = 2;
                    break;
                  }
                  throw e.error;
                case 2:
                  return _context43.abrupt("return", {
                    text: e[0].generated_text || ""
                  });
                case 3:
                case "end":
                  return _context43.stop();
              }
            }, _callee43);
          }));
          function extractResultData(_x87) {
            return _extractResultData4.apply(this, arguments);
          }
          return extractResultData;
        }()
      }]);
      return Mo;
    }(Pe);
    var To = /*#__PURE__*/function (_Pe3) {
      _inherits(To, _Pe3);
      var _super13 = _createSuper(To);
      function To(e) {
        var _this19;
        _classCallCheck(this, To);
        var n, r, o;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.huggingFace) == null ? void 0 : r.questionAnswer,
          i = (o = e.directConnection) == null ? void 0 : o.huggingFace;
        _this19 = _super13.call(this, e, "Ask a question", "bert-large-uncased-whole-word-masking-finetuned-squad", t, i), _this19.permittedErrorPrefixes = ["Authorization header", "Error in"], _this19.context = t.context;
        return _this19;
      }
      _createClass(To, [{
        key: "preprocessBody",
        value: function preprocessBody(e, t) {
          var i = t[t.length - 1].text;
          if (i) return {
            inputs: {
              question: i,
              context: this.context,
              options: {
                wait_for_model: !0
              }
            }
          };
        }
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData5 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee44(e) {
            return _regeneratorRuntime().wrap(function _callee44$(_context44) {
              while (1) switch (_context44.prev = _context44.next) {
                case 0:
                  if (!e.error) {
                    _context44.next = 2;
                    break;
                  }
                  throw e.error;
                case 2:
                  return _context44.abrupt("return", {
                    text: e.answer || ""
                  });
                case 3:
                case "end":
                  return _context44.stop();
              }
            }, _callee44);
          }));
          function extractResultData(_x88) {
            return _extractResultData5.apply(this, arguments);
          }
          return extractResultData;
        }()
      }]);
      return To;
    }(Pe);
    var Co = /*#__PURE__*/function (_Pe4) {
      _inherits(Co, _Pe4);
      var _super14 = _createSuper(Co);
      function Co(e) {
        _classCallCheck(this, Co);
        var n, r, o;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.huggingFace) == null ? void 0 : r.summarization,
          i = (o = e.directConnection) == null ? void 0 : o.huggingFace;
        return _super14.call(this, e, "Insert text to summarize", "facebook/bart-large-cnn", t, i);
      }
      _createClass(Co, [{
        key: "extractResultData",
        value: function () {
          var _extractResultData6 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee45(e) {
            return _regeneratorRuntime().wrap(function _callee45$(_context45) {
              while (1) switch (_context45.prev = _context45.next) {
                case 0:
                  if (!e.error) {
                    _context45.next = 2;
                    break;
                  }
                  throw e.error;
                case 2:
                  return _context45.abrupt("return", {
                    text: e[0].summary_text || ""
                  });
                case 3:
                case "end":
                  return _context45.stop();
              }
            }, _callee45);
          }));
          function extractResultData(_x89) {
            return _extractResultData6.apply(this, arguments);
          }
          return extractResultData;
        }()
      }]);
      return Co;
    }(Pe);
    var Ao = /*#__PURE__*/function (_Pe5) {
      _inherits(Ao, _Pe5);
      var _super15 = _createSuper(Ao);
      function Ao(e) {
        var _this20$maxMessages;
        var _this20;
        _classCallCheck(this, Ao);
        var n, r, o;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.huggingFace) == null ? void 0 : r.conversation,
          i = (o = e.directConnection) == null ? void 0 : o.huggingFace;
        _this20 = _super15.call(this, e, "Ask me anything!", "facebook/blenderbot-400M-distill", t, i), (_this20$maxMessages = _this20.maxMessages) !== null && _this20$maxMessages !== void 0 ? _this20$maxMessages : _this20.maxMessages = -1;
        return _this20;
      }
      // prettier-ignore
      _createClass(Ao, [{
        key: "processMessages",
        value: function processMessages(e) {
          var t = e.filter(function (a) {
              return a.text;
            }),
            i = t[t.length - 1].text,
            n = t.slice(0, t.length - 1);
          if (!i) return;
          var r = n.filter(function (a) {
              return a.role === "user";
            }).map(function (a) {
              return a.text;
            }),
            o = n.filter(function (a) {
              return a.role === "ai";
            }).map(function (a) {
              return a.text;
            });
          return {
            past_user_inputs: r,
            generated_responses: o,
            mostRecentMessageText: i
          };
        }
        // prettier-ignore
      }, {
        key: "preprocessBody",
        value: function preprocessBody(e, t) {
          var _i$options;
          var i = JSON.parse(JSON.stringify(e)),
            n = this.processMessages(t);
          if (n) return (_i$options = i.options) !== null && _i$options !== void 0 ? _i$options : i.options = {}, i.options.wait_for_model = !0, _objectSpread({
            inputs: {
              past_user_inputs: n.past_user_inputs,
              generated_responses: n.generated_responses,
              text: n.mostRecentMessageText
            }
          }, i);
        }
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData7 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee46(e) {
            return _regeneratorRuntime().wrap(function _callee46$(_context46) {
              while (1) switch (_context46.prev = _context46.next) {
                case 0:
                  if (!e.error) {
                    _context46.next = 2;
                    break;
                  }
                  throw e.error;
                case 2:
                  return _context46.abrupt("return", {
                    text: e.generated_text || ""
                  });
                case 3:
                case "end":
                  return _context46.stop();
              }
            }, _callee46);
          }));
          function extractResultData(_x90) {
            return _extractResultData7.apply(this, arguments);
          }
          return extractResultData;
        }()
      }]);
      return Ao;
    }(Pe);
    var qt = /*#__PURE__*/function (_ni3) {
      _inherits(qt, _ni3);
      var _super16 = _createSuper(qt);
      function qt(e) {
        var _this21;
        _classCallCheck(this, qt);
        var o;
        var t = JSON.parse(JSON.stringify(e.directConnection)),
          i = t.stabilityAI,
          n = {
            images: {
              files: {
                acceptedFormats: ".png",
                maxNumberOfFiles: 1
              }
            }
          };
        _this21 = _super16.call(this, e, re.buildKeyVerificationDetails(), re.buildHeaders, i, n), _this21.url = "https://api.stability.ai/v1/generation/stable-diffusion-v1-6/image-to-image", _this21.textInputPlaceholderText = "Describe image changes", _this21.introPanelMarkUp = "\n    <div style=\"width: 100%; text-align: center; margin-left: -10px\"><b>Stability AI: Image to Image</b></div>\n    <p>Upload an image to create a new one with the changes you have described.</p>\n    <p>Click <a href=\"https://platform.stability.ai/\">here</a> for more info.</p>";
        var r = (o = t.stabilityAI) == null ? void 0 : o.imageToImage;
        _typeof(r) == "object" && (r.engine_id && (_this21.url = "https://api.stability.ai/v1/generation/".concat(r.engine_id, "/text-to-image")), r.weight !== void 0 && r.weight !== null && (_this21._imageWeight = r.weight), qt.cleanConfig(r), Object.assign(_this21.rawBody, r)), _this21.canSendMessage = qt.canSendFileTextMessage;
        return _this21;
      }
      _createClass(qt, [{
        key: "createFormDataBody",
        value: function createFormDataBody(e, t, i) {
          var n = new FormData();
          return n.append("init_image", t), i && i !== "" && n.append("text_prompts[0][text]", i), this._imageWeight !== void 0 && this._imageWeight !== null && n.append("text_prompts[0][weight]", String(this._imageWeight)), Object.keys(e).forEach(function (r) {
            n.append(r, String(e[r]));
          }), n.get("weight") === void 0 && n.append("weight", String(1)), n;
        }
        // prettier-ignore
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI7 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee47(e, t, i) {
            var o, a, n, r;
            return _regeneratorRuntime().wrap(function _callee47$(_context47) {
              while (1) switch (_context47.prev = _context47.next) {
                case 0:
                  if (this.requestSettings) {
                    _context47.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  if (i) {
                    _context47.next = 4;
                    break;
                  }
                  throw new Error("Image was not found");
                case 4:
                  n = (a = (o = t[t.length - 1]) == null ? void 0 : o.text) == null ? void 0 : a.trim(), r = this.createFormDataBody(this.rawBody, i[0], n);
                  E.tempRemoveContentHeader(this.requestSettings, _.request.bind(this, this, r, e), !1);
                case 6:
                case "end":
                  return _context47.stop();
              }
            }, _callee47, this);
          }));
          function callServiceAPI(_x91, _x92, _x93) {
            return _callServiceAPI7.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData8 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee48(e) {
            return _regeneratorRuntime().wrap(function _callee48$(_context48) {
              while (1) switch (_context48.prev = _context48.next) {
                case 0:
                  if (!e.message) {
                    _context48.next = 2;
                    break;
                  }
                  throw e.message;
                case 2:
                  return _context48.abrupt("return", {
                    files: e.artifacts.map(function (i) {
                      return {
                        src: "".concat(Et).concat(i.base64),
                        type: "image"
                      };
                    })
                  });
                case 3:
                case "end":
                  return _context48.stop();
              }
            }, _callee48);
          }));
          function extractResultData(_x94) {
            return _extractResultData8.apply(this, arguments);
          }
          return extractResultData;
        }()
      }], [{
        key: "cleanConfig",
        value: function cleanConfig(e) {
          delete e.engine_id, delete e.weight;
        }
      }, {
        key: "canSendFileTextMessage",
        value: function canSendFileTextMessage(e, t) {
          return !!(t != null && t[0]) && !!(e && e.trim() !== "");
        }
      }]);
      return qt;
    }(ni);
    var ko = /*#__PURE__*/function (_Pe6) {
      _inherits(ko, _Pe6);
      var _super17 = _createSuper(ko);
      function ko(e) {
        _classCallCheck(this, ko);
        var n, r, o;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.huggingFace) == null ? void 0 : r.translation,
          i = (o = e.directConnection) == null ? void 0 : o.huggingFace;
        return _super17.call(this, e, "Insert text to translate", "Helsinki-NLP/opus-tatoeba-en-ja", t, i);
      }
      _createClass(ko, [{
        key: "extractResultData",
        value: function () {
          var _extractResultData9 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee49(e) {
            return _regeneratorRuntime().wrap(function _callee49$(_context49) {
              while (1) switch (_context49.prev = _context49.next) {
                case 0:
                  if (!e.error) {
                    _context49.next = 2;
                    break;
                  }
                  throw e.error;
                case 2:
                  return _context49.abrupt("return", {
                    text: e[0].translation_text || ""
                  });
                case 3:
                case "end":
                  return _context49.stop();
              }
            }, _callee49);
          }));
          function extractResultData(_x95) {
            return _extractResultData9.apply(this, arguments);
          }
          return extractResultData;
        }()
      }]);
      return ko;
    }(Pe);
    var Ht = /*#__PURE__*/function (_ni4) {
      _inherits(Ht, _ni4);
      var _super18 = _createSuper(Ht);
      function Ht(e) {
        var _this22;
        _classCallCheck(this, Ht);
        var r;
        var t = JSON.parse(JSON.stringify(e.directConnection)),
          i = t.stabilityAI;
        _this22 = _super18.call(this, e, re.buildKeyVerificationDetails(), re.buildHeaders, i), _this22.url = "https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image", _this22.textInputPlaceholderText = "Describe an image", _this22.introPanelMarkUp = "\n    <div style=\"width: 100%; text-align: center; margin-left: -10px\"><b>Stability AI: Text to Image</b></div>\n    <p>Insert text to generate an image.</p>\n    <p>Click <a href=\"https://platform.stability.ai/\">here</a> for more info.</p>";
        var n = (r = t.stabilityAI) == null ? void 0 : r.textToImage;
        _typeof(n) == "object" && (n.engine_id && (_this22.url = "https://api.stability.ai/v1/generation/".concat(n.engine_id, "/text-to-image")), n.weight !== void 0 && n.weight !== null && (_this22._imageWeight = n.weight), Ht.cleanConfig(n), Object.assign(_this22.rawBody, n)), _this22.canSendMessage = Ht.canSendTextMessage;
        return _this22;
      }
      _createClass(Ht, [{
        key: "preprocessBody",
        value: function preprocessBody(e, t) {
          var i = JSON.parse(JSON.stringify(e)),
            n = {
              text: t
            };
          return this._imageWeight && (n.weight = this._imageWeight), i.text_prompts = [n], i;
        }
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI8 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee50(e, t) {
            var i;
            return _regeneratorRuntime().wrap(function _callee50$(_context50) {
              while (1) switch (_context50.prev = _context50.next) {
                case 0:
                  if (this.requestSettings) {
                    _context50.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  i = this.preprocessBody(this.rawBody, t[t.length - 1].text);
                  _.request(this, i, e);
                case 4:
                case "end":
                  return _context50.stop();
              }
            }, _callee50, this);
          }));
          function callServiceAPI(_x96, _x97) {
            return _callServiceAPI8.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData10 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee51(e) {
            return _regeneratorRuntime().wrap(function _callee51$(_context51) {
              while (1) switch (_context51.prev = _context51.next) {
                case 0:
                  if (!e.message) {
                    _context51.next = 2;
                    break;
                  }
                  throw e.message;
                case 2:
                  return _context51.abrupt("return", {
                    files: e.artifacts.map(function (i) {
                      return {
                        src: "".concat(Et).concat(i.base64),
                        type: "image"
                      };
                    })
                  });
                case 3:
                case "end":
                  return _context51.stop();
              }
            }, _callee51);
          }));
          function extractResultData(_x98) {
            return _extractResultData10.apply(this, arguments);
          }
          return extractResultData;
        }()
      }], [{
        key: "cleanConfig",
        value: function cleanConfig(e) {
          delete e.engine_id, delete e.weight;
        }
      }, {
        key: "canSendTextMessage",
        value: function canSendTextMessage(e) {
          return !!(e && e.trim() !== "");
        }
      }]);
      return Ht;
    }(ni);
    var Io = /*#__PURE__*/function (_Pe7) {
      _inherits(Io, _Pe7);
      var _super19 = _createSuper(Io);
      function Io(e) {
        var _this23;
        _classCallCheck(this, Io);
        var n, r, o;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.huggingFace) == null ? void 0 : r.fillMask,
          i = (o = e.directConnection) == null ? void 0 : o.huggingFace;
        _this23 = _super19.call(this, e, "The goal of life is [MASK].", "bert-base-uncased", t, i), _this23.introPanelMarkUp = "\n    <div style=\"width: 100%; text-align: center; margin-left: -10px\"><b>Hugging Face</b></div>\n    <p>Insert a sentence with the word [MASK] and the model will try to fill it for you. E.g. I want [MASK].</p>\n    <p>First message may take an extented amount of time to complete as the model needs to be initialized.</p>", _this23.permittedErrorPrefixes = ["Authorization header", "No mask_token"];
        return _this23;
      }
      _createClass(Io, [{
        key: "extractResultData",
        value: function () {
          var _extractResultData11 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee52(e) {
            return _regeneratorRuntime().wrap(function _callee52$(_context52) {
              while (1) switch (_context52.prev = _context52.next) {
                case 0:
                  if (!e.error) {
                    _context52.next = 2;
                    break;
                  }
                  throw e.error;
                case 2:
                  return _context52.abrupt("return", {
                    text: e[0].sequence || ""
                  });
                case 3:
                case "end":
                  return _context52.stop();
              }
            }, _callee52);
          }));
          function extractResultData(_x99) {
            return _extractResultData11.apply(this, arguments);
          }
          return extractResultData;
        }()
      }]);
      return Io;
    }(Pe);
    var Gt = /*#__PURE__*/function () {
      function Gt() {
        _classCallCheck(this, Gt);
      }
      _createClass(Gt, null, [{
        key: "buildHeaders",
        value: function buildHeaders(e) {
          return {
            Authorization: "Bearer ".concat(e),
            "Content-Type": "application/json",
            accept: "application/json"
          };
        }
        // prettier-ignore
      }, {
        key: "handleVerificationResult",
        value: function handleVerificationResult(e, t, i, n) {
          var o;
          (o = e.message) != null && o.includes("invalid request: prompt must be at least 1 token long") ? i(t) : n(C.INVALID_KEY);
        }
      }, {
        key: "buildKeyVerificationDetails",
        value: function buildKeyVerificationDetails() {
          return {
            url: "https://api.cohere.ai/v1/generate",
            method: "POST",
            handleVerificationResult: Gt.handleVerificationResult,
            body: JSON.stringify({
              prompt: ""
            })
          };
        }
      }]);
      return Gt;
    }();
    var Yi = /*#__PURE__*/function (_U3) {
      _inherits(Yi, _U3);
      var _super20 = _createSuper(Yi);
      function Yi(e, t, i, n, r) {
        var _this24;
        _classCallCheck(this, Yi);
        _this24 = _super20.call(this, e, Gt.buildKeyVerificationDetails(), Gt.buildHeaders, r), _this24.insertKeyPlaceholderText = "Cohere API Key", _this24.getKeyLink = "https://dashboard.cohere.ai/api-keys", _this24.permittedErrorPrefixes = ["invalid"], _this24.url = t, _this24.textInputPlaceholderText = i, n && _typeof(n) == "object" && Object.assign(_this24.rawBody, n);
        return _this24;
      }
      return _createClass(Yi);
    }(U);
    var Lo = /*#__PURE__*/function (_Yi) {
      _inherits(Lo, _Yi);
      var _super21 = _createSuper(Lo);
      function Lo(e) {
        _classCallCheck(this, Lo);
        var n, r, o;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.cohere) == null ? void 0 : r.textGeneration,
          i = (o = e.directConnection) == null ? void 0 : o.cohere;
        return _super21.call(this, e, "https://api.cohere.ai/v1/generate", "Once upon a time", t, i);
      }
      _createClass(Lo, [{
        key: "preprocessBody",
        value: function preprocessBody(e, t) {
          var i = JSON.parse(JSON.stringify(e)),
            n = t[t.length - 1].text;
          if (n) return _objectSpread({
            prompt: n
          }, i);
        }
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI9 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee53(e, t) {
            var i;
            return _regeneratorRuntime().wrap(function _callee53$(_context53) {
              while (1) switch (_context53.prev = _context53.next) {
                case 0:
                  if (this.requestSettings) {
                    _context53.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  i = this.preprocessBody(this.rawBody, t);
                  _.request(this, i, e);
                case 4:
                case "end":
                  return _context53.stop();
              }
            }, _callee53, this);
          }));
          function callServiceAPI(_x100, _x101) {
            return _callServiceAPI9.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData12 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee54(e) {
            var t;
            return _regeneratorRuntime().wrap(function _callee54$(_context54) {
              while (1) switch (_context54.prev = _context54.next) {
                case 0:
                  if (!e.message) {
                    _context54.next = 2;
                    break;
                  }
                  throw e.message;
                case 2:
                  return _context54.abrupt("return", {
                    text: ((t = e.generations) == null ? void 0 : t[0].text) || ""
                  });
                case 3:
                case "end":
                  return _context54.stop();
              }
            }, _callee54);
          }));
          function extractResultData(_x102) {
            return _extractResultData12.apply(this, arguments);
          }
          return extractResultData;
        }()
      }]);
      return Lo;
    }(Yi);
    var Ro = /*#__PURE__*/function (_Yi2) {
      _inherits(Ro, _Yi2);
      var _super22 = _createSuper(Ro);
      function Ro(e) {
        _classCallCheck(this, Ro);
        var n, r, o;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.cohere) == null ? void 0 : r.summarization,
          i = (o = e.directConnection) == null ? void 0 : o.cohere;
        return _super22.call(this, e, "https://api.cohere.ai/v1/summarize", "Insert text to summarize", t, i);
      }
      _createClass(Ro, [{
        key: "preprocessBody",
        value: function preprocessBody(e, t) {
          var i = JSON.parse(JSON.stringify(e)),
            n = t[t.length - 1].text;
          if (n) return _objectSpread({
            text: n
          }, i);
        }
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI10 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee55(e, t) {
            var i;
            return _regeneratorRuntime().wrap(function _callee55$(_context55) {
              while (1) switch (_context55.prev = _context55.next) {
                case 0:
                  if (this.requestSettings) {
                    _context55.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  i = this.preprocessBody(this.rawBody, t);
                  _.request(this, i, e);
                case 4:
                case "end":
                  return _context55.stop();
              }
            }, _callee55, this);
          }));
          function callServiceAPI(_x103, _x104) {
            return _callServiceAPI10.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData13 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee56(e) {
            return _regeneratorRuntime().wrap(function _callee56$(_context56) {
              while (1) switch (_context56.prev = _context56.next) {
                case 0:
                  if (!e.message) {
                    _context56.next = 2;
                    break;
                  }
                  throw e.message;
                case 2:
                  return _context56.abrupt("return", {
                    text: e.summary || ""
                  });
                case 3:
                case "end":
                  return _context56.stop();
              }
            }, _callee56);
          }));
          function extractResultData(_x105) {
            return _extractResultData13.apply(this, arguments);
          }
          return extractResultData;
        }()
      }]);
      return Ro;
    }(Yi);
    var O = /*#__PURE__*/function () {
      function O() {
        _classCallCheck(this, O);
      }
      _createClass(O, null, [{
        key: "buildHeaders",
        value: function buildHeaders(e) {
          return {
            Authorization: "Bearer ".concat(e),
            "Content-Type": "application/json"
          };
        }
        // prettier-ignore
      }, {
        key: "handleVerificationResult",
        value: function handleVerificationResult(e, t, i, n) {
          var r = e;
          r.error ? r.error.code === "invalid_api_key" ? n(C.INVALID_KEY) : n(C.CONNECTION_FAILED) : i(t);
        }
      }, {
        key: "buildKeyVerificationDetails",
        value: function buildKeyVerificationDetails() {
          return {
            url: "https://api.openai.com/v1/models",
            method: "GET",
            handleVerificationResult: O.handleVerificationResult
          };
        }
      }, {
        key: "storeFiles",
        value: function () {
          var _storeFiles = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee58(e, t, i) {
            var n, r, o, a;
            return _regeneratorRuntime().wrap(function _callee58$(_context58) {
              while (1) switch (_context58.prev = _context58.next) {
                case 0:
                  n = e.requestSettings.headers;
                  if (n) {
                    _context58.next = 3;
                    break;
                  }
                  return _context58.abrupt("return");
                case 3:
                  e.url = "https://api.openai.com/v1/files";
                  r = n[E.CONTENT_TYPE];
                  delete n[E.CONTENT_TYPE];
                  o = i.map( /*#__PURE__*/function () {
                    var _ref8 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee57(a) {
                      var l;
                      return _regeneratorRuntime().wrap(function _callee57$(_context57) {
                        while (1) switch (_context57.prev = _context57.next) {
                          case 0:
                            l = new FormData();
                            return _context57.abrupt("return", (l.append("purpose", "assistants"), l.append("file", a), new Promise(function (c) {
                              c(O.directFetch(e, l, "POST", !1));
                            })));
                          case 2:
                          case "end":
                            return _context57.stop();
                        }
                      }, _callee57);
                    }));
                    return function (_x109) {
                      return _ref8.apply(this, arguments);
                    };
                  }());
                  _context58.prev = 7;
                  _context58.next = 10;
                  return Promise.all(o);
                case 10:
                  a = _context58.sent.map(function (l) {
                    return l.id;
                  });
                  return _context58.abrupt("return", (n[E.CONTENT_TYPE] = r, a));
                case 14:
                  _context58.prev = 14;
                  _context58.t0 = _context58["catch"](7);
                  throw n[E.CONTENT_TYPE] = r, E.displayError(t, _context58.t0), e.completionsHandlers.onFinish(), _context58.t0;
                case 17:
                case "end":
                  return _context58.stop();
              }
            }, _callee58, null, [[7, 14]]);
          }));
          function storeFiles(_x106, _x107, _x108) {
            return _storeFiles.apply(this, arguments);
          }
          return storeFiles;
        }() // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, {
        key: "directFetch",
        value: function () {
          var _directFetch = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee59(e, t, i) {
            var n,
              r,
              _args59 = arguments;
            return _regeneratorRuntime().wrap(function _callee59$(_context59) {
              while (1) switch (_context59.prev = _context59.next) {
                case 0:
                  n = _args59.length > 3 && _args59[3] !== undefined ? _args59[3] : !0;
                  e.requestSettings.method = i;
                  _context59.next = 4;
                  return E.fetch(e, e.requestSettings.headers, n, t).then(function (o) {
                    return E.processResponseByType(o);
                  });
                case 4:
                  r = _context59.sent;
                  if (!r.error) {
                    _context59.next = 7;
                    break;
                  }
                  throw r.error.message;
                case 7:
                  return _context59.abrupt("return", r);
                case 8:
                case "end":
                  return _context59.stop();
              }
            }, _callee59);
          }));
          function directFetch(_x110, _x111, _x112) {
            return _directFetch.apply(this, arguments);
          }
          return directFetch;
        }()
      }]);
      return O;
    }();
    var Zi = /*#__PURE__*/function (_U4) {
      _inherits(Fi, _U4);
      var _super23 = _createSuper(Fi);
      function Fi(e) {
        var _o$model, _a$voice;
        var _this25;
        _classCallCheck(this, Fi);
        var r, o, a;
        var t = JSON.parse(JSON.stringify(e.directConnection)),
          i = t == null ? void 0 : t.openAI;
        _this25 = _super23.call(this, e, O.buildKeyVerificationDetails(), O.buildHeaders, i), _this25.insertKeyPlaceholderText = "OpenAI API Key", _this25.getKeyLink = "https://platform.openai.com/account/api-keys", _this25.url = "https://api.openai.com/v1/audio/speech", _this25.permittedErrorPrefixes = ["Invalid"], _this25.introPanelMarkUp = "\n    <div style=\"width: 100%; text-align: center; margin-left: -10px\"><b>OpenAI : Text To Speech</b></div>\n    <p>Generate an audio file based on your text input.</p>\n    <p>Click <a href=\"https://platform.openai.com/docs/guides/text-to-speech\">here</a> for more information.</p>";
        var n = (r = t == null ? void 0 : t.openAI) == null ? void 0 : r.textToSpeech;
        _typeof(n) == "object" && Object.assign(_this25.rawBody, n), (_o$model = (o = _this25.rawBody).model) !== null && _o$model !== void 0 ? _o$model : o.model = Fi.DEFAULT_MODEL, (_a$voice = (a = _this25.rawBody).voice) !== null && _a$voice !== void 0 ? _a$voice : a.voice = Fi.DEFAULT_VOIDE, _this25.textInputPlaceholderText = "Insert text to generate audio", _this25.rawBody.response_format = "mp3";
        return _this25;
      }
      _createClass(Fi, [{
        key: "preprocessBody",
        value: function preprocessBody(e, t) {
          var r, o;
          var i = JSON.parse(JSON.stringify(e)),
            n = (o = (r = t[t.length - 1]) == null ? void 0 : r.text) == null ? void 0 : o.trim();
          return n && n !== "" && (i.input = n), i;
        }
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI11 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee60(e, t) {
            var n, i;
            return _regeneratorRuntime().wrap(function _callee60$(_context60) {
              while (1) switch (_context60.prev = _context60.next) {
                case 0:
                  if ((n = this.requestSettings) != null && n.headers) {
                    _context60.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  this.url = this.requestSettings.url || this.url;
                  i = this.preprocessBody(this.rawBody, t);
                  _.request(this, i, e);
                case 5:
                case "end":
                  return _context60.stop();
              }
            }, _callee60, this);
          }));
          function callServiceAPI(_x113, _x114) {
            return _callServiceAPI11.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData14 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee61(e) {
            return _regeneratorRuntime().wrap(function _callee61$(_context61) {
              while (1) switch (_context61.prev = _context61.next) {
                case 0:
                  if (!(e instanceof Blob)) {
                    _context61.next = 2;
                    break;
                  }
                  return _context61.abrupt("return", new Promise(function (t) {
                    var i = new FileReader();
                    i.readAsDataURL(e), i.onload = function (n) {
                      t({
                        files: [{
                          src: n.target.result,
                          type: "audio"
                        }]
                      });
                    };
                  }));
                case 2:
                  if (!e.error) {
                    _context61.next = 4;
                    break;
                  }
                  throw e.error.message;
                case 4:
                  return _context61.abrupt("return", {
                    error: "error"
                  });
                case 5:
                case "end":
                  return _context61.stop();
              }
            }, _callee61);
          }));
          function extractResultData(_x115) {
            return _extractResultData14.apply(this, arguments);
          }
          return extractResultData;
        }()
      }]);
      return Fi;
    }(U);
    Zi.DEFAULT_MODEL = "tts-1";
    Zi.DEFAULT_VOIDE = "alloy";
    var Oo = Zi;
    var si = /*#__PURE__*/function (_U5) {
      _inherits(Ee, _U5);
      var _super24 = _createSuper(Ee);
      function Ee(e) {
        var _o$model2;
        var _this26;
        _classCallCheck(this, Ee);
        var r, o;
        var t = JSON.parse(JSON.stringify(e.directConnection)),
          i = t == null ? void 0 : t.openAI;
        _this26 = _super24.call(this, e, O.buildKeyVerificationDetails(), O.buildHeaders, i, {
          audio: {}
        }), _this26.insertKeyPlaceholderText = "OpenAI API Key", _this26.getKeyLink = "https://platform.openai.com/account/api-keys", _this26.introPanelMarkUp = "\n    <div style=\"width: 100%; text-align: center; margin-left: -10px\"><b>OpenAI : Speech To Text</b></div>\n    <p><b>Upload an audio file</b> to transcribe it into text. You can optionally provide text to guide the audio\n      processing.\n    <p>Click <a href=\"https://platform.openai.com/docs/guides/speech-to-text\">here</a> for more info.</p>", _this26.url = "", _this26.permittedErrorPrefixes = ["Invalid"], _this26.textInputPlaceholderText = "Upload an audio file", _this26._service_url = Ee.AUDIO_TRANSCRIPTIONS_URL;
        var n = (r = t == null ? void 0 : t.openAI) == null ? void 0 : r.audio;
        _typeof(n) == "object" && (_this26.processConfig(n), Ee.cleanConfig(n), Object.assign(_this26.rawBody, n)), (_o$model2 = (o = _this26.rawBody).model) !== null && _o$model2 !== void 0 ? _o$model2 : o.model = Ee.DEFAULT_MODEL, _this26.rawBody.response_format = "json", _this26.canSendMessage = Ee.canSendFileMessage;
        return _this26;
      }
      _createClass(Ee, [{
        key: "processConfig",
        value: function processConfig(e) {
          e != null && e.type && e.type === "translation" && (this._service_url = Ee.AUDIO_TRANSLATIONS_URL, delete e.language);
        }
      }, {
        key: "preprocessBody",
        value: function preprocessBody(e, t) {
          var r, o;
          var i = JSON.parse(JSON.stringify(e)),
            n = (o = (r = t[t.length - 1]) == null ? void 0 : r.text) == null ? void 0 : o.trim();
          return n && n !== "" && (i.prompt = n), i;
        }
        // prettier-ignore
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI12 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee62(e, t, i) {
            var o, n, r;
            return _regeneratorRuntime().wrap(function _callee62$(_context62) {
              while (1) switch (_context62.prev = _context62.next) {
                case 0:
                  if ((o = this.requestSettings) != null && o.headers) {
                    _context62.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  if (i != null && i[0]) {
                    _context62.next = 4;
                    break;
                  }
                  throw new Error("No file was added");
                case 4:
                  this.url = this.requestSettings.url || this._service_url;
                  n = this.preprocessBody(this.rawBody, t), r = Ee.createFormDataBody(n, i[0]);
                  E.tempRemoveContentHeader(this.requestSettings, _.request.bind(this, this, r, e), !1);
                case 7:
                case "end":
                  return _context62.stop();
              }
            }, _callee62, this);
          }));
          function callServiceAPI(_x116, _x117, _x118) {
            return _callServiceAPI12.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData15 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee63(e) {
            return _regeneratorRuntime().wrap(function _callee63$(_context63) {
              while (1) switch (_context63.prev = _context63.next) {
                case 0:
                  if (!e.error) {
                    _context63.next = 2;
                    break;
                  }
                  throw e.error.message;
                case 2:
                  return _context63.abrupt("return", {
                    text: e.text
                  });
                case 3:
                case "end":
                  return _context63.stop();
              }
            }, _callee63);
          }));
          function extractResultData(_x119) {
            return _extractResultData15.apply(this, arguments);
          }
          return extractResultData;
        }()
      }], [{
        key: "canSendFileMessage",
        value: function canSendFileMessage(e, t) {
          return !!(t != null && t[0]);
        }
      }, {
        key: "cleanConfig",
        value: function cleanConfig(e) {
          delete e.type;
        }
      }, {
        key: "createFormDataBody",
        value: function createFormDataBody(e, t) {
          var i = new FormData();
          return i.append("file", t), Object.keys(e).forEach(function (n) {
            i.append(n, String(e[n]));
          }), i;
        }
      }]);
      return Ee;
    }(U);
    si.AUDIO_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
    si.AUDIO_TRANSLATIONS_URL = "https://api.openai.com/v1/audio/translations";
    si.DEFAULT_MODEL = "whisper-1";
    var No = si;
    var Z = /*#__PURE__*/function () {
      function Z() {
        _classCallCheck(this, Z);
      }
      _createClass(Z, null, [{
        key: "buildTextToSpeechHeaders",
        value: function buildTextToSpeechHeaders(e, t) {
          return {
            "Ocp-Apim-Subscription-Key": t,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": e
          };
        }
      }, {
        key: "buildSpeechToTextHeaders",
        value: function buildSpeechToTextHeaders(e) {
          return {
            "Ocp-Apim-Subscription-Key": e,
            Accept: "application/json"
          };
        }
        // prettier-ignore
      }, {
        key: "handleSpeechVerificationResult",
        value: function handleSpeechVerificationResult(e, t, i, n) {
          e.error ? n(C.INVALID_KEY) : i(t);
        }
      }, {
        key: "buildSpeechKeyVerificationDetails",
        value: function buildSpeechKeyVerificationDetails(e) {
          return {
            url: "https://".concat(e, ".api.cognitive.microsoft.com/sts/v1.0/issuetoken"),
            method: "POST",
            createHeaders: function createHeaders(t) {
              return {
                "Ocp-Apim-Subscription-Key": "".concat(t)
              };
            },
            handleVerificationResult: Z.handleSpeechVerificationResult
          };
        }
      }, {
        key: "buildSummarizationHeader",
        value: function buildSummarizationHeader(e) {
          return {
            "Ocp-Apim-Subscription-Key": e,
            "Content-Type": "application/json"
          };
        }
        // prettier-ignore
      }, {
        key: "handleLanguageVerificationResult",
        value: function handleLanguageVerificationResult(e, t, i, n) {
          var o;
          ((o = e.error) == null ? void 0 : o.code) === "401" ? n(C.INVALID_KEY) : i(t);
        }
      }, {
        key: "buildLanguageKeyVerificationDetails",
        value: function buildLanguageKeyVerificationDetails(e) {
          return {
            url: "".concat(e, "/language/analyze-text/jobs?api-version=2022-10-01-preview"),
            method: "POST",
            createHeaders: function createHeaders(t) {
              return {
                "Ocp-Apim-Subscription-Key": "".concat(t)
              };
            },
            handleVerificationResult: Z.handleLanguageVerificationResult
          };
        }
        // prettier-ignore
      }, {
        key: "handleTranslationVerificationResult",
        value: function handleTranslationVerificationResult(e, t, i, n) {
          e.json().then(function (o) {
            !Array.isArray(o) && o.error.code === 401e3 ? n(C.INVALID_KEY) : i(t);
          });
        }
      }, {
        key: "buildTranslationKeyVerificationDetails",
        value: function buildTranslationKeyVerificationDetails(e) {
          return {
            url: "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=es",
            method: "POST",
            createHeaders: function createHeaders(t) {
              return Z.buildTranslationHeaders(e, t);
            },
            handleVerificationResult: Z.handleTranslationVerificationResult
          };
        }
      }, {
        key: "buildTranslationHeaders",
        value: function buildTranslationHeaders(e, t) {
          var i = {
            "Ocp-Apim-Subscription-Key": t,
            "Content-Type": "application/json"
          };
          return e && (i["Ocp-Apim-Subscription-Region"] = e), i;
        }
      }]);
      return Z;
    }();
    var Po = /*#__PURE__*/function (_U6) {
      _inherits(Po, _U6);
      var _super25 = _createSuper(Po);
      // prettier-ignore
      function Po(e, t, i, n, r) {
        var _this27;
        _classCallCheck(this, Po);
        _this27 = _super25.call(this, e, Z.buildLanguageKeyVerificationDetails(i), t, n, r), _this27.insertKeyPlaceholderText = "Azure Language Subscription Key", _this27.getKeyLink =
        // eslint-disable-next-line max-len
        "https://learn.microsoft.com/en-us/azure/api-management/api-management-subscriptions#create-and-manage-subscriptions-in-azure-portal", _this27.permittedErrorPrefixes = ["Access"];
        return _this27;
      }
      return _createClass(Po);
    }(U);
    var Do = /*#__PURE__*/function (_Po) {
      _inherits(Do, _Po);
      var _super26 = _createSuper(Do);
      function Do(e) {
        var _a$language;
        var _this28;
        _classCallCheck(this, Do);
        var n, r, o, a;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.azure) == null ? void 0 : r.summarization,
          i = (o = e.directConnection) == null ? void 0 : o.azure;
        _this28 = _super26.call(this, e, Z.buildSummarizationHeader, t.endpoint, i), _this28.url = "", _this28.textInputPlaceholderText = "Insert text to summarize", (_a$language = (a = _this28.rawBody).language) !== null && _a$language !== void 0 ? _a$language : a.language = "en", Object.assign(_this28.rawBody, t), _this28.url = "".concat(t.endpoint, "/language/analyze-text/jobs?api-version=2022-10-01-preview");
        return _this28;
      }
      _createClass(Do, [{
        key: "preprocessBody",
        value: function preprocessBody(e, t) {
          var i = t[t.length - 1].text;
          if (i) return {
            analysisInput: {
              documents: [{
                id: "1",
                language: e.language,
                text: i
              }]
            },
            tasks: [{
              kind: "ExtractiveSummarization"
            }]
          };
        }
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI13 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee64(e, t) {
            var i;
            return _regeneratorRuntime().wrap(function _callee64$(_context64) {
              while (1) switch (_context64.prev = _context64.next) {
                case 0:
                  if (this.requestSettings) {
                    _context64.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  i = this.preprocessBody(this.rawBody, t);
                  _.request(this, i, e), this.messages = e;
                case 4:
                case "end":
                  return _context64.stop();
              }
            }, _callee64, this);
          }));
          function callServiceAPI(_x120, _x121) {
            return _callServiceAPI13.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData16 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee65(e) {
            var t, _i9, n;
            return _regeneratorRuntime().wrap(function _callee65$(_context65) {
              while (1) switch (_context65.prev = _context65.next) {
                case 0:
                  if (!e.error) {
                    _context65.next = 2;
                    break;
                  }
                  throw e.error.message;
                case 2:
                  if (this.messages && this.completionsHandlers) {
                    _i9 = e.headers.get("operation-location"), n = {
                      method: "GET",
                      headers: (t = this.requestSettings) == null ? void 0 : t.headers
                    };
                    _.executePollRequest(this, _i9, n, this.messages);
                  }
                  return _context65.abrupt("return", {
                    makingAnotherRequest: !0
                  });
                case 4:
                case "end":
                  return _context65.stop();
              }
            }, _callee65, this);
          }));
          function extractResultData(_x122) {
            return _extractResultData16.apply(this, arguments);
          }
          return extractResultData;
        }()
      }, {
        key: "extractPollResultData",
        value: function () {
          var _extractPollResultData4 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee66(e) {
            var t, _iterator, _step, _i10;
            return _regeneratorRuntime().wrap(function _callee66$(_context66) {
              while (1) switch (_context66.prev = _context66.next) {
                case 0:
                  if (!e.error) {
                    _context66.next = 2;
                    break;
                  }
                  throw e.error;
                case 2:
                  if (!(e.status === "running")) {
                    _context66.next = 4;
                    break;
                  }
                  return _context66.abrupt("return", {
                    timeoutMS: 2e3
                  });
                case 4:
                  if (!(e.errors.length > 0)) {
                    _context66.next = 6;
                    break;
                  }
                  throw e.errors[0];
                case 6:
                  if (!(e.tasks.items[0].results.errors.length > 0)) {
                    _context66.next = 8;
                    break;
                  }
                  throw e.tasks.items[0].results.errors[0];
                case 8:
                  t = "";
                  _iterator = _createForOfIteratorHelper(e.tasks.items[0].results.documents[0].sentences);
                  try {
                    for (_iterator.s(); !(_step = _iterator.n()).done;) {
                      _i10 = _step.value;
                      t += _i10.text;
                    }
                  } catch (err) {
                    _iterator.e(err);
                  } finally {
                    _iterator.f();
                  }
                  return _context66.abrupt("return", {
                    text: t || ""
                  });
                case 12:
                case "end":
                  return _context66.stop();
              }
            }, _callee66);
          }));
          function extractPollResultData(_x123) {
            return _extractPollResultData4.apply(this, arguments);
          }
          return extractPollResultData;
        }()
      }]);
      return Do;
    }(Po);
    var ct = /*#__PURE__*/function () {
      function ct() {
        _classCallCheck(this, ct);
      }
      _createClass(ct, null, [{
        key: "poll",
        value: function () {
          var _poll2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee67(e, t) {
            var i, a, l, d;
            return _regeneratorRuntime().wrap(function _callee67$(_context67) {
              while (1) switch (_context67.prev = _context67.next) {
                case 0:
                  i = {
                    authorization: e,
                    "content-type": "application/json"
                  };
                  _context67.t0 = "https://api.assemblyai.com/v2/transcript/";
                  _context67.next = 4;
                  return fetch("https://api.assemblyai.com/v2/transcript", {
                    method: "POST",
                    body: JSON.stringify({
                      audio_url: t
                    }),
                    headers: i
                  });
                case 4:
                  _context67.next = 6;
                  return _context67.sent.json();
                case 6:
                  _context67.t1 = _context67.sent.id;
                  a = _context67.t0.concat.call(_context67.t0, _context67.t1);
                case 8:
                  if (l) {
                    _context67.next = 24;
                    break;
                  }
                  _context67.next = 11;
                  return fetch(a, {
                    headers: i
                  });
                case 11:
                  _context67.next = 13;
                  return _context67.sent.json();
                case 13:
                  d = _context67.sent;
                  if (!(d.status === "completed")) {
                    _context67.next = 18;
                    break;
                  }
                  l = d;
                  _context67.next = 22;
                  break;
                case 18:
                  if (!(d.status === "error")) {
                    _context67.next = 20;
                    break;
                  }
                  throw new Error("Transcription failed: ".concat(d.error));
                case 20:
                  _context67.next = 22;
                  return new Promise(function (u) {
                    return setTimeout(u, 3e3);
                  });
                case 22:
                  _context67.next = 8;
                  break;
                case 24:
                  return _context67.abrupt("return", l);
                case 25:
                case "end":
                  return _context67.stop();
              }
            }, _callee67);
          }));
          function poll(_x124, _x125) {
            return _poll2.apply(this, arguments);
          }
          return poll;
        }()
      }, {
        key: "buildHeaders",
        value: function buildHeaders(e) {
          return {
            Authorization: e,
            "Content-Type": "application/octet-stream"
          };
        }
        // prettier-ignore
      }, {
        key: "handleVerificationResult",
        value: function handleVerificationResult(e, t, i, n) {
          var r = e;
          r.error ? r.error.code === "invalid_api_key" ? n(C.INVALID_KEY) : n(C.CONNECTION_FAILED) : i(t);
        }
      }, {
        key: "buildKeyVerificationDetails",
        value: function buildKeyVerificationDetails() {
          return {
            url: "https://api.assemblyai.com/v2/upload",
            method: "POST",
            handleVerificationResult: ct.handleVerificationResult
          };
        }
      }]);
      return ct;
    }();
    var Xi = /*#__PURE__*/function (_U7) {
      _inherits(Xi, _U7);
      var _super27 = _createSuper(Xi);
      function Xi(e) {
        var _this29;
        _classCallCheck(this, Xi);
        var i;
        var t = (i = e.directConnection) == null ? void 0 : i.assemblyAI;
        _this29 = _super27.call(this, e, ct.buildKeyVerificationDetails(), ct.buildHeaders, t, {
          audio: {}
        }), _this29.insertKeyPlaceholderText = "AssemblyAI API Key", _this29.getKeyLink = "https://www.assemblyai.com/app/account", _this29.introPanelMarkUp = "\n    <div style=\"width: 100%; text-align: center; margin-left: -10px\"><b>AssemblyAI Audio</b></div>\n    <p><b>Upload an audio file</b> to transcribe it into text.\n    <p>\n      Click <a href=\"https://www.assemblyai.com/docs/Guides/transcribing_an_audio_file#get-started\">here</a> for more info.\n    </p>", _this29.url = "https://api.assemblyai.com/v2/upload", _this29.isTextInputDisabled = !0, _this29.textInputPlaceholderText = "Upload an audio file", _this29.permittedErrorPrefixes = ["Authentication", "Invalid"], _this29.canSendMessage = Xi.canFileSendMessage;
        return _this29;
      }
      _createClass(Xi, [{
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI14 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee68(e, t, i) {
            var n;
            return _regeneratorRuntime().wrap(function _callee68$(_context68) {
              while (1) switch (_context68.prev = _context68.next) {
                case 0:
                  if ((n = this.requestSettings) != null && n.headers) {
                    _context68.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  if (i != null && i[0]) {
                    _context68.next = 4;
                    break;
                  }
                  throw new Error("No file was added");
                case 4:
                  _.request(this, i[0], e, !1);
                case 5:
                case "end":
                  return _context68.stop();
              }
            }, _callee68, this);
          }));
          function callServiceAPI(_x126, _x127, _x128) {
            return _callServiceAPI14.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData17 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee69(e) {
            var n, r, t;
            return _regeneratorRuntime().wrap(function _callee69$(_context69) {
              while (1) switch (_context69.prev = _context69.next) {
                case 0:
                  if (!e.error) {
                    _context69.next = 2;
                    break;
                  }
                  throw e.error;
                case 2:
                  t = (r = (n = this.requestSettings) == null ? void 0 : n.headers) == null ? void 0 : r.Authorization;
                  _context69.next = 5;
                  return ct.poll(t, e.upload_url);
                case 5:
                  _context69.t0 = _context69.sent.text;
                  return _context69.abrupt("return", {
                    text: _context69.t0
                  });
                case 7:
                case "end":
                  return _context69.stop();
              }
            }, _callee69, this);
          }));
          function extractResultData(_x129) {
            return _extractResultData17.apply(this, arguments);
          }
          return extractResultData;
        }()
      }], [{
        key: "canFileSendMessage",
        value: function canFileSendMessage(e, t) {
          return !!(t != null && t[0]);
        }
      }]);
      return Xi;
    }(U);
    var as = /*#__PURE__*/function (_U8) {
      _inherits(as, _U8);
      var _super28 = _createSuper(as);
      // prettier-ignore
      function as(e, t, i, n, r) {
        var _this30;
        _classCallCheck(this, as);
        _this30 = _super28.call(this, e, Z.buildSpeechKeyVerificationDetails(i), t, n, r), _this30.insertKeyPlaceholderText = "Azure Speech Subscription Key", _this30.getKeyLink =
        // eslint-disable-next-line max-len
        "https://learn.microsoft.com/en-us/azure/api-management/api-management-subscriptions#create-and-manage-subscriptions-in-azure-portal";
        return _this30;
      }
      return _createClass(as);
    }(U);
    var ls = /*#__PURE__*/function (_as) {
      _inherits(cs, _as);
      var _super29 = _createSuper(cs);
      // prettier-ignore
      function cs(e) {
        var _a$lang, _l$name, _c$gender;
        var _this31;
        _classCallCheck(this, cs);
        var n, r, o, a, l, c;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.azure) == null ? void 0 : r.textToSpeech,
          i = (o = e.directConnection) == null ? void 0 : o.azure;
        _this31 = _super29.call(this, e, Z.buildTextToSpeechHeaders.bind({}, (t == null ? void 0 : t.outputFormat) || "audio-16khz-128kbitrate-mono-mp3"), t.region, i), _this31.introPanelMarkUp = "\n    <div style=\"width: 100%; text-align: center; margin-left: -10px\"><b>Azure Text To Speech</b></div>\n    <p>Insert text to synthesize it to audio.\n    <p>\n      Click <a href=\"".concat(cs.HELP_LINK, "\">here</a> for more info.\n    </p>"), _this31.url = "", Object.assign(_this31.rawBody, t), (_a$lang = (a = _this31.rawBody).lang) !== null && _a$lang !== void 0 ? _a$lang : a.lang = "en-US", (_l$name = (l = _this31.rawBody).name) !== null && _l$name !== void 0 ? _l$name : l.name = "en-US-JennyNeural", (_c$gender = (c = _this31.rawBody).gender) !== null && _c$gender !== void 0 ? _c$gender : c.gender = "Female", _this31.url = "https://".concat(t.region, ".tts.speech.microsoft.com/cognitiveservices/v1");
        return _this31;
      }
      _createClass(cs, [{
        key: "preprocessBody",
        value: function preprocessBody(e, t) {
          var i = t[t.length - 1].text;
          if (i) return "<speak version='1.0' xml:lang='".concat(e.lang, "'>\n      <voice xml:lang='").concat(e.lang, "' xml:gender='").concat(e.gender, "' name='").concat(e.name, "'>\n        ").concat(i, "\n      </voice>\n    </speak>");
        }
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI15 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee70(e, t) {
            var i;
            return _regeneratorRuntime().wrap(function _callee70$(_context70) {
              while (1) switch (_context70.prev = _context70.next) {
                case 0:
                  if (this.requestSettings) {
                    _context70.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  i = this.preprocessBody(this.rawBody, t);
                  _.request(this, i, e, !1);
                case 4:
                case "end":
                  return _context70.stop();
              }
            }, _callee70, this);
          }));
          function callServiceAPI(_x130, _x131) {
            return _callServiceAPI15.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData18 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee71(e) {
            return _regeneratorRuntime().wrap(function _callee71$(_context71) {
              while (1) switch (_context71.prev = _context71.next) {
                case 0:
                  return _context71.abrupt("return", new Promise(function (t) {
                    var i = new FileReader();
                    i.readAsDataURL(e), i.onload = function (n) {
                      t({
                        files: [{
                          src: n.target.result,
                          type: "audio"
                        }]
                      });
                    };
                  }));
                case 1:
                case "end":
                  return _context71.stop();
              }
            }, _callee71);
          }));
          function extractResultData(_x132) {
            return _extractResultData18.apply(this, arguments);
          }
          return extractResultData;
        }()
      }]);
      return cs;
    }(as);
    ls.HELP_LINK =
    // eslint-disable-next-line max-len
    "https://learn.microsoft.com/en-GB/azure/cognitive-services/speech-service/get-started-text-to-speech?tabs=windows%2Cterminal&pivots=programming-language-rest";
    var jo = ls;
    var ds = /*#__PURE__*/function (_as2) {
      _inherits(Bi, _as2);
      var _super30 = _createSuper(Bi);
      function Bi(e) {
        var _this32;
        _classCallCheck(this, Bi);
        var o, a, l;
        var t = (a = (o = e.directConnection) == null ? void 0 : o.azure) == null ? void 0 : a.speechToText,
          i = (l = e.directConnection) == null ? void 0 : l.azure,
          n = {
            audio: {
              files: {
                acceptedFormats: ".wav,.ogg"
              }
            }
          };
        _this32 = _super30.call(this, e, Z.buildSpeechToTextHeaders, t.region, i, n), _this32.introPanelMarkUp = "\n    <div style=\"width: 100%; text-align: center; margin-left: -10px\"><b>Azure Speech To Text</b></div>\n    <p><b>Upload a .wav or .ogg audio file</b> to transcribe it into text.\n    <p>\n      Click <a href=\"".concat(Bi.HELP_LINK, "\">here</a> for more info.\n    </p>"), _this32.url = "", _this32.isTextInputDisabled = !0, _this32.textInputPlaceholderText = "Upload an audio file", _this32.canSendMessage = Bi.canFileSendMessage;
        var r = t.lang || "en-US";
        _this32.url = "https://".concat(t.region, ".stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=").concat(r, "&format=detailed"), _this32.recordAudio = void 0;
        return _this32;
      }
      _createClass(Bi, [{
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI16 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee72(e, t, i) {
            var n, r;
            return _regeneratorRuntime().wrap(function _callee72$(_context72) {
              while (1) switch (_context72.prev = _context72.next) {
                case 0:
                  if ((n = this.requestSettings) != null && n.headers) {
                    _context72.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  if (i != null && i[0]) {
                    _context72.next = 4;
                    break;
                  }
                  throw new Error("No file was added");
                case 4:
                  (r = this.requestSettings) != null && r.headers && (this.requestSettings.headers["Content-Type"] = i[0].name.toLocaleLowerCase().endsWith(".wav") ? "audio/wav; codecs=audio/pcm; samplerate=16000" : "audio/ogg; codecs=opus"), _.request(this, i[0], e, !1);
                case 5:
                case "end":
                  return _context72.stop();
              }
            }, _callee72, this);
          }));
          function callServiceAPI(_x133, _x134, _x135) {
            return _callServiceAPI16.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData19 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee73(e) {
            return _regeneratorRuntime().wrap(function _callee73$(_context73) {
              while (1) switch (_context73.prev = _context73.next) {
                case 0:
                  if (!e.error) {
                    _context73.next = 2;
                    break;
                  }
                  throw e.error;
                case 2:
                  return _context73.abrupt("return", {
                    text: e.DisplayText || ""
                  });
                case 3:
                case "end":
                  return _context73.stop();
              }
            }, _callee73);
          }));
          function extractResultData(_x136) {
            return _extractResultData19.apply(this, arguments);
          }
          return extractResultData;
        }()
      }], [{
        key: "canFileSendMessage",
        value: function canFileSendMessage(e, t) {
          return !!(t != null && t[0]);
        }
      }]);
      return Bi;
    }(as);
    ds.HELP_LINK =
    // eslint-disable-next-line max-len
    "https://learn.microsoft.com/en-GB/azure/cognitive-services/speech-service/get-started-text-to-speech?tabs=windows%2Cterminal&pivots=programming-language-rest";
    var Fo = ds;
    var Bo = /*#__PURE__*/function (_U9) {
      _inherits(Bo, _U9);
      var _super31 = _createSuper(Bo);
      // prettier-ignore
      function Bo(e) {
        var _this33;
        _classCallCheck(this, Bo);
        var n, r, o;
        var t = (r = (n = e.directConnection) == null ? void 0 : n.azure) == null ? void 0 : r.translation,
          i = (o = e.directConnection) == null ? void 0 : o.azure;
        _this33 = _super31.call(this, e, Z.buildTranslationKeyVerificationDetails(t.region), Z.buildTranslationHeaders.bind({}, t == null ? void 0 : t.region), i), _this33.insertKeyPlaceholderText = "Azure Translate Subscription Key", _this33.getKeyLink =
        // eslint-disable-next-line max-len
        "https://learn.microsoft.com/en-us/azure/api-management/api-management-subscriptions#create-and-manage-subscriptions-in-azure-portal", _this33.url = "", _this33.url = "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=".concat(t.language || "es");
        return _this33;
      }
      _createClass(Bo, [{
        key: "preprocessBody",
        value: function preprocessBody(e) {
          var t = e[e.length - 1].text;
          if (t) return [{
            Text: t
          }];
        }
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI17 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee74(e, t) {
            var i;
            return _regeneratorRuntime().wrap(function _callee74$(_context74) {
              while (1) switch (_context74.prev = _context74.next) {
                case 0:
                  if (this.requestSettings) {
                    _context74.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  i = this.preprocessBody(t);
                  _.request(this, i, e);
                case 4:
                case "end":
                  return _context74.stop();
              }
            }, _callee74, this);
          }));
          function callServiceAPI(_x137, _x138) {
            return _callServiceAPI17.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData20 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee75(e) {
            var t;
            return _regeneratorRuntime().wrap(function _callee75$(_context75) {
              while (1) switch (_context75.prev = _context75.next) {
                case 0:
                  if (!Array.isArray(e)) {
                    _context75.next = 2;
                    break;
                  }
                  return _context75.abrupt("return", {
                    text: ((t = e[0].translations) == null ? void 0 : t[0].text) || ""
                  });
                case 2:
                  throw e.error;
                case 3:
                case "end":
                  return _context75.stop();
              }
            }, _callee75);
          }));
          function extractResultData(_x139) {
            return _extractResultData20.apply(this, arguments);
          }
          return extractResultData;
        }()
      }]);
      return Bo;
    }(U);
    var Qi = /*#__PURE__*/function (_U10) {
      _inherits(ae, _U10);
      var _super32 = _createSuper(ae);
      function ae(e) {
        var _l$headers, _c$OpenAIBeta;
        var _this34;
        _classCallCheck(this, ae);
        var r, o, a, l, c;
        var t = JSON.parse(JSON.stringify(e.directConnection)),
          i = t.openAI;
        _this34 = _super32.call(this, e, O.buildKeyVerificationDetails(), O.buildHeaders, i), _this34.insertKeyPlaceholderText = "OpenAI API Key", _this34.getKeyLink = "https://platform.openai.com/account/api-keys", _this34.url = "", _this34.permittedErrorPrefixes = ["Incorrect"], _this34.searchedForThreadId = !1;
        var n = (r = t.openAI) == null ? void 0 : r.assistant;
        if (_typeof(n) == "object") {
          _this34.rawBody.assistant_id = n.assistant_id;
          var _ref9 = (a = (o = e.directConnection) == null ? void 0 : o.openAI) == null ? void 0 : a.assistant,
            d = _ref9.function_handler;
          d && (_this34._functionHandler = d);
        }
        (_l$headers = (l = _this34.requestSettings).headers) !== null && _l$headers !== void 0 ? _l$headers : l.headers = {}, (_c$OpenAIBeta = (c = _this34.requestSettings.headers)["OpenAI-Beta"]) !== null && _c$OpenAIBeta !== void 0 ? _c$OpenAIBeta : c["OpenAI-Beta"] = "assistants=v1", _this34.maxMessages = 1;
        return _this34;
      }
      _createClass(ae, [{
        key: "processMessage",
        value: function processMessage(e, t) {
          var i = this.totalMessagesMaxCharLength || -1;
          return {
            content: Xe.getCharacterLimitMessages(e, i)[0].text || "",
            role: "user",
            file_ids: t
          };
        }
      }, {
        key: "createNewThreadMessages",
        value: function createNewThreadMessages(e, t, i) {
          var n = JSON.parse(JSON.stringify(e)),
            r = this.processMessage(t, i);
          return n.thread = {
            messages: [r]
          }, n;
        }
      }, {
        key: "callService",
        value: function callService(e, t, i) {
          if (this.sessionId) {
            this.url = "".concat(ae.THREAD_PREFIX, "/").concat(this.sessionId, "/messages");
            var n = this.processMessage(t, i);
            _.request(this, n, e);
          } else {
            this.url = "".concat(ae.THREAD_PREFIX, "/runs");
            var _n2 = this.createNewThreadMessages(this.rawBody, t, i);
            _.request(this, _n2, e);
          }
          this.messages = e;
        }
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI18 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee76(e, t, i) {
            var n;
            return _regeneratorRuntime().wrap(function _callee76$(_context76) {
              while (1) switch (_context76.prev = _context76.next) {
                case 0:
                  if (this.requestSettings) {
                    _context76.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  this.searchedForThreadId || this.searchPreviousMessagesForThreadId(e.messages);
                  if (!i) {
                    _context76.next = 9;
                    break;
                  }
                  _context76.next = 6;
                  return O.storeFiles(this, e, i);
                case 6:
                  _context76.t0 = _context76.sent;
                  _context76.next = 10;
                  break;
                case 9:
                  _context76.t0 = void 0;
                case 10:
                  n = _context76.t0;
                  this.requestSettings.method = "POST", this.callService(e, t, n);
                case 12:
                case "end":
                  return _context76.stop();
              }
            }, _callee76, this);
          }));
          function callServiceAPI(_x140, _x141, _x142) {
            return _callServiceAPI18.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "searchPreviousMessagesForThreadId",
        value: function searchPreviousMessagesForThreadId(e) {
          var t = e.find(function (i) {
            return i._sessionId;
          });
          t && (this.sessionId = t._sessionId), this.searchedForThreadId = !0;
        }
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData21 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee77(e) {
            var n, t, i;
            return _regeneratorRuntime().wrap(function _callee77$(_context77) {
              while (1) switch (_context77.prev = _context77.next) {
                case 0:
                  if (!e.error) {
                    _context77.next = 2;
                    break;
                  }
                  throw e.error.message;
                case 2:
                  _context77.next = 4;
                  return this.assignThreadAndRun(e);
                case 4:
                  t = "".concat(ae.THREAD_PREFIX, "/").concat(this.sessionId, "/runs/").concat(this.run_id), i = {
                    method: "GET",
                    headers: (n = this.requestSettings) == null ? void 0 : n.headers
                  };
                  return _context77.abrupt("return", (_.executePollRequest(this, t, i, this.messages), {
                    makingAnotherRequest: !0
                  }));
                case 6:
                case "end":
                  return _context77.stop();
              }
            }, _callee77, this);
          }));
          function extractResultData(_x143) {
            return _extractResultData21.apply(this, arguments);
          }
          return extractResultData;
        }()
      }, {
        key: "assignThreadAndRun",
        value: function () {
          var _assignThreadAndRun = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee78(e) {
            var t;
            return _regeneratorRuntime().wrap(function _callee78$(_context78) {
              while (1) switch (_context78.prev = _context78.next) {
                case 0:
                  if (!this.sessionId) {
                    _context78.next = 8;
                    break;
                  }
                  this.url = "".concat(ae.THREAD_PREFIX, "/").concat(this.sessionId, "/runs");
                  _context78.next = 4;
                  return O.directFetch(this, JSON.parse(JSON.stringify(this.rawBody)), "POST");
                case 4:
                  t = _context78.sent;
                  this.run_id = t.id;
                  _context78.next = 9;
                  break;
                case 8:
                  this.sessionId = e.thread_id, this.run_id = e.id, this.messages && (this.messages.messages[this.messages.messages.length - 1]._sessionId = this.sessionId);
                case 9:
                case "end":
                  return _context78.stop();
              }
            }, _callee78, this);
          }));
          function assignThreadAndRun(_x144) {
            return _assignThreadAndRun.apply(this, arguments);
          }
          return assignThreadAndRun;
        }()
      }, {
        key: "extractPollResultData",
        value: function () {
          var _extractPollResultData5 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee79(e) {
            var r, t, i, n;
            return _regeneratorRuntime().wrap(function _callee79$(_context79) {
              while (1) switch (_context79.prev = _context79.next) {
                case 0:
                  t = e.status, i = e.required_action;
                  if (!(t === "queued" || t === "in_progress")) {
                    _context79.next = 3;
                    break;
                  }
                  return _context79.abrupt("return", {
                    timeoutMS: ae.POLLING_TIMEOUT_MS
                  });
                case 3:
                  if (!(t === "completed" && this.messages)) {
                    _context79.next = 10;
                    break;
                  }
                  this.url = "".concat(ae.THREAD_PREFIX, "/").concat(e.thread_id, "/messages");
                  _context79.next = 7;
                  return O.directFetch(this, {}, "GET");
                case 7:
                  _context79.t0 = _context79.sent.data[0].content[0].text.value;
                  _context79.t1 = this.sessionId;
                  return _context79.abrupt("return", {
                    text: _context79.t0,
                    _sessionId: _context79.t1
                  });
                case 10:
                  n = (r = i == null ? void 0 : i.submit_tool_outputs) == null ? void 0 : r.tool_calls;
                  if (!(t === "requires_action" && n)) {
                    _context79.next = 15;
                    break;
                  }
                  _context79.next = 14;
                  return this.handleTools(n);
                case 14:
                  return _context79.abrupt("return", _context79.sent);
                case 15:
                  throw Error("Thread run status: ".concat(t));
                case 16:
                case "end":
                  return _context79.stop();
              }
            }, _callee79, this);
          }));
          function extractPollResultData(_x145) {
            return _extractPollResultData5.apply(this, arguments);
          }
          return extractPollResultData;
        }() // prettier-ignore
      }, {
        key: "handleTools",
        value: function () {
          var _handleTools = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee80(e) {
            var t, i, n;
            return _regeneratorRuntime().wrap(function _callee80$(_context80) {
              while (1) switch (_context80.prev = _context80.next) {
                case 0:
                  if (this._functionHandler) {
                    _context80.next = 2;
                    break;
                  }
                  throw Error("Please define the `function_handler` property inside the [openAI](https://deepchat.dev/docs/directConnection/openAI#Assistant) object.");
                case 2:
                  t = e.map(function (r) {
                    return {
                      name: r["function"].name,
                      arguments: r["function"].arguments
                    };
                  });
                  _context80.next = 5;
                  return this._functionHandler(t);
                case 5:
                  i = _context80.sent;
                  if (!(!Array.isArray(i) || i.find(function (r) {
                    return typeof r != "string";
                  }) || e.length !== i.length)) {
                    _context80.next = 8;
                    break;
                  }
                  throw Error("Response must contain an array of strings for each individual function/tool_call, see https://deepchat.dev/docs/directConnection/OpenAI/#assistant-functions.");
                case 8:
                  n = i.map(function (r, o) {
                    return {
                      tool_call_id: e[o].id,
                      output: r
                    };
                  });
                  this.url = "".concat(ae.THREAD_PREFIX, "/").concat(this.sessionId, "/runs/").concat(this.run_id, "/submit_tool_outputs");
                  _context80.next = 12;
                  return O.directFetch(this, {
                    tool_outputs: n
                  }, "POST");
                case 12:
                  return _context80.abrupt("return", {
                    timeoutMS: ae.POLLING_TIMEOUT_MS
                  });
                case 13:
                case "end":
                  return _context80.stop();
              }
            }, _callee80, this);
          }));
          function handleTools(_x146) {
            return _handleTools.apply(this, arguments);
          }
          return handleTools;
        }()
      }]);
      return ae;
    }(U);
    Qi.THREAD_PREFIX = "https://api.openai.com/v1/threads";
    Qi.POLLING_TIMEOUT_MS = 800;
    var zo = Qi;
    var ri = /*#__PURE__*/function (_U11) {
      _inherits(Se, _U11);
      var _super33 = _createSuper(Se);
      function Se(e) {
        var _this35;
        _classCallCheck(this, Se);
        var o;
        var t = e.directConnection,
          i = t == null ? void 0 : t.openAI,
          n = {
            images: {
              files: {
                acceptedFormats: ".png",
                maxNumberOfFiles: 2
              }
            }
          };
        _this35 = _super33.call(this, e, O.buildKeyVerificationDetails(), O.buildHeaders, i, n), _this35.insertKeyPlaceholderText = "OpenAI API Key", _this35.getKeyLink = "https://platform.openai.com/account/api-keys", _this35.introPanelMarkUp = "\n    <div style=\"width: 100%; text-align: center; margin-left: -10px\"><b>OpenAI DALL\xB7E</b></div>\n    <p><b>Insert text</b> to generate an image.</p>\n    <p><b>Upload 1</b> PNG image to generate its variation and optionally insert text to specify the change.</p>\n    <p><b>Upload 2</b> PNG images where the second is a copy of the first with a transparent area where the edit should\n      take place and text to specify the edit.</p>\n    <p>Click <a href=\"https://platform.openai.com/docs/guides/images/introduction\">here</a> for more info.</p>", _this35.url = "", _this35.permittedErrorPrefixes = ["Incorrect", "Invalid input image"];
        var r = (o = t == null ? void 0 : t.openAI) == null ? void 0 : o.images;
        if (_this35.camera) {
          var a = _typeof(r) == "object" && r.size ? Number.parseInt(r.size) : 1024;
          _this35.camera.files = {
            dimensions: {
              width: a,
              height: a
            }
          };
        }
        _typeof(r) == "object" && Object.assign(_this35.rawBody, r), _this35.canSendMessage = Se.canFileSendMessage;
        return _this35;
      }
      _createClass(Se, [{
        key: "preprocessBody",
        value: function preprocessBody(e, t) {
          var i = JSON.parse(JSON.stringify(e));
          return t && t !== "" && (i.prompt = t), i;
        }
        // prettier-ignore
      }, {
        key: "callApiWithImage",
        value: function callApiWithImage(e, t, i) {
          var o, a;
          var n;
          var r = (a = (o = t[t.length - 1]) == null ? void 0 : o.text) == null ? void 0 : a.trim();
          if (i[1] || r && r !== "") {
            this.url = Se.IMAGE_EDIT_URL;
            var l = this.preprocessBody(this.rawBody, r);
            n = Se.createFormDataBody(l, i[0], i[1]);
          } else this.url = Se.IMAGE_VARIATIONS_URL, n = Se.createFormDataBody(this.rawBody, i[0]);
          E.tempRemoveContentHeader(this.requestSettings, _.request.bind(this, this, n, e), !1);
        }
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI19 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee81(e, t, i) {
            var n, r;
            return _regeneratorRuntime().wrap(function _callee81$(_context81) {
              while (1) switch (_context81.prev = _context81.next) {
                case 0:
                  if ((n = this.requestSettings) != null && n.headers) {
                    _context81.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  if (!(i != null && i[0])) {
                    _context81.next = 6;
                    break;
                  }
                  this.callApiWithImage(e, t, i);
                  _context81.next = 11;
                  break;
                case 6:
                  if (this.requestSettings) {
                    _context81.next = 8;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 8:
                  this.url = Se.IMAGE_GENERATION_URL;
                  r = this.preprocessBody(this.rawBody, t[t.length - 1].text);
                  _.request(this, r, e);
                case 11:
                case "end":
                  return _context81.stop();
              }
            }, _callee81, this);
          }));
          function callServiceAPI(_x147, _x148, _x149) {
            return _callServiceAPI19.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData22 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee82(e) {
            return _regeneratorRuntime().wrap(function _callee82$(_context82) {
              while (1) switch (_context82.prev = _context82.next) {
                case 0:
                  if (!e.error) {
                    _context82.next = 2;
                    break;
                  }
                  throw e.error.message;
                case 2:
                  return _context82.abrupt("return", {
                    files: e.data.map(function (i) {
                      return i.url ? {
                        src: i.url,
                        type: "image"
                      } : {
                        src: "".concat(Et).concat(i.b64_json),
                        type: "image"
                      };
                    })
                  });
                case 3:
                case "end":
                  return _context82.stop();
              }
            }, _callee82);
          }));
          function extractResultData(_x150) {
            return _extractResultData22.apply(this, arguments);
          }
          return extractResultData;
        }() // private static readonly MODAL_MARKDOWN = `
        // 1 image:
        // - With text - edits image based on the text
        // - No text - creates a variation of the image
        // 2 images:
        // - The second image needs to be a copy of the first with a transparent area where the edit should take place.
        // Add text to describe the required modification.
        // Click here for [more info](https://platform.openai.com/docs/guides/images/introduction).
        //   `;
      }], [{
        key: "canFileSendMessage",
        value: function canFileSendMessage(e, t) {
          return !!(t != null && t[0]) || !!(e && e.trim() !== "");
        }
      }, {
        key: "createFormDataBody",
        value: function createFormDataBody(e, t, i) {
          var n = new FormData();
          return n.append("image", t), i && n.append("mask", i), Object.keys(e).forEach(function (r) {
            n.append(r, String(e[r]));
          }), n;
        }
      }]);
      return Se;
    }(U);
    ri.IMAGE_GENERATION_URL = "https://api.openai.com/v1/images/generations";
    ri.IMAGE_VARIATIONS_URL = "https://api.openai.com/v1/images/variations";
    ri.IMAGE_EDIT_URL = "https://api.openai.com/v1/images/edits";
    var Uo = ri;
    var dt = /*#__PURE__*/function (_U12) {
      _inherits(dt, _U12);
      var _super34 = _createSuper(dt);
      function dt(e) {
        var _this36$maxMessages, _l$model;
        var _this36;
        _classCallCheck(this, dt);
        var r, o, a, l;
        var t = JSON.parse(JSON.stringify(e.directConnection)),
          i = t.openAI;
        _this36 = _super34.call(this, e, O.buildKeyVerificationDetails(), O.buildHeaders, i), _this36.insertKeyPlaceholderText = "OpenAI API Key", _this36.getKeyLink = "https://platform.openai.com/account/api-keys", _this36.url = "https://api.openai.com/v1/chat/completions", _this36.permittedErrorPrefixes = ["Incorrect"], _this36._systemMessage = dt.generateSystemMessage("You are a helpful assistant.");
        var n = (r = t.openAI) == null ? void 0 : r.chat;
        if (_typeof(n) == "object") {
          n.system_prompt && (_this36._systemMessage = dt.generateSystemMessage(n.system_prompt));
          var _ref10 = (a = (o = e.directConnection) == null ? void 0 : o.openAI) == null ? void 0 : a.chat,
            c = _ref10.function_handler;
          c && (_this36._functionHandler = c), _this36.cleanConfig(n), Object.assign(_this36.rawBody, n);
        }
        (_this36$maxMessages = _this36.maxMessages) !== null && _this36$maxMessages !== void 0 ? _this36$maxMessages : _this36.maxMessages = -1, (_l$model = (l = _this36.rawBody).model) !== null && _l$model !== void 0 ? _l$model : l.model = "gpt-3.5-turbo";
        return _this36;
      }
      _createClass(dt, [{
        key: "cleanConfig",
        value: function cleanConfig(e) {
          delete e.system_prompt, delete e.function_handler;
        }
      }, {
        key: "preprocessBody",
        value:
        // prettier-ignore
        function preprocessBody(e, t) {
          var _i$max_tokens;
          var i = JSON.parse(JSON.stringify(e)),
            n = Xe.getCharacterLimitMessages(t, this.totalMessagesMaxCharLength ? this.totalMessagesMaxCharLength - this._systemMessage.content.length : -1).map(function (r) {
              return {
                content: dt.getContent(r),
                role: r.role === v.USER_ROLE ? "user" : "assistant"
              };
            });
          return t.find(function (r) {
            return r.files && r.files.length > 0;
          }) && ((_i$max_tokens = i.max_tokens) !== null && _i$max_tokens !== void 0 ? _i$max_tokens : i.max_tokens = 300), i.messages = [this._systemMessage].concat(_toConsumableArray(n)), i;
        }
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI20 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee83(e, t) {
            var i, n;
            return _regeneratorRuntime().wrap(function _callee83$(_context83) {
              while (1) switch (_context83.prev = _context83.next) {
                case 0:
                  if (this.requestSettings) {
                    _context83.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  i = this.preprocessBody(this.rawBody, t), n = this.deepChat.stream;
                  n && (_typeof(n) != "object" || !n.simulation) || i.stream ? (i.stream = !0, I.request(this, i, e)) : _.request(this, i, e);
                case 4:
                case "end":
                  return _context83.stop();
              }
            }, _callee83, this);
          }));
          function callServiceAPI(_x151, _x152) {
            return _callServiceAPI20.apply(this, arguments);
          }
          return callServiceAPI;
        }() // prettier-ignore
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData23 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee84(e, t, i) {
            return _regeneratorRuntime().wrap(function _callee84$(_context84) {
              while (1) switch (_context84.prev = _context84.next) {
                case 0:
                  if (!e.error) {
                    _context84.next = 2;
                    break;
                  }
                  throw e.error.message;
                case 2:
                  return _context84.abrupt("return", e.choices[0].delta ? {
                    text: e.choices[0].delta.content || ""
                  } : e.choices[0].message ? e.choices[0].message.tool_calls ? this.handleTools(e.choices[0].message, t, i) : {
                    text: e.choices[0].message.content
                  } : {
                    text: ""
                  });
                case 3:
                case "end":
                  return _context84.stop();
              }
            }, _callee84, this);
          }));
          function extractResultData(_x153, _x154, _x155) {
            return _extractResultData23.apply(this, arguments);
          }
          return extractResultData;
        }() // prettier-ignore
      }, {
        key: "handleTools",
        value: function () {
          var _handleTools2 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee85(e, t, i) {
            var a, n, r, o, l;
            return _regeneratorRuntime().wrap(function _callee85$(_context85) {
              while (1) switch (_context85.prev = _context85.next) {
                case 0:
                  if (!(!e.tool_calls || !t || !i || !this._functionHandler)) {
                    _context85.next = 2;
                    break;
                  }
                  throw Error("Please define the `function_handler` property inside the [openAI](https://deepchat.dev/docs/directConnection/openAI#Chat) object.");
                case 2:
                  n = JSON.parse(JSON.stringify(i));
                  r = e.tool_calls.map(function (l) {
                    return {
                      name: l["function"].name,
                      arguments: l["function"].arguments
                    };
                  });
                  _context85.next = 6;
                  return (a = this._functionHandler) == null ? void 0 : a.call(this, r);
                case 6:
                  o = _context85.sent;
                  if (!o.text) {
                    _context85.next = 9;
                    break;
                  }
                  return _context85.abrupt("return", {
                    text: o.text
                  });
                case 9:
                  if (!(n.messages.push(e), Array.isArray(o) && !o.find(function (l) {
                    return typeof l != "string";
                  }) || r.length === o.length)) {
                    _context85.next = 17;
                    break;
                  }
                  o.forEach(function (c, d) {
                    var h;
                    var u = (h = e.tool_calls) == null ? void 0 : h[d];
                    n == null || n.messages.push({
                      role: "tool",
                      tool_call_id: u == null ? void 0 : u.id,
                      name: u == null ? void 0 : u["function"].name,
                      content: c.response
                    });
                  }), delete n.tools, delete n.tool_choice;
                  _context85.next = 13;
                  return t == null ? void 0 : t(n).then(function (c) {
                    return E.processResponseByType(c);
                  });
                case 13:
                  l = _context85.sent;
                  if (!l.error) {
                    _context85.next = 16;
                    break;
                  }
                  throw l.error.message;
                case 16:
                  return _context85.abrupt("return", {
                    text: l.choices[0].message.content || ""
                  });
                case 17:
                  throw Error("Response object must either be {response: string}[] for each individual function or {text: string} for a direct response, see https://deepchat.dev/docs/directConnection/OpenAI#FunctionHandler.");
                case 18:
                case "end":
                  return _context85.stop();
              }
            }, _callee85, this);
          }));
          function handleTools(_x156, _x157, _x158) {
            return _handleTools2.apply(this, arguments);
          }
          return handleTools;
        }()
      }], [{
        key: "generateSystemMessage",
        value: function generateSystemMessage(e) {
          return {
            role: "system",
            content: e
          };
        }
      }, {
        key: "getContent",
        value: function getContent(e) {
          if (e.files && e.files.length > 0) {
            var t = e.files.map(function (i) {
              return {
                type: "image_url",
                image_url: {
                  url: i.src
                }
              };
            });
            return e.text && e.text.trim().length > 0 && t.unshift({
              type: "text",
              text: e.text
            }), t;
          }
          return e.text;
        }
      }]);
      return dt;
    }(U);
    var qo = /*#__PURE__*/function (_Yi3) {
      _inherits(qo, _Yi3);
      var _super35 = _createSuper(qo);
      function qo(e) {
        var _this37$maxMessages;
        var _this37;
        _classCallCheck(this, qo);
        var r;
        var t = JSON.parse(JSON.stringify(e.directConnection)),
          i = (r = t.cohere) == null ? void 0 : r.chat,
          n = t.cohere;
        _this37 = _super35.call(this, e, "https://api.cohere.ai/v1/chat", "Ask me anything!", i, n), _typeof(i) == "object" && Object.assign(_this37.rawBody, i), (_this37$maxMessages = _this37.maxMessages) !== null && _this37$maxMessages !== void 0 ? _this37$maxMessages : _this37.maxMessages = -1;
        return _this37;
      }
      _createClass(qo, [{
        key: "preprocessBody",
        value: function preprocessBody(e, t) {
          var i = JSON.parse(JSON.stringify(e)),
            n = t.filter(function (r) {
              return r.text;
            });
          return i.query = n[n.length - 1].text, i.chat_history = n.slice(0, n.length - 1).map(function (r) {
            return {
              text: r.text,
              user_name: r.role === "ai" ? "CHATBOT" : "USER"
            };
          }), i;
        }
      }, {
        key: "callServiceAPI",
        value: function () {
          var _callServiceAPI21 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee86(e, t) {
            var i;
            return _regeneratorRuntime().wrap(function _callee86$(_context86) {
              while (1) switch (_context86.prev = _context86.next) {
                case 0:
                  if (this.requestSettings) {
                    _context86.next = 2;
                    break;
                  }
                  throw new Error("Request settings have not been set up");
                case 2:
                  i = this.preprocessBody(this.rawBody, t);
                  _.request(this, i, e);
                case 4:
                case "end":
                  return _context86.stop();
              }
            }, _callee86, this);
          }));
          function callServiceAPI(_x159, _x160) {
            return _callServiceAPI21.apply(this, arguments);
          }
          return callServiceAPI;
        }()
      }, {
        key: "extractResultData",
        value: function () {
          var _extractResultData24 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee87(e) {
            return _regeneratorRuntime().wrap(function _callee87$(_context87) {
              while (1) switch (_context87.prev = _context87.next) {
                case 0:
                  if (!e.message) {
                    _context87.next = 2;
                    break;
                  }
                  throw e.message;
                case 2:
                  return _context87.abrupt("return", {
                    text: e.text
                  });
                case 3:
                case "end":
                  return _context87.stop();
              }
            }, _callee87);
          }));
          function extractResultData(_x161) {
            return _extractResultData24.apply(this, arguments);
          }
          return extractResultData;
        }()
      }]);
      return qo;
    }(Yi);
    var Ho = /*#__PURE__*/function () {
      function Ho() {
        _classCallCheck(this, Ho);
      }
      _createClass(Ho, null, [{
        key: "create",
        value:
        // this should only be called when no _activeService is set or is demo as otherwise we don't want to reconnect
        function create(e) {
          var t = e.directConnection,
            i = e.request,
            n = e.demo,
            r = e.webModel;
          if (r) return new $i(e);
          if (t) {
            if (t.openAI) return t.openAI.images ? new Uo(e) : t.openAI.speechToText ? new No(e) : t.openAI.textToSpeech ? new Oo(e) : t.openAI.assistant ? new zo(e) : new dt(e);
            if (t.assemblyAI) return new Xi(e);
            if (t.cohere) return t.cohere.textGeneration ? new Lo(e) : t.cohere.summarization ? new Ro(e) : new qo(e);
            if (t.huggingFace) return t.huggingFace.textGeneration ? new Mo(e) : t.huggingFace.summarization ? new Co(e) : t.huggingFace.translation ? new ko(e) : t.huggingFace.fillMask ? new Io(e) : t.huggingFace.questionAnswer ? new To(e) : t.huggingFace.audioSpeechRecognition ? new _o(e) : t.huggingFace.audioClassification ? new So(e) : t.huggingFace.imageClassification ? new wo(e) : new Ao(e);
            if (t.azure) {
              if (t.azure.speechToText) return new Fo(e);
              if (t.azure.textToSpeech) return new jo(e);
              if (t.azure.summarization) return new Do(e);
              if (t.azure.translation) return new Bo(e);
            }
            if (t.stabilityAI) return t.stabilityAI.imageToImage ? new qt(e) : t.stabilityAI.imageToImageUpscale ? new zt(e) : t.stabilityAI.imageToImageMasking ? new Ut(e) : new Ht(e);
          }
          return i ? new Le(e) : new Le(e, void 0, n || !0);
        }
      }]);
      return Ho;
    }();
    var us = /*#__PURE__*/function () {
      function zi() {
        _classCallCheck(this, zi);
      }
      _createClass(zi, null, [{
        key: "appendStyleSheetToHead",
        value: function appendStyleSheetToHead() {
          var e = document.getElementsByTagName("head")[0];
          if (!Array.from(e.getElementsByTagName("link")).some(function (i) {
            return i.getAttribute("href") === zi.FONT_URL;
          })) {
            var _i11 = document.createElement("link");
            _i11.rel = "stylesheet", _i11.href = zi.FONT_URL, e.appendChild(_i11);
          }
        }
      }]);
      return zi;
    }();
    us.FONT_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap";
    var Go = us;
    var hs = /*#__PURE__*/_createClass(function hs() {
      _classCallCheck(this, hs);
    });
    hs.attibutes = {
      string: function string(s) {
        return s;
      },
      number: function number(s) {
        return parseFloat(s);
      },
      "boolean": function boolean(s) {
        return s === "true";
      },
      object: function object(s) {
        return JSON.parse(s);
      },
      array: function array(s) {
        return JSON.parse(s);
      },
      "function": function _function(s) {
        return new Function("return ".concat(s))();
      }
    };
    function y(s) {
      return function (e, t) {
        Object.defineProperty(e, t, {});
        var i = e.constructor,
          n = t.toLocaleLowerCase();
        i._attributes_[n] = hs.attibutes[s], i._attributeToProperty_[n] = t;
      };
    }
    var en = /*#__PURE__*/function () {
      function en() {
        _classCallCheck(this, en);
      }
      _createClass(en, null, [{
        key: "colorToHex",
        value: function colorToHex(e) {
          var t = document.createElement("div");
          return t.style.color = e, document.body.appendChild(t), "#".concat(window.getComputedStyle(t).color.match(/\d+/g).map(function (r) {
            return parseInt(r).toString(16).padStart(2, "0");
          }).join(""));
        }
      }, {
        key: "set",
        value: function set(e, t) {
          var i, n, r, o;
          if ((n = (i = t == null ? void 0 : t.loading) == null ? void 0 : i.bubble) != null && n.color) {
            var a = en.colorToHex((o = (r = t == null ? void 0 : t.loading) == null ? void 0 : r.bubble) == null ? void 0 : o.color);
            e.style.setProperty("--message-dots-color", a), e.style.setProperty("--message-dots-color-fade", "".concat(a, "33"));
          } else e.style.setProperty("--message-dots-color", "#848484"), e.style.setProperty("--message-dots-color-fade", "#55555533");
        }
      }]);
      return en;
    }();
    var Vt = /*#__PURE__*/function () {
      function Vt(e, t, i) {
        _classCallCheck(this, Vt);
        this._isDisplayed = !1, e ? (this._elementRef = this.createIntroPanelWithChild(e, i), this._isDisplayed = !0) : t && (this._elementRef = this.createInternalIntroPanel(t, i), this._isDisplayed = !0);
      }
      _createClass(Vt, [{
        key: "createIntroPanelWithChild",
        value: function createIntroPanelWithChild(e, t) {
          var i = Vt.createIntroPanel(t);
          return e.style.display === "none" && (e.style.display = "block"), i.appendChild(e), i;
        }
      }, {
        key: "createInternalIntroPanel",
        value: function createInternalIntroPanel(e, t) {
          var i = Vt.createIntroPanel(t);
          return i.id = "internal-intro-panel", i.innerHTML = e, i;
        }
      }, {
        key: "hide",
        value: function hide() {
          this._isDisplayed && this._elementRef && (this._elementRef.style.display = "none", this._isDisplayed = !1);
        }
      }, {
        key: "display",
        value: function display() {
          !this._isDisplayed && this._elementRef && (this._elementRef.style.display = "", this._isDisplayed = !0);
        }
      }], [{
        key: "createIntroPanel",
        value: function createIntroPanel(e) {
          var t = document.createElement("div");
          return t.classList.add("intro-panel"), Object.assign(t.style, e), t;
        }
      }]);
      return Vt;
    }();
    var Vo = /*#__PURE__*/function () {
      function Vo() {
        _classCallCheck(this, Vo);
      }
      _createClass(Vo, null, [{
        key: "getText",
        value: function getText(e, t) {
          var i, n;
          if (!e.directConnection && !e.request && !e.webModel && !e.demo) return "Connect to any API using the [request](https://deepchat.dev/docs/connect#Request)\n        property or a popular service via\n        [directConnection](https://deepchat.dev/docs/directConnection/#directConnection).\n        \n Host AI entirely on your browser via a [webModel](WORK).\n        \n To get started checkout the [Start](https://deepchat.dev/start) page and\n        live code [examples](https://deepchat.dev/examples/frameworks).\n        \n To remove this message set the [demo](https://deepchat.dev/docs/demo#demo) property to true.";
          if (e.directConnection) {
            if (!t.isDirectConnection()) return "Please define a valid service inside\n          the [directConnection](https://deepchat.dev/docs/directConnection/#directConnection) object.";
            var r = (i = e.directConnection.openAI) == null ? void 0 : i.chat;
            if (_typeof(r) == "object" && r.tools && !r.function_handler) return "Please define the `function_handler` property inside the openAI [chat](https://deepchat.dev/docs/directConnection/openAI#Chat) object.";
            var o = (n = e.directConnection.openAI) == null ? void 0 : n.assistant;
            if (typeof o == "boolean" || o && !o.assistant_id) return "Please define the `assistant_id` property inside the openAI [assistant](https://deepchat.dev/docs/directConnection/openAI#Assistant) object.";
          } else if (e.request && !e.request.url && !e.request.handler) return "Please define a `url` or a `handler` property inside the [request](https://deepchat.dev/docs/connect#Request) object.";
          return null;
        }
      }]);
      return Vo;
    }();
    var Wo = "<?xml version=\"1.0\" encoding=\"iso-8859-1\"?>\n<svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" \n\t viewBox=\"50 30 420 450\" xml:space=\"preserve\">\n<g filter=\"brightness(0) saturate(100%) invert(16%) sepia(0%) saturate(1942%) hue-rotate(215deg) brightness(99%) contrast(93%)\">\n\t<g>\n\t\t<path d=\"M447.933,103.629c-0.034-3.076-1.224-6.09-3.485-8.352L352.683,3.511c-0.004-0.004-0.007-0.005-0.011-0.008\n\t\t\tC350.505,1.338,347.511,0,344.206,0H89.278C75.361,0,64.04,11.32,64.04,25.237v461.525c0,13.916,11.32,25.237,25.237,25.237\n\t\t\th333.444c13.916,0,25.237-11.32,25.237-25.237V103.753C447.96,103.709,447.937,103.672,447.933,103.629z M356.194,40.931\n\t\t\tl50.834,50.834h-49.572c-0.695,0-1.262-0.567-1.262-1.262V40.931z M423.983,486.763c0,0.695-0.566,1.261-1.261,1.261H89.278\n\t\t\tc-0.695,0-1.261-0.566-1.261-1.261V25.237c0-0.695,0.566-1.261,1.261-1.261h242.94v66.527c0,13.916,11.322,25.239,25.239,25.239\n\t\t\th66.527V486.763z\"/>\n\t</g>\n</g>\n<g>\n\t<g>\n\t\t<path d=\"M362.088,164.014H149.912c-6.62,0-11.988,5.367-11.988,11.988c0,6.62,5.368,11.988,11.988,11.988h212.175\n\t\t\tc6.62,0,11.988-5.368,11.988-11.988C374.076,169.381,368.707,164.014,362.088,164.014z\"/>\n\t</g>\n</g>\n<g>\n\t<g>\n\t\t<path d=\"M362.088,236.353H149.912c-6.62,0-11.988,5.368-11.988,11.988c0,6.62,5.368,11.988,11.988,11.988h212.175\n\t\t\tc6.62,0,11.988-5.368,11.988-11.988C374.076,241.721,368.707,236.353,362.088,236.353z\"/>\n\t</g>\n</g>\n<g>\n\t<g>\n\t\t<path d=\"M362.088,308.691H149.912c-6.62,0-11.988,5.368-11.988,11.988c0,6.621,5.368,11.988,11.988,11.988h212.175\n\t\t\tc6.62,0,11.988-5.367,11.988-11.988C374.076,314.06,368.707,308.691,362.088,308.691z\"/>\n\t</g>\n</g>\n<g>\n\t<g>\n\t\t<path d=\"M256,381.031H149.912c-6.62,0-11.988,5.368-11.988,11.988c0,6.621,5.368,11.988,11.988,11.988H256\n\t\t\tc6.62,0,11.988-5.367,11.988-11.988C267.988,386.398,262.62,381.031,256,381.031z\"/>\n\t</g>\n</g>\n</svg>";
    var fe = /*#__PURE__*/function () {
      function fe() {
        _classCallCheck(this, fe);
      }
      _createClass(fe, null, [{
        key: "createImage",
        value: function createImage(e, t) {
          var i = new Image();
          return i.src = e.src, ne.scrollDownOnImageLoad(i.src, t), ne.processContent(i, i.src);
        }
        // WORK - should base64 images be clickable?
        // WORK - image still does not scroll down when loaded
      }, {
        key: "addNewImageMessage",
        value: function () {
          var _addNewImageMessage = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee88(e, t, i) {
            var n, r;
            return _regeneratorRuntime().wrap(function _callee88$(_context88) {
              while (1) switch (_context88.prev = _context88.next) {
                case 0:
                  n = fe.createImage(t, e.elementRef), r = e.createNewMessageElement("", i);
                  r.bubbleElement.appendChild(n), r.bubbleElement.classList.add("image-message"), ne.addMessage(e, r, "image", i);
                case 2:
                case "end":
                  return _context88.stop();
              }
            }, _callee88);
          }));
          function addNewImageMessage(_x162, _x163, _x164) {
            return _addNewImageMessage.apply(this, arguments);
          }
          return addNewImageMessage;
        }()
      }, {
        key: "createAudioElement",
        value: function createAudioElement(e, t) {
          var i = document.createElement("audio");
          return i.src = e.src, i.classList.add("audio-player"), i.controls = !0, ge.IS_SAFARI && (i.classList.add("audio-player-safari"), i.classList.add(t === v.USER_ROLE ? "audio-player-safari-right" : "audio-player-safari-left")), i;
        }
      }, {
        key: "addNewAudioMessage",
        value: function addNewAudioMessage(e, t, i) {
          var n = fe.createAudioElement(t, i),
            r = e.createNewMessageElement("", i);
          r.bubbleElement.appendChild(n), r.bubbleElement.classList.add("audio-message"), ne.addMessage(e, r, "audio", i);
        }
      }, {
        key: "createAnyFile",
        value: function createAnyFile(e) {
          var t = document.createElement("div");
          t.classList.add("any-file-message-contents");
          var i = document.createElement("div");
          i.classList.add("any-file-message-icon-container");
          var n = q.createSVGElement(Wo);
          n.classList.add("any-file-message-icon"), i.appendChild(n);
          var r = document.createElement("div");
          return r.classList.add("any-file-message-text"), r.textContent = e.name || ne.DEFAULT_FILE_NAME, t.appendChild(i), t.appendChild(r), ne.processContent(t, e.src);
        }
      }, {
        key: "addNewAnyFileMessage",
        value: function addNewAnyFileMessage(e, t, i) {
          var n = e.createNewMessageElement("", i),
            r = fe.createAnyFile(t);
          n.bubbleElement.classList.add("any-file-message-bubble"), n.bubbleElement.appendChild(r), ne.addMessage(e, n, "file", i);
        }
        // no overwrite previous message logic as it is complex to track which files are to be overwritten
      }, {
        key: "addMessages",
        value: function addMessages(e, t, i) {
          t.forEach(function (n) {
            var r, o;
            n.ref && (n = ne.removeFileRef(n)), n.type === "audio" || (r = n.src) != null && r.startsWith("data:audio") ? fe.addNewAudioMessage(e, n, i) : n.type === "image" || (o = n.src) != null && o.startsWith("data:image") ? fe.addNewImageMessage(e, n, i) : fe.addNewAnyFileMessage(e, n, i);
          });
        }
      }]);
      return fe;
    }();
    var me = /*#__PURE__*/function (_Ke) {
      _inherits(me, _Ke);
      var _super36 = _createSuper(me);
      function me(e, t, i) {
        var _this38;
        _classCallCheck(this, me);
        var a, l;
        _this38 = _super36.call(this, e);
        var n = t.permittedErrorPrefixes,
          r = t.introPanelMarkUp,
          o = t.demo;
        _this38._errorMessageOverrides = (a = e.errorMessages) == null ? void 0 : a.overrides, _this38._onClearMessages = jt.onClearMessages.bind(_assertThisInitialized(_this38), e), _this38._onError = jt.onError.bind(_assertThisInitialized(_this38), e), _this38._displayLoadingMessage = me.getDisplayLoadingMessage(e, t), _this38._permittedErrorPrefixes = n, _this38.addSetupMessageIfNeeded(e, t) || _this38.populateIntroPanel(i, r, e.introPanelStyle), _this38.addIntroductoryMessage(e, t), e.initialMessages && _this38.populateInitialMessages(e.initialMessages), _this38._displayServiceErrorMessages = (l = e.errorMessages) == null ? void 0 : l.displayServiceErrorMessages, e.getMessages = function () {
          return JSON.parse(JSON.stringify(_this38.messages));
        }, e.clearMessages = _this38.clearMessages.bind(_assertThisInitialized(_this38), t), e.refreshMessages = _this38.refreshTextMessages.bind(_assertThisInitialized(_this38)), e.scrollToBottom = Y.scrollToBottom.bind(_assertThisInitialized(_this38), _this38.elementRef), e._addMessage = function (c, d) {
          _this38.addNewMessage(_objectSpread(_objectSpread({}, c), {}, {
            sendUpdate: !!d
          }), !d);
        }, t.isWebModel() && t.setUpMessages(_assertThisInitialized(_this38)), o && _this38.prepareDemo(o), e.textToSpeech && Nt.processConfig(e.textToSpeech, function (c) {
          _this38.textToSpeech = c;
        });
        return _this38;
      }
      _createClass(me, [{
        key: "prepareDemo",
        value: function prepareDemo(e) {
          _typeof(e) == "object" && (e.response && (this.customDemoResponse = e.response), e.displayErrors && (e.displayErrors["default"] && this.addNewErrorMessage("", ""), e.displayErrors.service && this.addNewErrorMessage("service", ""), e.displayErrors.speechToText && this.addNewErrorMessage("speechToText", "")), e.displayLoadingBubble && this.addLoadingMessage());
        }
      }, {
        key: "addSetupMessageIfNeeded",
        value: function addSetupMessageIfNeeded(e, t) {
          var i = Vo.getText(e, t);
          if (i) {
            var n = this.createAndAppendNewMessageElement(i, v.AI_ROLE);
            this.applyCustomStyles(n, v.AI_ROLE, !1);
          }
          return !!i;
        }
        // WORK - const file for deep chat classes
      }, {
        key: "addIntroductoryMessage",
        value: function addIntroductoryMessage(e, t) {
          var _i12;
          var n;
          e != null && e.shadowRoot && (this._introMessage = e.introMessage);
          var i = this._introMessage;
          if (t != null && t.isWebModel() && ((_i12 = i) !== null && _i12 !== void 0 ? _i12 : i = t.getIntroMessage(i)), i) {
            var r;
            i != null && i.text ? r = this.createAndAppendNewMessageElement(i.text, v.AI_ROLE) : i != null && i.html && (r = Ye.add(this, i.html, v.AI_ROLE, this.messageElementRefs)), r && (this.applyCustomStyles(r, v.AI_ROLE, !1, (n = this.messageStyles) == null ? void 0 : n.intro), r.outerContainer.classList.add("deep-chat-intro"));
          }
        }
      }, {
        key: "removeIntroductoryMessage",
        value: function removeIntroductoryMessage() {
          var e = this.messageElementRefs[0];
          e.outerContainer.classList.contains("deep-chat-intro") && (e.outerContainer.remove(), this.messageElementRefs.shift());
        }
      }, {
        key: "populateInitialMessages",
        value: function populateInitialMessages(e) {
          var _this39 = this;
          e.forEach(function (t) {
            ke.processInitialMessageFile(t), _this39.addNewMessage(t, !0);
          }), setTimeout(function () {
            return Y.scrollToBottom(_this39.elementRef);
          }, 0);
        }
        // this should not be activated by streamed messages
      }, {
        key: "addNewMessage",
        value: function addNewMessage(e) {
          var t = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : !1;
          var i = me.createMessageContent(e),
            n = {
              status: e.overwrite
            };
          if (!e.ignoreText && i.text !== void 0 && e.text !== null && (this.addNewTextMessage(i.text, i.role, n), !t && this.textToSpeech && i.role !== v.USER_ROLE && Nt.speak(i.text, this.textToSpeech)), i.files && Array.isArray(i.files) && fe.addMessages(this, i.files, i.role), i.html !== void 0 && i.html !== null) {
            var r = Ye.add(this, i.html, i.role, this.messageElementRefs, n);
            be.isElementTemporary(r) && delete i.html;
          }
          this.isValidMessageContent(i) && this.updateStateOnMessage(i, e.overwrite, e.sendUpdate, t);
        }
      }, {
        key: "isValidMessageContent",
        value: function isValidMessageContent(e) {
          return e.text || e.html || e.files && e.files.length > 0;
        }
      }, {
        key: "updateStateOnMessage",
        value: function updateStateOnMessage(e, t) {
          var i = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : !0;
          var n = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : !1;
          t || this.messages.push(e), i && this.sendClientUpdate(e, n);
        }
        // prettier-ignore
      }, {
        key: "removeMessageOnError",
        value: function removeMessageOnError() {
          var e = this.messageElementRefs[this.messageElementRefs.length - 1],
            t = e == null ? void 0 : e.bubbleElement;
          (t != null && t.classList.contains(Ze.MESSAGE_CLASS) && t.textContent === "" || me.isTemporaryElement(e)) && this.removeLastMessage();
        }
        // prettier-ignore
      }, {
        key: "addNewErrorMessage",
        value: function addNewErrorMessage(e, t) {
          var l, c, d, u, h;
          this.removeMessageOnError();
          var i = me.createBaseElements(),
            n = i.outerContainer,
            r = i.bubbleElement;
          r.classList.add("error-message-text");
          var o = this.getPermittedMessage(t) || ((l = this._errorMessageOverrides) == null ? void 0 : l[e]) || ((c = this._errorMessageOverrides) == null ? void 0 : c["default"]) || "Error, please try again.";
          this.renderText(r, o);
          var a = D.extractParticularSharedStyles(["fontSize", "fontFamily"], (d = this.messageStyles) == null ? void 0 : d["default"]);
          D.applyCustomStylesToElements(i, !1, a), D.applyCustomStylesToElements(i, !1, (u = this.messageStyles) == null ? void 0 : u.error), this.elementRef.appendChild(n), Y.scrollToBottom(this.elementRef), this.textToSpeech && Nt.speak(o, this.textToSpeech), (h = this._onError) == null || h.call(this, o);
        }
      }, {
        key: "getPermittedMessage",
        value: function getPermittedMessage(e) {
          if (e) {
            if (this._displayServiceErrorMessages) return e;
            if (typeof e == "string" && this._permittedErrorPrefixes) {
              var t = me.checkPermittedErrorPrefixes(this._permittedErrorPrefixes, e);
              if (t) return t;
            } else if (Array.isArray(e) && this._permittedErrorPrefixes) for (var _t3 = 0; _t3 < e.length; _t3 += 1) {
              var _i13 = me.checkPermittedErrorPrefixes(this._permittedErrorPrefixes, e[_t3]);
              if (_i13) return _i13;
            }
          }
        }
      }, {
        key: "isLastMessageError",
        value: function isLastMessageError() {
          var e;
          return (e = v.getLastMessageBubbleElement(this.elementRef)) == null ? void 0 : e.classList.contains("error-message-text");
        }
      }, {
        key: "removeError",
        value: function removeError() {
          this.isLastMessageError() && v.getLastMessageElement(this.elementRef).remove();
        }
      }, {
        key: "addLoadingMessage",
        value: function addLoadingMessage() {
          var r;
          if (!this._displayLoadingMessage) return;
          var e = this.createMessageElements("", v.AI_ROLE),
            t = e.outerContainer,
            i = e.bubbleElement;
          i.classList.add("loading-message-text");
          var n = document.createElement("div");
          n.classList.add("dots-flashing"), i.appendChild(n), this.applyCustomStyles(e, v.AI_ROLE, !1, (r = this.messageStyles) == null ? void 0 : r.loading), en.set(i, this.messageStyles), this.elementRef.appendChild(t), Y.scrollToBottom(this.elementRef);
        }
      }, {
        key: "populateIntroPanel",
        value: function populateIntroPanel(e, t, i) {
          (e || t) && (this._introPanel = new Vt(e, t, i), this._introPanel._elementRef && (se.apply(this, this._introPanel._elementRef), this.elementRef.appendChild(this._introPanel._elementRef)));
        }
      }, {
        key: "addMultipleFiles",
        value: function () {
          var _addMultipleFiles = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee89(e) {
            return _regeneratorRuntime().wrap(function _callee89$(_context89) {
              while (1) switch (_context89.prev = _context89.next) {
                case 0:
                  return _context89.abrupt("return", Promise.all((e || []).map(function (t) {
                    return new Promise(function (i) {
                      if (!t.type || t.type === "any") {
                        var n = t.file.name || ne.DEFAULT_FILE_NAME;
                        i({
                          name: n,
                          type: "any",
                          ref: t.file
                        });
                      } else {
                        var _n3 = new FileReader();
                        _n3.readAsDataURL(t.file), _n3.onload = function () {
                          i({
                            src: _n3.result,
                            type: t.type,
                            ref: t.file
                          });
                        };
                      }
                    });
                  })));
                case 1:
                case "end":
                  return _context89.stop();
              }
            }, _callee89);
          }));
          function addMultipleFiles(_x165) {
            return _addMultipleFiles.apply(this, arguments);
          }
          return addMultipleFiles;
        }() // WORK - update all message classes to use deep-chat prefix
      }, {
        key: "clearMessages",
        value: function clearMessages(e, t) {
          var n, r;
          var i = [];
          this.messageElementRefs.forEach(function (o) {
            var a = o.bubbleElement.classList;
            a.contains("loading-message-text") || a.contains(Ze.MESSAGE_CLASS) ? i.push(o) : o.outerContainer.remove();
          }), Array.from(this.elementRef.children).forEach(function (o) {
            var l;
            var a = (l = o.children[0]) == null ? void 0 : l.children[0];
            a != null && a.classList.contains("error-message-text") && o.remove();
          }), this.messageElementRefs = i, t !== !1 && ((n = this._introPanel) != null && n._elementRef && this._introPanel.display(), this.addIntroductoryMessage()), this.messages.splice(0, this.messages.length), this.textElementsToText.splice(0, this.textElementsToText.length), (r = this._onClearMessages) == null || r.call(this), delete e.sessionId;
        }
      }], [{
        key: "getDisplayLoadingMessage",
        value: function getDisplayLoadingMessage(e, t) {
          var _e$displayLoadingBubb;
          return t.websocket ? !1 : (_e$displayLoadingBubb = e.displayLoadingBubble) !== null && _e$displayLoadingBubb !== void 0 ? _e$displayLoadingBubb : !0;
        }
      }, {
        key: "checkPermittedErrorPrefixes",
        value: function checkPermittedErrorPrefixes(e, t) {
          for (var _i14 = 0; _i14 < e.length; _i14 += 1) if (t.startsWith(e[_i14])) return t;
        }
      }]);
      return me;
    }(Ke);
    var St = /*#__PURE__*/function () {
      function W() {
        _classCallCheck(this, W);
      }
      _createClass(W, null, [{
        key: "adjustInputPadding",
        value: function adjustInputPadding(e, t) {
          t["inside-left"].length > 0 && e.classList.add("text-input-inner-left-adjustment"), t["inside-right"].length > 0 && e.classList.add("text-input-inner-right-adjustment");
        }
      }, {
        key: "adjustForOutsideButton",
        value: function adjustForOutsideButton(e, t, i) {
          i["outside-right"].length === 0 && i["outside-left"].length > 0 ? (e[0].classList.add(W.INPUT_OUTSIDE_LEFT_SMALL_ADJUSTMENT_CLASS), t.classList.add(W.INPUT_OUTSIDE_LEFT_SMALL_ADJUSTMENT_CLASS)) : i["outside-left"].length === 0 && i["outside-right"].length > 0 && (e[3].classList.add(W.INPUT_OUTSIDE_RIGHT_SMALL_ADJUSTMENT_CLASS), t.classList.add(W.INPUT_OUTSIDE_RIGHT_SMALL_ADJUSTMENT_CLASS));
        }
        // when submit is the only button
        // when submit button is outside by itself - we increase the height for a better look
      }, {
        key: "adjustOutsideSubmit",
        value: function adjustOutsideSubmit(e, t, i) {
          if (!(i["inside-left"].length > 0 || i["inside-right"].length > 0)) {
            if (i["outside-right"].length === 0 && i["outside-left"].length > 0) return e[0].classList.add(W.INPUT_OUTSIDE_LEFT_ADJUSTMENT_CLASS), t.classList.add(W.INPUT_OUTSIDE_LEFT_ADJUSTMENT_CLASS), i["outside-left"].map(function (n) {
              return n.button.elementRef.classList.add("submit-button-enlarged");
            });
            if (i["outside-left"].length === 0 && i["outside-right"].length > 0) return e[3].classList.add(W.INPUT_OUTSIDE_RIGHT_ADJUSTMENT_CLASS), t.classList.add(W.INPUT_OUTSIDE_RIGHT_ADJUSTMENT_CLASS), i["outside-right"].map(function (n) {
              return n.button.elementRef.classList.add("submit-button-enlarged");
            });
          }
        }
      }, {
        key: "set",
        value: function set(e, t, i, n) {
          !!W.adjustOutsideSubmit(t, i, n) || W.adjustForOutsideButton(t, i, n), W.adjustInputPadding(e, n);
        }
      }]);
      return W;
    }();
    St.INPUT_OUTSIDE_LEFT_ADJUSTMENT_CLASS = "text-input-container-left-adjustment";
    St.INPUT_OUTSIDE_RIGHT_ADJUSTMENT_CLASS = "text-input-container-right-adjustment";
    St.INPUT_OUTSIDE_LEFT_SMALL_ADJUSTMENT_CLASS = "text-input-container-left-small-adjustment";
    St.INPUT_OUTSIDE_RIGHT_SMALL_ADJUSTMENT_CLASS = "text-input-container-right-small-adjustment";
    var Ko = St;
    var Qe = /*#__PURE__*/function () {
      function Qe() {
        _classCallCheck(this, Qe);
      }
      _createClass(Qe, null, [{
        key: "create",
        value: function create() {
          return Array.from({
            length: 4
          }).map(function (e, t) {
            var i = document.createElement("div");
            return i.classList.add("input-button-container"), (t === 0 || t === 3) && i.classList.add("outer-button-container"), (t === 1 || t === 2) && i.classList.add("inner-button-container"), i;
          });
        }
      }, {
        key: "add",
        value: function add(e, t) {
          e.insertBefore(t[1], e.firstChild), e.insertBefore(t[0], e.firstChild), e.appendChild(t[2]), e.appendChild(t[3]);
        }
      }, {
        key: "getContainerIndex",
        value: function getContainerIndex(e) {
          return e === "outside-left" ? 0 : e === "inside-left" ? 1 : e === "inside-right" ? 2 : 3;
        }
      }, {
        key: "addButton",
        value: function addButton(e, t, i) {
          t.classList.add(i);
          var n = Qe.getContainerIndex(i);
          e[n].appendChild(t), n === 3 && t.classList.add("outside-right");
        }
      }]);
      return Qe;
    }();
    var Sn = ["camera", "gifs", "images", "audio", "mixedFiles", "submit", "microphone"];
    var j = /*#__PURE__*/function () {
      function j() {
        _classCallCheck(this, j);
      }
      _createClass(j, null, [{
        key: "createTextElement",
        value: function createTextElement(e) {
          var t = document.createElement("div");
          return t.classList.add("text-button"), t.innerText = e, t;
        }
      }, {
        key: "createElement",
        value: function createElement(e, t) {
          return t ? j.createTextElement(e) : q.createSVGElement(e);
        }
      }, {
        key: "createCustomElement",
        value: function createCustomElement(e, t) {
          var n, r, o, a;
          var i = t == null ? void 0 : t[e];
          if ((n = i == null ? void 0 : i.text) != null && n.content) return j.createElement((r = i == null ? void 0 : i.text) == null ? void 0 : r.content, !0);
          if ((o = i == null ? void 0 : i.svg) != null && o.content) return j.createElement((a = i == null ? void 0 : i.svg) == null ? void 0 : a.content, !1);
        }
      }, {
        key: "processElement",
        value: function processElement(e, t) {
          t != null && t.classList.contains("text-button") || e.classList.add("input-button-svg");
        }
        // publicly used for creating elements that do not change state in a sequence
        // prettier-ignore
      }, {
        key: "createSpecificStateElement",
        value: function createSpecificStateElement(e, t, i) {
          var n;
          return i && (n = j.createCustomElement(t, i)), j.processElement(e, n), n;
        }
        // used for creating elements that change state in a sequence
        // prettier-ignore
      }, {
        key: "create",
        value: function create(e, t, i) {
          var n = {};
          if (!i) return j.processElement(e), n;
          var r = j.createSpecificStateElement(e, t[0], i);
          n[t[0]] = r;
          var o = r;
          return t.slice(1).forEach(function (a) {
            o = j.createCustomElement(a, i) || o, n[a] = o;
          }), n;
        }
      }]);
      return j;
    }();
    var Jo = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<svg viewBox=\"0 0 32 32\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\">\n    <path d=\"M16 0c-8.836 0-16 7.163-16 16s7.163 16 16 16c8.837 0 16-7.163 16-16s-7.163-16-16-16zM16 30.032c-7.72 0-14-6.312-14-14.032s6.28-14 14-14 14 6.28 14 14-6.28 14.032-14 14.032zM23 15h-6v-6c0-0.552-0.448-1-1-1s-1 0.448-1 1v6h-6c-0.552 0-1 0.448-1 1s0.448 1 1 1h6v6c0 0.552 0.448 1 1 1s1-0.448 1-1v-6h6c0.552 0 1-0.448 1-1s-0.448-1-1-1z\"></path>\n</svg>";
    var te = /*#__PURE__*/function () {
      function te() {
        _classCallCheck(this, te);
      }
      _createClass(te, null, [{
        key: "unsetAllCSS",
        value: function unsetAllCSS(e, t) {
          var i, n;
          t.container && T.unsetAllCSSMouseStates(e, t.container), (i = t.svg) != null && i.styles && T.unsetAllCSSMouseStates(e.children[0], t.svg.styles), (n = t.text) != null && n.styles && T.unsetAllCSSMouseStates(e.children[0], t.text.styles);
        }
      }, {
        key: "unsetActionCSS",
        value: function unsetActionCSS(e, t) {
          var i, n;
          t.container && T.unsetActivityCSSMouseStates(e, t.container), (i = t.svg) != null && i.styles && T.unsetActivityCSSMouseStates(e.children[0], t.svg.styles), (n = t.text) != null && n.styles && T.unsetActivityCSSMouseStates(e.children[0], t.text.styles);
        }
      }, {
        key: "setElementsCSS",
        value: function setElementsCSS(e, t, i) {
          var n, r, o, a, l;
          Object.assign(e.style, (n = t.container) == null ? void 0 : n[i]), Object.assign(e.children[0].style, (o = (r = t.svg) == null ? void 0 : r.styles) == null ? void 0 : o[i]), Object.assign(e.children[0].style, (l = (a = t.text) == null ? void 0 : a.styles) == null ? void 0 : l[i]);
        }
      }, {
        key: "setElementCssUpToState",
        value: function setElementCssUpToState(e, t, i) {
          te.setElementsCSS(e, t, "default"), i !== "default" && (te.setElementsCSS(e, t, "hover"), i !== "hover" && te.setElementsCSS(e, t, "click"));
        }
      }]);
      return te;
    }();
    var wt = /*#__PURE__*/function () {
      function wt(e, t, i, n) {
        _classCallCheck(this, wt);
        this._mouseState = {
          state: "default"
        }, this.elementRef = e, this._customStyles = i, this.position = t, this.dropupText = n;
      }
      _createClass(wt, [{
        key: "buttonMouseLeave",
        value: function buttonMouseLeave(e) {
          this._mouseState.state = "default", e && (te.unsetAllCSS(this.elementRef, e), te.setElementsCSS(this.elementRef, e, "default"));
        }
      }, {
        key: "buttonMouseEnter",
        value: function buttonMouseEnter(e) {
          this._mouseState.state = "hover", e && te.setElementsCSS(this.elementRef, e, "hover");
        }
      }, {
        key: "buttonMouseUp",
        value: function buttonMouseUp(e) {
          e && te.unsetActionCSS(this.elementRef, e), this.buttonMouseEnter(e);
        }
      }, {
        key: "buttonMouseDown",
        value: function buttonMouseDown(e) {
          this._mouseState.state = "click", e && te.setElementsCSS(this.elementRef, e, "click");
        }
        // be careful not to use onclick as that is used for button functionality
      }, {
        key: "setEvents",
        value: function setEvents(e) {
          this.elementRef.onmousedown = this.buttonMouseDown.bind(this, e), this.elementRef.onmouseup = this.buttonMouseUp.bind(this, e), this.elementRef.onmouseenter = this.buttonMouseEnter.bind(this, e), this.elementRef.onmouseleave = this.buttonMouseLeave.bind(this, e);
        }
      }, {
        key: "unsetCustomStateStyles",
        value: function unsetCustomStateStyles(e) {
          if (this._customStyles) for (var t = 0; t < e.length; t += 1) {
            var _i15 = e[t],
              n = _i15 && this._customStyles[_i15];
            n && te.unsetActionCSS(this.elementRef, n);
          }
        }
      }, {
        key: "reapplyStateStyle",
        value: function reapplyStateStyle(e, t) {
          if (!this._customStyles) return;
          t && this.unsetCustomStateStyles(t);
          var i = this._customStyles[e];
          i && te.setElementCssUpToState(this.elementRef, i, this._mouseState.state), this.setEvents(i);
        }
      }]);
      return wt;
    }();
    var gt = /*#__PURE__*/function () {
      function gt() {
        _classCallCheck(this, gt);
      }
      _createClass(gt, null, [{
        key: "focusItemWhenOnEdge",
        value: function focusItemWhenOnEdge(e, t) {
          var i = t ? e.children[0] : e.children[e.children.length - 1];
          gt.focusSiblingItem(i, e, t, !0);
        }
        // isEdgeItem means is it a start or end item
        // prettier-ignore
      }, {
        key: "focusSiblingItem",
        value: function focusSiblingItem(e, t, i) {
          var n = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : !1;
          var r = n ? e : e[i ? "nextSibling" : "previousSibling"];
          r ? (e.dispatchEvent(new MouseEvent("mouseleave")), r.dispatchEvent(new MouseEvent("mouseenter"))) : (e.dispatchEvent(new MouseEvent("mouseleave")), gt.focusItemWhenOnEdge(t, i));
        }
      }]);
      return gt;
    }();
    var _e = /*#__PURE__*/function () {
      function _e() {
        _classCallCheck(this, _e);
      }
      _createClass(_e, null, [{
        key: "addItemEvents",
        value: function addItemEvents(e, t, i, n) {
          Te.add(t, n), t.addEventListener("click", function () {
            i.click();
          }), t.addEventListener("mouseenter", function (r) {
            e.highlightedItem = r.target;
          }), t.addEventListener("mouseleave", function () {
            e.highlightedItem = void 0;
          });
        }
      }, {
        key: "createItemText",
        value: function createItemText(e, t) {
          var i = document.createElement("div");
          return Object.assign(i.style, t), i.classList.add("dropup-menu-item-text"), i.textContent = e || "File", i;
        }
      }, {
        key: "createItemIcon",
        value: function createItemIcon(e, t) {
          var i = document.createElement("div");
          return Object.assign(i.style, t), i.classList.add("dropup-menu-item-icon"), i.appendChild(e.children[0]), i;
        }
      }, {
        key: "populateItem",
        value: function populateItem(e, t, i, n) {
          var r = e.children[0];
          r.classList.contains("text-button") ? t.appendChild(_e.createItemText(r.textContent, n == null ? void 0 : n.text)) : (t.appendChild(_e.createItemIcon(e, n == null ? void 0 : n.iconContainer)), t.appendChild(_e.createItemText(i, n == null ? void 0 : n.text)));
        }
        // prettier-ignore
      }, {
        key: "createItem",
        value: function createItem(e, t, i) {
          var l;
          var n = t.elementRef,
            r = t.dropupText,
            o = document.createElement("div");
          Object.assign(o.style, (l = i == null ? void 0 : i.item) == null ? void 0 : l["default"]), _e.populateItem(n, o, r, i), o.classList.add("dropup-menu-item");
          var a = T.processStateful((i == null ? void 0 : i.item) || {}, {
            backgroundColor: "#f3f3f3"
          }, {
            backgroundColor: "#ebebeb"
          });
          return _e.addItemEvents(e, o, n, a), o;
        }
      }]);
      return _e;
    }();
    var tn = /*#__PURE__*/function () {
      function tn(e, t) {
        var _this40 = this;
        _classCallCheck(this, tn);
        var i;
        this._isOpen = !0, this._styles = t, this.elementRef = tn.createElement((i = this._styles) == null ? void 0 : i.container), this.close(), setTimeout(function () {
          return _this40.addWindowEvents(e);
        });
      }
      _createClass(tn, [{
        key: "open",
        value: function open() {
          this.elementRef.style.display = "block", this._isOpen = !0;
        }
      }, {
        key: "close",
        value: function close() {
          this._isOpen && (this.elementRef.style.display = "none", this._isOpen = !1);
        }
      }, {
        key: "toggle",
        value: function toggle() {
          this._isOpen ? this.close() : this.open();
        }
      }, {
        key: "addItem",
        value: function addItem(e) {
          var t = _e.createItem(this, e, this._styles);
          this.elementRef.appendChild(t);
        }
        // prettier-ignore
      }, {
        key: "addWindowEvents",
        value: function addWindowEvents(e) {
          this.clickEvent = this.windowClick.bind(this, e), window.addEventListener("click", this.clickEvent), this.keyDownEvent = this.windowKeyDown.bind(this, e), window.addEventListener("keydown", this.keyDownEvent);
        }
      }, {
        key: "windowClick",
        value: function windowClick(e, t) {
          var i;
          !e.isConnected && this.clickEvent ? window.removeEventListener("click", this.clickEvent) : e.parentElement !== ((i = t.target.shadowRoot) == null ? void 0 : i.children[0]) && this.close();
        }
        // prettier-ignore
      }, {
        key: "windowKeyDown",
        value: function windowKeyDown(e, t) {
          var i, n, r;
          !e.isConnected && this.keyDownEvent ? window.removeEventListener("keydown", this.keyDownEvent) : this._isOpen && (t.key === R.ESCAPE ? (this.close(), (i = this.highlightedItem) == null || i.dispatchEvent(new MouseEvent("mouseleave"))) : t.key === R.ENTER ? ((n = this.highlightedItem) == null || n.click(), (r = this.highlightedItem) == null || r.dispatchEvent(new MouseEvent("mouseleave"))) : t.key === R.ARROW_DOWN ? gt.focusSiblingItem(this.highlightedItem || this.elementRef.children[this.elementRef.children.length - 1], this.elementRef, !0) : t.key === R.ARROW_UP && gt.focusSiblingItem(this.highlightedItem || this.elementRef.children[0], this.elementRef, !1));
        }
      }], [{
        key: "createElement",
        value: function createElement(e) {
          var t = document.createElement("div");
          return t.id = "dropup-menu", Object.assign(t.style, e), t;
        }
      }]);
      return tn;
    }();
    var Je = /*#__PURE__*/function (_wt) {
      _inherits(Je, _wt);
      var _super37 = _createSuper(Je);
      function Je(e, t) {
        var _this41;
        _classCallCheck(this, Je);
        var n;
        _this41 = _super37.call(this, Je.createButtonElement(), void 0, {
          styles: (n = t == null ? void 0 : t.button) == null ? void 0 : n.styles
        });
        var i = _this41.createInnerElements(_this41._customStyles);
        _this41._menu = new tn(e, t == null ? void 0 : t.menu), _this41.addClickEvent(), _this41.buttonContainer = Je.createButtonContainer(), _this41.elementRef.appendChild(i.styles), _this41.buttonContainer.appendChild(_this41.elementRef), _this41.elementRef.classList.add("dropup-icon", "upload-file-button"), _this41.buttonContainer.appendChild(_this41._menu.elementRef), _this41.reapplyStateStyle("styles"), _this41.addContainerEvents(e);
        return _this41;
      }
      _createClass(Je, [{
        key: "createInnerElements",
        value: function createInnerElements(e) {
          return {
            styles: this.createInnerElement(Je.createSVGIconElement(), "styles", e)
          };
        }
      }, {
        key: "createInnerElement",
        value: function createInnerElement(e, t, i) {
          return j.createSpecificStateElement(this.elementRef, t, i) || e;
        }
      }, {
        key: "addClickEvent",
        value: function addClickEvent() {
          this.elementRef.onclick = this._menu.toggle.bind(this._menu);
        }
      }, {
        key: "addItem",
        value: function addItem(e) {
          this._menu.addItem(e);
        }
      }, {
        key: "addContainerEvents",
        value: function addContainerEvents(e) {
          var _this42 = this;
          e.addEventListener("click", function (t) {
            t.target.classList.contains("dropup-icon") || _this42._menu.close();
          });
        }
      }], [{
        key: "createButtonElement",
        value: function createButtonElement() {
          var e = document.createElement("div");
          return e.classList.add("input-button"), e;
        }
      }, {
        key: "createSVGIconElement",
        value: function createSVGIconElement() {
          var e = q.createSVGElement(Jo);
          return e.id = "dropup-icon", e;
        }
      }, {
        key: "createButtonContainer",
        value: function createButtonContainer() {
          var e = document.createElement("div");
          return e.id = "dropup-container", e;
        }
      }, {
        key: "getPosition",
        value: function getPosition(e, t) {
          var i, n;
          return (i = t == null ? void 0 : t.button) != null && i.position ? (n = t == null ? void 0 : t.button) == null ? void 0 : n.position : e["outside-left"].length > 0 && e["outside-right"].length === 0 ? "outside-right" : "outside-left";
        }
      }]);
      return Je;
    }(wt);
    var F = /*#__PURE__*/function () {
      function F() {
        _classCallCheck(this, F);
      }
      _createClass(F, null, [{
        key: "addToDropup",
        value:
        // prettier-ignore
        function addToDropup(e, t, i, n) {
          var r = new Je(i, n);
          Sn.forEach(function (a) {
            var l = t["dropup-menu"].findIndex(function (d) {
                return d.buttonType === a;
              }),
              c = t["dropup-menu"][l];
            c && (r.addItem(c.button), t["dropup-menu"].splice(l, 1));
          });
          var o = Je.getPosition(t, n);
          Qe.addButton(e, r.buttonContainer, o), t[o].push({});
        }
      }, {
        key: "addToSideContainer",
        value: function addToSideContainer(e, t) {
          ["inside-left", "inside-right", "outside-left", "outside-right"].forEach(function (n) {
            var r = n;
            t[r].forEach(function (o) {
              Qe.addButton(e, o.button.elementRef, r);
            });
          });
        }
      }, {
        key: "setPosition",
        value: function setPosition(e, t, i) {
          var n = _objectSpread(_objectSpread({}, e[t]), {}, {
            buttonType: t
          });
          i.push(n), delete e[t];
        }
      }, {
        key: "createPositionsObj",
        value: function createPositionsObj() {
          return {
            "dropup-menu": [],
            "outside-left": [],
            "inside-left": [],
            "inside-right": [],
            "outside-right": []
          };
        }
        // prettier-ignore
      }, {
        key: "generatePositions",
        value: function generatePositions(e) {
          var t = F.createPositionsObj();
          Object.keys(e).forEach(function (n) {
            var o;
            var r = (o = e[n]) == null ? void 0 : o.button.position;
            r && F.setPosition(e, n, t[r]);
          }), t["inside-right"].length === 0 && e.submit && F.setPosition(e, "submit", t["inside-right"]), t["outside-right"].length === 0 && (e.submit ? F.setPosition(e, "submit", t["outside-right"]) : e.microphone ? F.setPosition(e, "microphone", t["outside-right"]) : e.camera && F.setPosition(e, "camera", t["outside-right"])), e.submit && F.setPosition(e, "submit", t["outside-left"].length === 0 ? t["outside-left"] : t["inside-right"]), e.microphone && F.setPosition(e, "microphone", t["outside-left"].length === 0 ? t["outside-left"] : t["inside-right"]);
          var i = Object.keys(e);
          return i.length > 1 || t["dropup-menu"].length > 0 ? Sn.forEach(function (n) {
            e[n] && t["dropup-menu"].push(_objectSpread(_objectSpread({}, e[n]), {}, {
              buttonType: n
            }));
          }) : i.length === 1 && F.setPosition(e, i[0], t["outside-right"].length === 0 ? t["outside-right"] : t["outside-left"]), t;
        }
        // prettier-ignore
      }, {
        key: "addButtons",
        value: function addButtons(e, t, i, n) {
          var r = F.generatePositions(t);
          return F.addToSideContainer(e, r), r["dropup-menu"].length > 0 && F.addToDropup(e, r, i, n), r;
        }
      }]);
      return F;
    }();
    var $o = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<svg viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<title>file</title>\n<path d=\"M20 10.9696L11.9628 18.5497C10.9782 19.4783 9.64274 20 8.25028 20C6.85782 20 5.52239 19.4783 4.53777 18.5497C3.55315 17.6211 3 16.3616 3 15.0483C3 13.7351 3.55315 12.4756 4.53777 11.547L12.575 3.96687C13.2314 3.34779 14.1217 3 15.05 3C15.9783 3 16.8686 3.34779 17.525 3.96687C18.1814 4.58595 18.5502 5.4256 18.5502 6.30111C18.5502 7.17662 18.1814 8.01628 17.525 8.63535L9.47904 16.2154C9.15083 16.525 8.70569 16.6989 8.24154 16.6989C7.77738 16.6989 7.33224 16.525 7.00403 16.2154C6.67583 15.9059 6.49144 15.4861 6.49144 15.0483C6.49144 14.6106 6.67583 14.1907 7.00403 13.8812L14.429 6.88674\" stroke=\"#000000\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n</svg>",
      Yo = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path d=\"M20,15.2928932 L20,5.5 C20,4.67157288 19.3284271,4 18.5,4 L5.5,4 C4.67157288,4 4,4.67157288 4,5.5 L4,12.2928932 L7.14644661,9.14644661 C7.34170876,8.95118446 7.65829124,8.95118446 7.85355339,9.14644661 L13.5,14.7928932 L16.1464466,12.1464466 C16.3417088,11.9511845 16.6582912,11.9511845 16.8535534,12.1464466 L20,15.2928932 Z M20,16.7071068 L16.5,13.2071068 L13.8535534,15.8535534 C13.6582912,16.0488155 13.3417088,16.0488155 13.1464466,15.8535534 L7.5,10.2071068 L4,13.7071068 L4,18.5 C4,19.3284271 4.67157288,20 5.5,20 L18.5,20 C19.3284271,20 20,19.3284271 20,18.5 L20,16.7071068 Z M3,5.5 C3,4.11928813 4.11928813,3 5.5,3 L18.5,3 C19.8807119,3 21,4.11928813 21,5.5 L21,18.5 C21,19.8807119 19.8807119,21 18.5,21 L5.5,21 C4.11928813,21 3,19.8807119 3,18.5 L3,5.5 Z M15,6 L17,6 C17.5522847,6 18,6.44771525 18,7 L18,9 C18,9.55228475 17.5522847,10 17,10 L15,10 C14.4477153,10 14,9.55228475 14,9 L14,7 C14,6.44771525 14.4477153,6 15,6 Z M15,7 L15,9 L17,9 L17,7 L15,7 Z\"/>\n</svg>\n",
      Zo = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"-49.49 -49.49 593.87 593.87\" stroke-width=\"3.95908\" transform=\"rotate(0)\">\n  <g stroke-width=\"0\"></g>\n  <g stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"0.98977\"></g>\n  <g>\n    <g>\n      <g>\n        <path d=\"M163.205,76.413v293.301c-3.434-3.058-7.241-5.867-11.486-8.339c-21.38-12.452-49.663-15.298-77.567-7.846 c-49.038,13.096-80.904,54.519-71.038,92.337c4.019,15.404,14.188,28.221,29.404,37.087c13.553,7.894,29.87,11.933,47.115,11.933 c9.962,0,20.231-1.356,30.447-4.087c42.74-11.406,72.411-44.344,72.807-77.654h0.011v-0.162c0.002-0.166,0-0.331,0-0.496V187.072 l290.971-67.3v178.082c-3.433-3.055-7.238-5.863-11.481-8.334c-21.385-12.452-49.654-15.308-77.567-7.846 c-49.038,13.087-80.904,54.519-71.038,92.356c4.019,15.385,14.183,28.212,29.404,37.067c13.548,7.894,29.875,11.933,47.115,11.933 c9.962,0,20.231-1.356,30.452-4.087c42.74-11.413,72.411-44.346,72.804-77.654h0.004v-0.065c0.003-0.236,0.001-0.469,0-0.704V0 L163.205,76.413z M104.999,471.779c-22.543,6.038-45.942,3.846-62.572-5.846c-10.587-6.163-17.591-14.817-20.255-25.038 c-7.144-27.375,18.452-58.029,57.062-68.346c8.409-2.25,16.938-3.346,25.188-3.346c13.87,0,26.962,3.115,37.389,9.192 c10.587,6.163,17.591,14.817,20.255,25.029c0.809,3.102,1.142,6.248,1.139,9.4v0.321h0.014 C162.99,437.714,139.082,462.678,104.999,471.779z M182.898,166.853V92.067l290.971-67.298v74.784L182.898,166.853z M415.677,399.923c-22.558,6.038-45.942,3.837-62.587-5.846c-10.587-6.163-17.587-14.817-20.25-25.019 c-7.144-27.385,18.452-58.058,57.058-68.365c8.414-2.25,16.942-3.346,25.192-3.346c13.875,0,26.962,3.115,37.385,9.192 c10.596,6.163,17.596,14.817,20.26,25.029v0.01c0.796,3.05,1.124,6.144,1.135,9.244v0.468h0.02 C473.668,365.851,449.763,390.814,415.677,399.923z\">\n        </path>\n      </g>\n    </g>\n  </g>\n</svg>",
      Xo = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\" viewBox=\"0 0 5.9266752 5.6408391\" height=\"21.31971\" width=\"22.4\">\n  <g>\n    <path d=\"m 5.2564627,1.548212 c -3.1136005,-0.4796804 -1.5568006,-0.2398402 0,0 z M 2.0001198,2.0922063 c 0.1556781,0 0.2657489,0.020893 0.3917849,0.080366 0.081154,0.038347 0.1153492,0.134065 0.076377,0.2138602 -0.038973,0.07979 -0.1363527,0.1134129 -0.2175069,0.075091 -0.078199,-0.036919 -0.1407455,-0.048792 -0.250655,-0.048792 -0.2260486,0 -0.3921482,0.2042182 -0.3921482,0.4801409 0,0.2761822 0.1663188,0.4810688 0.3921482,0.4810688 0.1117901,0 0.2064255,-0.046133 0.255659,-0.1284198 l 0.00162,-0.00389 V 3.0534032 l -0.098011,1.75e-4 c -0.081844,0 -0.1495979,-0.059305 -0.1612403,-0.1365887 l -0.00175,-0.023683 c 0,-0.08047 0.060311,-0.1470874 0.1389194,-0.1585331 l 0.024085,-0.00195 h 0.2612303 c 0.081842,0 0.149598,0.059305 0.1612404,0.1365891 l 0.00175,0.023683 -3.398e-4,0.3968809 v 0 l -0.00168,0.014211 v 0 l -0.00553,0.023034 v 0 l -0.00532,0.014145 c -0.098178,0.22826 -0.3236506,0.3528713 -0.5706303,0.3528713 -0.4240855,0 -0.7181621,-0.3622714 -0.7181621,-0.8016063 0,-0.4391857 0.2940275,-0.8006848 0.7181621,-0.8006848 z m 1.2034759,0.031275 c 0.081843,0 0.1495977,0.059305 0.1612403,0.1365891 l 0.00175,0.023683 v 1.2211775 c 0,0.088516 -0.07298,0.1602721 -0.1630073,0.1602721 -0.081841,0 -0.1495972,-0.059305 -0.1612397,-0.1365892 L 3.040589,3.5049308 V 2.2837527 c 0,-0.088516 0.07298,-0.1602721 0.1630067,-0.1602714 z m 0.7813442,0 0.5209469,0.00195 c 0.090025,3.048e-4 0.1627543,0.072306 0.1624458,0.1608234 -2.809e-4,0.08047 -0.06083,0.1468798 -0.1394772,0.158066 l -0.024092,0.00195 -0.3575326,-0.0013 v 0.4497782 l 0.2928918,2.27e-4 c 0.081842,0 0.1495979,0.059305 0.1612403,0.136589 l 0.00175,0.023683 c 0,0.080469 -0.06031,0.1470871 -0.1389193,0.1585393 l -0.024092,0.00195 -0.2928919,-2.336e-4 1.563e-4,0.2860316 c 0,0.080471 -0.06031,0.1470873 -0.1389193,0.1585395 l -0.024085,0.00195 c -0.081843,0 -0.1495979,-0.059305 -0.1612403,-0.1365826 l -0.00175,-0.023691 V 2.2841354 c 2.798e-4,-0.08047 0.060829,-0.1468797 0.1394758,-0.1580594 z\"/>\n    <path d=\"m 5.0894191,1.0943261 c 0,-0.21918999 -0.177687,-0.39686999 -0.396876,-0.39686999 h -3.43959 c -0.2191879,0 -0.391262,0.1777519 -0.3968759,0.39686999 l -0.027082,3.4379266 c 0.040152,0.2939927 0.4235456,0.409415 0.4235456,0.409415 l 3.4785583,-0.00851 c 0,0 0.3008506,-0.1402998 0.3236271,-0.4201576 0.042911,-0.5272495 0.034693,-1.6106146 0.034693,-3.4186761 z m -4.49792494,0 c 0,-0.36530999 0.29614504,-0.66145999 0.66145894,-0.66145999 h 3.43959 c 0.365314,0 0.66146,0.29615 0.66146,0.66145999 v 3.43959 c 0,0.36532 -0.296146,0.66146 -0.66146,0.66146 h -3.43959 c -0.3653139,0 -0.66145894,-0.29614 -0.66145894,-0.66146 z\"/>\n  </g>\n</svg>\n",
      Qo = {
        images: {
          id: "upload-images-icon",
          svgString: Yo,
          dropupText: "Image"
        },
        gifs: {
          id: "upload-gifs-icon",
          svgString: Xo,
          dropupText: "GIF"
        },
        audio: {
          id: "upload-audio-icon",
          svgString: Zo,
          dropupText: "Audio"
        },
        mixedFiles: {
          id: "upload-mixed-files-icon",
          svgString: $o,
          dropupText: "File"
        }
      };
    var ue = /*#__PURE__*/function () {
      // prettier-ignore
      function ue(e, t, i, n) {
        var _this43 = this;
        _classCallCheck(this, ue);
        this._attachments = [], this._fileCountLimit = 99, this._acceptedFormat = "", t.maxNumberOfFiles && (this._fileCountLimit = t.maxNumberOfFiles), this._toggleContainerDisplay = i, this._fileAttachmentsContainerRef = n, t.acceptedFormats && (this._acceptedFormat = t.acceptedFormats), setTimeout(function () {
          _this43._validationHandler = e._validationHandler;
        });
      }
      _createClass(ue, [{
        key: "attemptAddFile",
        value: function attemptAddFile(e, t) {
          return ue.isFileTypeValid(e, this._acceptedFormat) ? (this.addAttachmentBasedOnType(e, t, !0), !0) : !1;
        }
      }, {
        key: "addAttachmentBasedOnType",
        value: function addAttachmentBasedOnType(e, t, i) {
          var n = ue.getTypeFromBlob(e);
          if (n === "image") {
            var r = ue.createImageAttachment(t);
            this.addFileAttachment(e, "image", r, i);
          } else if (n === "audio") {
            var _r2 = Ui.createAudioAttachment(t);
            this.addFileAttachment(e, "audio", _r2, i);
          } else {
            var _r3 = ue.createAnyFileAttachment(e.name);
            this.addFileAttachment(e, "any", _r3, i);
          }
        }
      }, {
        key: "addFileAttachment",
        value: function addFileAttachment(e, t, i, n) {
          var a;
          var r = ue.createContainer(i);
          if (this._attachments.length >= this._fileCountLimit) {
            var l = this._attachments[this._attachments.length - 1].removeButton;
            l == null || l.click();
            var c = this._fileAttachmentsContainerRef.children;
            this._fileAttachmentsContainerRef.insertBefore(r, c[0]);
          } else this._fileAttachmentsContainerRef.appendChild(r);
          var o = {
            file: e,
            attachmentContainerElement: r,
            fileType: t
          };
          return n && (o.removeButton = this.createRemoveAttachmentButton(o), r.appendChild(o.removeButton)), this._toggleContainerDisplay(!0), this._attachments.push(o), this._fileAttachmentsContainerRef.scrollTop = this._fileAttachmentsContainerRef.scrollHeight, (a = this._validationHandler) == null || a.call(this), o;
        }
      }, {
        key: "createRemoveAttachmentButton",
        value: function createRemoveAttachmentButton(e) {
          var t = document.createElement("div");
          t.classList.add("remove-file-attachment-button"), t.onclick = this.removeAttachment.bind(this, e);
          var i = document.createElement("div");
          return i.classList.add("x-icon"), i.innerText = "×", t.appendChild(i), t;
        }
      }, {
        key: "removeAttachment",
        value: function removeAttachment(e) {
          var n;
          var t = this._attachments.findIndex(function (r) {
              return r === e;
            }),
            i = this._attachments[t].attachmentContainerElement;
          this._attachments.splice(t, 1), Ui.stopAttachmentPlayback(i), i.remove(), this._toggleContainerDisplay(!1), (n = this._validationHandler) == null || n.call(this);
        }
      }, {
        key: "getFiles",
        value: function getFiles() {
          return Array.from(this._attachments).map(function (e) {
            return {
              file: e.file,
              type: e.fileType
            };
          });
        }
      }, {
        key: "removeAllAttachments",
        value: function removeAllAttachments() {
          this._attachments.forEach(function (e) {
            setTimeout(function () {
              var t;
              return (t = e.removeButton) == null ? void 0 : t.click();
            });
          });
        }
      }], [{
        key: "isFileTypeValid",
        value: function isFileTypeValid(e, t) {
          if (t === "") return !0;
          var i = t.split(",");
          for (var n = 0; n < i.length; n++) {
            var r = i[n].trim();
            if (e.type === r) return !0;
            if (r.startsWith(".")) {
              var o = r.slice(1);
              if (e.name.endsWith(o)) return !0;
            } else {
              if (e.name.endsWith(r)) return !0;
              if (r.endsWith("/*") && e.type.startsWith(r.slice(0, -2))) return !0;
            }
          }
          return !1;
        }
      }, {
        key: "getTypeFromBlob",
        value: function getTypeFromBlob(e) {
          var t = e.type;
          return t.startsWith("image") ? "image" : t.startsWith("audio") ? "audio" : "any";
        }
      }, {
        key: "createImageAttachment",
        value: function createImageAttachment(e) {
          var t = new Image();
          return t.src = e, t.classList.add("image-attachment"), t;
        }
      }, {
        key: "createAnyFileAttachment",
        value: function createAnyFileAttachment(e) {
          var t = document.createElement("div");
          t.classList.add("border-bound-attachment"), ge.IS_SAFARI && t.classList.add("border-bound-attachment-safari");
          var i = document.createElement("div");
          i.classList.add("any-file-attachment-text");
          var n = document.createElement("div");
          return n.classList.add("file-attachment-text-container"), n.appendChild(i), i.textContent = e, t.appendChild(n), t;
        }
      }, {
        key: "createContainer",
        value: function createContainer(e) {
          var t = document.createElement("div");
          return t.classList.add("file-attachment"), t.appendChild(e), t;
        }
      }]);
      return ue;
    }();
    var ea = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<svg viewBox=\"0 0 32 32\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\">\n  <title>play</title>\n  <path d=\"M5.92 24.096q0 1.088 0.928 1.728 0.512 0.288 1.088 0.288 0.448 0 0.896-0.224l16.16-8.064q0.48-0.256 0.8-0.736t0.288-1.088-0.288-1.056-0.8-0.736l-16.16-8.064q-0.448-0.224-0.896-0.224-0.544 0-1.088 0.288-0.928 0.608-0.928 1.728v16.16z\"></path>\n</svg>",
      wn = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<svg viewBox=\"0 0 32 32\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\">\n<title>stop</title>\n<path d=\"M5.92 24.096q0 0.832 0.576 1.408t1.44 0.608h16.128q0.832 0 1.44-0.608t0.576-1.408v-16.16q0-0.832-0.576-1.44t-1.44-0.576h-16.128q-0.832 0-1.44 0.576t-0.576 1.44v16.16z\"></path>\n</svg>",
      ps = /*#__PURE__*/function (_ue) {
        _inherits(we, _ue);
        var _super38 = _createSuper(we);
        // prettier-ignore
        function we(e, t, i, n) {
          _classCallCheck(this, we);
          return _super38.call(this, e, t, i, n);
        }
        _createClass(we, [{
          key: "createTimer",
          value: function createTimer(e, t) {
            var _this44 = this;
            var i = 0;
            var n = t !== void 0 && t < we.TIMER_LIMIT_S ? t : we.TIMER_LIMIT_S;
            return setInterval(function () {
              var a;
              i += 1, i === n && ((a = _this44.stopPlaceholderCallback) == null || a.call(_this44), _this44.clearTimer()), i === 600 && e.classList.add("audio-placeholder-text-4-digits");
              var r = Math.floor(i / 60),
                o = (i % 60).toString().padStart(2, "0");
              e.textContent = "".concat(r, ":").concat(o);
            }, 1e3);
          }
        }, {
          key: "createPlaceholderAudioAttachment",
          value: function createPlaceholderAudioAttachment(e) {
            var t = we.createAudioContainer(),
              i = document.createElement("div");
            i.classList.add("audio-placeholder-text-3-digits");
            var n = document.createElement("div");
            n.classList.add("file-attachment-text-container", "audio-placeholder-text-3-digits-container"), n.appendChild(i);
            var r = q.createSVGElement(wn);
            return r.classList.add("attachment-icon", "stop-icon", "not-removable-attachment-icon"), i.textContent = "0:00", this._activePlaceholderTimer = this.createTimer(i, e), t.appendChild(n), this.addPlaceholderAudioAttachmentEvents(t, r, n), t;
          }
        }, {
          key: "addPlaceholderAudioAttachmentEvents",
          value: function addPlaceholderAudioAttachmentEvents(e, t, i) {
            var _this45 = this;
            var n = function n() {
              return e.replaceChildren(t);
            };
            e.addEventListener("mouseenter", n);
            var r = function r() {
              return e.replaceChildren(i);
            };
            e.addEventListener("mouseleave", r);
            var o = function o() {
              var a;
              return (a = _this45.stopPlaceholderCallback) == null ? void 0 : a.call(_this45);
            };
            e.addEventListener("click", o);
          }
        }, {
          key: "addPlaceholderAttachment",
          value: function addPlaceholderAttachment(e, t) {
            var i = this.createPlaceholderAudioAttachment(t);
            this._activePlaceholderAttachment = this.addFileAttachment(new File([], ""), "audio", i, !1), this.stopPlaceholderCallback = e;
          }
          // prettier-ignore
        }, {
          key: "completePlaceholderAttachment",
          value: function completePlaceholderAttachment(e, t) {
            var i = this._activePlaceholderAttachment;
            i && (i.file = e, we.addAudioElements(i.attachmentContainerElement.children[0], t), i.removeButton = this.createRemoveAttachmentButton(i), i.attachmentContainerElement.appendChild(i.removeButton), this._activePlaceholderAttachment = void 0, this.clearTimer());
          }
        }, {
          key: "removePlaceholderAttachment",
          value: function removePlaceholderAttachment() {
            this._activePlaceholderAttachment && (this.removeAttachment(this._activePlaceholderAttachment), this._activePlaceholderAttachment = void 0, this.clearTimer());
          }
        }, {
          key: "clearTimer",
          value: function clearTimer() {
            this._activePlaceholderTimer !== void 0 && (clearInterval(this._activePlaceholderTimer), this._activePlaceholderTimer = void 0, this.stopPlaceholderCallback = void 0);
          }
        }], [{
          key: "createAudioContainer",
          value: function createAudioContainer() {
            var e = document.createElement("div");
            return e.classList.add("border-bound-attachment", "audio-attachment-icon-container"), ge.IS_SAFARI && e.classList.add("border-bound-attachment-safari"), e;
          }
        }, {
          key: "addAudioElements",
          value: function addAudioElements(e, t) {
            var i = e.parentElement ? Y.cloneElement(e) : e,
              n = document.createElement("audio");
            n.src = t;
            var r = q.createSVGElement(ea);
            r.classList.add("attachment-icon", "play-icon");
            var o = q.createSVGElement(wn);
            o.classList.add("attachment-icon", "stop-icon"), i.replaceChildren(r), n.onplay = function () {
              i.replaceChildren(o);
            }, n.onpause = function () {
              i.replaceChildren(r), n.currentTime = 0;
            }, n.onended = function () {
              i.replaceChildren(r);
            }, i.onclick = function () {
              n.paused ? n.play() : n.pause();
            };
          }
        }, {
          key: "createAudioAttachment",
          value: function createAudioAttachment(e) {
            var t = we.createAudioContainer();
            return we.addAudioElements(t, e), t;
          }
        }, {
          key: "stopAttachmentPlayback",
          value: function stopAttachmentPlayback(e) {
            var t, i, n;
            (n = (i = (t = e.children[0]) == null ? void 0 : t.children) == null ? void 0 : i[0]) != null && n.classList.contains("stop-icon") && e.children[0].click();
          }
        }]);
        return we;
      }(ue);
    ps.TIMER_LIMIT_S = 5999;
    var Ui = ps;
    var ta = /*#__PURE__*/function () {
      function ta() {
        _classCallCheck(this, ta);
      }
      _createClass(ta, null, [{
        key: "create",
        value:
        // prettier-ignore
        function create(e, t, i, n, r) {
          return r === "audio" ? new Ui(e, t, i, n) : new ue(e, t, i, n);
        }
      }]);
      return ta;
    }();
    var _t = /*#__PURE__*/function () {
      function _t(e, t, i) {
        _classCallCheck(this, _t);
        this._fileAttachmentsTypes = [], this.elementRef = this.createAttachmentContainer();
        var n = _typeof(i) == "object" && !!i.displayFileAttachmentContainer;
        this.toggleContainerDisplay(n), e.appendChild(this.elementRef), t && Object.assign(this.elementRef.style, t);
      }
      // prettier-ignore
      _createClass(_t, [{
        key: "addType",
        value: function addType(e, t, i) {
          var n = ta.create(e, t, this.toggleContainerDisplay.bind(this), this.elementRef, i);
          return this._fileAttachmentsTypes.push(n), n;
        }
      }, {
        key: "createAttachmentContainer",
        value: function createAttachmentContainer() {
          var e = document.createElement("div");
          return e.id = "file-attachment-container", e;
        }
      }, {
        key: "toggleContainerDisplay",
        value: function toggleContainerDisplay(e) {
          e ? this.elementRef.style.display = "block" : this.elementRef.children.length === 0 && (this.elementRef.style.display = "none");
        }
      }, {
        key: "getAllFileData",
        value: function getAllFileData() {
          var e = this._fileAttachmentsTypes.map(function (t) {
            return t.getFiles();
          }).flat();
          return e.length > 0 ? e : void 0;
        }
      }, {
        key: "completePlaceholders",
        value: function () {
          var _completePlaceholders = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee91() {
            return _regeneratorRuntime().wrap(function _callee91$(_context91) {
              while (1) switch (_context91.prev = _context91.next) {
                case 0:
                  _context91.next = 2;
                  return Promise.all(this._fileAttachmentsTypes.map( /*#__PURE__*/function () {
                    var _ref11 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee90(e) {
                      var t;
                      return _regeneratorRuntime().wrap(function _callee90$(_context90) {
                        while (1) switch (_context90.prev = _context90.next) {
                          case 0:
                            return _context90.abrupt("return", (t = e.stopPlaceholderCallback) == null ? void 0 : t.call(e));
                          case 1:
                          case "end":
                            return _context90.stop();
                        }
                      }, _callee90);
                    }));
                    return function (_x166) {
                      return _ref11.apply(this, arguments);
                    };
                  }()));
                case 2:
                case "end":
                  return _context91.stop();
              }
            }, _callee91, this);
          }));
          function completePlaceholders() {
            return _completePlaceholders.apply(this, arguments);
          }
          return completePlaceholders;
        }()
      }, {
        key: "addFilesToAnyType",
        value: function addFilesToAnyType(e) {
          _t.addFilesToType(e, this._fileAttachmentsTypes);
        }
      }, {
        key: "removeAllFiles",
        value: function removeAllFiles() {
          this._fileAttachmentsTypes.forEach(function (e) {
            return e.removeAllAttachments();
          }), this.elementRef.replaceChildren(), this.toggleContainerDisplay(!1);
        }
      }, {
        key: "getNumberOfTypes",
        value: function getNumberOfTypes() {
          return this._fileAttachmentsTypes.length;
        }
      }], [{
        key: "addFilesToType",
        value: function addFilesToType(e, t) {
          e.forEach(function (i) {
            var n = new FileReader();
            n.readAsDataURL(i), n.onload = function (r) {
              for (var o = 0; o < t.length && !t[o].attemptAddFile(i, r.target.result); o += 1);
            };
          });
        }
      }]);
      return _t;
    }();
    var fs = /*#__PURE__*/function () {
      function le(e, t, i) {
        _classCallCheck(this, le);
        this._isOpen = !1, this._contentRef = le.createModalContent(t, i == null ? void 0 : i.backgroundColor), this._buttonPanel = le.createButtonPanel(i == null ? void 0 : i.backgroundColor), this._elementRef = le.createContainer(this._contentRef, i), this._elementRef.appendChild(this._buttonPanel), e.appendChild(this._elementRef), this._backgroundPanelRef = le.createDarkBackgroundPanel(), e.appendChild(this._backgroundPanelRef), this.addWindowEvents(e);
      }
      _createClass(le, [{
        key: "isOpen",
        value: function isOpen() {
          return this._isOpen;
        }
      }, {
        key: "addButtons",
        value: function addButtons() {
          var _this46 = this;
          for (var _len2 = arguments.length, e = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            e[_key2] = arguments[_key2];
          }
          e.forEach(function (t) {
            return _this46._buttonPanel.appendChild(t);
          });
        }
      }, {
        key: "close",
        value: function close() {
          var _this47 = this;
          this._elementRef.classList.remove("show-modal"), this._elementRef.classList.add("hide-modal"), this._backgroundPanelRef.classList.remove("show-modal-background"), this._backgroundPanelRef.classList.add("hide-modal-background"), this._isOpen = !1, setTimeout(function () {
            _this47._elementRef.style.display = "none", _this47._backgroundPanelRef.style.display = "none";
          }, le.MODAL_CLOSE_TIMEOUT_MS);
        }
      }, {
        key: "displayModalElements",
        value: function displayModalElements() {
          this._elementRef.style.display = "flex", this._elementRef.classList.remove("hide-modal"), this._elementRef.classList.add("show-modal"), this._backgroundPanelRef.style.display = "block", this._backgroundPanelRef.classList.remove("hide-modal-background"), this._backgroundPanelRef.classList.add("show-modal-background"), this._isOpen = !0;
        }
      }, {
        key: "openTextModal",
        value: function openTextModal(e) {
          this._contentRef.innerHTML = e, this.displayModalElements();
        }
      }, {
        key: "addCloseButton",
        value: function addCloseButton(e, t, i) {
          var _this48 = this;
          var n = t ? le.createSVGButton(e) : le.createTextButton(e);
          return this.addButtons(n), n.onclick = function () {
            _this48.close(), setTimeout(function () {
              i == null || i();
            }, 140);
          }, n;
        }
      }, {
        key: "addWindowEvents",
        value: function addWindowEvents(e) {
          this.keyDownEvent = this.windowKeyDown.bind(this, e), window.addEventListener("keydown", this.keyDownEvent);
        }
      }, {
        key: "windowKeyDown",
        value: function windowKeyDown(e, t) {
          var i, n;
          !e.isConnected && this.keyDownEvent ? window.removeEventListener("keydown", this.keyDownEvent) : this._isOpen && (t.key === R.ESCAPE ? (this.close(), (i = this.extensionCloseCallback) == null || i.call(this)) : t.key === R.ENTER && (this.close(), (n = this.extensionCloseCallback) == null || n.call(this)));
        }
      }], [{
        key: "createContainer",
        value: function createContainer(e, t) {
          var i = document.createElement("div");
          return i.classList.add("modal"), i.appendChild(e), t && delete t.backgroundColor, Object.assign(i.style, t), i;
        }
      }, {
        key: "createModalContent",
        value: function createModalContent(e, t) {
          var _i$classList;
          var i = document.createElement("div");
          return (_i$classList = i.classList).add.apply(_i$classList, _toConsumableArray(e)), t && (i.style.backgroundColor = t), document.createElement("div").appendChild(i), i;
        }
      }, {
        key: "createButtonPanel",
        value: function createButtonPanel(e) {
          var t = document.createElement("div");
          return t.classList.add("modal-button-panel"), e && (t.style.backgroundColor = e), t;
        }
      }, {
        key: "createDarkBackgroundPanel",
        value: function createDarkBackgroundPanel() {
          var e = document.createElement("div");
          return e.id = "modal-background-panel", e;
        }
      }, {
        key: "createTextButton",
        value: function createTextButton(e) {
          var t = document.createElement("div");
          return t.classList.add("modal-button"), t.textContent = e, t;
        }
      }, {
        key: "createSVGButton",
        value: function createSVGButton(e) {
          var t = document.createElement("div");
          t.classList.add("modal-button", "modal-svg-button");
          var i = q.createSVGElement(e);
          return i.classList.add("modal-svg-button-icon"), t.appendChild(i), t;
        }
      }, {
        key: "createTextModalFunc",
        value: function createTextModalFunc(e, t, i) {
          var n;
          if (_typeof(t) == "object" && (n = t.files) != null && n.infoModal) {
            var r = new le(e, ["modal-content"], t.files.infoModal.containerStyle);
            return r.addCloseButton("OK", !1, i), r.openTextModal.bind(r, t.infoModalTextMarkUp || "");
          }
        }
      }]);
      return le;
    }();
    fs.MODAL_CLOSE_TIMEOUT_MS = 190;
    var at = fs;
    var ut = /*#__PURE__*/function (_wt2) {
      _inherits(ut, _wt2);
      var _super39 = _createSuper(ut);
      // prettier-ignore
      function ut(e, t, i, n, r, o) {
        var _this49;
        _classCallCheck(this, ut);
        var l, c, d, u, h, p;
        _this49 = _super39.call(this, ut.createButtonElement(), (l = i.button) == null ? void 0 : l.position, i.button, o);
        var a = _this49.createInnerElements(n, r, _this49._customStyles);
        _this49._inputElement = ut.createInputElement((c = i == null ? void 0 : i.files) == null ? void 0 : c.acceptedFormats), _this49.addClickEvent(e, i), _this49.elementRef.replaceChildren(a.styles), _this49.reapplyStateStyle("styles"), _this49._fileAttachmentsType = t, _this49._openModalOnce = ((u = (d = i.files) == null ? void 0 : d.infoModal) == null ? void 0 : u.openModalOnce) === !1 || (p = (h = i.files) == null ? void 0 : h.infoModal) == null ? void 0 : p.openModalOnce;
        return _this49;
      }
      _createClass(ut, [{
        key: "createInnerElements",
        value: function createInnerElements(e, t, i) {
          var n = ut.createSVGIconElement(e, t);
          return {
            styles: this.createInnerElement(n, "styles", i)
          };
        }
      }, {
        key: "triggerImportPrompt",
        value: function triggerImportPrompt(e) {
          e.onchange = this["import"].bind(this, e), e.click();
        }
      }, {
        key: "import",
        value: function _import(e) {
          _t.addFilesToType(Array.from(e.files || []), [this._fileAttachmentsType]), e.value = "";
        }
      }, {
        key: "createInnerElement",
        value: function createInnerElement(e, t, i) {
          return j.createSpecificStateElement(this.elementRef, t, i) || e;
        }
      }, {
        key: "addClickEvent",
        value: function addClickEvent(e, t) {
          var i = this.triggerImportPrompt.bind(this, this._inputElement),
            n = at.createTextModalFunc(e, t, i);
          this.elementRef.onclick = this.click.bind(this, n);
        }
      }, {
        key: "click",
        value: function click(e) {
          e && (this._openModalOnce === void 0 || this._openModalOnce === !0) ? (e(), this._openModalOnce === !0 && (this._openModalOnce = !1)) : this.triggerImportPrompt(this._inputElement);
        }
      }], [{
        key: "createInputElement",
        value: function createInputElement(e) {
          var t = document.createElement("input");
          return t.type = "file", t.accept = e || "", t.hidden = !0, t.multiple = !0, t;
        }
      }, {
        key: "createButtonElement",
        value: function createButtonElement() {
          var e = document.createElement("div");
          return e.classList.add("input-button", "upload-file-button"), e;
        }
      }, {
        key: "createSVGIconElement",
        value: function createSVGIconElement(e, t) {
          var i = q.createSVGElement(t);
          return i.id = e, i;
        }
      }]);
      return ut;
    }(wt);
    var de = /*#__PURE__*/function () {
      function de() {
        _classCallCheck(this, de);
      }
      _createClass(de, null, [{
        key: "create",
        value: function create(e, t, i) {
          var n = de.createElement(i);
          de.addEvents(n, e, t), e.appendChild(n);
        }
      }, {
        key: "createElement",
        value: function createElement(e) {
          var t = document.createElement("div");
          return t.id = "drag-and-drop", _typeof(e) == "object" && Object.assign(t.style, e), t;
        }
      }, {
        key: "addEvents",
        value: function addEvents(e, t, i) {
          t.ondragenter = function (n) {
            n.preventDefault(), de.display(e);
          }, e.ondragleave = function (n) {
            n.preventDefault(), de.hide(e);
          }, e.ondragover = function (n) {
            n.preventDefault();
          }, e.ondrop = function (n) {
            n.preventDefault(), de.uploadFile(i, n), de.hide(e);
          };
        }
      }, {
        key: "uploadFile",
        value: function uploadFile(e, t) {
          var n;
          var i = (n = t.dataTransfer) == null ? void 0 : n.files;
          i && e.addFilesToAnyType(Array.from(i));
        }
      }, {
        key: "display",
        value: function display(e) {
          e.style.display = "block";
        }
      }, {
        key: "hide",
        value: function hide(e) {
          e.style.display = "none";
        }
      }, {
        key: "isEnabled",
        value: function isEnabled(e, t) {
          return t !== void 0 && t === !1 ? !1 : !!t || e.getNumberOfTypes() > 0;
        }
      }]);
      return de;
    }();
    var Me = /*#__PURE__*/function () {
      function Me() {
        _classCallCheck(this, Me);
      }
      _createClass(Me, null, [{
        key: "validate",
        value:
        // prettier-ignore
        function validate(e, t, i, n, r) {
          var o = e(i, n, r);
          return o ? t.changeToSubmitIcon() : t.changeToDisabledIcon(), o;
        }
        // prettier-ignore
      }, {
        key: "useValidationFunc",
        value: function () {
          var _useValidationFunc = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee92(e, t, i, n) {
            var r, o, a, l;
            return _regeneratorRuntime().wrap(function _callee92$(_context92) {
              while (1) switch (_context92.prev = _context92.next) {
                case 0:
                  r = t.inputElementRef, o = r.classList.contains("text-input-placeholder") ? "" : r.textContent;
                  _context92.next = 3;
                  return i.completePlaceholders();
                case 3:
                  a = i.getAllFileData(), l = a == null ? void 0 : a.map(function (c) {
                    return c.file;
                  });
                  return _context92.abrupt("return", Me.validate(e, n, o, l));
                case 5:
                case "end":
                  return _context92.stop();
              }
            }, _callee92);
          }));
          function useValidationFunc(_x167, _x168, _x169, _x170) {
            return _useValidationFunc.apply(this, arguments);
          }
          return useValidationFunc;
        }() // prettier-ignore
      }, {
        key: "useValidationFuncProgrammatic",
        value: function () {
          var _useValidationFuncProgrammatic = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee93(e, t, i) {
            var r, n;
            return _regeneratorRuntime().wrap(function _callee93$(_context93) {
              while (1) switch (_context93.prev = _context93.next) {
                case 0:
                  n = (r = t.files) == null ? void 0 : r.map(function (o) {
                    return o.file;
                  });
                  return _context93.abrupt("return", Me.validate(e, i, t.text, n, !0));
                case 2:
                case "end":
                  return _context93.stop();
              }
            }, _callee93);
          }));
          function useValidationFuncProgrammatic(_x171, _x172, _x173) {
            return _useValidationFuncProgrammatic.apply(this, arguments);
          }
          return useValidationFuncProgrammatic;
        }()
      }, {
        key: "validateWebsocket",
        value: function validateWebsocket(e, t) {
          return e.websocket && !$.canSendMessage(e.websocket) ? (t.changeToDisabledIcon(), !1) : !0;
        }
        // prettier-ignore
      }, {
        key: "attach",
        value: function attach(e, t, i, n, r) {
          var o = e.validateInput || ke.processValidateInput(e);
          e._validationHandler = /*#__PURE__*/function () {
            var _ref12 = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee94(a) {
              var l;
              return _regeneratorRuntime().wrap(function _callee94$(_context94) {
                while (1) switch (_context94.prev = _context94.next) {
                  case 0:
                    if (!(r.status.loadingActive || r.status.requestInProgress || t.isSubmitProgrammaticallyDisabled === !0 || !Me.validateWebsocket(t, r))) {
                      _context94.next = 2;
                      break;
                    }
                    return _context94.abrupt("return", !1);
                  case 2:
                    l = o || t.canSendMessage;
                    return _context94.abrupt("return", l ? a ? Me.useValidationFuncProgrammatic(l, a, r) : Me.useValidationFunc(l, i, n, r) : null);
                  case 4:
                  case "end":
                    return _context94.stop();
                }
              }, _callee94);
            }));
            return function (_x174) {
              return _ref12.apply(this, arguments);
            };
          }();
        }
      }]);
      return Me;
    }();
    var ia = "<?xml version=\"1.0\" encoding=\"iso-8859-1\"?>\n<svg height=\"1.4em\" width=\"1.4em\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\"\n\t viewBox=\"0 0 490.9 490.9\" xml:space=\"preserve\">\n\t<g>\n\t\t<g>\n\t\t\t<path d=\"M245.5,322.9c53,0,96.2-43.2,96.2-96.2V96.2c0-53-43.2-96.2-96.2-96.2s-96.2,43.2-96.2,96.2v130.5\n\t\t\t\tC149.3,279.8,192.5,322.9,245.5,322.9z M173.8,96.2c0-39.5,32.2-71.7,71.7-71.7s71.7,32.2,71.7,71.7v130.5\n\t\t\t\tc0,39.5-32.2,71.7-71.7,71.7s-71.7-32.2-71.7-71.7V96.2z\"/>\n\t\t\t<path d=\"M94.4,214.5c-6.8,0-12.3,5.5-12.3,12.3c0,85.9,66.7,156.6,151.1,162.8v76.7h-63.9c-6.8,0-12.3,5.5-12.3,12.3\n\t\t\t\ts5.5,12.3,12.3,12.3h152.3c6.8,0,12.3-5.5,12.3-12.3s-5.5-12.3-12.3-12.3h-63.9v-76.7c84.4-6.3,151.1-76.9,151.1-162.8\n\t\t\t\tc0-6.8-5.5-12.3-12.3-12.3s-12.3,5.5-12.3,12.3c0,76.6-62.3,138.9-138.9,138.9s-138.9-62.3-138.9-138.9\n\t\t\t\tC106.6,220,101.2,214.5,94.4,214.5z\"/>\n\t\t</g>\n\t</g>\n</svg>\n";
    var bt = /*#__PURE__*/function (_wt3) {
      _inherits(bt, _wt3);
      var _super40 = _createSuper(bt);
      function bt(e) {
        var _this50;
        _classCallCheck(this, bt);
        (e == null ? void 0 : e.position) === "dropup-menu" && (e.position = "outside-right"), _this50 = _super40.call(this, bt.createMicrophoneElement(), e == null ? void 0 : e.position, e), _this50.isActive = !1, _this50._innerElements = _this50.createInnerElements(_this50._customStyles), _this50.changeToDefault();
        return _this50;
      }
      _createClass(bt, [{
        key: "createInnerElements",
        value: function createInnerElements(e) {
          var t = bt.createSVGIconElement();
          return {
            "default": this.createInnerElement(t, "default", e),
            active: this.createInnerElement(t, "active", e),
            unsupported: this.createInnerElement(t, "unsupported", e),
            commandMode: this.createInnerElement(t, "commandMode", e)
          };
        }
        // prettier-ignore
      }, {
        key: "createInnerElement",
        value: function createInnerElement(e, t, i) {
          return j.createSpecificStateElement(this.elementRef, t, i) || e;
        }
      }, {
        key: "changeToActive",
        value: function changeToActive() {
          this.elementRef.replaceChildren(this._innerElements.active), this.toggleIconFilter("active"), this.reapplyStateStyle("active", ["default", "commandMode"]), this.isActive = !0;
        }
      }, {
        key: "changeToDefault",
        value: function changeToDefault() {
          this.elementRef.replaceChildren(this._innerElements["default"]), this.toggleIconFilter("default"), this.reapplyStateStyle("default", ["active", "commandMode"]), this.isActive = !1;
        }
      }, {
        key: "changeToCommandMode",
        value: function changeToCommandMode() {
          this.elementRef.replaceChildren(this._innerElements.unsupported), this.toggleIconFilter("command"), this.reapplyStateStyle("commandMode", ["active"]);
        }
      }, {
        key: "changeToUnsupported",
        value: function changeToUnsupported() {
          this.elementRef.replaceChildren(this._innerElements.unsupported), this.elementRef.classList.add("unsupported-microphone"), this.reapplyStateStyle("unsupported", ["active"]);
        }
      }, {
        key: "toggleIconFilter",
        value: function toggleIconFilter(e) {
          var t = this.elementRef.children[0];
          if (t.tagName.toLocaleLowerCase() === "svg") switch (e) {
            case "default":
              t.classList.remove("active-microphone-icon", "command-microphone-icon"), t.classList.add("default-microphone-icon");
              break;
            case "active":
              t.classList.remove("default-microphone-icon", "command-microphone-icon"), t.classList.add("active-microphone-icon");
              break;
            case "command":
              t.classList.remove("active-microphone-icon", "default-microphone-icon"), t.classList.add("command-microphone-icon");
              break;
          }
        }
      }], [{
        key: "createMicrophoneElement",
        value: function createMicrophoneElement() {
          var e = document.createElement("div");
          return e.id = "microphone-button", e.classList.add("input-button"), e;
        }
      }, {
        key: "createSVGIconElement",
        value: function createSVGIconElement() {
          var e = q.createSVGElement(ia);
          return e.id = "microphone-icon", e;
        }
      }]);
      return bt;
    }(wt);
    var ms = {},
      oi = {},
      ai = {},
      Mt = {},
      De = {};
    Object.defineProperty(De, "__esModule", {
      value: !0
    });
    De.Text = void 0;
    var ye = /*#__PURE__*/function () {
      function ye() {
        _classCallCheck(this, ye);
      }
      _createClass(ye, null, [{
        key: "capitalize",
        value: function capitalize(e) {
          return e.replace(ye.FIRST_CHAR_REGEX, function (t) {
            return t.toUpperCase();
          });
        }
      }, {
        key: "lineBreak",
        value: function lineBreak(e) {
          return e.replace(ye.DOUBLE_LINE, "<p></p>").replace(ye.ONE_LINE, "<br>");
        }
      }, {
        key: "isCharDefined",
        value: function isCharDefined(e) {
          return e !== void 0 && e !== " " && e !== " " && e !== "\n" && e !== "";
        }
        // WORK - can optimize to not not have to do it multiple times
      }, {
        key: "breakupIntoWordsArr",
        value: function breakupIntoWordsArr(e) {
          return e.split(/(\W+)/);
        }
      }]);
      return ye;
    }();
    De.Text = ye;
    ye.FIRST_CHAR_REGEX = /\S/;
    ye.DOUBLE_LINE = /\n\n/g;
    ye.ONE_LINE = /\n/g;
    Object.defineProperty(Mt, "__esModule", {
      value: !0
    });
    Mt.Translate = void 0;
    var na = De;
    var sa = /*#__PURE__*/function () {
      function sa() {
        _classCallCheck(this, sa);
      }
      _createClass(sa, null, [{
        key: "translate",
        value: function translate(e, t) {
          var i = na.Text.breakupIntoWordsArr(e);
          for (var n = 0; n < i.length; n += 1) t[i[n]] && (i[n] = t[i[n]]);
          return i.join("");
        }
      }]);
      return sa;
    }();
    Mt.Translate = sa;
    Object.defineProperty(ai, "__esModule", {
      value: !0
    });
    ai.WebSpeechTranscript = void 0;
    var _n = Mt;
    var ra = /*#__PURE__*/function () {
      function ra() {
        _classCallCheck(this, ra);
      }
      _createClass(ra, null, [{
        key: "extract",
        value: function extract(e, t, i) {
          var n = "";
          for (var r = e.resultIndex; r < e.results.length; ++r) {
            var o = e.results[r][0].transcript;
            i && (o = _n.Translate.translate(o, i)), e.results[r].isFinal ? t += o : n += o;
          }
          return {
            interimTranscript: n,
            finalTranscript: t,
            newText: n || t
          };
        }
      }, {
        key: "extractSafari",
        value: function extractSafari(e, t, i) {
          var n = "";
          var r = "";
          for (var o = e.resultIndex; o < e.results.length; ++o) {
            var a = e.results[o][0].transcript;
            i && (a = _n.Translate.translate(a, i)), n += a;
          }
          return {
            interimTranscript: r,
            finalTranscript: n,
            newText:  n
          };
        }
      }]);
      return ra;
    }();
    ai.WebSpeechTranscript = ra;
    var tt = {};
    Object.defineProperty(tt, "__esModule", {
      value: !0
    });
    tt.Browser = void 0;
    var lt = /*#__PURE__*/_createClass(function lt() {
      _classCallCheck(this, lt);
    });
    tt.Browser = lt;
    lt.IS_SAFARI = function () {
      return lt._IS_SAFARI === void 0 && (lt._IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)), lt._IS_SAFARI;
    };
    var Tt = {},
      li = {};
    Object.defineProperty(li, "__esModule", {
      value: !0
    });
    li.EventListeners = void 0;
    var J = /*#__PURE__*/function () {
      function J() {
        _classCallCheck(this, J);
      }
      _createClass(J, null, [{
        key: "getElementIfFocusedOnAvailable",
        value: function getElementIfFocusedOnAvailable(e, t) {
          return Array.isArray(e) ? e.find(function (i) {
            return t === i;
          }) : t === e ? e : void 0;
        }
      }, {
        key: "keyDownWindow",
        value: function keyDownWindow(e) {
          var _this51 = this;
          e.element && J.getElementIfFocusedOnAvailable(e.element, document.activeElement) && (J.KEY_DOWN_TIMEOUT !== null && clearTimeout(J.KEY_DOWN_TIMEOUT), J.KEY_DOWN_TIMEOUT = setTimeout(function () {
            J.KEY_DOWN_TIMEOUT = null, _this51.resetRecording(e);
          }, 500));
        }
      }, {
        key: "mouseDownWindow",
        value: function mouseDownWindow(e, t) {
          this.mouseDownElement = J.getElementIfFocusedOnAvailable(e, t.target);
        }
      }, {
        key: "mouseUpWindow",
        value: function mouseUpWindow(e) {
          this.mouseDownElement && this.resetRecording(e), this.mouseDownElement = void 0;
        }
      }, {
        key: "add",
        value: function add(e, t) {
          var i = (t == null ? void 0 : t.insertInCursorLocation) === void 0 || (t == null ? void 0 : t.insertInCursorLocation);
          t != null && t.element && i && (e.mouseDownEvent = J.mouseDownWindow.bind(e, t.element), document.addEventListener("mousedown", e.mouseDownEvent), e.mouseUpEvent = J.mouseUpWindow.bind(e, t), document.addEventListener("mouseup", e.mouseUpEvent), e.keyDownEvent = J.keyDownWindow.bind(e, t), document.addEventListener("keydown", e.keyDownEvent));
        }
      }, {
        key: "remove",
        value: function remove(e) {
          document.removeEventListener("mousedown", e.mouseDownEvent), document.removeEventListener("mouseup", e.mouseUpEvent), document.removeEventListener("keydown", e.keyDownEvent);
        }
      }]);
      return J;
    }();
    li.EventListeners = J;
    J.KEY_DOWN_TIMEOUT = null;
    var ci = {};
    Object.defineProperty(ci, "__esModule", {
      value: !0
    });
    ci.PreResultUtils = void 0;
    var oa = /*#__PURE__*/function () {
      function oa() {
        _classCallCheck(this, oa);
      }
      _createClass(oa, null, [{
        key: "process",
        value: function process(e, t, i, n, r) {
          var o = n == null ? void 0 : n(t, i);
          return o ? (setTimeout(function () {
            o.restart ? e.resetRecording(r) : o.stop && e.stop();
          }), (o.stop || o.restart) && o.removeNewText) : !1;
        }
      }]);
      return oa;
    }();
    ci.PreResultUtils = oa;
    var Ct = {},
      At = {};
    Object.defineProperty(At, "__esModule", {
      value: !0
    });
    At.AutoScroll = void 0;
    var nn = /*#__PURE__*/function () {
      function nn() {
        _classCallCheck(this, nn);
      }
      _createClass(nn, null, [{
        key: "changeStateIfNeeded",
        value: function changeStateIfNeeded(e, t) {
          t && !e.isCursorAtEnd && (e.endPadding = "", e.scrollingSpan.innerHTML = "&nbsp;");
        }
      }, {
        key: "scrollGeneric",
        value: function scrollGeneric(e, t) {
          e.isCursorAtEnd ? t.scrollTop = t.scrollHeight : e.scrollingSpan.scrollIntoView({
            block: "nearest"
          });
        }
        // primitives don't need to be scrolled except in safari
        // they can only safely be scrolled to the end
      }, {
        key: "scrollSafariPrimitiveToEnd",
        value: function scrollSafariPrimitiveToEnd(e) {
          e.scrollLeft = e.scrollWidth, e.scrollTop = e.scrollHeight;
        }
      }, {
        key: "isElementOverflown",
        value: function isElementOverflown(e) {
          return e.scrollHeight > e.clientHeight || e.scrollWidth > e.clientWidth;
        }
      }, {
        key: "isRequired",
        value: function isRequired(e, t) {
          return e && nn.isElementOverflown(t);
        }
      }]);
      return nn;
    }();
    At.AutoScroll = nn;
    var je = {};
    Object.defineProperty(je, "__esModule", {
      value: !0
    });
    je.Elements = void 0;
    var aa = /*#__PURE__*/function () {
      function aa() {
        _classCallCheck(this, aa);
      }
      _createClass(aa, null, [{
        key: "isPrimitiveElement",
        value: function isPrimitiveElement(e) {
          return e.tagName === "INPUT" || e.tagName === "TEXTAREA";
        }
      }, {
        key: "createInterimSpan",
        value: function createInterimSpan() {
          var e = document.createElement("span");
          return e.style.color = "grey", e.style.pointerEvents = "none", e;
        }
      }, {
        key: "createGenericSpan",
        value: function createGenericSpan() {
          var e = document.createElement("span");
          return e.style.pointerEvents = "none", e;
        }
      }, {
        key: "appendSpans",
        value: function appendSpans(e, t) {
          if (e.spansPopulated = !0, e.insertInCursorLocation && document.activeElement === t) {
            var _i16 = window.getSelection();
            if (_i16 != null && _i16.focusNode) {
              var n = _i16.getRangeAt(0);
              n.insertNode(e.scrollingSpan), n.insertNode(e.interimSpan), n.insertNode(e.finalSpan), n.collapse(!1), _i16.removeAllRanges(), _i16.addRange(n);
              return;
            }
          }
          t.appendChild(e.finalSpan), t.appendChild(e.interimSpan), t.appendChild(e.scrollingSpan);
        }
      }, {
        key: "applyCustomColors",
        value: function applyCustomColors(e, t) {
          t.interim && (e.interimSpan.style.color = t.interim), t["final"] && (e.finalSpan.style.color = t["final"]);
        }
      }, {
        key: "isInsideShadowDOM",
        value: function isInsideShadowDOM(e) {
          return e.getRootNode() instanceof ShadowRoot;
        }
      }]);
      return aa;
    }();
    je.Elements = aa;
    var Fe = {};
    Object.defineProperty(Fe, "__esModule", {
      value: !0
    });
    Fe.Cursor = void 0;
    var ht = /*#__PURE__*/function () {
      function ht() {
        _classCallCheck(this, ht);
      }
      _createClass(ht, null, [{
        key: "setOffsetForGeneric",
        value: function setOffsetForGeneric(e, t) {
          var i = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
          var n = 0;
          for (var r = 0; r < e.childNodes.length; r += 1) {
            var o = e.childNodes[r];
            if (o.childNodes.length > 0) {
              var a = ht.setOffsetForGeneric(o, t, i);
              if (a === -1) return -1;
              i += a;
            } else if (o.textContent !== null) {
              if (i + o.textContent.length > t) {
                var _a2 = document.createRange();
                _a2.setStart(o, t - i), _a2.collapse(!0);
                var l = window.getSelection();
                return l == null || l.removeAllRanges(), l == null || l.addRange(_a2), e.focus(), -1;
              }
              i += o.textContent.length, n += o.textContent.length;
            }
          }
          return n;
        }
      }, {
        key: "focusEndOfGeneric",
        value: function focusEndOfGeneric(e) {
          var t = document.createRange();
          t.selectNodeContents(e), t.collapse(!1);
          var i = window.getSelection();
          i && (i.removeAllRanges(), i.addRange(t));
        }
      }, {
        key: "setOffsetForSafariGeneric",
        value: function setOffsetForSafariGeneric(e, t) {
          var i = window.getSelection();
          if (i) {
            var n = ht.getGenericElementCursorOffset(e, i, !0);
            console.log(n), setTimeout(function () {}, 100), ht.setOffsetForGeneric(e, n + t);
          }
        }
        // set to automatically scroll to cursor (scroll does not work in Safari)
      }, {
        key: "setOffsetForPrimitive",
        value: function setOffsetForPrimitive(e, t, i) {
          i && e.blur(), e.setSelectionRange(t, t), e.focus();
        }
        // Scroll Input in Safari - does not work for TextArea and uses span which can have a different style
        // private static getCursorOffsetFromLeft(inputElement: HTMLInputElement, position: number) {
        //   // Get the value of the input element up to the cursor position
        //   const valueUpToCursor = inputElement.value.substring(0, position);
        //   // Create a temporary span element to measure the width of the text
        //   const tempSpan = document.createElement('span');
        //   tempSpan.textContent = valueUpToCursor;
        //   tempSpan.style.visibility = 'hidden';
        //   tempSpan.style.position = 'absolute';
        //   document.body.appendChild(tempSpan);
        //   // Measure the width of the text up to the cursor position
        //   const offsetWidth = tempSpan.offsetWidth;
        //   const offsetHeight = tempSpan.offsetHeight;
        //   // Clean up the temporary span element
        //   document.body.removeChild(tempSpan);
        //   return {left: offsetWidth, top: offsetHeight};
        // }
      }, {
        key: "getGenericElementCursorOffset",
        value: function getGenericElementCursorOffset(e, t, i) {
          var n = 0;
          if (t.rangeCount > 0) {
            var r = t.getRangeAt(0),
              o = r.cloneRange();
            o.selectNodeContents(e), i ? o.setEnd(r.startContainer, r.startOffset) : o.setEnd(r.endContainer, r.endOffset), n = o.toString().length;
          }
          return n;
        }
      }]);
      return ht;
    }();
    Fe.Cursor = ht;
    Object.defineProperty(Ct, "__esModule", {
      value: !0
    });
    Ct.CommandUtils = void 0;
    var Mn = At,
      la = je,
      ca = tt,
      Tn = Fe,
      Cn = De;
    var K = /*#__PURE__*/function () {
      function K() {
        _classCallCheck(this, K);
      }
      _createClass(K, null, [{
        key: "processCommand",
        value: function processCommand(e, t) {
          return (!t || !t.caseSensitive) && (e = e.toLowerCase()), (t == null ? void 0 : t.substrings) === !1 ? Cn.Text.breakupIntoWordsArr(e) : e;
        }
      }, {
        key: "process",
        value: function process(e) {
          var t;
          return ((t = e.settings) === null || t === void 0 ? void 0 : t.caseSensitive) === !0 ? e : Object.keys(e).reduce(function (n, r) {
            var o = e[r];
            return n[r] = typeof o == "string" ? K.processCommand(o, e.settings) : o, n;
          }, {});
        }
      }, {
        key: "toggleCommandModeOn",
        value: function toggleCommandModeOn(e) {
          var t;
          e.isWaitingForCommand = !0, (t = e.onCommandModeTrigger) === null || t === void 0 || t.call(e, !0);
        }
      }, {
        key: "toggleCommandModeOff",
        value: function toggleCommandModeOff(e) {
          var t;
          e.isWaitingForCommand && ((t = e.onCommandModeTrigger) === null || t === void 0 || t.call(e, !1), e.isWaitingForCommand = !1);
        }
      }, {
        key: "setText",
        value: function setText(e, t, i, n) {
          K.toggleCommandModeOff(e), la.Elements.isPrimitiveElement(n) ? (n.value = i, e.isTargetInShadow || Tn.Cursor.setOffsetForPrimitive(n, i.length, !0), ca.Browser.IS_SAFARI() && e.autoScroll && Mn.AutoScroll.scrollSafariPrimitiveToEnd(n)) : (n.textContent = i, e.isTargetInShadow || Tn.Cursor.focusEndOfGeneric(n), setTimeout(function () {
            return Mn.AutoScroll.scrollGeneric(e, n);
          })), e.resetRecording(t);
        }
      }, {
        key: "checkIfMatchesSubstring",
        value: function checkIfMatchesSubstring(e, t) {
          return t.includes(e);
        }
      }, {
        key: "checkIfMatchesWord",
        value: function checkIfMatchesWord(e, t, i) {
          var n = e;
          for (var r = i.length - 1; r >= 0; r -= 1) {
            var o = r,
              a = n.length - 1;
            for (; i[o] === n[a] && a >= 0;) o -= 1, a -= 1;
            if (a < 0) return !0;
          }
          return !1;
        }
        // prettier-ignore
      }, {
        key: "execCommand",
        value: function execCommand(e, t, i, n, r) {
          var o, a, l;
          var c = e.commands;
          if (!c || !n || !i) return;
          var d = ((o = c.settings) === null || o === void 0 ? void 0 : o.caseSensitive) === !0 ? t : t.toLowerCase(),
            u = Cn.Text.breakupIntoWordsArr(d),
            h = ((a = c.settings) === null || a === void 0 ? void 0 : a.substrings) === !1 ? K.checkIfMatchesWord : K.checkIfMatchesSubstring;
          if (c.commandMode && h(c.commandMode, d, u)) return e.setInterimColorToFinal(), setTimeout(function () {
            return K.toggleCommandModeOn(e);
          }), {
            doNotProcessTranscription: !1
          };
          if (!(c.commandMode && !e.isWaitingForCommand)) {
            if (c.stop && h(c.stop, d, u)) return K.toggleCommandModeOff(e), setTimeout(function () {
              return e.stop();
            }), {
              doNotProcessTranscription: !1
            };
            if (c.pause && h(c.pause, d, u)) return K.toggleCommandModeOff(e), e.setInterimColorToFinal(), setTimeout(function () {
              var p;
              e.isPaused = !0, (p = e.onPauseTrigger) === null || p === void 0 || p.call(e, !0);
            }), {
              doNotProcessTranscription: !1
            };
            if (c.resume && h(c.resume, d, u)) return e.isPaused = !1, (l = e.onPauseTrigger) === null || l === void 0 || l.call(e, !1), K.toggleCommandModeOff(e), e.resetRecording(i), {
              doNotProcessTranscription: !0
            };
            if (c.reset && h(c.reset, d, u)) return r !== void 0 && K.setText(e, i, r, n), {
              doNotProcessTranscription: !0
            };
            if (c.removeAllText && h(c.removeAllText, d, u)) return K.setText(e, i, "", n), {
              doNotProcessTranscription: !0
            };
          }
        }
      }]);
      return K;
    }();
    Ct.CommandUtils = K;
    var di = {};
    Object.defineProperty(di, "__esModule", {
      value: !0
    });
    di.Highlight = void 0;
    var da = je,
      it = Fe;
    var Wt = /*#__PURE__*/function () {
      function Wt() {
        _classCallCheck(this, Wt);
      }
      _createClass(Wt, null, [{
        key: "setStateForPrimitive",
        value: function setStateForPrimitive(e, t) {
          var i, n;
          t.selectionStart !== null && (i = t.selectionStart), t.selectionEnd !== null && (n = t.selectionEnd), e.isHighlighted = i !== n;
        }
      }, {
        key: "setStateForGeneric",
        value: function setStateForGeneric(e, t) {
          var i = window.getSelection();
          if (i != null && i.focusNode) {
            var n = it.Cursor.getGenericElementCursorOffset(t, i, !0),
              r = it.Cursor.getGenericElementCursorOffset(t, i, !1);
            e.isHighlighted = n !== r;
          }
        }
      }, {
        key: "setState",
        value: function setState(e, t) {
          document.activeElement === t && (da.Elements.isPrimitiveElement(t) ? Wt.setStateForPrimitive(e, t) : Wt.setStateForGeneric(e, t));
        }
      }, {
        key: "removeForGeneric",
        value: function removeForGeneric(e, t) {
          var i = window.getSelection();
          if (i) {
            var n = it.Cursor.getGenericElementCursorOffset(t, i, !0);
            i.deleteFromDocument(), it.Cursor.setOffsetForGeneric(t, n), e.isHighlighted = !1;
          }
        }
      }, {
        key: "removeForPrimitive",
        value: function removeForPrimitive(e, t) {
          var i = t.selectionStart,
            n = t.selectionEnd,
            r = t.value;
          if (i && n) {
            var o = r.substring(0, i) + r.substring(n);
            t.value = o, it.Cursor.setOffsetForPrimitive(t, i, e.autoScroll);
          }
          e.isHighlighted = !1;
        }
      }]);
      return Wt;
    }();
    di.Highlight = Wt;
    var ui = {};
    Object.defineProperty(ui, "__esModule", {
      value: !0
    });
    ui.Padding = void 0;
    var ua = je,
      An = Fe,
      Ue = De;
    var Kt = /*#__PURE__*/function () {
      function Kt() {
        _classCallCheck(this, Kt);
      }
      _createClass(Kt, null, [{
        key: "setStateForPrimitiveElement",
        value: function setStateForPrimitiveElement(e, t) {
          if (document.activeElement === t && t.selectionStart !== null) {
            var n = t.selectionStart,
              r = t.value[n - 1],
              o = t.selectionEnd === null ? n : t.selectionEnd,
              a = t.value[o];
            Ue.Text.isCharDefined(r) && (e.startPadding = " ", e.numberOfSpacesBeforeNewText = 1), Ue.Text.isCharDefined(a) && (e.endPadding = " ", e.numberOfSpacesAfterNewText = 1), e.isCursorAtEnd = t.value.length === o;
            return;
          }
          var i = t.value[t.value.length - 1];
          Ue.Text.isCharDefined(i) && (e.startPadding = " ", e.numberOfSpacesBeforeNewText = 1), e.isCursorAtEnd = !0;
        }
      }, {
        key: "setStateForGenericElement",
        value: function setStateForGenericElement(e, t) {
          var i, n, r;
          if (document.activeElement === t) {
            var a = window.getSelection();
            if (a != null && a.focusNode) {
              var l = An.Cursor.getGenericElementCursorOffset(t, a, !0),
                c = (i = t.textContent) === null || i === void 0 ? void 0 : i[l - 1],
                d = An.Cursor.getGenericElementCursorOffset(t, a, !1),
                u = (n = t.textContent) === null || n === void 0 ? void 0 : n[d];
              Ue.Text.isCharDefined(c) && (e.startPadding = " "), Ue.Text.isCharDefined(u) && (e.endPadding = " "), e.isCursorAtEnd = ((r = t.textContent) === null || r === void 0 ? void 0 : r.length) === d;
              return;
            }
          }
          var o = t.innerText.charAt(t.innerText.length - 1);
          Ue.Text.isCharDefined(o) && (e.startPadding = " "), e.isCursorAtEnd = !0;
        }
      }, {
        key: "setState",
        value: function setState(e, t) {
          ua.Elements.isPrimitiveElement(t) ? Kt.setStateForPrimitiveElement(e, t) : Kt.setStateForGenericElement(e, t);
        }
      }, {
        key: "adjustStateAfterRecodingPrimitiveElement",
        value: function adjustStateAfterRecodingPrimitiveElement(e, t) {
          if (e.primitiveTextRecorded = !0, e.insertInCursorLocation && document.activeElement === t && (t.selectionEnd !== null && (e.endPadding = e.endPadding + t.value.slice(t.selectionEnd)), t.selectionStart !== null)) {
            e.startPadding = t.value.slice(0, t.selectionStart) + e.startPadding;
            return;
          }
          e.startPadding = t.value + e.startPadding;
        }
      }, {
        key: "adjustSateForNoTextPrimitiveElement",
        value: function adjustSateForNoTextPrimitiveElement(e) {
          e.numberOfSpacesBeforeNewText === 1 && (e.startPadding = e.startPadding.substring(0, e.startPadding.length - 1), e.numberOfSpacesBeforeNewText = 0), e.numberOfSpacesAfterNewText === 1 && (e.endPadding = e.endPadding.substring(1), e.numberOfSpacesAfterNewText = 0);
        }
      }]);
      return Kt;
    }();
    ui.Padding = Kt;
    Object.defineProperty(Tt, "__esModule", {
      value: !0
    });
    Tt.Speech = void 0;
    var kn = li,
      ha = ci,
      In = Ct,
      Rt = At,
      Ti = di,
      ie = je,
      Ci = ui,
      Ln = tt,
      Rn = Fe,
      Ai = De;
    var pa = /*#__PURE__*/function () {
      function pa() {
        _classCallCheck(this, pa);
        this.finalTranscript = "", this.interimSpan = ie.Elements.createInterimSpan(), this.finalSpan = ie.Elements.createGenericSpan(), this.scrollingSpan = ie.Elements.createGenericSpan(), this.isCursorAtEnd = !1, this.spansPopulated = !1, this.startPadding = "", this.endPadding = "", this.numberOfSpacesBeforeNewText = 0, this.numberOfSpacesAfterNewText = 0, this.isHighlighted = !1, this.primitiveTextRecorded = !1, this.recognizing = !1, this._displayInterimResults = !0, this.insertInCursorLocation = !0, this.autoScroll = !0, this.isRestarting = !1, this.isPaused = !1, this.isWaitingForCommand = !1, this.isTargetInShadow = !1, this.cannotBeStopped = !1, this.resetState();
      }
      _createClass(pa, [{
        key: "prepareBeforeStart",
        value: function prepareBeforeStart(e) {
          var t, i;
          if (e != null && e.element) if (kn.EventListeners.add(this, e), Array.isArray(e.element)) {
            var r = e.element.find(function (o) {
              return o === document.activeElement;
            }) || e.element[0];
            if (!r) return;
            this.prepare(r);
          } else this.prepare(e.element);
          (e == null ? void 0 : e.displayInterimResults) !== void 0 && (this._displayInterimResults = e.displayInterimResults), e != null && e.textColor && (this._finalTextColor = (t = e == null ? void 0 : e.textColor) === null || t === void 0 ? void 0 : t["final"], ie.Elements.applyCustomColors(this, e.textColor)), (e == null ? void 0 : e.insertInCursorLocation) !== void 0 && (this.insertInCursorLocation = e.insertInCursorLocation), (e == null ? void 0 : e.autoScroll) !== void 0 && (this.autoScroll = e.autoScroll), this._onResult = e == null ? void 0 : e.onResult, this._onPreResult = e == null ? void 0 : e.onPreResult, this._onStart = e == null ? void 0 : e.onStart, this._onStop = e == null ? void 0 : e.onStop, this._onError = e == null ? void 0 : e.onError, this.onCommandModeTrigger = e == null ? void 0 : e.onCommandModeTrigger, this.onPauseTrigger = e == null ? void 0 : e.onPauseTrigger, this._options = e, !((i = this._options) === null || i === void 0) && i.commands && (this.commands = In.CommandUtils.process(this._options.commands));
        }
      }, {
        key: "prepare",
        value: function prepare(e) {
          Ci.Padding.setState(this, e), Ti.Highlight.setState(this, e), this.isTargetInShadow = ie.Elements.isInsideShadowDOM(e), ie.Elements.isPrimitiveElement(e) ? (this._primitiveElement = e, this._originalText = this._primitiveElement.value) : (this._genericElement = e, this._originalText = this._genericElement.textContent);
        }
        // there was an attempt to optimize this by not having to restart the service and just reset state:
        // unfortunately it did not work because the service would still continue firing the intermediate and final results
        // into the new position
      }, {
        key: "resetRecording",
        value: function resetRecording(e) {
          this.isRestarting = !0, this.stop(!0), this.resetState(!0), this.start(e, !0);
        }
        // prettier-ignore
      }, {
        key: "updateElements",
        value: function updateElements(e, t, i) {
          var n;
          var r = Ai.Text.capitalize(t);
          if (this.finalTranscript === r && e === "") return;
          ha.PreResultUtils.process(this, i, e === "", this._onPreResult, this._options) && (e = "", i = "");
          var o = this.commands && In.CommandUtils.execCommand(this, i, this._options, this._primitiveElement || this._genericElement, this._originalText);
          if (o) {
            if (o.doNotProcessTranscription) return;
            e = "", i = "";
          }
          if (this.isPaused || this.isWaitingForCommand) return;
          (n = this._onResult) === null || n === void 0 || n.call(this, i, e === ""), this.finalTranscript = r, this._displayInterimResults || (e = "");
          var a = this.finalTranscript === "" && e === "";
          this._primitiveElement ? this.updatePrimitiveElement(this._primitiveElement, e, a) : this._genericElement && this.updateGenericElement(this._genericElement, e, a);
        }
        // prettier-ignore
        // remember that padding values here contain actual text left and right
      }, {
        key: "updatePrimitiveElement",
        value: function updatePrimitiveElement(e, t, i) {
          this.isHighlighted && Ti.Highlight.removeForPrimitive(this, e), this.primitiveTextRecorded || Ci.Padding.adjustStateAfterRecodingPrimitiveElement(this, e), i && Ci.Padding.adjustSateForNoTextPrimitiveElement(this);
          var n = this.startPadding + this.finalTranscript + t;
          if (e.value = n + this.endPadding, !this.isTargetInShadow) {
            var r = n.length + this.numberOfSpacesAfterNewText;
            Rn.Cursor.setOffsetForPrimitive(e, r, this.autoScroll);
          }
          this.autoScroll && Ln.Browser.IS_SAFARI() && this.isCursorAtEnd && Rt.AutoScroll.scrollSafariPrimitiveToEnd(e);
        }
      }, {
        key: "updateGenericElement",
        value: function updateGenericElement(e, t, i) {
          this.isHighlighted && Ti.Highlight.removeForGeneric(this, e), this.spansPopulated || ie.Elements.appendSpans(this, e);
          var n = (i ? "" : this.startPadding) + Ai.Text.lineBreak(this.finalTranscript);
          this.finalSpan.innerHTML = n;
          var r = Rt.AutoScroll.isRequired(this.autoScroll, e);
          Rt.AutoScroll.changeStateIfNeeded(this, r);
          var o = Ai.Text.lineBreak(t) + (i ? "" : this.endPadding);
          this.interimSpan.innerHTML = o, Ln.Browser.IS_SAFARI() && this.insertInCursorLocation && Rn.Cursor.setOffsetForSafariGeneric(e, n.length + o.length), r && Rt.AutoScroll.scrollGeneric(this, e), i && (this.scrollingSpan.innerHTML = "");
        }
      }, {
        key: "finalise",
        value: function finalise(e) {
          this._genericElement && (e ? (this.finalSpan = ie.Elements.createGenericSpan(), this.setInterimColorToFinal(), this.interimSpan = ie.Elements.createInterimSpan(), this.scrollingSpan = ie.Elements.createGenericSpan()) : this._genericElement.textContent = this._genericElement.textContent, this.spansPopulated = !1), kn.EventListeners.remove(this);
        }
      }, {
        key: "setInterimColorToFinal",
        value: function setInterimColorToFinal() {
          this.interimSpan.style.color = this._finalTextColor || "black";
        }
      }, {
        key: "resetState",
        value: function resetState(e) {
          this._primitiveElement = void 0, this._genericElement = void 0, this.finalTranscript = "", this.finalSpan.innerHTML = "", this.interimSpan.innerHTML = "", this.scrollingSpan.innerHTML = "", this.startPadding = "", this.endPadding = "", this.isHighlighted = !1, this.primitiveTextRecorded = !1, this.numberOfSpacesBeforeNewText = 0, this.numberOfSpacesAfterNewText = 0, e || (this.stopTimeout = void 0);
        }
      }, {
        key: "setStateOnStart",
        value: function setStateOnStart() {
          var e;
          this.recognizing = !0, this.isRestarting ? this.isRestarting = !1 : (e = this._onStart) === null || e === void 0 || e.call(this);
        }
      }, {
        key: "setStateOnStop",
        value: function setStateOnStop() {
          var e;
          this.recognizing = !1, this.isRestarting || (e = this._onStop) === null || e === void 0 || e.call(this);
        }
      }, {
        key: "setStateOnError",
        value: function setStateOnError(e) {
          var t;
          (t = this._onError) === null || t === void 0 || t.call(this, e), this.recognizing = !1;
        }
      }]);
      return pa;
    }();
    Tt.Speech = pa;
    Object.defineProperty(oi, "__esModule", {
      value: !0
    });
    oi.WebSpeech = void 0;
    var On = ai,
      Nn = tt,
      fa = Tt;
    var Jt = /*#__PURE__*/function (_fa$Speech) {
      _inherits(Jt, _fa$Speech);
      var _super41 = _createSuper(Jt);
      function Jt() {
        _classCallCheck(this, Jt);
        return _super41.call(this);
      }
      _createClass(Jt, [{
        key: "start",
        value: function start(e) {
          var t;
          this._extractText === void 0 && (this._extractText = Nn.Browser.IS_SAFARI() ? On.WebSpeechTranscript.extractSafari : On.WebSpeechTranscript.extract), this.validate() && (this.prepareBeforeStart(e), this.instantiateService(e), (t = this._service) === null || t === void 0 || t.start(), this._translations = e == null ? void 0 : e.translations);
        }
      }, {
        key: "validate",
        value: function validate() {
          return Jt.getAPI() ? !0 : (this.error("Speech Recognition is unsupported"), !1);
        }
      }, {
        key: "instantiateService",
        value: function instantiateService(e) {
          var t, i;
          var n = Jt.getAPI();
          this._service = new n(), this._service.continuous = !0, this._service.interimResults = (t = e == null ? void 0 : e.displayInterimResults) !== null && t !== void 0 ? t : !0, this._service.lang = ((i = e == null ? void 0 : e.language) === null || i === void 0 ? void 0 : i.trim()) || "en-US", this.setEvents();
        }
      }, {
        key: "setEvents",
        value: function setEvents() {
          var _this52 = this;
          this._service && (this._service.onstart = function () {
            _this52.setStateOnStart();
          }, this._service.onerror = function (e) {
            Nn.Browser.IS_SAFARI() && e.message === "Another request is started" || e.error === "aborted" && _this52.isRestarting || e.error !== "no-speech" && _this52.error(e.message || e.error);
          }, this._service.onaudioend = function () {
            _this52.setStateOnStop();
          }, this._service.onend = function () {
            _this52._stopping = !1;
          }, this._service.onresult = function (e) {
            if (_typeof(e.results) > "u" && _this52._service) _this52._service.onend = null, _this52._service.stop();else if (_this52._extractText && !_this52._stopping) {
              var _this52$_extractText = _this52._extractText(e, _this52.finalTranscript, _this52._translations),
                t = _this52$_extractText.interimTranscript,
                _i17 = _this52$_extractText.finalTranscript,
                n = _this52$_extractText.newText;
              _this52.updateElements(t, _i17, n);
            }
          });
        }
      }, {
        key: "stop",
        value: function stop(e) {
          var t;
          this._stopping = !0, (t = this._service) === null || t === void 0 || t.stop(), this.finalise(e);
        }
      }, {
        key: "error",
        value: function error(e) {
          console.error(e), this.setStateOnError(e), this.stop();
        }
      }], [{
        key: "getAPI",
        value: function getAPI() {
          return window.webkitSpeechRecognition || window.SpeechRecognition;
        }
      }]);
      return Jt;
    }(fa.Speech);
    oi.WebSpeech = Jt;
    var hi = {};
    Object.defineProperty(hi, "__esModule", {
      value: !0
    });
    hi.GlobalState = void 0;
    var $e = /*#__PURE__*/function () {
      function $e() {
        _classCallCheck(this, $e);
      }
      _createClass($e, null, [{
        key: "doubleClickDetector",
        value: function doubleClickDetector() {
          return $e.doubleClickPending ? !0 : ($e.doubleClickPending = !0, setTimeout(function () {
            $e.doubleClickPending = !1;
          }, 300), !1);
        }
      }]);
      return $e;
    }();
    hi.GlobalState = $e;
    $e.doubleClickPending = !1;
    var pi = {},
      fi = {};
    Object.defineProperty(fi, "__esModule", {
      value: !0
    });
    fi.PreventConnectionStop = void 0;
    var ma = /*#__PURE__*/function () {
      function ma() {
        _classCallCheck(this, ma);
      }
      _createClass(ma, null, [{
        key: "applyPrevention",
        value: function applyPrevention(e) {
          clearTimeout(e._manualConnectionStopPrevention), e.cannotBeStopped = !0, e._manualConnectionStopPrevention = setTimeout(function () {
            e.cannotBeStopped = !1;
          }, 800);
        }
      }, {
        key: "clearPrevention",
        value: function clearPrevention(e) {
          clearTimeout(e._manualConnectionStopPrevention), e.cannotBeStopped = !1;
        }
      }]);
      return ma;
    }();
    fi.PreventConnectionStop = ma;
    var mi = {},
      gi = {};
    Object.defineProperty(gi, "__esModule", {
      value: !0
    });
    gi.README_URL = void 0;
    gi.README_URL = "https://github.com/OvidijusParsiunas/speech-to-element";
    Object.defineProperty(mi, "__esModule", {
      value: !0
    });
    mi.AzureSpeechConfig = void 0;
    var ki = gi;
    var $t = /*#__PURE__*/function () {
      function $t() {
        _classCallCheck(this, $t);
      }
      _createClass($t, null, [{
        key: "validateOptions",
        value: function validateOptions(e, t) {
          return t ? !t.subscriptionKey && !t.token && !t.retrieveToken ? (e("Please define a 'subscriptionKey', 'token' or 'retrieveToken' property - more info: ".concat(ki.README_URL)), !1) : t.region ? !0 : (e("Please define a 'region' property - more info: ".concat(ki.README_URL)), !1) : (e("Please provide subscription details - more info: ".concat(ki.README_URL)), !1);
        }
      }, {
        key: "getNewSpeechConfig",
        value: function () {
          var _getNewSpeechConfig = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee95(e, t) {
            return _regeneratorRuntime().wrap(function _callee95$(_context95) {
              while (1) switch (_context95.prev = _context95.next) {
                case 0:
                  if (!t.region) {
                    _context95.next = 2;
                    break;
                  }
                  return _context95.abrupt("return", t.subscriptionKey ? e.fromSubscription(t.subscriptionKey.trim(), t.region.trim()) : t.token ? e.fromAuthorizationToken(t.token.trim(), t.region.trim()) : t.retrieveToken ? t.retrieveToken().then(function (i) {
                    return t.region ? e.fromAuthorizationToken((i == null ? void 0 : i.trim()) || "", t.region.trim()) : null;
                  })["catch"](function (i) {
                    return console.error(i), null;
                  }) : null);
                case 2:
                case "end":
                  return _context95.stop();
              }
            }, _callee95);
          }));
          function getNewSpeechConfig(_x175, _x176) {
            return _getNewSpeechConfig.apply(this, arguments);
          }
          return getNewSpeechConfig;
        }()
      }, {
        key: "process",
        value: function process(e, t) {
          t.language && (e.speechRecognitionLanguage = t.language.trim());
        }
      }, {
        key: "get",
        value: function () {
          var _get = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee96(e, t) {
            var i;
            return _regeneratorRuntime().wrap(function _callee96$(_context96) {
              while (1) switch (_context96.prev = _context96.next) {
                case 0:
                  _context96.next = 2;
                  return $t.getNewSpeechConfig(e, t);
                case 2:
                  i = _context96.sent;
                  return _context96.abrupt("return", (i && $t.process(i, t), i));
                case 4:
                case "end":
                  return _context96.stop();
              }
            }, _callee96);
          }));
          function get(_x177, _x178) {
            return _get.apply(this, arguments);
          }
          return get;
        }()
      }]);
      return $t;
    }();
    mi.AzureSpeechConfig = $t;
    var bi = {};
    Object.defineProperty(bi, "__esModule", {
      value: !0
    });
    bi.StopTimeout = void 0;
    var vt = /*#__PURE__*/function () {
      function vt() {
        _classCallCheck(this, vt);
      }
      _createClass(vt, null, [{
        key: "set",
        value: function set(e) {
          e.stopTimeout = setTimeout(function () {
            return e.stop();
          }, e.stopTimeoutMS);
        }
      }, {
        key: "reset",
        value: function reset(e, t) {
          e.stopTimeoutMS = t || vt.DEFAULT_MS, e.stopTimeout && clearTimeout(e.stopTimeout), vt.set(e);
        }
      }]);
      return vt;
    }();
    bi.StopTimeout = vt;
    vt.DEFAULT_MS = 2e4;
    var vi = {};
    Object.defineProperty(vi, "__esModule", {
      value: !0
    });
    vi.AzureTranscript = void 0;
    var ga = Mt;
    var ba = /*#__PURE__*/function () {
      function ba() {
        _classCallCheck(this, ba);
      }
      _createClass(ba, null, [{
        key: "extract",
        value:
        // newText is used to only send new text in onResult as finalTranscript is continuously accumulated
        function extract(e, t, i, n) {
          return n && (e = ga.Translate.translate(e, n)), i ? {
            interimTranscript: "",
            finalTranscript: t + e,
            newText: e
          } : {
            interimTranscript: e,
            finalTranscript: t,
            newText: e
          };
        }
      }]);
      return ba;
    }();
    vi.AzureTranscript = ba;
    Object.defineProperty(pi, "__esModule", {
      value: !0
    });
    pi.Azure = void 0;
    var Pn = fi,
      Dn = mi,
      Ii = bi,
      jn = vi,
      va = Tt;
    var Yt = /*#__PURE__*/function (_va$Speech) {
      _inherits(Yt, _va$Speech);
      var _super42 = _createSuper(Yt);
      function Yt() {
        var _this53;
        _classCallCheck(this, Yt);
        _this53 = _super42.apply(this, arguments), _this53._newTextPadding = "";
        return _this53;
      }
      _createClass(Yt, [{
        key: "start",
        value: function start(e, t) {
          this._newTextPadding = "", this.stopTimeout === void 0 && Ii.StopTimeout.reset(this, e == null ? void 0 : e.stopAfterSilenceMs), this.prepareBeforeStart(e), this.startAsync(e), t || Pn.PreventConnectionStop.applyPrevention(this);
        }
      }, {
        key: "startAsync",
        value: function () {
          var _startAsync = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee97(e) {
            var t;
            return _regeneratorRuntime().wrap(function _callee97$(_context97) {
              while (1) switch (_context97.prev = _context97.next) {
                case 0:
                  _context97.t0 = this.validate(e);
                  if (!_context97.t0) {
                    _context97.next = 6;
                    break;
                  }
                  _context97.next = 4;
                  return this.instantiateService(e);
                case 4:
                  this._translations = e == null ? void 0 : e.translations;
                  (t = this._service) === null || t === void 0 || t.startContinuousRecognitionAsync(function () {}, this.error);
                case 6:
                case "end":
                  return _context97.stop();
              }
            }, _callee97, this);
          }));
          function startAsync(_x179) {
            return _startAsync.apply(this, arguments);
          }
          return startAsync;
        }()
      }, {
        key: "validate",
        value: function validate(e) {
          return Yt.getAPI() ? Dn.AzureSpeechConfig.validateOptions(this.error.bind(this), e) : (this.moduleNotFound(), !1);
        }
      }, {
        key: "instantiateService",
        value: function () {
          var _instantiateService = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee98(e) {
            var t, i, n, r;
            return _regeneratorRuntime().wrap(function _callee98$(_context98) {
              while (1) switch (_context98.prev = _context98.next) {
                case 0:
                  t = Yt.getAPI();
                  i = t.AudioConfig.fromDefaultMicrophoneInput();
                  _context98.next = 4;
                  return Dn.AzureSpeechConfig.get(t.SpeechConfig, e);
                case 4:
                  n = _context98.sent;
                  if (n) {
                    r = new t.SpeechRecognizer(n, i);
                    this.setEvents(r), this._service = r, e.retrieveToken && this.retrieveTokenInterval(e.retrieveToken);
                  } else this.error("Unable to contact Azure server");
                case 6:
                case "end":
                  return _context98.stop();
              }
            }, _callee98, this);
          }));
          function instantiateService(_x180) {
            return _instantiateService.apply(this, arguments);
          }
          return instantiateService;
        }()
      }, {
        key: "setEvents",
        value: function setEvents(e) {
          e.recognizing = this.onRecognizing.bind(this), e.recognized = this.onRecognized.bind(this), e.sessionStarted = this.onSessionStarted.bind(this), e.canceled = this.onCanceled.bind(this), e.sessionStopped = this.onSessionStopped.bind(this);
        }
        // prettier-ignore
      }, {
        key: "onRecognizing",
        value: function onRecognizing(e, t) {
          if (this._stopping) return;
          var _jn$AzureTranscript$e = jn.AzureTranscript.extract(this._newTextPadding + t.result.text, this.finalTranscript, !1, this._translations),
            i = _jn$AzureTranscript$e.interimTranscript,
            n = _jn$AzureTranscript$e.finalTranscript,
            r = _jn$AzureTranscript$e.newText;
          Ii.StopTimeout.reset(this, this.stopTimeoutMS), this.updateElements(i, n, r);
        }
        // WORK - huge opportunity to fix this in the repo!!!!!
        //   function onRecognized(sender, recognitionEventArgs) {
        //     var result = recognitionEventArgs.result;
        //     onRecognizedResult(recognitionEventArgs.result);
        // }
        // prettier-ignore
      }, {
        key: "onRecognized",
        value: function onRecognized(e, t) {
          var i = t.result;
          switch (i.reason) {
            case window.SpeechSDK.ResultReason.Canceled:
              break;
            case window.SpeechSDK.ResultReason.RecognizedSpeech:
              if (i.text && !this._stopping) {
                var _jn$AzureTranscript$e2 = jn.AzureTranscript.extract(this._newTextPadding + i.text, this.finalTranscript, !0, this._translations),
                  n = _jn$AzureTranscript$e2.interimTranscript,
                  r = _jn$AzureTranscript$e2.finalTranscript,
                  o = _jn$AzureTranscript$e2.newText;
                Ii.StopTimeout.reset(this, this.stopTimeoutMS), this.updateElements(n, r, o), r !== "" && (this._newTextPadding = " ");
              }
              break;
          }
        }
      }, {
        key: "onCanceled",
        value: function onCanceled(e, t) {
          t.reason === window.SpeechSDK.CancellationReason.Error && this.error(t.errorDetails);
        }
      }, {
        key: "onSessionStarted",
        value: function onSessionStarted() {
          Pn.PreventConnectionStop.clearPrevention(this), this.setStateOnStart();
        }
      }, {
        key: "onSessionStopped",
        value: function onSessionStopped() {
          this._retrieveTokenInterval || clearInterval(this._retrieveTokenInterval), this._stopping = !1, this.setStateOnStop();
        }
      }, {
        key: "retrieveTokenInterval",
        value: function retrieveTokenInterval(e) {
          var _this54 = this;
          this._retrieveTokenInterval = setInterval(function () {
            e == null || e().then(function (t) {
              _this54._service && (_this54._service.authorizationToken = (t == null ? void 0 : t.trim()) || "");
            })["catch"](function (t) {
              _this54.error(t);
            });
          }, 1e4);
        }
      }, {
        key: "stop",
        value: function stop(e) {
          var t;
          !e && this._retrieveTokenInterval && clearInterval(this._retrieveTokenInterval), this._stopping = !0, (t = this._service) === null || t === void 0 || t.stopContinuousRecognitionAsync(), this.finalise(e);
        }
      }, {
        key: "moduleNotFound",
        value: function moduleNotFound() {
          console.error("speech recognition module not found:"), console.error("please install the 'microsoft-cognitiveservices-speech-sdk' npm package or add a script tag: <script src=\"https://aka.ms/csspeech/jsbrowserpackageraw\"></script>"), this.setStateOnError("speech recognition module not found");
        }
      }, {
        key: "error",
        value: function error(e) {
          this._retrieveTokenInterval && clearInterval(this._retrieveTokenInterval), console.error(e), this.setStateOnError(e), this.stop();
        }
      }], [{
        key: "getAPI",
        value: function getAPI() {
          return window.SpeechSDK;
        }
      }]);
      return Yt;
    }(va.Speech);
    pi.Azure = Yt;
    Object.defineProperty(ms, "__esModule", {
      value: !0
    });
    var Fn = oi,
      ya = Ct,
      ee = hi,
      xa = pi;
    var We = /*#__PURE__*/function () {
      function We() {
        _classCallCheck(this, We);
      }
      _createClass(We, null, [{
        key: "toggle",
        value: function toggle(e, t) {
          var i, n;
          var r = e.toLocaleLowerCase().trim();
          !((i = ee.GlobalState.service) === null || i === void 0) && i.recognizing ? this.stop() : r === "webspeech" ? We.startWebSpeech(t) : r === "azure" ? We.startAzure(t) : (console.error("service not found - must be either 'webspeech' or 'azure'"), (n = t == null ? void 0 : t.onError) === null || n === void 0 || n.call(t, "service not found - must be either 'webspeech' or 'azure'"));
        }
      }, {
        key: "startWebSpeech",
        value: function startWebSpeech(e) {
          We.stop() || (ee.GlobalState.service = new Fn.WebSpeech(), ee.GlobalState.service.start(e));
        }
      }, {
        key: "isWebSpeechSupported",
        value: function isWebSpeechSupported() {
          return !!Fn.WebSpeech.getAPI();
        }
      }, {
        key: "startAzure",
        value: function startAzure(e) {
          var t;
          We.stop() || !((t = ee.GlobalState.service) === null || t === void 0) && t.cannotBeStopped || (ee.GlobalState.service = new xa.Azure(), ee.GlobalState.service.start(e));
        }
      }, {
        key: "stop",
        value: function stop() {
          var e;
          return ee.GlobalState.doubleClickDetector() ? !0 : (!((e = ee.GlobalState.service) === null || e === void 0) && e.recognizing && ee.GlobalState.service.stop(), !1);
        }
      }, {
        key: "endCommandMode",
        value: function endCommandMode() {
          ee.GlobalState.service && ya.CommandUtils.toggleCommandModeOff(ee.GlobalState.service);
        }
      }]);
      return We;
    }();
    var Li = ms["default"] = We;
    var Zt = /*#__PURE__*/function (_bt) {
      _inherits(Zt, _bt);
      var _super43 = _createSuper(Zt);
      function Zt(e, t, i) {
        var _this55;
        _classCallCheck(this, Zt);
        var o;
        _this55 = _super43.call(this, _typeof(e.speechToText) == "object" ? (o = e.speechToText) == null ? void 0 : o.button : {});
        var _Zt$processConfigurat = Zt.processConfiguration(t, e.speechToText),
          n = _Zt$processConfigurat.serviceName,
          r = _Zt$processConfigurat.processedConfig;
        if (_this55._addErrorMessage = i, n === "webspeech" && !Li.isWebSpeechSupported()) _this55.changeToUnsupported();else {
          var a = !e.textInput || !e.textInput.disabled;
          _this55.elementRef.onclick = _this55.buttonClick.bind(_assertThisInitialized(_this55), t, a, n, r);
        }
        return _this55;
      }
      // prettier-ignore
      _createClass(Zt, [{
        key: "buttonClick",
        value: function buttonClick(e, t, i, n) {
          e.removeTextIfPlaceholder(), Li.toggle(i, _objectSpread({
            insertInCursorLocation: !1,
            element: t ? e.inputElementRef : void 0,
            onError: this.onError.bind(this),
            onStart: this.changeToActive.bind(this),
            onStop: this.changeToDefault.bind(this),
            onCommandModeTrigger: this.onCommandModeTrigger.bind(this)
          }, n));
        }
      }, {
        key: "onCommandModeTrigger",
        value: function onCommandModeTrigger(e) {
          e ? this.changeToCommandMode() : this.changeToActive();
        }
      }, {
        key: "onError",
        value: function onError() {
          this._addErrorMessage("speechToText", "speech input error");
        }
      }], [{
        key: "processConfiguration",
        value: function processConfiguration(e, t) {
          var _i$displayInterimResu, _i$textColor, _i$translations, _i$commands;
          var c;
          var i = _typeof(t) == "object" ? t : {},
            n = _typeof(i.webSpeech) == "object" ? i.webSpeech : {},
            r = i.azure || {},
            o = _objectSpread(_objectSpread({
              displayInterimResults: (_i$displayInterimResu = i.displayInterimResults) !== null && _i$displayInterimResu !== void 0 ? _i$displayInterimResu : void 0,
              textColor: (_i$textColor = i.textColor) !== null && _i$textColor !== void 0 ? _i$textColor : void 0,
              translations: (_i$translations = i.translations) !== null && _i$translations !== void 0 ? _i$translations : void 0,
              commands: (_i$commands = i.commands) !== null && _i$commands !== void 0 ? _i$commands : void 0
            }, n), r),
            a = (c = i.commands) == null ? void 0 : c.submit;
          return a && (o.onPreResult = function (d) {
            return d.toLowerCase().includes(a) ? (setTimeout(function () {
              var u;
              return (u = e.submit) == null ? void 0 : u.call(e);
            }), Li.endCommandMode(), {
              restart: !0,
              removeNewText: !0
            }) : null;
          }), {
            serviceName: Zt.getServiceName(i),
            processedConfig: o
          };
        }
      }, {
        key: "getServiceName",
        value: function getServiceName(e) {
          return e.webSpeech ? "webspeech" : e.azure ? "azure" : "webspeech";
        }
      }]);
      return Zt;
    }(bt);
    var gs = /*#__PURE__*/function () {
      function gs() {
        _classCallCheck(this, gs);
      }
      _createClass(gs, null, [{
        key: "getFileName",
        value: function getFileName(e, t) {
          var i = /* @__PURE__ */new Date(),
            n = String(i.getHours()).padStart(2, "0"),
            r = String(i.getMinutes()).padStart(2, "0"),
            o = String(i.getSeconds()).padStart(2, "0");
          return "".concat(e, "-").concat(n, "-").concat(r, "-").concat(o, ".").concat(t);
        }
      }]);
      return gs;
    }();
    var Ea = /*#__PURE__*/function (_bt2) {
      _inherits(Ea, _bt2);
      var _super44 = _createSuper(Ea);
      function Ea(e, t) {
        var _this56;
        _classCallCheck(this, Ea);
        var i, n;
        _this56 = _super44.call(this, t.button), _this56._waitingForBrowserApproval = !1, _this56._audioType = e, _this56._extension = ((i = t.files) == null ? void 0 : i.format) || "mp3", _this56._maxDurationSeconds = (n = t.files) == null ? void 0 : n.maxDurationSeconds, _this56.elementRef.onclick = _this56.buttonClick.bind(_assertThisInitialized(_this56));
        return _this56;
      }
      _createClass(Ea, [{
        key: "buttonClick",
        value: function buttonClick() {
          this._waitingForBrowserApproval || (this.isActive ? this.stop() : (this._waitingForBrowserApproval = !0, this.record()));
        }
      }, {
        key: "stop",
        value: function stop() {
          var _this57 = this;
          return new Promise(function (e) {
            var t, i;
            _this57.changeToDefault(), (t = _this57._mediaRecorder) == null || t.stop(), (i = _this57._mediaStream) == null || i.getTracks().forEach(function (n) {
              return n.stop();
            }), setTimeout(function () {
              e();
            }, 10);
          });
        }
      }, {
        key: "record",
        value: function record() {
          var _this58 = this;
          navigator.mediaDevices.getUserMedia({
            audio: !0
          }).then(function (e) {
            _this58.changeToActive(), _this58._mediaRecorder = new MediaRecorder(e), _this58._audioType.addPlaceholderAttachment(_this58.stop.bind(_this58), _this58._maxDurationSeconds), _this58._mediaStream = e, _this58._mediaRecorder.addEventListener("dataavailable", function (t) {
              _this58.createFile(t);
            }), _this58._mediaRecorder.start();
          })["catch"](function (e) {
            console.error(e), _this58.stop();
          })["finally"](function () {
            _this58._waitingForBrowserApproval = !1;
          });
        }
      }, {
        key: "createFile",
        value: function createFile(e) {
          var _this59 = this;
          var t = new Blob([e.data], {
              type: "audio/".concat(this._extension)
            }),
            i = gs.getFileName(this._newFilePrefix || "audio", this._extension),
            n = new File([t], i, {
              type: t.type
            }),
            r = new FileReader();
          r.readAsDataURL(n), r.onload = function (o) {
            _this59._audioType.completePlaceholderAttachment(n, o.target.result);
          };
        }
      }]);
      return Ea;
    }(bt);
    var Sa = "<?xml version=\"1.0\" standalone=\"no\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.0//EN\" \"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\">\n<svg xmlns=\"http://www.w3.org/2000/svg\" stroke=\"currentColor\" fill=\"none\" stroke-width=\"1\" viewBox=\"0 0 24 24\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n  <line x1=\"22\" y1=\"2\" x2=\"11\" y2=\"14\"></line>\n  <polygon points=\"22 2 15 22 11 14 2 10 22 2\"></polygon>\n</svg>\n";
    var B = /*#__PURE__*/function () {
      function B() {
        _classCallCheck(this, B);
      }
      _createClass(B, null, [{
        key: "setPropertyValueIfDoesNotExist",
        value: function setPropertyValueIfDoesNotExist(e, t, i) {
          var _e$n, _e$n2;
          var n = t[0];
          t.length === 1 ? (_e$n = e[n]) !== null && _e$n !== void 0 ? _e$n : e[n] = i : ((_e$n2 = e[n]) !== null && _e$n2 !== void 0 ? _e$n2 : e[n] = {}, t.shift(), B.setPropertyValueIfDoesNotExist(e[n], t, i));
        }
      }, {
        key: "setPropertyValue",
        value: function setPropertyValue(e, t, i) {
          var _e$n3;
          var n = t[0];
          t.length === 1 ? e[n] = i : ((_e$n3 = e[n]) !== null && _e$n3 !== void 0 ? _e$n3 : e[n] = {}, t.shift(), B.setPropertyValue(e[n], t, i));
        }
      }, {
        key: "getObjectValue",
        value: function getObjectValue(e, t) {
          var i = t[0],
            n = e[i];
          return n === void 0 || t.length === 1 ? n : B.getObjectValue(n, t.slice(1));
        }
      }, {
        key: "overwritePropertyObjectFromAnother",
        value: function overwritePropertyObjectFromAnother(e, t, i) {
          var n = B.getObjectValue(t, i);
          if (n) {
            var r = _objectSpread(_objectSpread({}, n), B.getObjectValue(e, i) || {});
            B.setPropertyValue(e, i, r);
          }
        }
      }]);
      return B;
    }();
    var Ce = /*#__PURE__*/function () {
      function Ce() {
        _classCallCheck(this, Ce);
      }
      _createClass(Ce, null, [{
        key: "resetSubmit",
        value: function resetSubmit(e, t) {
          t ? e.unsetCustomStateStyles(["loading", "submit"]) : e.unsetCustomStateStyles(["stop", "loading", "submit"]), e.reapplyStateStyle("submit");
        }
      }, {
        key: "overwriteDefaultStyleWithSubmit",
        value: function overwriteDefaultStyleWithSubmit(e, t) {
          if (!e.submit) return;
          var i = JSON.parse(JSON.stringify(e[t] || {}));
          B.overwritePropertyObjectFromAnother(i, e.submit, ["container", "default"]), B.overwritePropertyObjectFromAnother(i, e.submit, ["text", "styles", "default"]), B.overwritePropertyObjectFromAnother(i, e.submit, ["svg", "styles", "default"]), e[t] = i;
        }
        // prettier-ignore
      }, {
        key: "setUpDisabledButton",
        value: function setUpDisabledButton(e) {
          B.setPropertyValueIfDoesNotExist(e, ["submit", "container", "default", "backgroundColor"], ""), B.setPropertyValueIfDoesNotExist(e, ["disabled", "container", "default", "backgroundColor"], "unset"), B.setPropertyValueIfDoesNotExist(e.submit, ["svg", "styles", "default", "filter"], ""), B.setPropertyValueIfDoesNotExist(e.disabled, ["svg", "styles", "default", "filter"], "brightness(0) saturate(100%) invert(70%) sepia(0%) saturate(5564%) hue-rotate(207deg) brightness(100%) contrast(97%)"), Ce.overwriteDefaultStyleWithSubmit(e, "disabled");
        }
      }, {
        key: "process",
        value: function process(e) {
          var t = JSON.parse(JSON.stringify(e || {}));
          return Ce.overwriteDefaultStyleWithSubmit(t, "loading"), Ce.overwriteDefaultStyleWithSubmit(t, "stop"), e != null && e.alwaysEnabled || Ce.setUpDisabledButton(t), t;
        }
      }]);
      return Ce;
    }();
    var yi = /*#__PURE__*/function (_wt4) {
      _inherits(k, _wt4);
      var _super45 = _createSuper(k);
      // prettier-ignore
      function k(e, t, i, n, r) {
        var _this60;
        _classCallCheck(this, k);
        var o = Ce.process(e.submitButtonStyles);
        _this60 = _super45.call(this, k.createButtonContainerElement(), o == null ? void 0 : o.position, o), _this60._isSVGLoadingIconOverriden = !1, _this60.status = {
          requestInProgress: !1,
          loadingActive: !1
        }, _this60._messages = i, _this60._inputElementRef = t, _this60._fileAttachments = r, _this60._innerElements = _this60.createInnerElements(), _this60._abortStream = new AbortController(), _this60._stopClicked = {
          listener: function listener() {}
        }, _this60._serviceIO = n, _this60._alwaysEnabled = !!(o != null && o.alwaysEnabled), e.disableSubmitButton = _this60.disableSubmitButton.bind(_assertThisInitialized(_this60), n), _this60.attemptOverwriteLoadingStyle(e), setTimeout(function () {
          var a;
          _this60._validationHandler = e._validationHandler, _this60.assignHandlers(_this60._validationHandler), (a = _this60._validationHandler) == null || a.call(_assertThisInitialized(_this60));
        });
        return _this60;
      }
      // prettier-ignore
      _createClass(k, [{
        key: "createInnerElements",
        value: function createInnerElements() {
          var _j$create = j.create(this.elementRef, ["submit", "loading", "stop"], this._customStyles),
            e = _j$create.submit,
            t = _j$create.loading,
            i = _j$create.stop,
            n = e || k.createSubmitIconElement();
          return {
            submit: n,
            loading: t || k.createLoadingIconElement(),
            stop: i || k.createStopIconElement(),
            disabled: this.createDisabledIconElement(n)
          };
        }
      }, {
        key: "createDisabledIconElement",
        value: function createDisabledIconElement(e) {
          return j.createCustomElement("disabled", this._customStyles) || e.cloneNode(!0);
        }
        // prettier-ignore
      }, {
        key: "attemptOverwriteLoadingStyle",
        value: function attemptOverwriteLoadingStyle(e) {
          var t, i, n, r, o, a, l, c, d;
          if (!((i = (t = this._customStyles) == null ? void 0 : t.submit) != null && i.svg || (o = (r = (n = this._customStyles) == null ? void 0 : n.loading) == null ? void 0 : r.svg) != null && o.content || (c = (l = (a = this._customStyles) == null ? void 0 : a.loading) == null ? void 0 : l.text) != null && c.content) && (e.displayLoadingBubble === void 0 || e.displayLoadingBubble === !0)) {
            var u = document.createElement("style");
            u.textContent = "\n        .loading-button > * {\n          filter: brightness(0) saturate(100%) invert(72%) sepia(0%) saturate(3044%) hue-rotate(322deg) brightness(100%)\n            contrast(96%) !important;\n        }", (d = e.shadowRoot) == null || d.appendChild(u), this._isSVGLoadingIconOverriden = !0;
          }
        }
      }, {
        key: "assignHandlers",
        value: function assignHandlers(e) {
          this._serviceIO.completionsHandlers = {
            onFinish: this.resetSubmit.bind(this, e)
          }, this._serviceIO.streamHandlers = {
            onOpen: this.changeToStopIcon.bind(this),
            onClose: this.resetSubmit.bind(this, e),
            abortStream: this._abortStream,
            stopClicked: this._stopClicked
          };
          var t = this._serviceIO.deepChat.stream;
          _typeof(t) == "object" && typeof t.simulation == "number" && (this._serviceIO.streamHandlers.simulationInterim = t.simulation);
        }
      }, {
        key: "resetSubmit",
        value: function resetSubmit(e) {
          this.status.requestInProgress = !1, this.status.loadingActive = !1, e();
        }
      }, {
        key: "submitFromInput",
        value: function () {
          var _submitFromInput = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee99() {
            var t, e, _i18;
            return _regeneratorRuntime().wrap(function _callee99$(_context99) {
              while (1) switch (_context99.prev = _context99.next) {
                case 0:
                  _context99.next = 2;
                  return this._fileAttachments.completePlaceholders();
                case 2:
                  e = this._fileAttachments.getAllFileData();
                  if (this._inputElementRef.classList.contains("text-input-placeholder")) this.attemptSubmit({
                    text: "",
                    files: e
                  });else {
                    _i18 = (t = this._inputElementRef.textContent) == null ? void 0 : t.trim();
                    this.attemptSubmit({
                      text: _i18,
                      files: e
                    });
                  }
                case 4:
                case "end":
                  return _context99.stop();
              }
            }, _callee99, this);
          }));
          function submitFromInput() {
            return _submitFromInput.apply(this, arguments);
          }
          return submitFromInput;
        }()
      }, {
        key: "programmaticSubmit",
        value: function () {
          var _programmaticSubmit = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee100(e) {
            var _this61 = this;
            var t;
            return _regeneratorRuntime().wrap(function _callee100$(_context100) {
              while (1) switch (_context100.prev = _context100.next) {
                case 0:
                  typeof e == "string" && (e = ke.processSubmitUserMessage(e));
                  t = {
                    text: e.text
                  };
                  e.files && (t.files = Array.from(e.files).map(function (i) {
                    return {
                      file: i,
                      type: ue.getTypeFromBlob(i)
                    };
                  })), setTimeout(function () {
                    return _this61.attemptSubmit(t, !0);
                  });
                case 3:
                case "end":
                  return _context100.stop();
              }
            }, _callee100);
          }));
          function programmaticSubmit(_x181) {
            return _programmaticSubmit.apply(this, arguments);
          }
          return programmaticSubmit;
        }() // TO-DO - should be disabled when loading history
      }, {
        key: "attemptSubmit",
        value: function () {
          var _attemptSubmit = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee101(e) {
            var t,
              r,
              o,
              a,
              i,
              n,
              _args101 = arguments;
            return _regeneratorRuntime().wrap(function _callee101$(_context101) {
              while (1) switch (_context101.prev = _context101.next) {
                case 0:
                  t = _args101.length > 1 && _args101[1] !== undefined ? _args101[1] : !1;
                  _context101.next = 3;
                  return (r = this._validationHandler) == null ? void 0 : r.call(this, t ? e : void 0);
                case 3:
                  _context101.t0 = _context101.sent;
                  _context101.t1 = !1;
                  if (!(_context101.t0 === _context101.t1)) {
                    _context101.next = 7;
                    break;
                  }
                  return _context101.abrupt("return");
                case 7:
                  this.changeToLoadingIcon();
                  _context101.next = 10;
                  return this.addNewMessage(e);
                case 10:
                  this._serviceIO.isWebModel() || this._messages.addLoadingMessage();
                  qi.clear(this._inputElementRef);
                  i = (o = e.files) == null ? void 0 : o.map(function (l) {
                    return l.file;
                  }), n = {
                    text: e.text === "" ? void 0 : e.text,
                    files: i
                  };
                  _context101.next = 15;
                  return this._serviceIO.callAPI(n, this._messages);
                case 15:
                  (a = this._fileAttachments) == null || a.removeAllFiles();
                case 16:
                case "end":
                  return _context101.stop();
              }
            }, _callee101, this);
          }));
          function attemptSubmit(_x182) {
            return _attemptSubmit.apply(this, arguments);
          }
          return attemptSubmit;
        }()
      }, {
        key: "addNewMessage",
        value: function () {
          var _addNewMessage = _asyncToGenerator( /*#__PURE__*/_regeneratorRuntime().mark(function _callee102(_ref13) {
            var e, t, i;
            return _regeneratorRuntime().wrap(function _callee102$(_context102) {
              while (1) switch (_context102.prev = _context102.next) {
                case 0:
                  e = _ref13.text, t = _ref13.files;
                  i = {
                    role: v.USER_ROLE
                  };
                  e && (i.text = e);
                  _context102.t0 = t;
                  if (!_context102.t0) {
                    _context102.next = 8;
                    break;
                  }
                  _context102.next = 7;
                  return this._messages.addMultipleFiles(t);
                case 7:
                  i.files = _context102.sent;
                case 8:
                  this._serviceIO.sessionId && (i._sessionId = this._serviceIO.sessionId);
                  Object.keys(i).length > 0 && this._messages.addNewMessage(i);
                case 10:
                case "end":
                  return _context102.stop();
              }
            }, _callee102, this);
          }));
          function addNewMessage(_x183) {
            return _addNewMessage.apply(this, arguments);
          }
          return addNewMessage;
        }()
      }, {
        key: "stopStream",
        value: function stopStream() {
          var e;
          this._abortStream.abort(), (e = this._stopClicked) == null || e.listener(), this._validationHandler && this.resetSubmit(this._validationHandler);
        }
      }, {
        key: "changeToStopIcon",
        value: function changeToStopIcon() {
          this._serviceIO.websocket || (this.elementRef.classList.remove(k.LOADING_CLASS, k.DISABLED_CLASS, k.SUBMIT_CLASS), this.elementRef.replaceChildren(this._innerElements.stop), this.reapplyStateStyle("stop", ["loading", "submit"]), this.elementRef.onclick = this.stopStream.bind(this), this.status.loadingActive = !1);
        }
        // WORK - animation needs to be lowered
      }, {
        key: "changeToLoadingIcon",
        value: function changeToLoadingIcon() {
          this._serviceIO.websocket || (this._isSVGLoadingIconOverriden || this.elementRef.replaceChildren(this._innerElements.loading), this.elementRef.classList.remove(k.SUBMIT_CLASS, k.DISABLED_CLASS), this.elementRef.classList.add(k.LOADING_CLASS), this.reapplyStateStyle("loading", ["submit"]), this.elementRef.onclick = function () {}, this.status.requestInProgress = !0, this.status.loadingActive = !0);
        }
        // called every time when user triggers an input via ValidationHandler - hence use class to check if not already present
      }, {
        key: "changeToSubmitIcon",
        value: function changeToSubmitIcon() {
          this.elementRef.classList.contains(k.SUBMIT_CLASS) || (this.elementRef.classList.remove(k.LOADING_CLASS, k.DISABLED_CLASS), this.elementRef.classList.add(k.SUBMIT_CLASS), this.elementRef.replaceChildren(this._innerElements.submit), Ce.resetSubmit(this, this.status.loadingActive), this.elementRef.onclick = this.submitFromInput.bind(this));
        }
        // called every time when user triggers an input via ValidationHandler - hence use class to check if not already present
      }, {
        key: "changeToDisabledIcon",
        value: function changeToDisabledIcon() {
          var e = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : !1;
          this._alwaysEnabled && !e ? this.changeToSubmitIcon() : this.elementRef.classList.contains(k.DISABLED_CLASS) || (this.elementRef.classList.remove(k.LOADING_CLASS, k.SUBMIT_CLASS), this.elementRef.classList.add(k.DISABLED_CLASS), this.elementRef.replaceChildren(this._innerElements.disabled), this.reapplyStateStyle("disabled", ["submit"]), this.elementRef.onclick = function () {});
        }
      }, {
        key: "disableSubmitButton",
        value: function disableSubmitButton(e, t) {
          var i;
          e.isSubmitProgrammaticallyDisabled = t !== !1, !(this.status.requestInProgress || this.status.loadingActive) && (t === !1 ? (i = this._validationHandler) == null || i.call(this) : this.changeToDisabledIcon(!0));
        }
      }], [{
        key: "createButtonContainerElement",
        value: function createButtonContainerElement() {
          var e = document.createElement("div");
          return e.classList.add("input-button"), e;
        }
      }, {
        key: "createSubmitIconElement",
        value: function createSubmitIconElement() {
          var e = q.createSVGElement(Sa);
          return e.id = "submit-icon", e;
        }
      }, {
        key: "createLoadingIconElement",
        value: function createLoadingIconElement() {
          var e = document.createElement("div");
          return e.classList.add("dots-jumping"), e;
        }
      }, {
        key: "createStopIconElement",
        value: function createStopIconElement() {
          var e = document.createElement("div");
          return e.id = "stop-icon", e;
        }
      }]);
      return k;
    }(wt);
    yi.SUBMIT_CLASS = "submit-button";
    yi.LOADING_CLASS = "loading-button";
    yi.DISABLED_CLASS = "disabled-button";
    var wa = yi;
    var _a = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<svg viewBox=\"0 0 32 32\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path d=\"M27.1 14.313V5.396L24.158 8.34c-2.33-2.325-5.033-3.503-8.11-3.503C9.902 4.837 4.901 9.847 4.899 16c.001 6.152 5.003 11.158 11.15 11.16 4.276 0 9.369-2.227 10.836-8.478l.028-.122h-3.23l-.022.068c-1.078 3.242-4.138 5.421-7.613 5.421a8 8 0 0 1-5.691-2.359A7.993 7.993 0 0 1 8 16.001c0-4.438 3.611-8.049 8.05-8.049 2.069 0 3.638.58 5.924 2.573l-3.792 3.789H27.1z\"/>\n</svg>\n",
      Ma = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<svg viewBox=\"0 0 32 32\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\">\n  <title>capture</title>\n  <path d=\"M0 16q0 3.264 1.28 6.208t3.392 5.12 5.12 3.424 6.208 1.248 6.208-1.248 5.12-3.424 3.392-5.12 1.28-6.208-1.28-6.208-3.392-5.12-5.088-3.392-6.24-1.28q-3.264 0-6.208 1.28t-5.12 3.392-3.392 5.12-1.28 6.208zM4 16q0-3.264 1.6-6.016t4.384-4.352 6.016-1.632 6.016 1.632 4.384 4.352 1.6 6.016-1.6 6.048-4.384 4.352-6.016 1.6-6.016-1.6-4.384-4.352-1.6-6.048z\"></path>\n</svg>\n",
      Ta = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<svg viewBox=\"0 0 1024 1024\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path d=\"M195.2 195.2a64 64 0 0 1 90.496 0L512 421.504 738.304 195.2a64 64 0 0 1 90.496 90.496L602.496 512 828.8 738.304a64 64 0 0 1-90.496 90.496L512 602.496 285.696 828.8a64 64 0 0 1-90.496-90.496L421.504 512 195.2 285.696a64 64 0 0 1 0-90.496z\"/>\n</svg>",
      Ca = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<svg viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path d=\"M4.89163 13.2687L9.16582 17.5427L18.7085 8\" stroke=\"#000000\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n</svg>";
    var sn = /*#__PURE__*/function (_at) {
      _inherits(sn, _at);
      var _super46 = _createSuper(sn);
      // prettier-ignore
      function sn(e, t, i, n) {
        var _this62;
        _classCallCheck(this, sn);
        _this62 = _super46.call(this, e, ["modal-content", "modal-camera-content"], i), _this62._stopped = !1, _this62._format = "image/png", _this62._canvas = document.createElement("canvas"), _this62._canvas.classList.add("camera-modal-canvas");
        var _this62$addButtonsAnd = _this62.addButtonsAndTheirEvents(t),
          r = _this62$addButtonsAnd.captureButton,
          o = _this62$addButtonsAnd.submitButton;
        _this62._captureButton = r, _this62._submitButton = o, _this62._captureIcon = _this62._captureButton.children[0], _this62._refreshIcon = q.createSVGElement(_a), _this62._refreshIcon.classList.add("modal-svg-button-icon", "modal-svg-refresh-icon"), (n == null ? void 0 : n.format) === "jpeg" && (_this62._format = "image/jpeg"), n != null && n.dimensions && (_this62._dimensions = n.dimensions), _this62._contentRef.appendChild(_this62._canvas), _this62.extensionCloseCallback = _this62.stop;
        return _this62;
      }
      _createClass(sn, [{
        key: "addButtonsAndTheirEvents",
        value: function addButtonsAndTheirEvents(e) {
          var t = at.createSVGButton(Ma);
          t.classList.add("modal-svg-camera-button"), t.children[0].classList.add("modal-svg-camera-icon");
          var i = this.addCloseButton(Ta, !0);
          i.classList.add("modal-svg-close-button"), i.children[0].classList.add("modal-svg-close-icon");
          var n = at.createSVGButton(Ca);
          return n.classList.add("modal-svg-submit-button"), this.addButtons(t, n), this.addButtonEvents(t, i, n, e), {
            captureButton: t,
            submitButton: n
          };
        }
        // prettier-ignore
      }, {
        key: "addButtonEvents",
        value: function addButtonEvents(e, t, i, n) {
          var _this63 = this;
          e.onclick = function () {
            _this63.capture();
          }, t.addEventListener("click", this.stop.bind(this)), i.onclick = function () {
            var r = _this63.getFile();
            r && _t.addFilesToType([r], [n]), _this63.stop(), _this63.close();
          };
        }
      }, {
        key: "stop",
        value: function stop() {
          var _this64 = this;
          this._mediaStream && this._mediaStream.getTracks().forEach(function (e) {
            return e.stop();
          }), this._stopped = !0, setTimeout(function () {
            _this64._captureButton.replaceChildren(_this64._captureIcon), _this64._captureButton.classList.replace("modal-svg-refresh-button", "modal-svg-camera-button");
            var e = _this64._canvas.getContext("2d");
            e == null || e.clearRect(0, 0, _this64._canvas.width, _this64._canvas.height);
          }, at.MODAL_CLOSE_TIMEOUT_MS);
        }
      }, {
        key: "start",
        value: function start() {
          var _this65 = this;
          this._dataURL = void 0, this._submitButton.classList.add("modal-svg-submit-disabled"), this._stopped = !1, navigator.mediaDevices.getUserMedia({
            video: this._dimensions || !0
          }).then(function (e) {
            if (_this65._mediaStream = e, !_this65.isOpen()) return _this65.stop();
            var t = document.createElement("video");
            t.srcObject = e, t.play(), requestAnimationFrame(_this65.updateCanvas.bind(_this65, t, _this65._canvas));
          })["catch"](function (e) {
            console.error(e), _this65.stop(), _this65.close();
          });
        }
      }, {
        key: "capture",
        value: function capture() {
          this._dataURL ? (this._captureButton.replaceChildren(this._captureIcon), this._captureButton.classList.replace("modal-svg-refresh-button", "modal-svg-camera-button"), this._submitButton.classList.add("modal-svg-submit-disabled"), this._dataURL = void 0) : (this._captureButton.replaceChildren(this._refreshIcon), this._captureButton.classList.replace("modal-svg-camera-button", "modal-svg-refresh-button"), this._submitButton.classList.remove("modal-svg-submit-disabled"), this._dataURL = this._canvas.toDataURL());
        }
      }, {
        key: "getFile",
        value: function getFile() {
          if (this._dataURL) {
            var e = atob(this._dataURL.split(",")[1]),
              t = new Array(e.length);
            for (var a = 0; a < e.length; a++) t[a] = e.charCodeAt(a);
            var _i19 = new Uint8Array(t),
              n = new Blob([_i19], {
                type: this._format
              }),
              r = this._format === "image/jpeg" ? "jpeg" : "png",
              o = gs.getFileName(this._newFilePrefix || "photo", r);
            return new File([n], o, {
              type: n.type
            });
          }
        }
      }, {
        key: "updateCanvas",
        value: function updateCanvas(e, t) {
          if (!this._stopped) {
            if (!this._dataURL) {
              t.width = e.videoWidth, t.height = e.videoHeight;
              var _i20 = t.getContext("2d");
              _i20 == null || _i20.drawImage(e, 0, 0, t.width, t.height);
            }
            requestAnimationFrame(this.updateCanvas.bind(this, e, t));
          }
        }
      }, {
        key: "openCameraModal",
        value: function openCameraModal(e) {
          this.displayModalElements(), e.start();
        }
        // prettier-ignore
      }], [{
        key: "createCameraModalFunc",
        value: function createCameraModalFunc(e, t, i, n) {
          var r = new sn(e, t, i, n);
          return r.openCameraModal.bind(r, r);
        }
      }]);
      return sn;
    }(at);
    var Aa = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<svg viewBox=\"0 0 32 32\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path d=\"M29 7h-4.599l-2.401-4h-12l-2.4 4h-4.6c-1 0-3 1-3 2.969v16.031c0 1.657 1.5 3 2.792 3h26.271c1.313 0 2.938-1.406 2.938-2.968v-16.032c0-1-1-3-3-3zM30 26.032c0 0.395-0.639 0.947-0.937 0.969h-26.265c-0.232-0.019-0.797-0.47-0.797-1v-16.031c0-0.634 0.851-0.953 1-0.969h5.732l2.4-4h9.802l1.785 3.030 0.55 0.97h5.731c0.705 0 0.99 0.921 1 1v16.032zM16 10c-3.866 0-7 3.134-7 7s3.134 7 7 7 7-3.134 7-7-3.134-7-7-7zM16 22c-2.757 0-5-2.243-5-5s2.243-5 5-5 5 2.243 5 5-2.243 5-5 5z\"></path>\n</svg>";
    var Xt = /*#__PURE__*/function (_wt5) {
      _inherits(Xt, _wt5);
      var _super47 = _createSuper(Xt);
      function Xt(e, t, i) {
        var _this66;
        _classCallCheck(this, Xt);
        var r;
        _this66 = _super47.call(this, Xt.createButtonElement(), (r = i == null ? void 0 : i.button) == null ? void 0 : r.position, (i == null ? void 0 : i.button) || {}, "Photo");
        var n = _this66.createInnerElements(_this66._customStyles);
        i && _this66.addClickEvent(e, t, i.modalContainerStyle, i.files), _this66.elementRef.classList.add("upload-file-button"), _this66.elementRef.appendChild(n.styles), _this66.reapplyStateStyle("styles");
        return _this66;
      }
      _createClass(Xt, [{
        key: "createInnerElements",
        value: function createInnerElements(e) {
          return {
            styles: this.createInnerElement(Xt.createSVGIconElement(), "styles", e)
          };
        }
      }, {
        key: "createInnerElement",
        value: function createInnerElement(e, t, i) {
          return j.createSpecificStateElement(this.elementRef, t, i) || e;
        }
      }, {
        key: "addClickEvent",
        value:
        // prettier-ignore
        function addClickEvent(e, t, i, n) {
          var r = sn.createCameraModalFunc(e, t, i, n);
          this.elementRef.onclick = r;
        }
      }], [{
        key: "createButtonElement",
        value: function createButtonElement() {
          var e = document.createElement("div");
          return e.classList.add("input-button"), e;
        }
      }, {
        key: "createSVGIconElement",
        value: function createSVGIconElement() {
          var e = q.createSVGElement(Aa);
          return e.id = "camera-icon", e;
        }
      }]);
      return Xt;
    }(wt);
    var pt = /*#__PURE__*/function () {
      // prettier-ignore
      function pt(e, t, i, n) {
        _classCallCheck(this, pt);
        this.elementRef = pt.createPanelElement(e.inputAreaStyle);
        var r = new qi(e, i),
          o = {},
          a = this.createFileUploadComponents(e, i, n, o);
        e.speechToText && !o.microphone && (o.microphone = {
          button: new Zt(e, r, t.addNewErrorMessage.bind(t))
        });
        var l = new wa(e, r.inputElementRef, t, i, a);
        r.submit = l.submitFromInput.bind(l), Me.attach(e, i, r, a, l), e.submitUserMessage = l.programmaticSubmit.bind(l), o.submit = {
          button: l
        }, pt.addElements(this.elementRef, r, o, n, a, e.dropupStyles);
      }
      _createClass(pt, [{
        key: "createFileUploadComponents",
        value:
        // prettier-ignore
        function createFileUploadComponents(e, t, i, n) {
          var o, a, l, c;
          var r = new _t(this.elementRef, e.attachmentContainerStyle, t.demo);
          if (pt.createUploadButtons(e, t.fileTypes || {}, r, i, n), (o = t.camera) != null && o.files) {
            var d = ((a = n.images) == null ? void 0 : a.fileType) || r.addType(e, t.camera.files, "images");
            n.camera = {
              button: new Xt(i, d, t.camera)
            };
          }
          if ((l = t.recordAudio) != null && l.files) {
            var _d = ((c = n.audio) == null ? void 0 : c.fileType) || r.addType(e, t.recordAudio.files, "audio");
            n.microphone = {
              button: new Ea(_d, t.recordAudio)
            };
          }
          return de.isEnabled(r, e.dragAndDrop) && de.create(i, r, e.dragAndDrop), r;
        }
        // prettier-ignore
      }], [{
        key: "createPanelElement",
        value: function createPanelElement(e) {
          var t = document.createElement("div");
          return t.id = "input", Object.assign(t.style, e), t;
        }
      }, {
        key: "createUploadButtons",
        value: function createUploadButtons(e, t, i, n, r) {
          Object.keys(t).forEach(function (o) {
            var a = o,
              l = t[a];
            if (l.files) {
              var c = i.addType(e, l.files, a),
                _Qo$a = Qo[a],
                d = _Qo$a.id,
                u = _Qo$a.svgString,
                h = _Qo$a.dropupText,
                p = new ut(n, c, l, d, u, h);
              r[a] = {
                button: p,
                fileType: c
              };
            }
          });
        }
        // prettier-ignore
      }, {
        key: "addElements",
        value: function addElements(e, t, i, n, r, o) {
          Y.addElements(e, t.elementRef);
          var a = Qe.create(),
            l = F.addButtons(a, i, n, o);
          Ko.set(t.inputElementRef, a, r.elementRef, l), Qe.add(e, a);
        }
      }]);
      return pt;
    }();
    var rn = /*#__PURE__*/function () {
      function rn() {
        _classCallCheck(this, rn);
      }
      _createClass(rn, null, [{
        key: "createElements",
        value: function createElements(e, t, i) {
          var n = document.createElement("div");
          n.id = "chat-view";
          var r = new me(e, t, i);
          t.websocket && $.createConnection(t, r);
          var o = new pt(e, r, t, n);
          return Y.addElements(n, r.elementRef, o.elementRef), n;
        }
      }, {
        key: "render",
        value: function render(e, t, i, n) {
          var r = rn.createElements(e, i, n);
          t.replaceChildren(r);
        }
      }]);
      return rn;
    }();
    var ka = "#validate-property-key-view{height:100%;position:relative;display:flex;justify-content:center;align-items:center;padding:8px}#large-loading-ring{display:inline-block;width:50px;height:50px}#large-loading-ring:after{content:\" \";display:block;width:38px;height:38px;margin:1px;border-radius:50%;border:5px solid #5fb2ff;border-color:#5fb2ff transparent #5fb2ff transparent;animation:large-loading-ring 1.4s linear infinite}@keyframes large-loading-ring{0%{transform:rotate(0)}to{transform:rotate(360deg)}}#insert-key-view{height:100%;position:relative}#insert-key-contents{text-align:center;position:absolute;top:44%;left:50%;transform:translate(-50%,-50%);width:82%;display:flex;max-width:700px}#insert-key-title{margin-bottom:15px}#insert-key-input-container{margin-right:2.7em;width:calc(100% - 80px)}#insert-key-input{padding:.3em 1.7em .3em .3em;border-width:1px;border-style:solid;border-radius:3px;width:100%;font-size:inherit}.insert-key-input-valid{border-color:gray}.insert-key-input-invalid{border-color:red}#visibility-icon-container{position:relative;float:right;cursor:pointer;-webkit-user-select:none;user-select:none}.visibility-icon{filter:brightness(0) saturate(100%) invert(63%) sepia(1%) saturate(9%) hue-rotate(43deg) brightness(98%) contrast(92%);position:absolute;right:-1.7em;top:-1.43em}#visible-icon{top:-1.4em}.visibility-icon:hover{filter:unset}.visibility-icon>*{pointer-events:none}#start-button{border:1px solid grey;color:#454545;border-radius:4px;width:3em;display:flex;justify-content:center;align-items:center;cursor:pointer;padding:.28em .3em;-webkit-user-select:none;user-select:none;background-color:#fff}#start-button:hover{background-color:#f2f2f2}#start-button:active{background-color:#d2d2d2}#insert-key-help-text-container{width:100%;position:absolute;margin-top:32px;margin-bottom:20px}#insert-key-help-text-contents{width:100%;position:absolute}#insert-key-input-invalid-text{display:block;margin-top:1em;margin-bottom:.5em;color:red}.insert-key-input-help-text{display:block;margin-top:16px}#loading-ring{display:inline-block;width:16px;height:16px}#loading-ring:after{content:\" \";display:block;width:11px;height:11px;margin:1px;border-radius:50%;border:2px solid #0084ff;border-color:#0084ff transparent #0084ff transparent;animation:loading-ring 1.2s linear infinite}@keyframes loading-ring{0%{transform:rotate(0)}to{transform:rotate(360deg)}}#error-view{color:red;font-size:1.2em;line-height:1.3em;margin-top:-5px;text-align:center;height:100%;display:flex;justify-content:center;align-items:center;padding-left:8px;padding-right:8px}.intro-panel{position:absolute;display:flex;justify-content:center;right:0;bottom:0;left:0;margin:auto;height:fit-content;top:-2.5em}#internal-intro-panel{width:250px;height:min-content;display:block;border-radius:5px;overflow:auto;border:1px solid rgb(203,203,203);padding:10px;max-height:calc(100% - 6.8em)}#internal-intro-panel>p{margin-block-start:.8em;margin-block-end:.8em}pre code.hljs{display:block;overflow-x:auto;padding:1em}code.hljs{padding:3px 5px}/*!\n  Theme: a11y-dark\n  Author: @ericwbailey\n  Maintainer: @ericwbailey\n\n  Based on the Tomorrow Night Eighties theme: https://github.com/isagalaev/highlight.js/blob/master/src/styles/tomorrow-night-eighties.css\n*/.hljs{background:#2b2b2b;color:#f8f8f2}.hljs-comment,.hljs-quote{color:#d4d0ab}.hljs-deletion,.hljs-name,.hljs-regexp,.hljs-selector-class,.hljs-selector-id,.hljs-tag,.hljs-template-variable,.hljs-variable{color:#ffa07a}.hljs-built_in,.hljs-link,.hljs-literal,.hljs-meta,.hljs-number,.hljs-params,.hljs-type{color:#f5ab35}.hljs-attribute{color:gold}.hljs-addition,.hljs-bullet,.hljs-string,.hljs-symbol{color:#abe338}.hljs-section,.hljs-title{color:#00e0e0}.hljs-keyword,.hljs-selector-tag{color:#dcc6e0}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}@media screen and (-ms-high-contrast: active){.hljs-addition,.hljs-attribute,.hljs-built_in,.hljs-bullet,.hljs-comment,.hljs-link,.hljs-literal,.hljs-meta,.hljs-number,.hljs-params,.hljs-quote,.hljs-string,.hljs-symbol,.hljs-type{color:highlight}.hljs-keyword,.hljs-selector-tag{font-weight:700}}#messages{overflow:auto}.outer-message-container:last-child{margin-bottom:5px}.inner-message-container{display:flex;margin-left:auto;margin-right:auto;width:calc(97.5% - 24px);max-width:100%}.message-bubble{margin-top:10px;word-wrap:break-word;width:fit-content;max-width:60%;border-radius:10px;padding:.42em .55em;height:fit-content;line-height:1.26em}.user-message-text{color:#fff;background-color:#0084ff;margin-right:0;margin-left:auto}.ai-message-text{color:#000;background-color:#e4e6eb;margin-left:0;margin-right:auto}.html-message{max-width:unset}.error-message-text{margin:14px auto 10px;background-color:#f4c0c0;color:#474747;text-align:center;max-width:95%}.loading-message-text{width:1em;padding:.6em .75em .6em 1.3em}.message-bubble>p:first-child{margin-top:0}.message-bubble>p:last-child{margin-bottom:0}pre{overflow:auto;display:block;word-break:break-all;word-wrap:break-word;border-radius:7px;background:#2b2b2b;color:#f8f8f2;margin-top:.8em;margin-bottom:.8em;padding:.6em;font-size:.9em;line-height:1.5em}.image-message{padding:0;display:flex;background-color:#ddd}.image-message>*,.image-message>*>*{width:100%;border-radius:8px;display:flex}.audio-message{width:60%;max-width:300px;height:2.2em;max-height:54px;padding:0;background-color:unset}.audio-player{width:100%;height:100%}.audio-player-safari{height:fit-content;width:40px}.audio-player-safari-left{float:left}.audio-player-safari-right{float:right}.any-file-message-bubble{padding:1px}.any-file-message-contents{display:flex}.any-file-message-icon-container{width:1.3em;min-width:1.3em;position:relative;border-radius:4px;margin-left:6px;margin-right:2px}.any-file-message-icon{background-color:#fff;border-radius:4px;position:absolute;width:1em;height:1.25em;padding:1px;margin-top:auto;margin-bottom:auto;top:0;bottom:0}.any-file-message-text{padding-top:5px;overflow-wrap:anywhere;padding-bottom:5px;padding-right:7px}.message-bubble>a{color:inherit}.left-item-position{margin-right:10px}.right-item-position{margin-left:10px}.deep-chat-web-model-button{margin-top:10px;margin-bottom:5px;margin-left:1px}.avatar{padding-top:5px;width:1.5em;height:1.5em;border-radius:1px}.avatar-container{margin-top:9px}.name{margin-top:16px;font-size:15px}#drag-and-drop{position:absolute;display:none;z-index:10;height:calc(100% - 10px);width:calc(100% - 10px);background-color:#70c6ff4d;border:5px dashed #6dafff}#file-attachment-container{position:absolute;height:3.6em;width:calc(80% - 4px);top:-2.5em;border-radius:5px;overflow:auto;text-align:left;background-color:#d7d7d73b;padding-left:4px}.file-attachment{width:2.85em;height:2.85em;display:inline-flex;margin-right:.6em;margin-bottom:.44em;margin-top:4px;position:relative;background-color:#fff;border-radius:5px}.image-attachment{width:100%;height:100%;object-fit:cover;border-radius:5px}.border-bound-attachment{width:calc(100% - 2px);height:calc(100% - 2px);border:1px solid #c3c3c3;border-radius:5px;overflow:hidden}.border-bound-attachment-safari{width:calc(100% - 1px);height:calc(100% - 1px)}.audio-attachment-icon-container{cursor:pointer}.audio-attachment-icon-container:hover{background-color:#f8f8f8}.attachment-icon{left:0;right:0;bottom:0;top:2px;margin:auto;position:absolute;width:25px;-webkit-user-select:none;user-select:none}.not-removable-attachment-icon{top:0;right:0;bottom:0;left:0}.play-icon{filter:brightness(0) saturate(100%) invert(17%) sepia(0%) saturate(1392%) hue-rotate(67deg) brightness(98%) contrast(97%)}.stop-icon{filter:brightness(0) saturate(100%) invert(29%) sepia(90%) saturate(1228%) hue-rotate(198deg) brightness(93%) contrast(98%)}.audio-placeholder-text-3-digits{padding-left:.26rem}.audio-placeholder-text-4-digits{padding-left:.1rem}.any-file-attachment{padding:2px 0}.file-attachment-text-container{position:absolute;width:inherit;display:flex;align-items:center;height:100%;top:-1px}.audio-placeholder-text-3-digits-container{padding-top:1px;cursor:default}.any-file-attachment-text{text-overflow:ellipsis;white-space:nowrap;overflow:hidden;padding-left:.13em;margin-left:auto;margin-right:auto}.remove-file-attachment-button{height:1.25em;width:1.25em;border:1px solid #cfcfcf;border-radius:25px;background-color:#fff;top:-4px;right:-5px;position:absolute;display:flex;justify-content:center;cursor:pointer;-webkit-user-select:none;user-select:none}.remove-file-attachment-button:hover{background-color:#e4e4e4}.remove-file-attachment-button:active{background-color:#d7d7d7}.x-icon{color:#4e4e4e;top:-.075em;position:relative;font-size:1.05em}.modal{display:none;flex-direction:column;align-items:center;justify-content:center;position:absolute;width:80%;max-width:420px;max-height:80%;margin:auto;top:0;right:0;bottom:0;left:0;z-index:2}.modal-content{border-top:1px solid rgb(217,217,217);border-left:1px solid rgb(217,217,217);border-right:1px solid rgb(217,217,217);border-top-left-radius:inherit;border-top-right-radius:inherit;background-color:#fff;overflow-y:auto;height:fit-content;max-height:calc(100% - 3.3em);width:100%}.modal-content>p{margin-left:1em;margin-right:1em}.modal-content>ul{margin-right:1em}.modal-button-panel{height:3.3em;border:1px solid;border-color:rgb(223,223,223) rgb(217,217,217) rgb(217,217,217);border-bottom-left-radius:inherit;border-bottom-right-radius:inherit;background-color:#fff;text-align:center;justify-content:center;display:flex;width:100%}.modal-button{min-width:2.5em;text-align:center;color:#fff;border-radius:5px;padding:.4em .4em .3em;height:1.25em;background-color:#3279b2;top:0;bottom:0;cursor:pointer;-webkit-user-select:none;user-select:none;margin:auto .31em}.modal-button:hover{background-color:#276da7}.modal-button:active{background-color:#1b5687}.modal-svg-button{padding:0 0 2px;width:2em;height:1.8em}.modal-svg-button-icon{width:100%;height:100%;filter:brightness(0) saturate(100%) invert(100%) sepia(15%) saturate(4%) hue-rotate(346deg) brightness(101%) contrast(102%)}#modal-background-panel{position:absolute;width:100%;height:100%;background-color:#00000042;z-index:1;display:none}.show-modal-background{animation:fadeInBackground .3s ease-in-out}@keyframes fadeInBackground{0%{opacity:0}to{opacity:1}}.show-modal{animation:fadeInModal .3s ease-in-out}@keyframes fadeInModal{0%{opacity:0;scale:.95}to{opacity:1;scale:1}}.hide-modal-background{animation:fadeOutBackground .2s ease-in-out}@keyframes fadeOutBackground{0%{opacity:1}to{opacity:0}}.hide-modal{animation:fadeOutModal .2s ease-in-out}@keyframes fadeOutModal{0%{opacity:1;scale:1}to{opacity:0;scale:.95}}.modal-camera-content{overflow:hidden;text-align:center;border:unset;height:100%;background-color:#2a2a2a;display:flex;justify-content:center}.camera-modal-canvas{max-width:100%;max-height:100%;margin-top:auto;margin-bottom:auto}.modal-svg-submit-button{background-color:green}.modal-svg-submit-button:hover{background-color:#007500}.modal-svg-submit-button:active{background-color:#006500}.modal-svg-submit-disabled{pointer-events:none;background-color:#747474}.modal-svg-close-button{height:1.56em;padding-top:.37em;padding-bottom:0;background-color:#c13e3e}.modal-svg-close-button:hover{background-color:#b43434}.modal-svg-close-button:active{background-color:#972929}.modal-svg-close-icon{width:80%;height:80%}.modal-svg-camera-button{height:1.6em;padding-top:.38em;padding-bottom:0}.modal-svg-camera-icon{height:76%}.modal-svg-refresh-icon{height:105%}.modal-svg-refresh-button{height:1.66em;padding-top:.11em;padding-bottom:.21em}.input-button-container{position:relative;z-index:1}.inside-right{position:absolute;right:calc(10% + .35em);bottom:.85em}.inside-left{position:absolute;left:calc(10% + .35em);bottom:.85em}.outside-left{position:absolute;right:calc(11px - .55em);bottom:.88em}.outside-right{position:absolute;left:calc(11px - .55em);bottom:.88em}#upload-images-icon{position:absolute;pointer-events:none;width:1.45em;height:1.45em;left:.11em;bottom:.08em;filter:brightness(0) saturate(100%) invert(43%) sepia(0%) saturate(740%) hue-rotate(77deg) brightness(99%) contrast(92%)}#upload-gifs-icon{position:absolute;pointer-events:none;width:1.5em;height:1.48em;left:.07em;bottom:.08em;filter:brightness(0) saturate(100%) invert(49%) sepia(0%) saturate(2586%) hue-rotate(12deg) brightness(93%) contrast(90%)}#upload-audio-icon{position:absolute;pointer-events:none;width:1.21em;height:1.21em;left:.17em;bottom:.2em;filter:brightness(0) saturate(100%) invert(15%) sepia(0%) saturate(337%) hue-rotate(125deg) brightness(91%) contrast(94%);transform:scaleX(.95)}#camera-icon{position:absolute;pointer-events:none;width:1.21em;height:1.21em;left:.23em;bottom:.2em;filter:brightness(0) saturate(100%) invert(52%) sepia(0%) saturate(161%) hue-rotate(164deg) brightness(91%) contrast(92%);transform:scaleX(.95)}#upload-mixed-files-icon{position:absolute;pointer-events:none;width:1.21em;height:1.21em;left:.25em;bottom:.2em;filter:brightness(0) saturate(100%) invert(53%) sepia(0%) saturate(36%) hue-rotate(74deg) brightness(98%) contrast(93%);transform:scaleX(.95)}#interim-text{color:gray}#microphone-button{padding-top:.5px}.outer-button-container>#microphone-button{padding-bottom:1px}#microphone-icon{position:absolute;pointer-events:none;width:1.21em;height:1.21em;left:.25em;bottom:.25em}.default-microphone-icon{filter:brightness(0) saturate(100%) invert(32%) sepia(0%) saturate(924%) hue-rotate(46deg) brightness(95%) contrast(99%)}.active-microphone-icon{filter:brightness(0) saturate(100%) invert(10%) sepia(97%) saturate(7495%) hue-rotate(0deg) brightness(101%) contrast(107%);border-radius:10px}.command-microphone-icon{filter:brightness(0) saturate(100%) invert(42%) sepia(96%) saturate(1067%) hue-rotate(77deg) brightness(99%) contrast(102%)}.unsupported-microphone{display:none}#submit-icon{height:100%;filter:brightness(0) saturate(100%) invert(32%) sepia(0%) saturate(924%) hue-rotate(46deg) brightness(95%) contrast(99%);width:1.21em}#stop-icon{background-color:#acacac;position:absolute;width:.95em;height:.95em;left:.35em;bottom:.35em;border-radius:2px}.submit-button-enlarged{scale:1.1;margin-right:.3em;margin-left:.3em}.dots-jumping{position:relative;left:calc(-9990px + .275em);width:.22em;height:.22em;border-radius:5px;background-color:#848484;color:#848484;box-shadow:9990px 0 #848484,calc(9990px + .44em) 0 0 0 #848484,calc(9990px + .8em) 0 0 0 #848484;animation:dots-jumping 1.5s infinite linear;bottom:-.7em}@keyframes dots-jumping{0%{box-shadow:9990px 0 #848484,calc(9990px + .44em) 0 0 0 #848484,calc(9990px + .8em) 0 0 0 #848484}16.667%{box-shadow:9990px -6px #848484,calc(9990px + .44em) 0 0 0 #848484,calc(9990px + .8em) 0 0 0 #848484}33.333%{box-shadow:9990px 0 #848484,calc(9990px + .44em) 0 0 0 #848484,calc(9990px + .8em) 0 0 0 #848484}50%{box-shadow:9990px 0 #848484,calc(9990px + .44em) -6px 0 0 #848484,calc(9990px + .8em) 0 0 0 #848484}66.667%{box-shadow:9990px 0 #848484,calc(9990px + .44em) 0 0 0 #848484,calc(9990px + .8em) 0 0 0 #848484}83.333%{box-shadow:9990px 0 #848484,calc(9990px + .44em) 0 0 0 #848484,calc(9990px + .8em) -6px 0 0 #848484}to{box-shadow:9990px 0 #848484,calc(9990px + .44em) 0 0 0 #848484,calc(9990px + .8em) 0 0 0 #848484}}.dots-flashing{position:relative;width:.45em;height:.45em;border-radius:5px;background-color:var(--message-dots-color);color:var(--message-dots-color);animation:dots-flashing 1s infinite linear alternate;animation-delay:.5s}.dots-flashing:before,.dots-flashing:after{content:\"\";display:inline-block;position:absolute;top:0}.dots-flashing:before{left:-.7em;width:.45em;height:.45em;border-radius:5px;background-color:var(--message-dots-color);color:var(--message-dots-color);animation:dots-flashing 1s infinite alternate;animation-delay:0s}.dots-flashing:after{left:.7em;width:.45em;height:.45em;border-radius:5px;background-color:var(--message-dots-color);color:var(--message-dots-color);animation:dots-flashing 1s infinite alternate;animation-delay:1s}@keyframes dots-flashing{0%{background-color:var(--message-dots-color)}50%,to{background-color:var(--message-dots-color-fade)}}.input-button{border-radius:4px;cursor:pointer;margin-bottom:.2em;-webkit-user-select:none;user-select:none}.input-button-svg{width:1.65em;height:1.65em}.input-button:hover{background-color:#9c9c9c2e}.input-button:active{background-color:#9c9c9c5e}.loading-button{cursor:auto}.loading-button:hover{background-color:unset}.text-button{filter:unset!important;display:flex;justify-content:center;align-items:center;margin-left:4px;margin-right:4px;height:1.6em}#text-input-container{background-color:#fff;width:80%;display:flex;border:1px solid #0000001a;border-radius:5px;margin-top:.8em;margin-bottom:.8em;box-shadow:#959da533 0 1px 12px;overflow-y:auto;max-height:200px;position:relative}.text-input-container-left-adjustment{margin-left:1.5em}.text-input-container-right-adjustment{margin-right:1.5em}.text-input-container-left-small-adjustment{margin-left:1.1em}.text-input-container-left-small-adjustment>.outside-left{right:calc(14px - .55em)}.text-input-container-right-small-adjustment{margin-right:1.1em}.text-input-container-right-small-adjustment>.outside-right{left:calc(14px - .55em)}#text-input{text-align:left;outline:none;word-wrap:break-word;line-break:auto}.text-input-styling{padding:.4em .5em;overflow:overlay;width:100%}.text-input-inner-left-adjustment{padding-left:2.2em}.text-input-inner-right-adjustment{padding-right:2em}.text-input-disabled{pointer-events:none;-webkit-user-select:none;user-select:none}.text-input-placeholder{color:gray}.outside-right>#dropup-menu,.inside-right>#dropup-menu{right:0}#dropup-icon{position:absolute;pointer-events:none;width:1.16em;height:1.2em;left:.265em;bottom:.43em;filter:brightness(0) saturate(100%) invert(54%) sepia(0%) saturate(724%) hue-rotate(6deg) brightness(92%) contrast(90%)}#dropup-menu{background-color:#fff;position:absolute;transform:translateY(-100%);border-radius:5px;z-index:1;top:-.49em;box-shadow:#0003 -1px 2px 10px,#0000001a 0 2px 4px;cursor:pointer;-webkit-user-select:none;user-select:none}.dropup-menu-item{height:1.4em;padding:.28em .84em .28em .35em;display:flex;position:relative}.dropup-menu-item:first-child{padding-top:.49em;border-top-left-radius:inherit;border-top-right-radius:inherit}.dropup-menu-item:last-child{padding-bottom:.45em;border-bottom-left-radius:inherit;border-bottom-right-radius:inherit}.dropup-menu-item-icon{width:1.39em;position:relative;margin-right:.56em}.dropup-menu-item-icon>svg{bottom:0!important;top:0!important;margin-bottom:auto;margin-top:auto}.dropup-menu-item-text{margin-top:.08em;width:max-content}#input{width:100%;display:inline-flex;text-align:center;margin-left:auto;margin-right:auto;margin-top:auto;position:relative;justify-content:center}#chat-view{height:100%;display:grid;grid-template-columns:100%}::-webkit-scrollbar{width:9px;height:9px}::-webkit-scrollbar-thumb{background-color:#d0d0d0;border-radius:5px}::-webkit-scrollbar-track{background-color:#f2f2f2}:host{all:initial;display:table-cell}#container{height:inherit;width:inherit;overflow:hidden}\n";
    var Ia = Object.defineProperty,
      La = Object.getOwnPropertyDescriptor,
      x = function x(s, e, t, i) {
        for (var n = i > 1 ? void 0 : i ? La(e, t) : e, r = s.length - 1, o; r >= 0; r--) (o = s[r]) && (n = (i ? o(e, t, n) : o(n)) || n);
        return i && n && Ia(e, t, n), n;
      };
    var b = /*#__PURE__*/function (_vo) {
      _inherits(b, _vo);
      var _super48 = _createSuper(b);
      function b() {
        var _this67;
        _classCallCheck(this, b);
        _this67 = _super48.call(this), _this67.getMessages = function () {
          return [];
        }, _this67.submitUserMessage = function () {
          return console.warn("submitUserMessage failed - please wait for chat view to render before calling this property.");
        }, _this67.focusInput = function () {
          return Qt.focusFromParentElement(_this67._elementRef);
        }, _this67.refreshMessages = function () {}, _this67.clearMessages = function () {}, _this67.scrollToBottom = function () {}, _this67.disableSubmitButton = function () {}, _this67._hasBeenRendered = !1, _this67._auxiliaryStyleApplied = !1, _this67._addMessage = function () {
          return console.warn("addMessage failed - please wait for chat view to render before calling this property.");
        }, Go.appendStyleSheetToHead(), _this67._elementRef = document.createElement("div"), _this67._elementRef.id = "container", _this67.attachShadow({
          mode: "open"
        }).appendChild(_this67._elementRef), Ei.apply(ka, _this67.shadowRoot), setTimeout(function () {
          _this67._hasBeenRendered || _this67.onRender();
        }, 20);
        return _this67;
      }
      _createClass(b, [{
        key: "changeToChatView",
        value: function changeToChatView() {
          this._activeService && (this._activeService.validateConfigKey = !1), this.onRender();
        }
        // prettier-ignore
      }, {
        key: "onRender",
        value: function onRender() {
          var _this$_childElement;
          (!this._activeService || this._activeService.demo) && (this._activeService = Ho.create(this)), this.auxiliaryStyle && !this._auxiliaryStyleApplied && (Ei.apply(this.auxiliaryStyle, this.shadowRoot), this._auxiliaryStyleApplied = !0), Ei.applyDefaultStyleToComponent(this.style, this.chatStyle), ke.checkForContainerStyles(this, this._elementRef), this._activeService.key && this._activeService.validateConfigKey ? Dt.render(this._elementRef, this.changeToChatView.bind(this), this._activeService) : !(this._activeService instanceof U) || this._activeService.key ? ((_this$_childElement = this._childElement) !== null && _this$_childElement !== void 0 ? _this$_childElement : this._childElement = this.children[0], rn.render(this, this._elementRef, this._activeService, this._childElement)) : this._activeService instanceof U && P.render(this._elementRef, this.changeToChatView.bind(this), this._activeService), this._hasBeenRendered = !0, jt.onRender(this);
        }
      }, {
        key: "disconnectedCallback",
        value: function disconnectedCallback() {
          $i.chat = void 0;
        }
      }]);
      return b;
    }(vo);
    x([y("object")], b.prototype, "directConnection", 2);
    x([y("object")], b.prototype, "request", 2);
    x([y("object")], b.prototype, "webModel", 2);
    x([y("object")], b.prototype, "stream", 2);
    x([y("object")], b.prototype, "requestBodyLimits", 2);
    x([y("function")], b.prototype, "requestInterceptor", 2);
    x([y("function")], b.prototype, "responseInterceptor", 2);
    x([y("function")], b.prototype, "validateInput", 2);
    x([y("object")], b.prototype, "chatStyle", 2);
    x([y("object")], b.prototype, "attachmentContainerStyle", 2);
    x([y("object")], b.prototype, "dropupStyles", 2);
    x([y("object")], b.prototype, "inputAreaStyle", 2);
    x([y("object")], b.prototype, "textInput", 2);
    x([y("object")], b.prototype, "submitButtonStyles", 2);
    x([y("string")], b.prototype, "auxiliaryStyle", 2);
    x([y("array")], b.prototype, "initialMessages", 2);
    x([y("object")], b.prototype, "introMessage", 2);
    x([y("object")], b.prototype, "avatars", 2);
    x([y("object")], b.prototype, "names", 2);
    x([y("boolean")], b.prototype, "displayLoadingBubble", 2);
    x([y("object")], b.prototype, "errorMessages", 2);
    x([y("object")], b.prototype, "messageStyles", 2);
    x([y("object")], b.prototype, "textToSpeech", 2);
    x([y("object")], b.prototype, "speechToText", 2);
    x([y("object")], b.prototype, "images", 2);
    x([y("object")], b.prototype, "gifs", 2);
    x([y("object")], b.prototype, "camera", 2);
    x([y("object")], b.prototype, "audio", 2);
    x([y("object")], b.prototype, "microphone", 2);
    x([y("object")], b.prototype, "mixedFiles", 2);
    x([y("object")], b.prototype, "dragAndDrop", 2);
    x([y("object")], b.prototype, "introPanelStyle", 2);
    x([y("object")], b.prototype, "htmlClassUtilities", 2);
    x([y("function")], b.prototype, "onNewMessage", 2);
    x([y("function")], b.prototype, "onClearMessages", 2);
    x([y("function")], b.prototype, "onComponentRender", 2);
    x([y("function")], b.prototype, "onError", 2);
    x([y("object")], b.prototype, "demo", 2);
    x([y("object")], b.prototype, "_insertKeyViewStyles", 2);
    customElements.define("deep-chat", b);

    /* App.svelte generated by Svelte v3.59.2 */
    const file = "App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let deep_chat;
    	let deep_chat_directconnection_value;
    	let deep_chat__insertkeyviewstyles_value;
    	let deep_chat_demo_value;
    	let deep_chat_mixedfiles_value;
    	let deep_chat_textinput_value;
    	let deep_chat_chatstyle_value;
    	let deep_chat_messagestyles_value;

    	const block = {
    		c: function create() {
    			main = element("main");
    			deep_chat = element("deep-chat");

    			set_custom_element_data(deep_chat, "directconnection", deep_chat_directconnection_value = {
    				openAI: {
    					validateKeyProperty: true,
    					assistant: {
    						assistant_id: "asst_0qjNhzjIMuwfjJJ2e4Cl8vdY",
    						function_handler: /*func*/ ctx[1]
    					}
    				}
    			});

    			set_custom_element_data(deep_chat, "_insertkeyviewstyles", deep_chat__insertkeyviewstyles_value = { displayCautionText: false });
    			set_custom_element_data(deep_chat, "demo", deep_chat_demo_value = false);
    			set_custom_element_data(deep_chat, "mixedfiles", deep_chat_mixedfiles_value = true);
    			set_custom_element_data(deep_chat, "textinput", deep_chat_textinput_value = { placeholder: { text: "Say something" } });
    			set_custom_element_data(deep_chat, "initialmessages", /*initialMessages*/ ctx[0]);

    			set_custom_element_data(deep_chat, "chatstyle", deep_chat_chatstyle_value = {
    				width: "100%",
    				height: "100dvh",
    				backgroundColor: "white",
    				border: "none",
    				fontSize: "16px",
    				fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
    			});

    			set_custom_element_data(deep_chat, "messagestyles", deep_chat_messagestyles_value = {
    				default: { shared: { bubble: { maxWidth: "75%" } } }
    			});

    			add_location(deep_chat, file, 65, 4, 3599);
    			attr_dev(main, "class", "svelte-u93l4o");
    			add_location(main, file, 33, 2, 1851);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, deep_chat);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function getCurrentWeather(location) {
    	location = location.toLowerCase();

    	if (location.includes('tokyo')) {
    		return 'Good';
    	} else if (location.includes('san francisco')) {
    		return 'Mild';
    	} else {
    		return 'Very Hot';
    	}
    }

    function getCurrentTime(location) {
    	location = location.toLowerCase();

    	if (location.includes('tokyo')) {
    		return '10p';
    	} else if (location.includes('san francisco')) {
    		return '6p';
    	} else {
    		return '12p';
    	}
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	const initialMessages = [
    		{
    			role: "ai",
    			text: "Hi, I'm **BIDARA**, bio-inspired design and research assisant. I'm an OpenAI [GPT-4](https://openai.com/research/gpt-4) [assistant](https://platform.openai.com/docs/assistants/how-it-works), that was instructed by [NASA's PeTaL initiative](https://www1.grc.nasa.gov/research-and-engineering/vine/petal/) to help others understand, learn from, and emulate the strategies used by living things to create sustainable designs and technologies using the [Biomimicry Institute's design process](https://toolbox.biomimicry.org/methods/process/).\n\nBefore we begin, please be advised:\n\n- Do not share any sensitive information in your conversations including but not limited to, personal information, sensitive or non-public government/company data, ITAR, CUI, export controlled, or trade secrets.\n- While OpenAI has safeguards in place, BIDARA may occasionally generate incorrect or misleading information and produce offensive or biased content.\n\nHow can I assist you today?"
    		}
    	];

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const func = functionsDetails => {
    		return functionsDetails.map(functionDetails => {
    			let tmp = null;

    			if (functionDetails.name == "get_weather") {
    				tmp = getCurrentWeather(functionDetails.arguments);
    			} else if (functionDetails.name == "get_time") {
    				tmp = getCurrentTime(functionDetails.arguments);
    			}

    			return tmp;
    		});
    	};

    	$$self.$capture_state = () => ({
    		DeepChat: b,
    		initialMessages,
    		getCurrentWeather,
    		getCurrentTime
    	});

    	return [initialMessages, func];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
