
import React, { useEffect, useState, useRef } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
    closeOnOverlay?: boolean;
    hideCloseButton?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = '2xl', closeOnOverlay = true, hideCloseButton = false }) => {
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const modalContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    // Focus treatment when modal opens
    useEffect(() => {
        if (isOpen) {
            window.focus();
            setTimeout(() => {
                if (modalContentRef.current) {
                    // Find first editable input element inside the modal
                    const inputs = modalContentRef.current.querySelectorAll('input:not([disabled]), textarea:not([disabled]), select:not([disabled])');
                    if (inputs.length > 0) {
                        (inputs[0] as HTMLElement).focus();
                    } else {
                        const buttons = modalContentRef.current.querySelectorAll('button:not([disabled]), [tabindex="0"]');
                        const target = Array.from(buttons).find(b => b.getAttribute('aria-label') !== 'Close modal') || buttons[0];
                        if (target) {
                            (target as HTMLElement).focus();
                        } else {
                            modalContentRef.current.focus();
                        }
                    }
                }
            }, 60);
        } else {
            setOffset({ x: 0, y: 0 });
            setIsDragging(false);
        }
    }, [isOpen]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // Only drag with left/main click

        const target = e.target as HTMLElement;
        // Don't drag if clicking buttons, inputs, anchor tags or close symbols in header
        if (
            target.tagName === 'BUTTON' || 
            target.closest('button') || 
            target.tagName === 'INPUT' || 
            target.tagName === 'A' || 
            target.tagName === 'TEXTAREA' || 
            target.tagName === 'SELECT'
        ) {
            return;
        }

        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - offset.x,
            y: e.clientY - offset.y
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const newX = e.clientX - dragStart.current.x;
        const newY = e.clientY - dragStart.current.y;
        setOffset({ x: newX, y: newY });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // Compact slightly reduced sizes
    const maxWidthClasses = {
        'sm': 'max-w-xs',
        'md': 'max-w-sm',
        'lg': 'max-w-md',
        'xl': 'max-w-lg',
        '2xl': 'max-w-xl',
        '3xl': 'max-w-2xl',
        '4xl': 'max-w-3xl',
        '5xl': 'max-w-4xl',
        '6xl': 'max-w-5xl',
        '7xl': 'max-w-6xl',
        'full': 'max-w-full'
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex justify-center items-center p-4 overflow-hidden"
            onClick={closeOnOverlay ? onClose : undefined}
            aria-modal="true"
            role="dialog"
        >
            <div 
                ref={modalContentRef}
                tabIndex={-1}
                className={`bg-white rounded-lg shadow-xl w-full ${maxWidthClasses[maxWidth]} max-h-[85vh] flex flex-col relative overflow-hidden select-text outline-none`}
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    cursor: isDragging ? 'grabbing' : 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div 
                    className="flex justify-between items-center border-b p-3 sm:p-4 shrink-0 bg-gray-50 select-none cursor-grab active:cursor-grabbing"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    <h3 className="text-md sm:text-lg font-bold text-gray-800">{title}</h3>
                    {!hideCloseButton && (
                        <button 
                            onClick={onClose} 
                            className="text-gray-500 hover:text-gray-800 text-2xl leading-none px-2 focus:outline-none" 
                            aria-label="Close modal"
                        >
                            &times;
                        </button>
                    )}
                </div>
                <div className="p-4 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
