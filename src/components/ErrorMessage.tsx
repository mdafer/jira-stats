import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
    message: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
    return (
        <div className="card" style={{ background: '#450a0a', border: '1px solid #991b1b', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#fca5a5' }}>
                <AlertCircle size={20} />
                <p>API Error: {message}</p>
            </div>
        </div>
    );
};

export default ErrorMessage;
