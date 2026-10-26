import { fixupPluginRules } from '@eslint/compat';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const plugin = fixupPluginRules(jsxA11y);
const headingRule = plugin.rules['heading-has-content'];

// The installed legacy rule recognizes Literal but not the current JSXText AST node.
// Normalize only its visitor input; leave the source AST and all other rules intact.
export const accessibleJsxPlugin = {
  ...plugin,
  rules: {
    ...plugin.rules,
    'heading-has-content': {
      ...headingRule,
      create(context) {
        const listeners = headingRule.create(context);
        return {
          ...listeners,
          JSXOpeningElement(node) {
            const compatibleParent = {
              ...node.parent,
              children: node.parent.children.map((child) =>
                child.type === 'JSXText' ? { ...child, type: 'Literal' } : child,
              ),
            };
            listeners.JSXOpeningElement({ ...node, parent: compatibleParent });
          },
        };
      },
    },
  },
};
