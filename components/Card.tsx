
import React from 'react';

interface CardProps {
    title: string;
    value: string;
    icon: string;
    color: string;
    compact?: boolean;
    isLargeValue?: boolean;
}

const Card: React.FC<CardProps> = ({ title, value, icon, color, compact, isLargeValue }) => {
    return (
        <div className={`bg-white ${compact ? 'p-1 h-11' : 'p-3 h-16'} rounded-lg shadow-sm border border-gray-100 flex items-center overflow-hidden`}>
            <div className={`${compact ? 'p-1' : 'p-2'} rounded-lg ${color} shrink-0`}>
                <i className={`${icon} text-white ${compact ? 'text-xs' : 'text-xl'}`}></i>
            </div>
            <div className={`${compact ? 'mr-1' : 'mr-3'} overflow-hidden min-w-0`}>
                <p className="text-gray-500 text-[8px] font-bold truncate uppercase">{title}</p>
                <p className={`${isLargeValue ? 'text-base' : (compact ? 'text-[10px]' : 'text-sm')} font-black text-gray-800 leading-tight whitespace-pre-line truncate`}>{value}</p>
            </div>
        </div>
    );
};

export default Card;
