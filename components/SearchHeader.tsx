import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface SearchHeaderProps {
    title: string;
    isActive: boolean;
    children: React.ReactNode;
    tooltip?: string;
}

const SearchHeader: React.FC<SearchHeaderProps> = ({ title, isActive, children, tooltip }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-center gap-1">
                <span>{title}</span>
                <button
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                    className={`p-0.5 rounded-[20px] bg-blue-100 transition-colors ${isOpen || isActive ? 'bg-blue-300 text-blue-600' : 'hover:bg-blue-200 text-gray-400'}`}
                    title={tooltip}
                >
                    <Search size={10} />
                </button>
            </div>
            {(isOpen || isActive) && children}
        </div>
    );
};

export default SearchHeader;
