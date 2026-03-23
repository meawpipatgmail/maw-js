import React, { ComponentProps } from 'react';
import { AutosizeTextarea } from './AutosizeTextarea';

export const OVERLAY_COMMANDS = ['/wake', '/sleep', '/hey', '/recap', '/rrr', '/forward', '/workon', '/awaken'];

// Accent color used for command highlighting
const ACCENT = '#89b4fa';

interface CommandOverlayProps {
  message: string;
  matchedCommand?: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

const CommandOverlay: React.FC<CommandOverlayProps> = ({ message, matchedCommand, scrollRef }) => {
  if (!matchedCommand) return null;
  return (
    <div
      ref={scrollRef}
      className="absolute inset-0 w-full h-full px-3 py-1.5 pointer-events-none whitespace-pre-wrap break-words font-mono text-[13px] z-0 overflow-hidden"
      style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 'inherit' }}
      aria-hidden="true"
    >
      <span style={{ color: ACCENT }}>
        {message.substring(0, matchedCommand.length + 1)}
      </span>
      <span>{message.substring(matchedCommand.length + 1)}</span>
    </div>
  );
};

interface CommandAwareInputProps extends ComponentProps<typeof AutosizeTextarea> {
  value: string;
}

export const CommandAwareInput = React.forwardRef<HTMLTextAreaElement, CommandAwareInputProps>(
  ({ className, value, ...props }, ref) => {
    const message = value || '';
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const overlayRef = React.useRef<HTMLDivElement>(null);

    // Forward ref support
    React.useImperativeHandle(ref, () => textareaRef.current!);

    const matchedCommand = React.useMemo(() => {
      const normalized = message.toLowerCase();
      return OVERLAY_COMMANDS.find(cmd => normalized.startsWith(cmd + ' ') || normalized === cmd);
    }, [message]);

    React.useLayoutEffect(() => {
      if (overlayRef.current && textareaRef.current) {
        overlayRef.current.scrollTop = textareaRef.current.scrollTop;
        overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    });

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (overlayRef.current) {
        overlayRef.current.scrollTop = e.currentTarget.scrollTop;
        overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
      props.onScroll?.(e);
    };

    return (
      <div className="flex-1 min-w-0 relative">
        <CommandOverlay message={message} matchedCommand={matchedCommand} scrollRef={overlayRef} />
        <AutosizeTextarea
          ref={textareaRef}
          className={`w-full bg-transparent font-mono text-[13px] outline-none border-none px-3 py-1.5 placeholder:text-white/20 ${matchedCommand ? 'text-transparent' : 'text-white/90'} ${className || ''}`}
          value={message}
          onScroll={handleScroll}
          {...props}
        />
      </div>
    );
  }
);

CommandAwareInput.displayName = 'CommandAwareInput';
