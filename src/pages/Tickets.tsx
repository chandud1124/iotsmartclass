import React from 'react';
import TicketList from '@/components/TicketList';

const Tickets: React.FC = () => {
    return (
        <div className="container mx-auto p-6">
            <TicketList />
        </div>
    );
};

export default Tickets;
