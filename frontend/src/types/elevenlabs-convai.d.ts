import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        'agent-id'?: string;
        /** UUID del deal MEDDPICC; ElevenLabs lo envía como `user_id` en el webhook (alternativa fiable a `deal_id` en dynamic-variables). */
        'user-id'?: string;
        'dynamic-variables'?: string;
        'override-first-message'?: string;
        'override-language'?: string;
        /** Ver docs widget: conversationStarted, conversationEnded */
        startConversation?: () => void;
        endConversation?: () => void;
      };
    }
  }
}
