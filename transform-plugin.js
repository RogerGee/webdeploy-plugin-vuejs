/**
 * transform-plugin.js
 *
 * vuejs (webdeploy plugin)
 *
 * Copyright (C) Roger Gee, et al.
 */

module.exports = function(babel) {
    const { types:t } = babel;

    function firstExpr(file) {
        var node = file.program.body[0];

        if (t.isFunctionDeclaration(node)) {
            node = t.functionExpression(node.id,node.params,node.body,node.generator,node.async);
        }
        else if (t.isExpressionStatement(node)) {
            node = node.expression;
        }

        return node;
    }

    return {
        name: 'VueJsTransformPlugin',

        visitor: {
            // Transforms the default declaration to inject the extra properties
            // from the vue component file.
            ExportDefaultDeclaration(path,state) {
                const decl = path.node.declaration;
                const { renderInfo, hasStyles, scopeId } = state.opts;

                var props = {};
                if (renderInfo) {
                    props['render'] = firstExpr(
                        babel.parseSync(renderInfo.render)
                    );
                    props['staticRenderFns'] = firstExpr(
                        babel.parseSync(renderInfo.staticRenderFns)
                    );
                    props['functional'] = t.booleanLiteral(renderInfo.isFunctional);
                    props['_compiled'] = t.booleanLiteral(true);
                }
                if (hasStyles) {
                    // Add the generated scope ID to the component
                    // properties. This is not documented in Vue.js API;
                    // however, looking at the source, it is apparent that a
                    // _scopeId property is used for applying the scope ID to
                    // components.

                    props['_scopeId'] = t.stringLiteral(scopeId);
                }

                if (t.isObjectExpression(decl)) {
                    Object.keys(props).forEach((prop) => {
                        decl.properties.push(
                            t.objectProperty(t.identifier(prop),props[prop])
                        );
                    });
                }
                else if (t.isIdentifier(decl)) {
                    var nodes = [];

                    Object.keys(props).forEach((prop) => {
                        nodes.push(
                            t.expressionStatement(
                                t.assignmentExpression(
                                    '=',
                                    t.memberExpression(decl,t.identifier(prop)),
                                    props[prop]
                                )
                            )
                        );
                    });
                    nodes.push(path.node)

                    path.replaceWithMultiple(nodes);
                }
                else {
                    throw new Error("Vue component <script> export cannot be " + decl.type);
                }
            }
        }
    };
};
