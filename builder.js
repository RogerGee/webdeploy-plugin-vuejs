/**
 * builder.js
 *
 * vuejs (webdeploy plugin)
 *
 * Copyright (C) Roger Gee, et al.
 */

const { format } = require("util");
const vuejsCompiler = require('vue-template-compiler');
const vuejsTranspile = require('vue-template-es2015-compiler');
const hash = require('hash-sum');
const { compileStyle } = require('@vue/component-compiler-utils');

function createTemplateFunction(code,isFunctional) {
    var funcCode;

    if (isFunctional) {
        var opts = {
            transforms: {
                stripWithFunctional: true
            }
        };

        funcCode = format("function render (_h, _vm) {%s}",code);
        return vuejsTranspile(funcCode,opts);
    }

    funcCode = format("function render () {%s}",code);
    return vuejsTranspile(funcCode);
}

function compileTemplate(template) {
    const isFunctional = !!template.attrs.functional;

    var compiled = vuejsCompiler.compile(template.content, {
        preserveWhitespace: true
    });

    return {
        render: createTemplateFunction(compiled.render),
        staticRenderFns: '['
            + compiled.staticRenderFns.map(createTemplateFunction).join(',')
            + ']',
        isFunctional
    };
}

function makeStyleImports(styleTargets) {
    return styleTargets.map((target) => {
        return format("import './%s'\n",target.targetName);
    });
}

class VueBuilder {
    constructor(target,settings) {
        this.target = target;

        // Create a scope ID for the builder. This will be used for scoped
        // CSS. (This copies the behavior of vue-loader.)
        this.scopeId = "data-v-" + hash(this.target.getSourceTargetPath());

        this.compilerSettings = settings.vuejsCompilerSettings;
    }

    build(donefn,errfn) {
        var targets = [];

        // Parse the SFC target into its components.
        var components;
        components = vuejsCompiler.parseComponent(this.target.content,this.compilerSettings);

        if (!components.script || !components.script.content) {
            throw new Error(
                format(
                    "vuejs: target component '%s' must have a <script> section",
                    this.target.targetName
                )
            );
        }

        // Compile the <template> section into render function object (if any).
        var renderInfo;
        if (components.template) {
            renderInfo = compileTemplate(components.template);
        }

        // Create style targets from the <style> section(s).
        var styleTargets = this.createStyleTargets(components.styles);

        // Add import references to script content for styles.
        var styleImports = makeStyleImports(styleTargets);
        var scriptContent = format("%s\n%s",components.script.content,styleImports);

        // Create new JavaScript target that combines the render function (if
        // any) and <script>.
        var scriptTarget = this.createScriptTarget(scriptContent,renderInfo);

        targets.push(scriptTarget);
        styleTargets.forEach((target) => targets.push(target));

        donefn(targets);
    }

    createScriptTarget(scriptContent,renderInfo) {
        var scriptTarget = this.target.makeOutputTarget(this.target.targetName + ".js");
        var content = format("// Compiled from %s\n",this.target.targetName) + scriptContent;

        // Append render information to the script target's module exports.
        if (renderInfo) {
            content += "\n";
            content += "export {\n";
            content += "  render: " + renderInfo.render + ",\n";
            content += "  staticRenderFns: " + renderInfo.staticRenderFns + ",\n";
            content += "  functional: " + (renderInfo.isFunctional ? "true" : "false") + ",\n";
            content += "  _compiled: true\n";
            content += "};\n";
        }

        // Append scope ID to script target's module exports.
        content += format("\nexport var _scopeId = '%s';",this.scopeId);

        scriptTarget.stream.end(content);
        return scriptTarget;
    }

    createStyleTargets(styleInfoList) {
        var resultMap = {};
        var resultList = [];

        for (let i = 0;i < styleInfoList.length;++i) {
            var styleInfo = styleInfoList[i];
            var lang = styleInfo.lang || "css";

            if (lang == "css") {
                var ext = "css";
                var opts = {
                    source: styleInfo.content,
                    scoped: !!styleInfo.attrs.scoped,
                    id: this.scopeId,
                    trim: true
                }

                const { code, map, errors } = compileStyle(opts);

                if (errors.length) {
                    throw errors[0];
                }

                styleInfo.content = code;
                styleInfo.map = map;
            }
            else if (lang == "scss") {
                var ext = "scss";
            }
            else {
                throw new Error(
                    format(
                        "vuejs: target '%s' requires unsupported <style> lang attribute '%s'",
                        this.target.targetName,
                        lang
                    )
                );
            }

            // Aggregate content by extension.
            if (!(ext in resultMap)) {
                resultMap[ext] = format("/* Compiled from %s */\n",this.target.targetName);
                resultList.push(ext);
            }
            resultMap[ext] += styleInfo.content;
        }

        // Use the result list order to create the targets.
        return resultList.map((ext) => {
            var newName = format("%s.%s",this.target.targetName,ext);
            var styleTarget = this.target.makeOutputTarget(newName);

            styleTarget.stream.end(resultMap[ext]);
            return styleTarget;
        });
    }
}

module.exports = {
    VueBuilder
}
