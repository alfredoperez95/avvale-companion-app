'use client';

import {
  createElement,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ElementType,
  type ReactNode,
} from 'react';

type CssPropertyMap = Record<string, string | number | null | undefined>;

type CssStyledProps = {
  as?: ElementType;
  cssProperties: CssPropertyMap;
  children?: ReactNode;
  [key: string]: unknown;
};

function toKebabCase(property: string): string {
  return property.startsWith('--') ? property : property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

export const CssStyled = forwardRef<HTMLElement, CssStyledProps>(function CssStyled(
  { as = 'div', cssProperties, children, ...props },
  forwardedRef,
) {
  const ref = useRef<HTMLElement | null>(null);

  useImperativeHandle(forwardedRef, () => ref.current as HTMLElement, []);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    for (const [property, rawValue] of Object.entries(cssProperties as CssPropertyMap)) {
      if (rawValue === null || rawValue === undefined) {
        node.style.removeProperty(toKebabCase(property));
        continue;
      }
      node.style.setProperty(toKebabCase(property), String(rawValue));
    }
  }, [cssProperties]);

  return createElement(as as ElementType, { ...(props as Record<string, unknown>), ref }, children as ReactNode);
});
