import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ui5-busy-indicator': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        active?: boolean;
        delay?: number | string;
      };
    }
  }
}
