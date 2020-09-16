# vuejs (webdeploy plugin)

> Build plugin that compiles Vue.js single-file component files

## Synopsis

This build plugin compiles `.vue` single-file component files. A single-file component target is split into one or more new targets, each representing a part of the component. The `<script>` section is converted into a JavaScript target ending in `.js`, and `<style>` sections are converted into style targets with an extension according to the style language (e.g. `.css`, `.scss`). If the component file provides a `<template>` section, then the compiled template info is injected into the default export of the `<script>` section.

Scripts in component files must use ES6 JavaScript modules for exporting the component object.

## Install

~~~
npm install --save-dev @webdeploy/plugin-vuejs vue-template-compiler
~~~

When installing this plugin, you should also install `vue-template-compiler` at the correct version required for your project.

## Plugin Settings

### `validateFileExtension`

- Required: `false`
- Default: `true`

Verifies that the input target file name has the `.vue` extension.

### `vuejsCompilerSettings`

- Required: `false`
- Default: `{ pad: "line" }`

Defines the settings object passed to the Vue.js compiler tools.

## Example Compilation

`a.vue`:
~~~
<template>
  <div class="hello">
    <div class="wrapper">
      <p :hidden="!show">Hello, World!</p>
    </div>
    <button @click="show = !show">{{ show ? 'Hide' : 'Show' }}</button>
  </div>
</template>

<script>
  export default {
    name: 'Hello',

    data: () => ({
        show: false
    })
  }
</script>

<style scoped>
  p {
    color: blue;
    font-size: 22px;
    padding: 7px;
    text-align: center;
  }

  button {
    width: 100%;
    padding: 8px 10px;
    font-size: 18px;
  }

  .wrapper {
    min-height: 48px;
  }
</style>
~~~

Target Output:
~~~
a.vue ⇒ a.vue.js
      ⇒ a.vue.css
~~~

`a.vue.js`:
~~~javascript
export default {
  name: 'Hello',
  data: () => ({
    show: false
  }),
  render: function render() {
    var _vm = this;

    var _h = _vm.$createElement;

    var _c = _vm._self._c || _h;

    return _c('div', {
      staticClass: "hello"
    }, [_c('div', {
      staticClass: "wrapper"
    }, [_c('p', {
      attrs: {
        "hidden": !_vm.show
      }
    }, [_vm._v("Hello, World!")])]), _vm._v(" "), _c('button', {
      on: {
        "click": function ($event) {
          _vm.show = !_vm.show;
        }
      }
    }, [_vm._v(_vm._s(_vm.show ? 'Hide' : 'Show'))])]);
  },
  staticRenderFns: [],
  functional: false,
  _compiled: true,
  _scopeId: "data-v-361a4bd2"
};
import './a.vue.css';
~~~

`a.vue.css`
~~~css
p[data-v-361a4bd2] {
  color: blue;
  font-size: 22px;
  padding: 7px;
  text-align: center;
}
button[data-v-361a4bd2] {
  width: 100%;
  padding: 8px 10px;
  font-size: 18px;
}
.wrapper[data-v-361a4bd2] {
  min-height: 48px;
}
~~~

