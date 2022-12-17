export function renderTree(node) {

  if (node.nodeName === '#comment') {
    return `<!--${esc(node.nodeValue)}-->`;
  }

  let { nodeName, attributes, childNodes } = node;

  if (nodeName === '#document-fragment') {
    return childNodes.flatMap(renderTree).join('');
  }

  if (nodeName) {
    attributes = toAttributes(attributes);

    let pairs = Object.keys(attributes).map((k) => {
      return esc(k) + '="' + esc(attributes[k]) + '"';
    });

    let open = nodeName;
    if (pairs.length > 0) {
      open += ' ' + pairs.join(' ');
    }

    return `<${open}>${childNodes.flatMap(renderTree).join('')}</${nodeName}>`;
  }

  if (Array.isArray(node)) {
    return node.map(renderTree).join('');
  }

  return node;
}

const DOM_PROPS = {
  className: 'class',
  htmlFor: 'for',
  httpEquiv: 'http-equiv',
};

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
};

function escMap(m) {
  return HTML_ESCAPES[m];
}

function esc(s) {
  s = '' + (s || '');
  return /[&<>"'`]/.test(s) ? s.replace(/[&<>"'`]/g, escMap) : s;
}

function toAttributes(props) {
  let attr = {};
  Object.keys(props).forEach(function (key) {
    let name = typeof DOM_PROPS[key] === 'string' ? DOM_PROPS[key] : key;
    let val = props[key];
    attr[name] = val === true ? '' : val;
  });
  return attr;
}
