import container from 'markdown-it-container/dist/markdown-it-container.min';
import Replacer from './lib/index';
import reactBlockRule from './lib/react_block';
import { react_inline } from './lib/react_inline';

export const SupportReactComponent = (md, options) => {
  md.use(...createContainer('rc', options, '`'));
  md.use(...createContainer('mixin-react', options, '`'));

  // react_block
  md.block.ruler.before('html_block','react_block',reactBlockRule,[ 'paragraph', 'reference', 'blockquote' ]);
  md.renderer.rules.react_block = function (tokens, idx) {
    const code = `\`\`\` mixin-react
return (${tokens[idx].content})
\`\`\``;
    // console.log('code',code)
    return md.render(code);
  };

  // react_inline
  md.inline.ruler.before('html_inline','react_inline',react_inline);
  const replacer = new Replacer(options);
  md.renderer.rules.react_inline = function (tokens, idx) {
    let wrapperId = 'rc' + Math.random().toString(36).substr(2, 10);

    const code = `return (${tokens[idx].content})`;
    return replacer.getHtml(wrapperId, code);
  };
};

function createContainer (klass, options, marker = ':') {
  const replacer = new Replacer(options);
  return [container, klass, {
    render (tokens, idx,_options,env) {
      const token = tokens[idx];
      // const info = token.info.trim().slice(klass.length).trim();
      if (token.nesting === 1) {
        // Todo:Inject env variable to instance sandbox
        if (typeof env.mdRefs === 'object' && typeof replacer.sandbox === 'object') {
          replacer.sandbox.mdRefs = env.mdRefs;
        }
        let wrapperId = 'rc' + Math.random().toString(36).substr(2, 10);

        try {
          const offset = tokens.slice(idx).findIndex(token => token.type === `container_${klass}_close`);
          let str = tokens.slice(idx,idx + offset).reduce((pre,cur)=>{
            return pre + '\n' + cur.content;
          },'');
          const html = replacer.getHtml(wrapperId, str);
          return `<div class="${klass}" style="opacity: 0" id="${wrapperId}">${html}`;
        } catch (e) {
          if (options && options.allowErrorLog) console.log(e);
          return `<div class="${klass}" style="opacity: 0" id="${wrapperId}">`;
        }
      } else {
        return '</div>\n';
      }
    },
    marker
  }];
}