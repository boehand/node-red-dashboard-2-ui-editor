/*
 * Catalog of Node-RED Dashboard 2 widget types known to the editor.
 *
 * Each entry mirrors the minimum defaults from the corresponding .html node
 * definition in @flowfuse/node-red-dashboard (nodes/widgets/*.html) so that a
 * node created from the editor is valid in Node-RED without further config.
 *
 * `width` values follow the Dashboard 2 convention: 0 means "auto-fit to group
 * width", any other value is the number of grid columns occupied.
 */
(function (global) {
    'use strict'

    const WIDGETS = [
        {
            type: 'ui-button',
            label: 'Button',
            category: 'input',
            icon: 'fa-hand-pointer-o',
            defaults: { label: 'button', width: 0, height: 1, order: 0, payload: '', payloadType: 'str', topic: 'topic', topicType: 'msg', icon: '', iconPosition: 'left', emulateClick: false, className: '' }
        },
        {
            type: 'ui-button-group',
            label: 'Button Group',
            category: 'input',
            icon: 'fa-th',
            defaults: { label: 'button-group', width: 0, height: 1, order: 0, options: [{ label: 'Option 1', value: 'option-1' }], allowMultiple: false, rounded: true, useThemeColors: true, passthru: true, className: '' }
        },
        {
            type: 'ui-switch',
            label: 'Switch',
            category: 'input',
            icon: 'fa-toggle-on',
            defaults: { label: 'switch', width: 0, height: 1, order: 0, passthru: true, decouple: false, evaluationType: 'default', onvalue: 'true', onvalueType: 'bool', onicon: '', oncolor: '', offvalue: 'false', offvalueType: 'bool', officon: '', offcolor: '', topic: 'topic', topicType: 'msg', style: 'auto', className: '' }
        },
        {
            type: 'ui-slider',
            label: 'Slider',
            category: 'input',
            icon: 'fa-sliders',
            defaults: { label: 'slider', tooltip: '', width: 0, height: 1, order: 0, min: 0, max: 10, step: 1, thumbLabel: 'off', iconPrepend: '', iconAppend: '', showLabel: true, showValue: false, passthru: true, topic: 'topic', topicType: 'msg', className: '' }
        },
        {
            type: 'ui-dropdown',
            label: 'Dropdown',
            category: 'input',
            icon: 'fa-caret-square-o-down',
            defaults: { label: 'Select option', tooltip: '', width: 0, height: 1, order: 0, options: [{ label: '', value: 'value', type: 'str' }], multiple: false, chips: false, clearable: false, allowRegex: false, passthru: true, topic: 'topic', topicType: 'msg', className: '' }
        },
        {
            type: 'ui-radio-group',
            label: 'Radio Group',
            category: 'input',
            icon: 'fa-dot-circle-o',
            defaults: { label: 'Select', width: 0, height: 1, order: 0, columns: 1, options: [{ label: 'Option 1', value: 'option-1', type: 'str' }], passthru: true, topic: 'topic', topicType: 'msg', className: '' }
        },
        {
            type: 'ui-text-input',
            label: 'Text Input',
            category: 'input',
            icon: 'fa-font',
            defaults: { label: 'text', tooltip: '', width: 0, height: 1, order: 0, mode: 'text', iconPrepend: '', iconAppend: '', clearable: false, delay: 300, passthru: true, sendOnDelay: true, sendOnBlur: true, sendOnEnter: true, topic: 'topic', topicType: 'msg', className: '' }
        },
        {
            type: 'ui-number-input',
            label: 'Number Input',
            category: 'input',
            icon: 'fa-calculator',
            defaults: { label: 'number', tooltip: '', width: 0, height: 1, order: 0, iconPrepend: '', iconAppend: '', clearable: false, min: 0, max: 10, step: 1, passthru: true, sendOnDelay: true, sendOnBlur: true, sendOnEnter: true, sendOnIncrement: true, topic: 'topic', topicType: 'msg', className: '' }
        },
        {
            type: 'ui-form',
            label: 'Form',
            category: 'input',
            icon: 'fa-list-alt',
            defaults: { label: '', width: 0, height: 1, order: 0, options: [{ label: 'Name', key: 'name', type: 'text', required: true, rows: 4 }], formValue: {}, payload: '', submit: 'Submit', cancel: 'Cancel', topic: 'topic', topicType: 'msg', splitLayout: false, resetOnSubmit: true, className: '' }
        },
        {
            type: 'ui-file-input',
            label: 'File Input',
            category: 'input',
            icon: 'fa-file-o',
            defaults: { label: 'Upload', width: 0, height: 1, order: 0, accept: '', multiple: false, topic: 'topic', topicType: 'msg', className: '' }
        },
        {
            type: 'ui-text',
            label: 'Text',
            category: 'output',
            icon: 'fa-align-left',
            defaults: { label: 'text', format: '{{msg.payload}}', layout: 'row-left', style: false, font: '', fontSize: 14, color: '#717171', wrap: false, width: 0, height: 1, order: 0, className: '' }
        },
        {
            type: 'ui-gauge',
            label: 'Gauge',
            category: 'output',
            icon: 'fa-tachometer',
            defaults: { title: 'Gauge', gstyle: 'needle', icon: '', prefix: '', suffix: '', units: '', segments: [{ from: 0, color: '#53B04F' }, { from: 3.33, color: '#FFA500' }, { from: 6.66, color: '#FF0000' }], min: 0, max: 10, sizeThickness: 24, sizeKeyThickness: 4, sizeGap: 2, sizeKeyLength: 12, showValue: true, showLiveValue: false, valueFontSize: 18, showPointer: true, showSegmentLimits: false, showTitle: true, width: 3, height: 3, order: 0, className: '' }
        },
        {
            type: 'ui-chart',
            label: 'Chart',
            category: 'output',
            icon: 'fa-bar-chart',
            defaults: { label: 'chart', chartType: 'line', category: 'topic', categoryType: 'msg', xAxisLabel: '', xAxisProperty: null, xAxisPropertyType: 'timestamp', xAxisType: 'time', xAxisFormat: '', xAxisFormatType: 'auto', xmin: '', xmax: '', ymin: '', ymax: '', yAxisLabel: '', bins: 5, action: 'append', pointShape: 'circle', pointRadius: 4, showLegend: true, removeOlder: 1, removeOlderUnit: '3600', removeOlderPoints: '', colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'], textColor: [], width: 0, height: 5, order: Number.MAX_SAFE_INTEGER, className: '' }
        },
        {
            type: 'ui-table',
            label: 'Table',
            category: 'output',
            icon: 'fa-table',
            defaults: { label: '', width: 0, height: 5, order: 0, maxrows: 0, columns: [], showSearch: false, showSelectColumns: false, sortable: false, columnSortable: false, className: '' }
        },
        {
            type: 'ui-progress',
            label: 'Progress',
            category: 'output',
            icon: 'fa-tasks',
            defaults: { label: '', format: '{{msg.payload}}%', min: 0, max: 100, colorStyle: 'default', backgroundColorStyle: 'default', colorBg: '#EEE', color: '#0094CE', showPercentage: true, showValue: true, width: 0, height: 1, order: 0, className: '' }
        },
        {
            type: 'ui-notification',
            label: 'Notification',
            category: 'output',
            icon: 'fa-bell',
            defaults: { displayTime: 5, showCountdown: true, position: 'bottom right', color: '', allowDismiss: true, raw: false, className: '' }
        },
        {
            type: 'ui-audio',
            label: 'Audio',
            category: 'output',
            icon: 'fa-volume-up',
            defaults: { name: '', width: 0, height: 0, order: 0, className: '' }
        },
        {
            type: 'ui-markdown',
            label: 'Markdown',
            category: 'content',
            icon: 'fa-book',
            defaults: { content: '# Markdown\n\nWrite some **markdown** here.', width: 0, height: 1, order: 0, className: '' }
        },
        {
            type: 'ui-template',
            label: 'Template',
            category: 'content',
            icon: 'fa-code',
            defaults: { template: '<div>Template</div>', templateScope: 'local', width: 0, height: 1, order: 0, className: '' }
        },
        {
            type: 'ui-spacer',
            label: 'Spacer',
            category: 'content',
            icon: 'fa-arrows-h',
            defaults: { width: 1, height: 1, order: 0, className: '' }
        },
        {
            type: 'ui-control',
            label: 'Control',
            category: 'logic',
            icon: 'fa-sliders',
            defaults: { events: 'all', className: '' }
        },
        {
            type: 'ui-event',
            label: 'Event',
            category: 'logic',
            icon: 'fa-play-circle-o',
            defaults: { events: ['page', 'group', 'widget'], className: '' }
        }
    ]

    const CATEGORIES = [
        { id: 'input', label: 'Input' },
        { id: 'output', label: 'Output' },
        { id: 'content', label: 'Content' },
        { id: 'logic', label: 'Logic' }
    ]

    global.D2UIEditorCatalog = { WIDGETS, CATEGORIES }
})(window)
