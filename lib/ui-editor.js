module.exports = function (RED) {
    RED.plugins.registerPlugin("dashboard-2-ui-editor", {
        type: "editor-plugin",
        onadd: function () {
            RED.log.info("[dashboard-2-ui-editor] loaded");
        }
    });
};
