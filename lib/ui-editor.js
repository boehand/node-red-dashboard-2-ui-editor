'use strict'

const path = require('path')

module.exports = function (RED) {
    // Serve Vue 3 (global build with template compiler) for the editor plugin
    RED.httpAdmin.get('/dashboard-2-ui-editor/vue.js', function (req, res) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'public, max-age=86400')
        res.sendFile(path.join(__dirname, '..', 'resources', 'vue.global.prod.js'))
    })

    RED.plugins.registerPlugin('dashboard-2-ui-editor', {
        type: 'editor-plugin',
        onadd: function () {
            RED.log.info('[dashboard-2-ui-editor] loaded')
        }
    })
}
