import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
  key?: React.Key;
}

export function TooltipWrapper({ content, children, className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  return (
    <div 
      className={cn("relative inline-block", className)}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPosition({ x: rect.left + rect.width / 2, y: rect.top });
        setIsVisible(true);
      }}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, x: '-50%' }}
            animate={{ opacity: 1, y: -5, x: '-50%' }}
            exit={{ opacity: 0, y: 5, x: '-50%' }}
            className="fixed z-[100] px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded shadow-lg pointer-events-none whitespace-nowrap"
            style={{ 
              left: position.x,
              top: position.y - 30
            }}
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
