/**
 * vuejs.js
 *
 * vuejs (webdeploy plugin)
 *
 * Copyright (C) Roger Gee, et al.
 */

const { format } = require("util");

const { VueBuilder } = require("./builder");

const OPTION_SCHEMA = [
    { key:'validateFileExtension', type:'boolean', defaultValue:true },
    {
        key: 'vuejsCompilerSettings',
        type: 'object',
        defaultValue: {
            pad: "line"
        }
    }
];
const VUE_FILE = /(.+)\.vue$/;

function makeOption(settings,key,type,defaultValue) {
    if (!(key in settings)) {
        if (typeof defaultValue === "undefined") {
            throw new Error(format("vuejs: missing required option '%s'",key));
        }

        return defaultValue;
    }

    if (typeof settings[key] !== type) {
        throw new Error(format("vuejs: invalid value for plugin setting '%s'",key));
    }

    return settings[key];
}

function buildPlugin(target,settings) {
    try {
        var options = {};
        for (let i = 0;i < OPTION_SCHEMA.length;++i) {
            let opt = OPTION_SCHEMA[i];
            options[opt.key] = makeOption(settings,opt.key,opt.type,opt.defaultValue);
        }

    } catch (err) {
        return Promise.reject(err);
    }

    if (options.validateFileExtension) {
        if (!target.targetName.match(VUE_FILE)) {
            let err = new Error(
                format(
                    "vuejs: target '%s' must have .vue extension",
                    target.targetName
                )
            );
            return Promise.reject(err);
        }
    }

    return new Promise((resolve,reject) => {
        target.loadContent().then((content) => {
            var compiler = new VueBuilder(target,settings);

            try {
                compiler.build(resolve);
            } catch (err) {
                reject(err);
            }
        });
    });
}

module.exports = {
    exec: buildPlugin
}
