(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('markdown-it-container'), require('react'), require('react-dom'), require('react-dom/server'), require('babel-standalone')) :
  typeof define === 'function' && define.amd ? define(['exports', 'markdown-it-container', 'react', 'react-dom', 'react-dom/server', 'babel-standalone'], factory) :
  (global = global || self, factory(global.replacer = {}, global.container, global.React, global.ReactDOM, global.ReactDOMServer, global.babel));
}(this, function (exports, container, React, ReactDOM, ReactDOMServer, babel) { 'use strict';

  container = container && container.hasOwnProperty('default') ? container['default'] : container;
  React = React && React.hasOwnProperty('default') ? React['default'] : React;
  ReactDOM = ReactDOM && ReactDOM.hasOwnProperty('default') ? ReactDOM['default'] : ReactDOM;
  ReactDOMServer = ReactDOMServer && ReactDOMServer.hasOwnProperty('default') ? ReactDOMServer['default'] : ReactDOMServer;

  const babelTransformOptions = {
    presets: ['stage-3', 'react', 'es2015'],
    plugins: ['filterXSS']
  };

  function filterXSS() {
    return {
      visitor: {
        Identifier(path) {
          if (path.isIdentifier({ name: 'constructor' })) {
            // console.warn('constructor xss');
            path.node.name = 'x';
          }
          else if (window[path.node.name]) {
            path.node.name = 'x';
          }
        },
        // Function traverse
        FunctionExpression(path) {
          path.traverse({
            ThisExpression(path) {
              // console.warn('FunctionExpression xss');
              path.remove();
            },
          });
        },
        FunctionDeclaration(path) {
          const funcName = path.node.id.name;

          if (funcName !== 'YMGGKLK') {
            path.traverse({
              ThisExpression(path) {
                // console.warn('FunctionDeclaration xss');
                path.remove();
              },
            });
          }
        },
        ThisExpression() {
          // console.log('this');
        },
      }
    };
  }

  // compile javascript code with sandbox
  function compileCode(code) {
    code = 'with (sandbox) {' + code + '}';
    const fn = new Function('sandbox', code);
    return (sandbox) => {
      const proxy = new Proxy(sandbox, {
        has() {
          return true; // cheet prop
        },
        get(target, key, receiver) {
          // protect escape
          if (key === Symbol.unscopables) {
            return undefined;
          }
          return Reflect.get(target, key, receiver);
        }
      });
      return fn(proxy);
    };
  }

  // render react code to dom
  function renderReact(wrapperId, reactCode, sandbox) {
    const __container = document.getElementById(wrapperId);
    if (!__container) {
      return;
    }

    const newSandbox = {
      ...sandbox,
      __container,
    };
    const func = compileCode(reactCode);
    func(newSandbox);
    // style resume
    __container.style.opacity = 1;
  }

  const NOOP = () => {
  };
  class Replacer {
    constructor(options = {}) {
      if (options.sandbox && typeof options.sandbox !== 'object') {
        throw Error('sandbox must be object!');
      }
      if (options.babelInit && typeof options.babelInit !== 'function') {
        throw Error('babelInit must be function!');
      }
      this._init(options);
    }

    _init({
      babelInit = NOOP,
      sandbox = {},
      babelOptions,
      enableSSR = true
    }) {
      babel.registerPlugin('filterXSS', filterXSS);
      babelInit(babel);
      this.babel = babel;
      this.babelOptions = {
        ...babelTransformOptions,
        ...babelOptions
      };
      this.sandbox = {
        React,
        ReactDOM,
        NULL: Object.create(null),
        ReactDOMServer,
        ...sandbox
      };
      this.enableSSR = enableSSR;
    }

    _replace({
      str,
      wrapperId,
      lang,
    }) {
      if (lang === 'mixin-react') {
        return this._replacerReact(str, wrapperId);
      }
      return str;
    }

    // get html of react code
    _replacerReact(code, wrapperId) {
      const reactCode = `function YMGGKLK(props) { ${code} }
                  ReactDOM.hydrate(YMGGKLK.call(NULL),__container)
                  `;

      const finalCode  = this._transReactCode(reactCode);
      const html = this.enableSSR ? this._codeToHtml(wrapperId, code) : '<div></div>';

      setTimeout(renderReact.bind(null, wrapperId, finalCode, this.sandbox), 0);

      return html;
    }

    // pre-render HTML
    _codeToHtml(wrapperId, code) {
      const reactCode = `function YMGGKLK(props) { ${code} }
                  Html["${wrapperId}"] = ReactDOMServer.renderToStaticMarkup(YMGGKLK.call(NULL))
                  `;
      const Html = {};
      const newSandbox = {
        ...this.sandbox,
        Html
      };
      const func = compileCode(this._transReactCode(reactCode));
      func(newSandbox);
      return Html[wrapperId];
    }

    // use babel translation react code
    _transReactCode(code) {
      const rst = this.babel.transform(code, this.babelOptions);

      return rst.code;
    }

    getHtml(wrapperId,str,lang = 'mixin-react') {
      const html = this._replace({
        str,
        wrapperId,
        lang,
      });
      return html;
    }
  }

  const SupportReactComponent = (md, options) => {
    md.use(...createContainer('rc', options, '`'));
    md.use(...createContainer('mixin-react', options, '`'));
  };

  function createContainer (klass, options, marker = ':') {
    const replacer = new Replacer(options);
    return [container, klass, {
      render (tokens, idx) {
        const token = tokens[idx];
        // const info = token.info.trim().slice(klass.length).trim();
        if (token.nesting === 1) {
          let wrapperId = 'rc' + Math.random().toString(36).substr(2, 10);

          const offset = tokens.slice(idx).findIndex(token => token.type === `container_${klass}_close`);
          let str = tokens.slice(idx,idx + offset).reduce((pre,cur)=>{
            return pre + '\n' + cur.content;
          },'');
          const html = replacer.getHtml(wrapperId, str);
          return `<div class="${klass}" style="opacity: 0" id="${wrapperId}">${html}`;
        } else {
          return '</div>\n';
        }
      },
      marker
    }];
  }

  exports.SupportReactComponent = SupportReactComponent;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
