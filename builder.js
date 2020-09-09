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
const babel = require('@babel/core');

const plugin_transform_script_target = require('./transform-plugin');

function createTemplateFunction(code,isFunctional) {
    let funcCode;

    if (isFunctional) {
        const opts = {
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

    const compiled = vuejsCompiler.compile(template.content, {
        preserveWhitespace: true
    });

    function createfn(code) {
        return createTemplateFunction(code,isFunctional);
    }

    return {
        render: createfn(compiled.render),
        staticRenderFns: '['
            + compiled.staticRenderFns.map(createfn).join(',')
            + ']',
        isFunctional
    };
}

function makeStyleImports(styleTargets) {
    return styleTargets.map((target) => {
        return format("import './%s'",target.targetName);
    }).join("\n");
}

class VueBuilder {
    constructor(target,settings) {
        this.target = target;
        this.targetSourcePath = target.getSourceTargetPath();

        // Create a scope ID for the builder. This will be used for scoped
        // CSS. (This copies the behavior of vue-loader.)
        this.scopeId = "data-v-" + hash(this.targetSourcePath);

        this.compilerSettings = settings.vuejsCompilerSettings;
    }

    build(donefn,errfn) {
        const targets = [];

        // Parse the SFC target into its components.
        const components = vuejsCompiler.parseComponent(this.target.content,this.compilerSettings);

        if (!components.script || !components.script.content) {
            throw new Error(
                format(
                    "vuejs: target component '%s' must have a <script> section",
                    this.target.targetName
                )
            );
        }

        // Compile the <template> section into render function object (if any).
        let renderInfo;
        if (components.template) {
            renderInfo = compileTemplate(components.template);
        }

        // Create style targets from the <style> section(s).
        const styleTargets = this.createStyleTargets(components.styles);

        // Add import references to script content for styles.
        const styleImports = makeStyleImports(styleTargets);
        const scriptContent = format("%s\n%s\n",components.script.content,styleImports);

        // Create new JavaScript target that combines the render function (if
        // any) and <script>.
        const scriptTarget = this.createScriptTarget(scriptContent,renderInfo,styleTargets.length > 0);

        targets.push(scriptTarget);
        styleTargets.forEach((target) => targets.push(target));

        donefn(targets);
    }

    createScriptTarget(scriptContent,renderInfo,hasStyles) {
        const scriptTarget = this.target.makeOutputTarget(this.target.targetName + ".js");
        let content = format("// Compiled from %s\n",this.targetSourcePath);

        let transform
        if (!renderInfo && !hasStyles) {
            transform = {
                code: scriptContent
            };
        }
        else {
            transform = babel.transformSync(scriptContent,{
                plugins: [
                    [plugin_transform_script_target,{ renderInfo,hasStyles,scopeId:this.scopeId }]
                ]
            });
        }

        content += transform.code.trim() + "\n";

        scriptTarget.stream.end(content);
        return scriptTarget;
    }

    createStyleTargets(styleInfoList) {
        const resultMap = {};
        const resultList = [];

        for (let i = 0;i < styleInfoList.length;++i) {
            let ext;
            const styleInfo = styleInfoList[i];
            const lang = styleInfo.lang || "css";

            if (lang == "css") {
                const opts = {
                    source: styleInfo.content,
                    scoped: !!styleInfo.attrs.scoped,
                    id: this.scopeId,
                    trim: true
                };

                const { code, map, errors } = compileStyle(opts);

                if (errors.length) {
                    throw errors[0];
                }

                styleInfo.content = code;
                styleInfo.map = map;

                ext = "css";
            }
            else if (lang == "scss") {
                ext = "scss";
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
                resultMap[ext] = format("/* Compiled from %s */\n",this.targetSourcePath);
                resultList.push(ext);
            }
            resultMap[ext] += styleInfo.content;
        }

        // Use the result list order to create the targets.
        return resultList.map((ext) => {
            const newName = format("%s.%s",this.target.targetName,ext);
            const styleTarget = this.target.makeOutputTarget(newName);

            styleTarget.stream.end(resultMap[ext]);
            return styleTarget;
        });
    }
}

module.exports = {
    VueBuilder
};
