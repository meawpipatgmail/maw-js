import * as React from 'react';

export type AutosizeTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> & {
  minRows?: number;
  maxRows?: number;
};

function setRef<T>(ref: React.ForwardedRef<T>, value: T) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref && typeof (ref as any) === 'object') {
    (ref as any).current = value;
  }
}

export const AutosizeTextarea = React.forwardRef<HTMLTextAreaElement, AutosizeTextareaProps>(
  ({ minRows = 1, maxRows = 6, className = '', onChange, onInput, style, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;

      el.style.height = 'auto';

      const computed = window.getComputedStyle(el);
      const lineHeight = parseFloat(computed.lineHeight || '0') || 20;
      const paddingY = parseFloat(computed.paddingTop || '0') + parseFloat(computed.paddingBottom || '0');
      const borderY = parseFloat(computed.borderTopWidth || '0') + parseFloat(computed.borderBottomWidth || '0');
      const maxHeight = (maxRows ? lineHeight * maxRows : Infinity) + paddingY + borderY;

      const next = Math.min(el.scrollHeight, maxHeight);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > next ? 'auto' : 'hidden';
    }, [maxRows]);

    React.useLayoutEffect(() => {
      resize();
    }, [props.value, resize]);

    React.useEffect(() => {
      const handler = () => resize();
      window.addEventListener('resize', handler);
      return () => window.removeEventListener('resize', handler);
    }, [resize]);

    const handleInput: React.FormEventHandler<HTMLTextAreaElement> = (e) => {
      resize();
      onInput?.(e);
    };

    const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
      onChange?.(e);
      resize();
    };

    return (
      <textarea
        {...props}
        ref={(node) => {
          innerRef.current = node;
          setRef(forwardedRef, node);
        }}
        rows={minRows}
        className={`overflow-hidden resize-none ${className}`}
        onInput={handleInput}
        onChange={handleChange}
        style={style}
      />
    );
  }
);

AutosizeTextarea.displayName = 'AutosizeTextarea';
