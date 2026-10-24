import React from 'react';
import Modal from './Modal';

interface ConfirmActionModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
    isOpen,
    title = 'تأكيد الحذف',
    message,
    confirmLabel = 'نعم، احذف',
    cancelLabel = 'إلغاء',
    danger = true,
    onConfirm,
    onCancel,
}) => {
    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            maxWidth="md"
            closeOnOverlay={false}
            hideCloseButton
        >
            <div className="p-4 text-center space-y-4">
                <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
                    <i className={`bi ${danger ? 'bi-exclamation-triangle-fill text-red-600' : 'bi-question-circle-fill text-amber-600'} text-2xl`}></i>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed font-semibold">{message}</p>
                <div className="flex gap-3 justify-center pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-5 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-bold transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-5 py-2 rounded-lg text-white text-sm font-bold transition-colors ${danger
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ConfirmActionModal;
