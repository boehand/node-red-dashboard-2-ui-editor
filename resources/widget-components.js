/*
 * Per-widget Vue 3 component definitions used by the UI Editor preview.
 *
 * Each entry corresponds to one Dashboard 2 widget node type and mirrors the
 * structure of its `<template>` in `@flowfuse/node-red-dashboard`'s
 * `ui/src/widgets/*.vue`. Vuetify is intentionally not pulled in — the editor
 * preview is a static, in-sidebar approximation, so the templates use plain
 * HTML wrapped in the `d2ed-pw-*` classes already defined in `ui-editor.css`.
 *
 * Components receive the node's runtime config as `node` (a plain object) and
 * the parent group as `group`, so the same prop names used by the real
 * Dashboard 2 components (label, options, min/max, format, …) are available
 * here. Adding a new widget means adding one entry to D2UIWidgetComponents
 * with type / template / optional computed; nothing else needs to change.
 *
 * Exposes window.D2UIWidgetComponents — a map from node type to Vue component
 * definition. A `__resolve` helper centralises lookup so the renderer never
 * needs a fallback path.
 */
(function (global) {
    'use strict'

    function escapeHtml (s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
    }

    // -----------------------------------------------------------------------
    // Widget components — one per ui-* node type.
    //
    // The shapes mirror the corresponding Vue files under
    // FlowFuse/node-red-dashboard / ui/src/widgets/*.vue:
    //   • props are the same names the runtime widget binds against
    //     (`node.label`, `node.format`, `node.options`, …)
    //   • templates render the same logical structure (button → <button>,
    //     gauge → svg arc + needle, chart → svg with axes + plot, …)
    //   • all dynamic styling (colour, label position, segment palette) is
    //     driven by the node defaults from widget-catalog.js.
    // -----------------------------------------------------------------------

    const components = {}

    // --- input ----------------------------------------------------------------
    components['ui-button'] = {
        props: ['node', 'group'],
        computed: {
            color () { return this.node.color || '#0094CE' },
            text () { return this.node.label || this.node.name || 'button' },
            icon () { return this.node.icon },
            iconLeft () { return this.icon && this.node.iconPosition !== 'right' },
            iconRight () { return this.icon && this.node.iconPosition === 'right' }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-button">
                <button class="d2ed-pw-btn" :style="{ background: color }">
                    <i v-if="iconLeft" class="fa" :class="icon"></i>
                    <span class="d2ed-pw-btn-text">{{ text }}</span>
                    <i v-if="iconRight" class="fa" :class="icon"></i>
                </button>
            </div>
        `
    }

    components['ui-button-group'] = {
        props: ['node', 'group'],
        computed: {
            label () { return this.node.label || '' },
            options () {
                const opts = Array.isArray(this.node.options) ? this.node.options : []
                return (opts.length ? opts : [{ label: 'Option 1' }]).slice(0, 4)
            }
        },
        methods: {
            optionLabel (o) { return String(o.label || o.value || 'Opt') }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-btn-group">
                <span v-if="label" class="d2ed-pw-lbl">{{ label }}</span>
                <div class="d2ed-pw-btn-group-row">
                    <button v-for="(o, i) in options"
                            :key="i"
                            class="d2ed-pw-btn-group-btn"
                            :class="{ 'is-active': i === 0 }">{{ optionLabel(o) }}</button>
                </div>
            </div>
        `
    }

    components['ui-switch'] = {
        props: ['node', 'group'],
        computed: {
            label () { return this.node.label || this.node.name || '' },
            on () { return !!this.node.passthru }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-switch">
                <span class="d2ed-pw-lbl">{{ label }}</span>
                <div class="d2ed-pw-toggle" :class="{ 'is-off': !on }">
                    <div class="d2ed-pw-toggle-thumb"></div>
                </div>
            </div>
        `
    }

    components['ui-slider'] = {
        props: ['node', 'group'],
        computed: {
            label () { return this.node.label || '' },
            min () { return this.node.min !== undefined ? this.node.min : 0 },
            max () { return this.node.max !== undefined ? this.node.max : 10 }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-slider">
                <span v-if="label" class="d2ed-pw-lbl">{{ label }}</span>
                <div class="d2ed-pw-slider-row">
                    <span class="d2ed-pw-slider-bound">{{ min }}</span>
                    <div class="d2ed-pw-slider-track">
                        <div class="d2ed-pw-slider-fill" style="width:50%"></div>
                        <div class="d2ed-pw-slider-thumb" style="left:50%"></div>
                    </div>
                    <span class="d2ed-pw-slider-bound">{{ max }}</span>
                </div>
            </div>
        `
    }

    components['ui-dropdown'] = {
        props: ['node', 'group'],
        computed: {
            label () { return this.node.label || '' },
            firstOption () {
                const opts = Array.isArray(this.node.options) ? this.node.options : []
                if (!opts.length) return 'Option 1'
                const o = opts[0]
                return String(o.label || o.value || 'Option 1')
            }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-dropdown">
                <span v-if="label" class="d2ed-pw-lbl">{{ label }}</span>
                <div class="d2ed-pw-select">
                    <span>{{ firstOption }}</span>
                    <i class="fa fa-chevron-down"></i>
                </div>
            </div>
        `
    }

    components['ui-radio-group'] = {
        props: ['node', 'group'],
        computed: {
            label () { return this.node.label || '' },
            options () {
                const opts = Array.isArray(this.node.options) ? this.node.options : []
                return (opts.length ? opts : [{ label: 'Option 1' }]).slice(0, 4)
            }
        },
        methods: {
            optionLabel (o) { return String(o.label || o.value || 'Option') }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-radio">
                <span v-if="label" class="d2ed-pw-lbl">{{ label }}</span>
                <div v-for="(o, i) in options" :key="i" class="d2ed-pw-radio-row">
                    <span class="d2ed-pw-radio-dot" :class="{ 'is-on': i === 0 }"></span>
                    <span>{{ optionLabel(o) }}</span>
                </div>
            </div>
        `
    }

    components['ui-text-input'] = {
        props: ['node', 'group'],
        computed: {
            label () { return this.node.label || '' },
            mode () { return this.node.mode || 'text' },
            modeClass () { return 'd2ed-pw-input-' + this.mode },
            placeholder () { return this.mode === 'password' ? '••••••' : '' }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-text-input">
                <span v-if="label" class="d2ed-pw-lbl">{{ label }}</span>
                <div class="d2ed-pw-input-field" :class="modeClass">{{ placeholder }}</div>
            </div>
        `
    }

    components['ui-number-input'] = {
        props: ['node', 'group'],
        computed: {
            label () { return this.node.label || '' },
            value () { return String(this.node.min == null ? 0 : this.node.min) }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-number-input">
                <span v-if="label" class="d2ed-pw-lbl">{{ label }}</span>
                <div class="d2ed-pw-number-row">
                    <button class="d2ed-pw-num-btn">−</button>
                    <div class="d2ed-pw-number-val">{{ value }}</div>
                    <button class="d2ed-pw-num-btn">+</button>
                </div>
            </div>
        `
    }

    components['ui-form'] = {
        props: ['node', 'group'],
        computed: {
            fields () {
                const opts = Array.isArray(this.node.options) ? this.node.options : []
                return (opts.length ? opts : [{ label: 'Name', key: 'name' }]).slice(0, 2)
            },
            submitText () { return this.node.submit || 'Submit' }
        },
        methods: {
            fieldLabel (f) { return String(f.label || f.key || 'Field') }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-form">
                <div v-for="(f, i) in fields" :key="i" class="d2ed-pw-form-field">
                    <span class="d2ed-pw-lbl">{{ fieldLabel(f) }}</span>
                    <div class="d2ed-pw-input-field"></div>
                </div>
                <button class="d2ed-pw-btn d2ed-pw-btn-form">{{ submitText }}</button>
            </div>
        `
    }

    components['ui-file-input'] = {
        props: ['node', 'group'],
        computed: {
            label () { return this.node.label || 'Upload' }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-file">
                <button class="d2ed-pw-btn-outline">
                    <i class="fa fa-upload"></i>
                    <span>{{ label }}</span>
                </button>
            </div>
        `
    }

    // --- output ---------------------------------------------------------------
    components['ui-text'] = {
        props: ['node', 'group'],
        computed: {
            label () { return this.node.label || '' },
            value () { return this.node.format || '{{msg.payload}}' }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-text">
                <span v-if="label" class="d2ed-pw-lbl">{{ label }}</span>
                <div class="d2ed-pw-text-value">{{ value }}</div>
            </div>
        `
    }

    components['ui-gauge'] = {
        props: ['node', 'group'],
        computed: {
            min () { return typeof this.node.min === 'number' ? this.node.min : 0 },
            max () { return typeof this.node.max === 'number' ? this.node.max : 10 },
            range () { return (this.max - this.min) || 10 },
            title () { return this.node.title || this.node.name || this.node.label || 'Gauge' },
            cx () { return 50 },
            cy () { return 52 },
            radius () { return 38 },
            trackLeft () { return this.point(0) },
            trackRight () { return this.point(1) },
            needle () { return this.point(0.5) },
            needleY2 () { return +(this.needle.y + 4).toFixed(1) },
            segments () {
                const segs = Array.isArray(this.node.segments) && this.node.segments.length
                    ? this.node.segments
                    : [
                        { from: this.min, color: '#53B04F' },
                        { from: this.min + this.range / 3, color: '#FFA500' },
                        { from: this.min + this.range * 2 / 3, color: '#FF0000' }
                    ]
                const out = []
                for (let i = 0; i < segs.length; i++) {
                    const seg = segs[i]
                    const next = segs[i + 1]
                    const start = (seg.from - this.min) / this.range
                    const end = next ? (next.from - this.min) / this.range : 1
                    const a = this.point(start)
                    const b = this.point(end)
                    const la = (end - start) > 0.5 ? 1 : 0
                    out.push({
                        d: `M${a.x} ${a.y} A${this.radius} ${this.radius} 0 ${la} 0 ${b.x} ${b.y}`,
                        color: seg.color || '#888'
                    })
                }
                return out
            },
            trackPath () {
                const a = this.trackLeft, b = this.trackRight
                return `M${a.x} ${a.y} A${this.radius} ${this.radius} 0 0 0 ${b.x} ${b.y}`
            }
        },
        methods: {
            point (pct) {
                const a = Math.PI - Math.max(0, Math.min(1, pct)) * Math.PI
                return {
                    x: +(this.cx + this.radius * Math.cos(a)).toFixed(1),
                    y: +(this.cy - this.radius * Math.sin(a)).toFixed(1)
                }
            }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-gauge">
                <svg viewBox="0 0 100 60" class="d2ed-pw-gauge-svg">
                    <path :d="trackPath" fill="none" stroke="#e0e0e0" stroke-width="9"/>
                    <path v-for="(s, i) in segments"
                          :key="i"
                          :d="s.d"
                          fill="none"
                          :stroke="s.color"
                          stroke-width="9"
                          stroke-linecap="butt"/>
                    <line :x1="cx" :y1="cy" :x2="needle.x" :y2="needleY2" stroke="#444" stroke-width="2" stroke-linecap="round"/>
                    <circle :cx="cx" :cy="cy" r="3.5" fill="#444"/>
                    <text :x="cx" y="59" text-anchor="middle" font-size="5.5" fill="#999">{{ min }} – {{ max }}</text>
                </svg>
                <div class="d2ed-pw-gauge-title">{{ title }}</div>
            </div>
        `
    }

    components['ui-chart'] = {
        props: ['node', 'group'],
        computed: {
            title () { return this.node.label || 'Chart' },
            chartType () { return this.node.chartType || 'line' },
            isBar () { return this.chartType === 'bar' },
            color () {
                const c = Array.isArray(this.node.colors) && this.node.colors[0]
                return c || '#0094CE'
            },
            bars () {
                return [
                    { x: 10, y: 30, h: 20 },
                    { x: 28, y: 15, h: 35 },
                    { x: 46, y: 22, h: 28 },
                    { x: 64, y: 10, h: 40 },
                    { x: 82, y: 25, h: 25 }
                ]
            },
            linePoints () { return '10,40 25,25 40,33 55,14 70,26 90,10' },
            areaPoints () { return '10,52 10,40 25,25 40,33 55,14 70,26 90,10 90,52' },
            areaFill () {
                const c = this.color
                if (/^#[0-9a-fA-F]{6}$/.test(c)) {
                    const r = parseInt(c.slice(1, 3), 16)
                    const g = parseInt(c.slice(3, 5), 16)
                    const b = parseInt(c.slice(5, 7), 16)
                    return `rgba(${r}, ${g}, ${b}, 0.12)`
                }
                return 'rgba(0,148,206,0.12)'
            }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-chart">
                <div class="d2ed-pw-chart-title">{{ title }}</div>
                <svg viewBox="0 0 100 55" class="d2ed-pw-chart-svg" preserveAspectRatio="none">
                    <line x1="8" y1="4" x2="8" y2="52" stroke="#ddd" stroke-width="1"/>
                    <line x1="8" y1="52" x2="96" y2="52" stroke="#ddd" stroke-width="1"/>
                    <template v-if="isBar">
                        <rect v-for="(b, i) in bars"
                              :key="i"
                              :x="b.x"
                              :y="b.y"
                              width="12"
                              :height="b.h"
                              :fill="color"
                              rx="1"/>
                    </template>
                    <template v-else>
                        <polyline :points="areaPoints" :fill="areaFill" stroke="none"/>
                        <polyline :points="linePoints" fill="none" :stroke="color" stroke-width="2" stroke-linejoin="round"/>
                    </template>
                </svg>
            </div>
        `
    }

    components['ui-table'] = {
        props: ['node', 'group'],
        computed: {
            title () { return this.node.label || '' },
            columns () {
                const cols = Array.isArray(this.node.columns) ? this.node.columns : []
                if (!cols.length) return ['Col 1', 'Col 2', 'Col 3']
                return cols.slice(0, 4).map(c => String(c.title || c.key || c))
            }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-table">
                <div v-if="title" class="d2ed-pw-lbl">{{ title }}</div>
                <div class="d2ed-pw-table-head">
                    <span v-for="(c, i) in columns" :key="i">{{ c }}</span>
                </div>
                <div class="d2ed-pw-table-row d2ed-pw-table-empty"><span>—</span></div>
            </div>
        `
    }

    components['ui-progress'] = {
        props: ['node', 'group'],
        computed: {
            title () { return this.node.label || '' },
            showValue () { return this.node.showValue !== false }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-progress">
                <span v-if="title" class="d2ed-pw-lbl">{{ title }}</span>
                <div class="d2ed-pw-progress-track">
                    <div class="d2ed-pw-progress-fill" style="width:50%"></div>
                </div>
                <span v-if="showValue" class="d2ed-pw-progress-val">50%</span>
            </div>
        `
    }

    components['ui-notification'] = {
        props: ['node', 'group'],
        computed: {
            position () { return this.node.position || 'bottom right' }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-notification">
                <i class="fa fa-bell"></i>
                <span>Notification</span>
                <span class="d2ed-pw-notif-pos">{{ position }}</span>
            </div>
        `
    }

    components['ui-audio'] = {
        props: ['node', 'group'],
        template: `
            <div class="d2ed-pw d2ed-pw-audio">
                <i class="fa fa-volume-up"></i>
                <div class="d2ed-pw-audio-bar">
                    <div></div><div></div><div></div><div></div><div></div>
                </div>
            </div>
        `
    }

    // --- content --------------------------------------------------------------
    components['ui-markdown'] = {
        props: ['node', 'group'],
        computed: {
            snippet () {
                const c = (this.node.content || '').toString()
                return c.substring(0, 60) || 'Write some markdown here.'
            }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-markdown">
                <div class="d2ed-pw-md-h1">Markdown</div>
                <div class="d2ed-pw-md-p">{{ snippet }}</div>
            </div>
        `
    }

    components['ui-template'] = {
        props: ['node', 'group'],
        computed: {
            snippet () {
                const t = (this.node.template || '<div>Template</div>').toString()
                return t.substring(0, 50)
            }
        },
        template: `
            <div class="d2ed-pw d2ed-pw-template">
                <code class="d2ed-pw-code">{{ snippet }}</code>
            </div>
        `
    }

    components['ui-spacer'] = {
        props: ['node', 'group'],
        template: `
            <div class="d2ed-pw d2ed-pw-spacer">
                <div class="d2ed-pw-spacer-inner"><div></div><div></div></div>
            </div>
        `
    }

    // --- logic ----------------------------------------------------------------
    // ui-control and ui-event have no visual representation in Dashboard 2 —
    // they are runtime-only nodes that emit / receive control events. Render a
    // small badge so the editor still shows them on the layout.
    components['ui-control'] = {
        props: ['node', 'group'],
        template: `
            <div class="d2ed-pw d2ed-pw-logic">
                <i class="fa fa-sliders"></i>
                <span>Control</span>
            </div>
        `
    }

    components['ui-event'] = {
        props: ['node', 'group'],
        template: `
            <div class="d2ed-pw d2ed-pw-logic">
                <i class="fa fa-play-circle-o"></i>
                <span>Event</span>
            </div>
        `
    }

    // -----------------------------------------------------------------------
    // Resolution: every catalog widget type must have a registered component.
    // Throwing on a missing entry surfaces the gap immediately instead of
    // silently rendering a placeholder.
    // -----------------------------------------------------------------------
    function resolve (type) {
        const c = components[type]
        if (!c) {
            throw new Error('No Vue component registered for widget type: ' + type)
        }
        return c
    }

    function has (type) {
        return Object.prototype.hasOwnProperty.call(components, type)
    }

    function types () {
        return Object.keys(components)
    }

    global.D2UIWidgetComponents = {
        components,
        resolve,
        has,
        types,
        // Exposed so tests and the renderer can sanitise text without pulling
        // in another helper module.
        escapeHtml
    }
})(typeof window !== 'undefined' ? window : globalThis)
