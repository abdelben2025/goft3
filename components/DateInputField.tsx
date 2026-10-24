import React from 'react';

interface DateInputFieldProps {
    value: string;
    onChange: (value: string) => void;
    label: string;
    required?: boolean;
    id?: string;
    className?: string;
    min?: string;
    max?: string;
}

export const DateInputField: React.FC<DateInputFieldProps> = ({ value, onChange, label, required, id, className, min, max }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        // Allow numbers and slashes
        val = val.replace(/[^0-9/]/g, '');
        
        // Simple auto-slash logic
        if (val.length === 2 && !value.endsWith('/')) val += '/';
        if (val.length === 5 && !value.endsWith('/')) val += '/';
        
        // Limit length
        if (val.length > 10) val = val.substring(0, 10);

        onChange(val);
    };

    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 text-center">{label}</label>
            <input
                type="text"
                id={id}
                value={value}
                onChange={handleChange}
                placeholder="DD/MM/YYYY"
                required={required}
                min={min}
                max={max}
                className={className || "w-full h-9 px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] text-center"}
                style={{ direction: 'ltr' }} // Force LTR so dates like 20/10/2023 don't get scrambled visually in RTL context
            />
        </div>
    );
};