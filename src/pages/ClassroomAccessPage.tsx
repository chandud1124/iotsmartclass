import React from 'react';
import { ClassroomAccessManager } from '@/components/ClassroomAccessManager';
import { RoleGuard } from '@/components/RoleGuard';

const ClassroomAccessPage: React.FC = () => {
    return (
        <RoleGuard roles={['admin', 'principal', 'dean', 'hod']}>
            <div className="container mx-auto p-6">
                <ClassroomAccessManager />
            </div>
        </RoleGuard>
    );
};

export default ClassroomAccessPage;