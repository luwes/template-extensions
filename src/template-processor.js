/* global AttrPart */

export const defaultProcessor = {
  processCallback(instance, parts, state) {
    if (!state) return;
    for (const [expression, part] of parts) {
      if (expression in state) {
        const value = state[expression];
        // boolean attr
        if (
          typeof value === 'boolean' &&
          part instanceof AttrPart &&
          typeof part.element[part.attributeName] === 'boolean'
        ) {
          part.booleanValue = value;
        } else if (typeof value === 'function' && part instanceof AttrPart) {
          part.element[part.attributeName] = value;
        } else {
          part.value = value;
        }
      }
    }
  },
};
