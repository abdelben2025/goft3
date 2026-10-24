import React, { useState, useEffect, useRef, useMemo } from 'react';

interface Option {
    value: string | number;
    label: string;
}

interface CustomDropdownProps {
    options: Option[];
    value: string | number;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    enableSearch?: boolean;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ options, value, onChange, placeholder, disabled, className, enableSearch = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    useEffect(() => {
        if (isOpen && enableSearch && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen, enableSearch]);

    const selectedOption = options.find(opt => String(opt.value) === String(value));

    const filteredOptions = useMemo(() => {
        return options.filter(option => 
            option.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    return (
        <div className={`relative ${isOpen ? 'z-30' : 'z-10'} ${className || ''}`} ref={wrapperRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`relative w-full h-8 text-center px-3 py-2 border border-blue-200 rounded-[20px] shadow-sm text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-sky-400 flex justify-between items-center ${disabled ? 'bg-gray-200 cursor-not-allowed text-gray-500 border-gray-300' : 'bg-gray-50 border-gray-300 cursor-pointer text-center text-gray-700'}`}
            >
                <span className="block truncate ml-4 text-center" title={selectedOption ? selectedOption.label : placeholder || 'اختر...'}>
                    {selectedOption ? selectedOption.label : placeholder || 'اختر...'}
                </span>
                <span className="flex items-center pointer-events-none">
                    <i className="bi bi-chevron-down text-gray-400 text-center"></i>
                </span>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white shadow-lg rounded-md py-1 text-base text-center ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {enableSearch && (
                        <div className="px-3 py-2 border-b border-gray-100">
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="w-full px-2 py-1 text-black border border-sky-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400 text-center"
                                placeholder="بحث..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                    <ul className="max-h-[250px] overflow-y-auto">
                        {placeholder && !searchTerm && (
                             <li
                                className="text-gray-900 cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-sky-400 hover:text-white text-center"
                                onClick={() => { onChange(''); setIsOpen(false); setSearchTerm(''); }}
                            >
                                <span className={`block truncate ${value === '' ? 'font-semibold' : 'font-normal'}`}>
                                    {placeholder}
                                </span>
                            </li>
                        )}
                        {filteredOptions.map((option) => (
                            <li
                                key={option.value}
                                className="text-gray-900 cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-sky-400 hover:text-white text-center group"
                                onClick={() => { onChange(String(option.value)); setIsOpen(false); setSearchTerm(''); }}
                            >
                                <span className={`block truncate ${String(value) === String(option.value) ? 'font-semibold' : 'font-normal'}`} title={option.label}>
                                    {option.label}
                                </span>
                                {String(value) === String(option.value) && (
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-sky-400 group-hover:text-white">
                                        <i className="bi bi-check-lg"></i>
                                    </span>
                                )}
                            </li>
                        ))}
                        {filteredOptions.length === 0 && (
                            <li className="text-gray-500 cursor-default select-none relative py-2 pl-3 pr-9 text-center">
                                لا توجد نتائج
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default CustomDropdown;